import { geminiHelper } from "../lib/geminiHelper";
import { Type } from "@google/genai";
import { extractMathTestNumber, parseMathTest } from "../lib/thales/mappings";

export interface DayPlan {
  lessons: string[];
  assignments: string[];
  resources: string[];
}

export interface WeeklyPlan {
  weekDays: {
    monday: DayPlan;
    tuesday: DayPlan;
    wednesday: DayPlan;
    thursday: DayPlan;
    friday: DayPlan;
  };
  aiAuditorWarnings: string[];
}

/**
 * Advanced Reasoning Engine for processing raw pacing guide text into a structured week plan.
 */
export async function processPacingGuide(rawText: string): Promise<WeeklyPlan | null> {
  const SYSTEM_PROMPT = `
ACT AS: A Senior Curriculum Auditor at Thales Academy.
TASK: Parse the following raw "pacing guide" text into a structured JSON weekly plan.

STRUCTURE: 
Organize the content into exactly 5 days (monday, tuesday, wednesday, thursday, friday).
Each day must have:
- lessons: List of specific lesson topics/numbers.
- assignments: Homework or test items.
- resources: Mentioned materials (e.g., "Workbook page 45", "Study Guide").

AUDITOR COMPONENT:
Generate "aiAuditorWarnings" if you detect:
1. Missing core subjects (Math, Reading, Spelling, etc.).
2. Pacing anomalies (e.g., a test being administered on a Monday without prior review).
3. Missing study guides for upcoming tests.
4. Incomplete data or fragments.
`;

  const daySchema = {
    type: Type.OBJECT,
    properties: {
      lessons: { type: Type.ARRAY, items: { type: Type.STRING } },
      assignments: { type: Type.ARRAY, items: { type: Type.STRING } },
      resources: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["lessons", "assignments", "resources"]
  };

  const schemaProperties = {
    weekDays: {
      type: Type.OBJECT,
      properties: {
        monday: daySchema,
        tuesday: daySchema,
        wednesday: daySchema,
        thursday: daySchema,
        friday: daySchema
      },
      required: ["monday", "tuesday", "wednesday", "thursday", "friday"]
    },
    aiAuditorWarnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  };

  const requiredFields = ["weekDays", "aiAuditorWarnings"];

  try {
    const parsed = await geminiHelper.generateStructuredJSON<WeeklyPlan>(
      SYSTEM_PROMPT + "\n\nRAW PACING DATA:\n" + rawText,
      schemaProperties,
      requiredFields
    );

    if (!parsed) return null;

    // CRITICAL INTEGRATION: Deterministic Post-Processing
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
    
    days.forEach(day => {
      const dayData = parsed.weekDays[day];
      
      // Check lessons
      dayData.lessons = dayData.lessons.map(lesson => {
        const testNum = extractMathTestNumber(lesson);
        if (testNum !== null) {
          const details = parseMathTest(testNum);
          return `[MATH TEST ${testNum}] ${details.factSkill} (${details.powerUp})`;
        }
        return lesson;
      });

      // Check assignments
      dayData.assignments = dayData.assignments.map(assignment => {
        const testNum = extractMathTestNumber(assignment);
        if (testNum !== null) {
          const details = parseMathTest(testNum);
          return `[MATH TEST ${testNum}] STUDY: ${details.factSkill} (${details.powerUp})`;
        }
        return assignment;
      });
    });

    return parsed;
  } catch (error) {
    console.error("Planner AI Engine: Failed to generate structured plan", error);
    return null;
  }
}
