import { geminiHelper } from "../lib/geminiHelper";
import { Type } from "@google/genai";
import { extractMathTestNumber, parseMathTest, resolveELAResource } from "../lib/thales/mappings";
import { resourceService } from "./service.resource";
import { auth } from "../lib/firebase";

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
- resources: Mentioned materials (e.g., "Workbook page 45", "Study Guide", "CP 45").

THALES SPECIFIC RULES:
1. BREVITY MANDATE: Never include vendor names (Saxon, Shurley). Use "Math", "Grammar", "ELA".
2. ELA NOTATION: Treat decimals like "12.5" as Chapter 12, Lesson 5.
3. CP NOTATION: Treat "CP 45" or "cp45" as Classroom Practice 45.
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

    // Load active mappings from Canvas File Registry
    const userId = auth.currentUser?.uid;
    const resources = userId ? await resourceService.getAllResources(userId) : [];
    const mapDict = resources.reduce((acc, m) => {
      // Map both raw and clean names to the clean name for indexing
      acc[m.rawName.toLowerCase()] = m.cleanName;
      acc[m.cleanName.toLowerCase()] = m.cleanName;
      return acc;
    }, {} as Record<string, string>);

    // CRITICAL INTEGRATION: Deterministic Post-Processing
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
    
    days.forEach(day => {
      const dayData = parsed.weekDays[day];
      
      // 1. Post-process lessons
      dayData.lessons = dayData.lessons.map(lesson => {
        const trimmed = lesson.trim();
        const mapped = mapDict[trimmed.toLowerCase()];
        if (mapped) return mapped;

        // Check Math
        const testNum = extractMathTestNumber(trimmed);
        if (testNum !== null) {
          const details = parseMathTest(testNum);
          return `[MATH TEST ${testNum}] ${details.factSkill} (${details.powerUp})`;
        }
        
        // Check ELA (Decimals or CP)
        const ela = resolveELAResource(trimmed);
        if (ela) return ela.title;

        return lesson;
      });

      // 2. Post-process assignments
      const newAssignments: string[] = [...dayData.assignments];
      
      // Look for CP in lessons/resources to auto-generate assignments if missing
      dayData.lessons.concat(dayData.resources).forEach(item => {
        const trimmed = item.trim();
        const mapped = mapDict[trimmed.toLowerCase()];
        const lookup = mapped || trimmed;

        const ela = resolveELAResource(lookup);
        if (ela && ela.isAssignment) {
          const finalTitle = mapped || ela.title;
          if (!newAssignments.some(a => a.includes(finalTitle))) {
            newAssignments.push(finalTitle);
          }
        }
      });

      dayData.assignments = newAssignments.map(assignment => {
        const trimmed = assignment.trim();
        const mapped = mapDict[trimmed.toLowerCase()];
        if (mapped) return mapped;

        const testNum = extractMathTestNumber(trimmed);
        if (testNum !== null) {
          const details = parseMathTest(testNum);
          return `[MATH TEST ${testNum}] STUDY: ${details.factSkill} (${details.powerUp})`;
        }

        const ela = resolveELAResource(trimmed);
        if (ela) return ela.title;

        return assignment;
      });

      // 3. Post-process resources
      dayData.resources = dayData.resources.map(res => {
        const trimmed = res.trim();
        const mapped = mapDict[trimmed.toLowerCase()];
        return mapped || trimmed;
      });
    });

    return parsed;
  } catch (error) {
    console.error("Planner AI Engine: Failed to generate structured plan", error);
    return null;
  }
}
