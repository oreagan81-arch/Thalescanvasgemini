import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from 'firebase-admin';
import { GoogleGenAI } from "@google/genai";
import { Resend } from 'resend';
import * as crypto from 'crypto';
import { 
  PLANNER_SCHEMA, 
  PARSER_SCHEMA,
  ENRICHMENT_SCHEMA,
  getParserPrompt, 
  getEnrichmentPrompt,
  PROMPT_VERSION
} from './prompts';
import { rulesEngine } from './rulesEngine';
import { jobService, JobStatus } from './jobService';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const canvasApiToken = defineSecret('CANVAS_API_TOKEN');
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY || "");

/**
 * Never Crash Contract Wrapper
 */
const neverCrash = (handler: (request: CallableRequest<any>) => Promise<any>) => {
    return onCall(async (request: CallableRequest<any>) => {
        try {
            return await handler(request);
        } catch (error: any) {
            console.error("[CRITICAL FAILURE]", error);
            // Return a safe error structure instead of crashing
            return {
                success: false,
                error: error.message || "An unexpected system error occurred. Please retry.",
                timestamp: new Date().toISOString()
            };
        }
    });
};

async function canvasRequest(path: string, method: string, body: any, token: string) {
  const url = `https://thalesacademy.instructure.com/api/v1/${path}`;
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 2s, 4s, 8s...
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.log(`[CANVAS API] Retry attempt ${attempt} for ${path}. Waiting ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }

      const res = await fetch(url, {
        method,
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.ok) {
        return await res.json();
      }

      const status = res.status;
      const errorText = await res.text();
      lastError = new Error(`Canvas API error: ${status} ${errorText}`);

      // Retry on 429 (Rate Limit) or 5xx (Server Errors)
      if (status === 429 || (status >= 500 && status <= 599)) {
        console.warn(`[CANVAS API] Transient error ${status} on attempt ${attempt + 1}. Retrying...`);
        continue;
      }

      // Permanent errors (400 Bad Request, 401 Unauthorized, 404 Not Found) - do not retry
      throw lastError;

    } catch (error: any) {
      // If we threw inside the block (e.g. permanent error), re-throw immediately
      if (error.message.includes('Canvas API error')) {
        throw error;
      }

      // Network errors (fetch failures) are worth retrying
      lastError = error;
      console.error(`[CANVAS API] Network error on attempt ${attempt + 1}: ${error.message}`);
      if (attempt === maxRetries - 1) throw lastError;
    }
  }

  throw lastError || new Error(`Canvas API failed after ${maxRetries} attempts`);
}

/**
 * Generates a SHA-256 hash.
 */
function generateHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export const startAiPlanGeneration = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  
  const { rawText, existingState, historicalContext, weekId, quarter, targetDays, force } = request.data;
  if (!rawText) throw new HttpsError("invalid-argument", "Raw text is required.");

  const userId = request.auth.uid;
  // Hash includes context and targetDays for idempotency
  const inputHash = generateHash(`${userId}_${rawText}_${JSON.stringify(existingState || {})}_${JSON.stringify(historicalContext || {})}_${JSON.stringify(targetDays || [])}`);
  
  // 1. CACHE CHECK
  if (!force) {
    const existingJobSnap = await db.collection('jobs').doc(inputHash).get();
    if (existingJobSnap.exists()) {
      const jobData = existingJobSnap.data();
      if (jobData?.status === JobStatus.COMPLETED) {
        console.log(`[CACHE HIT] Returning existing result for ${inputHash}`);
        return { jobId: inputHash, status: JobStatus.COMPLETED, result: jobData.result };
      }
    }
  }

  const jobId = await jobService.getOrCreateJob(userId, 'AI_PLAN', request.data, { customId: inputHash });

  // Trigger processing asynchronously
  (async () => {
    await jobService.runProcessor(jobId, async (job) => {
      const intermediate = job.intermediateState || {};
      
      await jobService.updateProgress(jobId, { progress: 10 });
      
      // AGENT 1 & 2: PARSER & AUDITOR (Deterministic) - No AI, just structure extraction
      let structuralPlan = intermediate.structuralPlan;
      if (!structuralPlan) {
        await jobService.updateProgress(jobId, { progress: 20, intermediateState: { ...intermediate, step: 'PARSER' } });
        
        try {
          if (rawText.trim().startsWith('{')) {
            const json = JSON.parse(rawText);
            structuralPlan = {
              course: json.course || "General",
              quarter: json.quarter || quarter || 1,
              week: json.week || weekId || "1",
              days: json.days || []
            };
          } else {
            structuralPlan = rulesEngine.deterministicParse(rawText, quarter || 1, weekId);
          }
        } catch (err) {
          console.warn("Deterministic parser error, using empty shell", err);
          structuralPlan = { course: "Thales Curriculum", quarter: quarter || 1, weekId: weekId || "1", days: [] };
        }

        await jobService.updateProgress(jobId, { 
          progress: 35, 
          intermediateState: { ...intermediate, step: 'AUDIT', structuralPlan } 
        });

        await jobService.addLog(jobId, {
          step: 'PARSER_DETERMINISTIC',
          input: { rawTextLength: rawText.length },
          output: { structuralPlan }
        });
      }

      // AGENT 2: PLANNER (JS Rules Engine) - Structural integrity
      await jobService.updateProgress(jobId, { progress: 40 });
      
      if (existingState && existingState.days && !intermediate.structuralPlan) {
         structuralPlan.days = structuralPlan.days.map((day: any) => {
           const existingDay = existingState.days.find((d: any) => d.day === day.day);
           if (existingDay) {
             return existingDay;
           }
           return day;
         });
      }

      // AGENT 3: GENERATOR (Gemini Pro) - Deep academic content (DAY-LEVEL GENERATION)
      let enrichedPlan = intermediate.enrichedPlan || structuralPlan;
      
      if (!intermediate.enrichedPlan) {
        await jobService.updateProgress(jobId, { progress: 65 });
        const courseInfo = `${structuralPlan.course}, Quarter ${structuralPlan.quarter}, Week ${structuralPlan.weekId}`;
        
        /**
         * MASTER PIPELINE CONTROLLER: processWeek
         * Orchestrates Cache, AI, Validation, and Rules Enforcement.
         */
        const processWeek = async (plan: any) => {
          const results = [];
          
          for (let i = 0; i < plan.days.length; i++) {
            const day = plan.days[i];
            const isTargeted = targetDays && targetDays.length > 0 ? targetDays.includes(day.day) : true;
            
            if (!isTargeted) {
              results.push(rulesEngine.applyDayRules(day));
              continue;
            }

            try {
              // 1. Prepare Enrichment Target
              const lessonsToEnrich = day.lessons.filter((l: any) => {
                const isForced = targetDays && targetDays.includes(day.day);
                const isMissingContent = !(l.description && l.description.length > 20);
                return isForced || isMissingContent;
              }).map((l: any) => ({
                id: l.id || generateHash(`${day.day}_${l.subject}_${l.lessonTitle}`),
                subject: l.subject,
                lessonTitle: l.lessonTitle,
                currentDescription: l.description || ""
              }));

              if (lessonsToEnrich.length === 0) {
                results.push(rulesEngine.applyDayRules(day));
                continue;
              }

              const dayInputHash = generateHash(JSON.stringify({
                course: plan.course,
                quarter: plan.quarter,
                day: day.day,
                lessons: lessonsToEnrich
              }));

              // 2. CACHE CHECK
              const isForced = force || (targetDays && targetDays.includes(day.day));
              const cachedDay = await db.collection("generatedDays").doc(dayInputHash).get();
              let processedDay;

              if (cachedDay.exists() && !isForced) {
                console.log(`[PIPELINE] Cache Hit: ${day.day}`);
                processedDay = { ...day, lessons: cachedDay.data()?.lessons || day.lessons };
              } else {
                console.log(`[PIPELINE] Generation Start: ${day.day} (Forced: ${isForced})`);
                // 3. GENERATION
                const generatorModel = genAI.getGenerativeModel({ 
                  model: "gemini-1.5-flash", 
                  generationConfig: { responseMimeType: "application/json", responseSchema: ENRICHMENT_SCHEMA as any }
                });

                const generatorResult = await generatorModel.generateContent(getEnrichmentPrompt(day.day, JSON.stringify(lessonsToEnrich), courseInfo));
                const usage = generatorResult.response.usageMetadata;
                const enrichedResp = JSON.parse(generatorResult.response.text());
                const enrichedItems = enrichedResp.enrichedItems || [];
                
                const synthesizedLessons = day.lessons.map((lesson: any) => {
                  const item = enrichedItems.find((ei: any) => ei.id === lesson.id || ei.lessonTitle === lesson.lessonTitle);
                  return item ? { ...lesson, ...item } : lesson;
                });

                processedDay = { ...day, lessons: synthesizedLessons };

                // 4. OBSERVABILITY
                await db.collection("logs").add({
                  jobId,
                  userId: job.userId,
                  step: "generateDay",
                  promptVersion: PROMPT_VERSION,
                  day: day.day,
                  input: { lessonsToEnrich, courseInfo },
                  output: { enrichedItems, usage },
                  timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
              }

              // 5. ENFORCE SYSTEM RULES
              processedDay = rulesEngine.applyDayRules(processedDay);

              // 6. VALIDATION
              if (!rulesEngine.validateDay(processedDay)) {
                throw new Error("Validation Failure: Structural integrity compromised during synthesis.");
              }

              // 7. STORE (If generated)
              if (!cachedDay.exists()) {
                await db.collection("generatedDays").doc(dayInputHash).set({
                  lessons: processedDay.lessons,
                  promptVersion: PROMPT_VERSION,
                  createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
              }

              results.push(processedDay);
              
              // Progress tracking (Update every day in the loop)
              const dayProgress = 65 + Math.floor(((i + 1) / plan.days.length) * 20);
              await jobService.updateProgress(jobId, { progress: dayProgress });

            } catch (err: any) {
              console.error(`[PIPELINE FAILURE] ${day.day}`, err);
              results.push({ 
                ...day, 
                error: true, 
                message: `Pipeline Fault: ${err.message}` 
              });
            }
          }
          return results;
        };

        const enrichedDays = await processWeek(structuralPlan);
        enrichedPlan = { ...structuralPlan, days: enrichedDays };
        
        // Final Weekly Level Pass
        enrichedPlan = rulesEngine.applyHardRules(enrichedPlan);

        await jobService.addLog(jobId, {
          step: 'RULE_ENFORCER',
          input: { planDayCount: enrichedPlan.days.length },
          output: { status: 'rulesApplied' }
        });

        await jobService.updateProgress(jobId, { 
          progress: 85, 
          intermediateState: { ...intermediate, enrichedPlan } 
        });
      }

      // AGENT 4: VALIDATOR (JS Logic) - Rule enforcement
      await jobService.updateProgress(jobId, { progress: 90 });
      let finalPlan = rulesEngine.validateAgenda(enrichedPlan);
      const validation = rulesEngine.validateThalesRules(finalPlan);
      
      finalPlan.days = finalPlan.days.map((day: any) => ({
        ...day,
        lessons: (day.lessons || []).map((lesson: any) => ({
          ...lesson,
          lessonTitle: (lesson.lessonTitle || "TBD").replace(/Saxon|Shurley|SOTW/gi, 'Standard').trim(),
          lesson: lesson.lesson?.replace(/Saxon|Shurley|SOTW/gi, 'Standard').trim(), 
          objectives: (lesson.objectives || []).map((obj: string) => obj.replace(/Saxon|Shurley|SOTW/gi, 'Standard'))
        }))
      }));

      return finalPlan;
    });
  })();

  return { jobId };
});

export const getJobStatus = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  
  const { jobId } = request.data;
  if (!jobId) throw new HttpsError("invalid-argument", "jobId is required.");

  const jobSnap = await db.collection('jobs').doc(jobId).get();
  if (!jobSnap.exists()) {
    throw new HttpsError("not-found", `Job ${jobId} not found.`);
  }

  const jobData = jobSnap.data();
  return {
    id: jobData?.id,
    status: jobData?.status,
    progress: jobData?.progress,
    result: jobData?.result,
    error: jobData?.error,
    updatedAt: jobData?.updatedAt?.toDate().toISOString()
  };
});

export const startAnnouncementGeneration = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  
  const { weekId, settings, command, plannerRows } = request.data;
  const userId = request.auth.uid;
  const inputHash = generateHash(`ANN_${userId}_${weekId}_${command}_${JSON.stringify(plannerRows)}`);

  // Check cache
  const existingJobSnap = await db.collection('jobs').doc(inputHash).get();
  if (existingJobSnap.exists()) {
    const jobData = existingJobSnap.data();
    if (jobData?.status === JobStatus.COMPLETED) {
      return { jobId: inputHash, status: JobStatus.COMPLETED, result: jobData.result };
    }
  }

  const jobId = await jobService.getOrCreateJob(userId, 'AI_ANNOUNCEMENT', request.data, { customId: inputHash });

  // Background processing
  (async () => {
    await jobService.runProcessor(jobId, async (job) => {
      const { command, plannerRows, settings } = job.payload;
      
      await jobService.updateProgress(jobId, { progress: 20 });
      
      // Deterministic Preparation
      const mathTestNum = command.match(/math\s*test\s*(\d+)/i)?.[1];
      let curriculumContext = "";
      if (mathTestNum) {
         curriculumContext += `\nMath Test ${mathTestNum} detected.`;
      }
      
      await jobService.updateProgress(jobId, { progress: 40 });

      // AI Generation
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `
        TASK: Draft a parent announcement for Thales Academy.
        USER COMMAND: ${command}
        ACADEMIC CONTEXT: ${JSON.stringify(plannerRows)}
        TONE PREFERENCE: ${settings?.tone || 'Warm'}
        ${curriculumContext}
        
        RULES:
        - Use Cidi Labs dp-box and dp-header tags.
        - Friday Agenda Rule: Omit instructional sections on Fridays, focus on assessments.
        - Brevity Mandate: Strip all vendor names (Saxon, Shurley, etc).
        - Friday Rule: If today is Friday, keep it brief and celebratory.
      `;

      try {
        const result = await model.generateContent(prompt);
        const usage = result.response.usageMetadata;
        const text = result.response.text();

        await jobService.addLog(jobId, {
          step: 'AI_ANNOUNCEMENT_CONTENT',
          message: 'Neural Engine: Crafted announcement content.',
          input: { command, tone: settings?.tone },
          output: { textLength: text.length, usage }
        });

        // Global Observability Log
        await db.collection("logs").add({
          jobId,
          userId: job.userId,
          step: "generateAnnouncement",
          promptVersion: PROMPT_VERSION,
          input: { command, plannerRowsCount: plannerRows.length },
          output: { text, usage },
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        await jobService.updateProgress(jobId, { progress: 90 });
        
        return {
          title: `${settings?.course || 'Thales Academy'} Update - ${weekId}`,
          bodyHTML: text,
          suggestedPostDate: new Date().toISOString()
        };
      } catch (err: any) {
        console.error("[ANN AI FAILURE]", err);
        await jobService.addLog(jobId, {
          step: 'AI_ERROR',
          message: `Intelligence Fault: ${err.message}`,
          error: err.stack
        });
        throw err;
      }
    });
  })();

  return { jobId };
});

export const deployPages = onCall({ secrets: [canvasApiToken] }, async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const { pages, force } = request.data;
  const token = canvasApiToken.value();
  
  if (!Array.isArray(pages)) {
    throw new HttpsError("invalid-argument", "The 'pages' argument must be an array.");
  }

  const deployed = [];
  for (const page of pages) {
    if (!page.id || !page.courseId) continue;

    // 1. Transactional Lock
    const lockKey = generateHash(`deploy_page_${page.id}`);
    const lockRef = db.collection('locks').doc(lockKey);
    
    try {
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(lockRef);
        if (snap.exists() && snap.data()!.expiresAt.toDate() > new Date()) {
          throw new Error(`Deployment lock active for ${page.title}`);
        }
        transaction.set(lockRef, { 
          expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 60000) 
        });
      });

      // 2. Fetch Shadow State
      const pageRef = db.collection('canvas_pages').doc(page.id);
      const pageSnap = await pageRef.get();
      const shadowCopy = pageSnap.exists() ? pageSnap.data() : null;
      
      const currentHash = generateHash(page.html + page.title);
      let canvasId = page.canvasId || shadowCopy?.canvasId;

      // 3. DIFF SYNC LAYER
      if (canvasId && shadowCopy?.contentHash === currentHash && !force) {
        console.log(`[SYNC SKIP] Page "${page.title}" matches remote state.`);
        deployed.push(page.title);
        continue;
      }

      // 4. Remote Action
      let result;
      if (canvasId) {
        console.log(`[SYNC UPDATE] Pushing diff for "${page.title}" (${canvasId})`);
        result = await canvasRequest(`courses/${page.courseId}/pages/${canvasId}`, 'PUT', {
          wiki_page: { title: page.title, body: page.html }
        }, token);
      } else {
        console.log(`[SYNC CREATE] Initializing new page "${page.title}"`);
        result = await canvasRequest(`courses/${page.courseId}/pages`, 'POST', {
          wiki_page: { title: page.title, body: page.html, published: false }
        }, token);
        canvasId = result.url.split('/').pop();
      }
      
      // 5. Update Shadow Copy
      await pageRef.set({
        id: page.id,
        courseId: page.courseId,
        title: page.title,
        canvasId: canvasId || result.page_id || result.url?.split('/').pop(),
        contentHash: currentHash,
        status: 'Deployed',
        lastSyncedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      deployed.push(page.title);
      await lockRef.delete();

    } catch (error: any) {
      console.error(`Diff-Sync Error (${page.title}): ${error.message}`);
    }
  }
  return { success: true, deployed: deployed.length, titles: deployed };
});

export const deployAssignments = onCall({ secrets: [canvasApiToken] }, async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const token = canvasApiToken.value();
  const { assignments, force } = request.data;

  if (!Array.isArray(assignments)) {
    throw new HttpsError("invalid-argument", "The 'assignments' argument must be an array.");
  }

  const results = [];
  for (const assign of assignments) {
    if (!assign.id || !assign.courseId) continue;

    const lockKey = generateHash(`deploy_assign_${assign.id}`);
    const lockRef = db.collection('locks').doc(lockKey);

    try {
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(lockRef);
        if (snap.exists() && snap.data()!.expiresAt.toDate() > new Date()) {
          throw new Error(`Lock active for ${assign.title}`);
        }
        transaction.set(lockRef, { 
          expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 60000) 
        });
      });

      const assignRef = db.collection('assignments').doc(assign.id);
      const assignSnap = await assignRef.get();
      const shadowCopy = assignSnap.exists() ? assignSnap.data() : null;

      const payloadToHash = JSON.stringify({ 
        title: assign.title, 
        description: assign.description, 
        points: assign.points 
      });
      
      const currentHash = generateHash(payloadToHash);
      let canvasId = assign.canvasId || shadowCopy?.canvasId;

      // DIFF SYNC LAYER
      if (canvasId && shadowCopy?.contentHash === currentHash && !force) {
        console.log(`[SYNC SKIP] Assignment "${assign.title}" matches remote state.`);
        results.push(canvasId);
        continue;
      }

      let res;
      if (canvasId) {
        console.log(`[SYNC UPDATE] Syncing Assignment "${assign.title}" (${canvasId})`);
        res = await canvasRequest(`courses/${assign.courseId}/assignments/${canvasId}`, 'PUT', {
          assignment: { 
            name: assign.title, 
            points_possible: assign.points, 
            description: assign.description || ""
          }
        }, token);
      } else {
        console.log(`[SYNC CREATE] Creating Assignment "${assign.title}"`);
        res = await canvasRequest(`courses/${assign.courseId}/assignments`, 'POST', {
          assignment: { 
            name: assign.title, 
            points_possible: assign.points, 
            published: false,
            description: assign.description || ""
          }
        }, token);
        canvasId = res.id.toString();
      }
      
      await assignRef.set({
        canvasId,
        contentHash: currentHash,
        status: 'Deployed', 
        lastSyncedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await lockRef.delete();
      results.push(canvasId);
    } catch (error: any) {
      console.error(`Assignment Sync Failure: ${error.message}`);
    }
  }
  return { success: true, count: results.length };
});

export const deployAnnouncements = onCall({ secrets: [canvasApiToken] }, async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const token = canvasApiToken.value();
  const { announcements, force } = request.data;

  if (!Array.isArray(announcements)) {
    throw new HttpsError("invalid-argument", "The 'announcements' argument must be an array.");
  }

  for (const ann of announcements) {
    if (!ann.id || !ann.courseId) continue;

    const lockKey = generateHash(`deploy_ann_${ann.id}`);
    const lockRef = db.collection('locks').doc(lockKey);

    try {
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(lockRef);
        if (snap.exists() && snap.data()!.expiresAt.toDate() > new Date()) {
          throw new Error("Lock active");
        }
        transaction.set(lockRef, { 
          expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 60000) 
        });
      });

      const annRef = db.collection('announcements').doc(ann.id);
      const annSnap = await annRef.get();
      const shadowCopy = annSnap.exists() ? annSnap.data() : null;

      const currentHash = generateHash(ann.content + ann.title);
      let canvasId = ann.canvasId || shadowCopy?.canvasId;

      // DIFF SYNC LAYER
      if (canvasId && shadowCopy?.contentHash === currentHash && !force) {
        console.log(`[SYNC SKIP] Announcement "${ann.title}" matches remote state.`);
        continue;
      }

      if (canvasId) {
        console.log(`[SYNC UPDATE] Syncing Announcement "${ann.title}" (${canvasId})`);
        await canvasRequest(`courses/${ann.courseId}/discussion_topics/${canvasId}`, 'PUT', {
          title: ann.title, 
          message: ann.content
        }, token);
      } else {
        console.log(`[SYNC CREATE] Posting Announcement "${ann.title}"`);
        const res = await canvasRequest(`courses/${ann.courseId}/discussion_topics`, 'POST', {
          title: ann.title, 
          message: ann.content, 
          is_announcement: true, 
          published: true
        }, token);
        canvasId = res.id.toString();
      }
      
      await annRef.set({ 
        canvasId,
        contentHash: currentHash,
        status: 'Posted',
        lastSyncedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await lockRef.delete();
    } catch (error: any) {
      console.error(`Announcement Sync Failure: ${error.message}`);
    }
  }
  return { success: true };
});

export const generateAIResponse = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const { prompt } = request.data;
  if (!prompt) throw new HttpsError("invalid-argument", "Prompt is required.");

  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
  let result;
  try {
    result = await model.generateContent(prompt);
  } catch (err) {
    console.error("AI FAILURE", err);
    throw new Error("Generation failed");
  }
  return { result: result.response.text() };
});

export const runWeekValidator = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const { weekId } = request.data;
  const snapshot = await db.collection('planner_rows').where('weekId', '==', weekId).get();
  const errors = [];
  if (snapshot.empty) errors.push(`No data found for week ${weekId}.`);
  return { valid: errors.length === 0, errors };
});

export const generateNewsletter = onCall(async (request: CallableRequest<any>) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    return { success: true, message: "Newsletter stub updated with auth check." };
});


/**
 * 1. Admin Notifications: Friday Deploy Sync
 * Triggers an email summary to the administrator detailing Canvas deployment success/failures.
 */
export const fridayDeploySync = neverCrash(async (request: CallableRequest<any>) => {
    const { successList = [], failureList = [], weekId } = request.data;
    const adminEmail = process.env.ADMIN_EMAIL;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!adminEmail || !resendApiKey) {
        throw new HttpsError("failed-precondition", "Admin email or Resend API key missing.");
    }

    const htmlBody = `
      <h2>Friday Deploy Sync Report</h2>
      <p>The automated Canvas pacing sync has completed for week ${weekId || 'unknown'}.</p>
      <h3 style="color: green;">✅ Successful Subjects:</h3>
      <ul>${successList.map((s: string) => `<li>${s}</li>`).join('') || '<li>None</li>'}</ul>
      <h3 style="color: red;">❌ Failed Subjects:</h3>
      <ul>${failureList.map((f: string) => `<li>${f}</li>`).join('') || '<li>None</li>'}</ul>
    `;

    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: adminEmail,
      subject: `Canvas Sync: Friday Deployment Report - Week ${weekId || 'N/A'}`,
      html: htmlBody
    });

    return { success: true, message: "Deployment report sent successfully." };
});

/**
 * 2. Dynamic Sheet Mapping
 * Scans column A of the pacing guide for dates and saves their row mappings into Firestore.
 * Implements chunked batch writes to handle large sheets.
 */
export const importSheetData = neverCrash(async (request: CallableRequest<any>) => {
    const { spreadsheetData, mode } = request.data;
    
    if (!Array.isArray(spreadsheetData)) {
        throw new HttpsError("invalid-argument", "spreadsheetData is required and must be an array.");
    }
    
    // If 'rescan' is passed, we rebuild the contentMapRegistry
    if (mode === "rescan") {
        const registryRef = db.collection("contentMapRegistry");
        
        // 1. Delete existing docs in chunks of 500
        let snapshot = await registryRef.limit(500).get();
        while (!snapshot.empty) {
            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            snapshot = await registryRef.limit(500).get();
        }

        // 2. Identify and save new mappings in chunks of 500
        const mappings: { date: string, row: number }[] = [];
        spreadsheetData.forEach((row: any[], index: number) => {
            const colA = row[0];
            if (typeof colA === 'string' && /^[A-Z][a-z]{2,8}\s\d{1,2}$/.test(colA.trim())) {
                mappings.push({
                    date: colA.trim(),
                    row: index + 1
                });
            }
        });

        // 3. Commit new mappings in batches of 500
        for (let i = 0; i < mappings.length; i += 500) {
            const chunk = mappings.slice(i, i + 500);
            const batch = db.batch();
            chunk.forEach(m => {
                const docRef = registryRef.doc();
                batch.set(docRef, {
                    dateString: m.date,
                    rowNumber: m.row,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch.commit();
        }
        
        return { success: true, message: `Successfully rescanned sheet and created ${mappings.length} dynamic mappings.` };
    }

    return { success: true, message: "Standard import executed without rescan." };
});

/**
 * Morning Digest: Mon-Fri at 5 AM.
 * Summarizes the day's academic lessons and provides an AI encouraging brief.
 */
export const morningDigest = onSchedule("0 5 * * 1-5", async (event) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!adminEmail || !resendApiKey) {
        console.error("Morning Digest aborted: ADMIN_EMAIL or RESEND_API_KEY missing.");
        return;
    }

    // Identify Today (Simplified Date string matching the registry format)
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    
    console.log(`Generating Morning Digest for ${dateStr}`);

    // 1. Fetch today's pacing rows from Firestore
    // We try to find rows where day matches current day and week matches current week, 
    // or direct date match if supported.
    const rowsSnap = await db.collection('planner_rows')
        .where('date', '==', dateStr) 
        .get();

    if (rowsSnap.empty) {
        console.log("No pacing rows found for today.");
        return;
    }

    const rows = rowsSnap.docs.map(d => d.data());
    const lessonList = rows.map(r => `${r.subject}: ${r.lessonTitle}`).join('\n');

    // 2. AI Encouraging Brief via Gemini
    const aiPrompt = `
        You are a supportive academic assistant for Thales Academy. 
        Here is the lesson plan for today (${dateStr}):
        ${lessonList}
        
        Write a 2-3 sentence encouraging brief about these lessons for the school admin. 
        Focus on the value of the topics being taught today. Keep it professional and uplifting.
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    let result;
    try {
      result = await model.generateContent(aiPrompt);
    } catch (err) {
      console.error("AI FAILURE", err);
      throw new Error("Generation failed");
    }
    const brief = result.response.text();

    // 3. Send via Resend
    const resend = new Resend(resendApiKey);
    await resend.emails.send({
        from: 'Thales OS <notifications@thales-os.app>',
        to: adminEmail,
        subject: `☀️ Morning Digest: ${dateStr}`,
        html: `
            <h2>Good Morning, Administrator!</h2>
            <p>Here is your academic digest for today, ${dateStr}:</p>
            <h3>Today's Focus:</h3>
            <ul>
                ${rows.map(r => `<li><strong>${r.subject}:</strong> ${r.lessonTitle}</li>`).join('')}
            </ul>
            <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; border-left: 4px solid #0065a7;">
                <p><em>${brief}</em></p>
            </div>
            <p>Have a productive day at Thales Academy!</p>
        `
    });
    console.log("Morning Digest sent successfully.");
});

