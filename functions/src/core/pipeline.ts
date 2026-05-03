/**
 * THALES ACADEMIC OS - AI PIPELINE CORE
 * Explicit stages for observability, retriability, and state management.
 */

import * as admin from 'firebase-admin';
import { GoogleGenAI, Schema } from "@google/genai";
import { rulesEngine, RawItem, WeeklyPlan, DayPlan } from './rulesEngine';
import { trackMetrics } from '../control/metrics';
import { generateWithControl } from '../ai/generator';

const db = admin.firestore();

export interface SystemConfig {
  model: "gemini-1.5-pro" | "gemini-1.5-flash";
  fallbackModel: "gemini-1.5-flash";
  promptVersion: string;
  temperature: number;
  maxTokens: number;
  rules: {
    enforceFridayMessage: boolean;
    requireResources: boolean;
    strictHomeworkLogic: boolean;
  };
  features: {
    enableCaching: boolean;
    enableDiffSync: boolean;
    enableAI: boolean;
  };
}

export interface PipelineOptions {
  userId: string;
  quarter: number;
  weekId: string;
  force?: boolean;
  targetDays?: string[];
  historicalContext?: any;
}

export class AiPipeline {
  private genAI: GoogleGenAI;
  private jobId: string;
  private userId: string;
  private config: SystemConfig;

  constructor(apiKey: string, jobId: string, userId: string, config: SystemConfig) {
    this.genAI = new GoogleGenAI(apiKey);
    this.jobId = jobId;
    this.userId = userId;
    this.config = config;
  }