/**
 * Nightly Error Monitor: 11 PM.
 * Scans deployLogs for errors in the last 24 hours and alerts admin.
 */
export const nightlyErrorMonitor = onSchedule("0 23 * * *", async (event) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!adminEmail || !resendApiKey) return;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const errorSnap = await db.collection('deployLogs')
        .where('status', '==', 'ERROR')
        .where('createdAt', '>=', twentyFourHoursAgo)
        .get();

    if (errorSnap.empty) {
        console.log("No critical deployment errors detected in the last 24 hours.");
        return;
    }

    const errors = errorSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const resend = new Resend(resendApiKey);
    await resend.emails.send({
        from: 'Thales OS <alerts@thales-os.app>',
        to: adminEmail,
        subject: `⚠️ Nightly Error Alert: ${errors.length} Failures Detected`,
        html: `
            <h2>Deployment Error Report</h2>
            <p>The following deployment errors occurred in the last 24 hours:</p>
            <ul>
                ${errors.map((e: any) => `<li><strong>ID:</strong> ${e.id} | <strong>Message:</strong> ${e.message || 'Unknown Error'}</li>`).join('')}
            </ul>
            <p>Please check the Thales OS Dashboard for details.</p>
        `
    });
    console.log(`Sent alert for ${errors.length} deployment errors.`);
});