  private async trackStep(step: string, startTime: number, extra: any = {}): Promise<void> {
    const duration = Date.now() - startTime;
    await db.collection("metrics").add({
      jobId: this.jobId,
      step,
      duration,
      ...extra,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  /**
   * STAGE 1: Parse Input
   * Deterministically extracts raw data into an intermediate representation.
   */
  async parseInput(rawText: string, quarter: number, weekId: string): Promise<any> {
    const start = Date.now();
    console.log(`[PIPELINE] Stage 1: Parsing Input`);
    let result: any;
    if (rawText.trim().startsWith('{')) {
      try {
        const json = JSON.parse(rawText);
        result = {
          course: json.course || "General",
          quarter: json.quarter || quarter || 1,
          week: json.week || weekId || "1",
          days: json.days || []
        };
      } catch (err) {
        console.warn("JSON parsing failed, falling back to deterministic parser", err);
      }
    }
    result = result || (rulesEngine as any).deterministicParse?.(rawText, quarter, weekId) || { days: [] };
    await this.trackStep('parseInput', start);
    return result;
  }

  /**
   * STAGE 2: Build Week Structure
   * Maps parsed items to a standard 5-day Thales week.
   */
  async buildWeekStructure(parsedItems: any): Promise<WeeklyPlan> {
    const start = Date.now();
    console.log(`[PIPELINE] Stage 2: Building Structure`);
    const result = (parsedItems.days && parsedItems.days.length > 0)
        ? parsedItems as WeeklyPlan
        : (rulesEngine as any).buildStructuralWeek?.([], "1", 1) || { weekId: "1", quarter: 1, days: [] };
    
    await this.trackStep('buildWeekStructure', start);
    return result;
  }

  /**
   * STAGE 3: Generate Day (AI Enrichment)
   * Enriches a specific day's lessons using Gemini. Includes Cache and Log hooks.
   */
  async generateDay(
    day: DayPlan, 
    courseInfo: string, 
    promptVersion: string,
    promptFn: (day: string, lessons: string, context: string) => string,
    schema: Schema,
    force: boolean = false,
    isRetry: boolean = false
  ): Promise<{ day: DayPlan; usage: any }> {
    const start = Date.now();
    console.log(`[PIPELINE] Stage 3: Generating Day - ${day.day}`);
    
    const lessonsToEnrich = day.lessons.filter((l: any) => {
      const isMissingContent = !(l.description && l.description.length > 20);
      return !l.manuallyEdited && (force || isMissingContent);
    }).map((l: any) => ({
      id: l.id || this.generateHash(`${day.day}_${l.subject}_${l.lessonTitle}`),
      subject: l.subject,
      lessonTitle: l.lessonTitle,
      currentDescription: l.description || ""
    }));

    if (lessonsToEnrich.length === 0) {
      console.log(`[PIPELINE] No enrichment needed for ${day.day}`);
      await this.trackStep('generateDay', start, { cacheHit: false, retries: 0 }); // Actually not enriched
      return { day, usage: null };
    }

    const dayInputHash = this.generateHash(JSON.stringify({
      course: courseInfo,
      day: day.day,
      lessons: lessonsToEnrich
    }));

    // 3a. Cache Check
    if (!force) {
      const cachedDay = await db.collection("generatedDays").doc(dayInputHash).get();
      if (cachedDay.exists()) {
        console.log(`[PIPELINE] Cache Hit: ${day.day}`);
        await this.trackStep('generateDay', start, { cacheHit: true, retries: 0 });
        return { day: { ...day, lessons: cachedDay.data()?.output || day.lessons }, usage: null };
      }
    }

    // 3b. AI Generation
    const prompt = promptFn(day.day, JSON.stringify(lessonsToEnrich), courseInfo);
    const enrichedResp = await generateWithControl(prompt, "generate", this.config, this.genAI, this.userId, schema, isRetry);
    
    const enrichedItems = enrichedResp.enrichedItems || [];
    
    // Usage metadata is tricky now because generateWithFallback hides it.
    // I need to update generateWithFallback to return usage or just calculate it differently.
    // For now, let's keep it simple: just get the enriched items.
    // Actually, I need to pass usage back, so I should update callGemini to return { content, usage }.
    const usage = enrichedResp.usage || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
    
    const synthesizedLessons = day.lessons.map((lesson: any) => {
      const item = enrichedItems.find((ei: any) => ei.id === lesson.id || ei.lessonTitle === lesson.lessonTitle);
      return item ? { ...lesson, ...item } : lesson;
    });

    const processedDay = { ...day, lessons: synthesizedLessons };

    // 3c. Logging Stage
    await db.collection("logs").add({
      jobId: this.jobId,
      step: "generateDay",
      promptVersion,
      day: day.day,
      input: { lessonsToEnrich, courseInfo },
      output: { enrichedItems, usage },
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    await this.trackStep('generateDay', start, { cacheHit: false, retries: 0, usage });
    return { day: processedDay, usage };
  }

  /**
   * STAGE 4: Validate Day
   * Checks structural integrity of a generated day.
   */
  async validateDay(day: DayPlan): Promise<boolean> {
    console.log(`[PIPELINE] Stage 4: Validating Day - ${day.day}`);
    return rulesEngine.validateDay(day);
  }

  /**
   * STAGE 5: Apply Rules
   * Deterministic academic logic application.
   */
  async applyRules(day: DayPlan): Promise<DayPlan> {
    console.log(`[PIPELINE] Stage 5: Applying Rules - ${day.day}`);
    return rulesEngine.applyDayRules(day);
  }

  /**
   * STAGE 6: Store
   * Persists the generated state for caching.
   */
  async store(
    day: DayPlan, 
    courseInfo: string, 
    lessonsToEnrich: any[], 
    promptVersion: string,
    output: any,
    usage: any
  ): Promise<void> {
    console.log(`[PIPELINE] Stage 6: Storing Day - ${day.day}`);
    const input = {
      course: courseInfo,
      day: day.day,
      lessons: lessonsToEnrich
    };
    const dayInputHash = this.generateHash(JSON.stringify(input));

    await db.collection("generatedDays").doc(dayInputHash).set({
      input,
      output,
      promptVersion,
      model: "gemini-1.5-flash",
      usage,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  /**
   * Orchestrates the processing for a single day.
   */
  async processDay(
    day: DayPlan,
    courseInfo: string,
    promptVersion: string,
    promptFn: (day: string, lessons: string, context: string) => string,
    schema: Schema,
    jobId: string,
    jobService: any,
    force: boolean = false,
    isRetry: boolean = false
  ): Promise<DayPlan> {
    console.log(`[PIPELINE] Processing Day: ${day.day}`);

    // STAGE 3: GENERATE DAY
    const { day: processedDay, usage } = await this.generateDay(day, courseInfo, promptVersion, promptFn, schema, force, isRetry);
    day = processedDay;

    // STAGE 4: VALIDATE DAY
    await jobService.updateStep(jobId, 'validate', 'running');
    const isValid = await this.validateDay(day);
    if (!isValid) {
      console.warn(`[PIPELINE] Validation failed for ${day.day}`);
      await jobService.updateStep(jobId, 'validate', 'failed');
    } else {
      await jobService.updateStep(jobId, 'validate', 'done');
    }

    // STAGE 5: APPLY RULES
    await jobService.updateStep(jobId, 'rules', 'running');
    day = await this.applyRules(day);
    await jobService.updateStep(jobId, 'rules', 'done');

    // STAGE 6: STORE (Cache for future)
    const lessonsToEnrich = day.lessons.filter((l: any) => !(l.description && l.description.length > 20));
    await this.store(day, courseInfo, lessonsToEnrich, promptVersion, day.lessons, usage);

    return day;
  }

  private generateHash(input: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(input).digest('hex');
  }
}