/**
 * Jaccard Similarity Algorithm (Intersection over Union)
 * Used to detect near-duplicate assignment titles in Canvas.
 */
function getJaccardSimilarity(s1: string, s2: string): number {
    const set1 = new Set(s1.toLowerCase().trim().split(/\s+/));
    const set2 = new Set(s2.toLowerCase().trim().split(/\s+/));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Duplicate Sweeper: Cleans up cluttered Canvas courses
 */
export const sweepDuplicates = neverCrash(async (request: CallableRequest<any>) => {
    const { courseId } = request.data;
    if (!courseId) throw new Error("courseId is required");

    const token = process.env.CANVAS_API_TOKEN;
    if (!token) {
        throw new Error("CANVAS_API_TOKEN not configured. Please add it to your function environment variables.");
    }

    // 1. Fetch all Canvas assignments for the course
    const baseUrl = `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/assignments`;
    const response = await fetch(`${baseUrl}?per_page=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
        throw new Error(`Canvas API Error: ${response.status} ${response.statusText}`);
    }
    
    const assignments: any[] = await response.json();
    const results: any[] = [];
    const deletedIds = new Set<string>();

    // 2. Pairwise Comparison using Jaccard Similarity
    for (let i = 0; i < assignments.length; i++) {
        for (let j = i + 1; j < assignments.length; j++) {
            const a1 = assignments[i];
            const a2 = assignments[j];
            
            // Skip if either was already marked for deletion in this pass
            if (deletedIds.has(a1.id) || deletedIds.has(a2.id)) continue;

            const similarity = getJaccardSimilarity(a1.name, a2.name);

            if (similarity >= 0.80) {
                // High Similarity: Check for submissions before deleting
                if (!a2.has_submitted_submissions) {
                    console.log(`[Sweeper] High similarity (${Math.round(similarity * 100)}%) detected. Deleting duplicate: ${a2.name} (ID: ${a2.id})`);
                    await fetch(`${baseUrl}/${a2.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    deletedIds.add(a2.id);
                    results.push({ action: 'DELETE', id: a2.id, name: a2.name, similarity });
                }
            } else if (similarity >= 0.50) {
                // Moderate Similarity: Unpublish and flag
                console.log(`[Sweeper] Moderate similarity (${Math.round(similarity * 100)}%) detected. Unpublishing: ${a2.name} (ID: ${a2.id})`);
                await fetch(`${baseUrl}/${a2.id}`, {
                    method: 'PUT',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ assignment: { published: false, comment: `[SYSTEM] Potential duplicate of ${a1.name}` } })
                });
                results.push({ action: 'UNPUBLISH', id: a2.id, name: a2.name, similarity });
            }
        }
    }

    return { 
        success: true, 
        courseId, 
        processedCount: assignments.length, 
        actionsTaken: results.length,
        details: results 
    };
});

/**
 * AI File Classification: Categorizes Canvas files using historical rules and Gemini
 */
export const classifyCanvasFiles = neverCrash(async (request: CallableRequest<any>) => {
    const { filename } = request.data;
    if (!filename) throw new Error("filename is required");

    // 1. Query Firestore learningRules first (Historical matches)
    const rulesRef = db.collection('learningRules');
    const existingRule = await rulesRef.where('filename', '==', filename).limit(1).get();

    if (!existingRule.empty) {
        console.log(`[Classifier] Cache hit for ${filename}`);
        return { 
            source: 'learning_rules', 
            classification: existingRule.docs[0].data() 
        };
    }

    // 2. AI Inference via Gemini
    console.log(`[Classifier] Cache miss for ${filename}. Querying Gemini...`);
    
    const prompt = `
        You are an expert academic data classifier for Thales Academy.
        Categorize the following filename into a subject (Math, ELA, History, Science) and identify the lesson number.
        
        Filename: "${filename}"
        
        Return exactly this JSON structure:
        {
          "subject": "Math | ELA | History | Science | Other",
          "lessonNum": "string or null",
          "isTest": boolean,
          "confidence": number (0.0 to 1.0)
        }
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    let result;
    try {
      result = await model.generateContent(prompt);
    } catch (err) {
      console.error("AI FAILURE", err);
      throw new Error("Generation failed");
    }
    const text = result.response.text();
    
    // Clean and Parse JSON
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const classification = JSON.parse(jsonMatch ? jsonMatch[0] : text);

        // 3. Persist for future learning
        await rulesRef.add({
            filename,
            ...classification,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { source: 'gemini_ai', classification };
    } catch (err) {
        console.error("[Classifier] Failed to parse AI response:", text);
        throw new Error("AI Classification failed to generate valid data.");
    }
});
