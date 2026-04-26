import { geminiHelper } from "../lib/geminiHelper";
import { generateFriendlySlug } from "../lib/thales/rulesEngine";
import { UserSettings } from "./service.settings";
import { Type } from "@google/genai";

export interface SyllabusExtractionResult {
  pacingPlan: {
    weekId: string;
    rows: any[];
  };
  announcements: {
    title: string;
    bodyHTML: string;
    suggestedPostDate: string;
  }[];
  resources: {
    title: string;
    friendlyUrl: string;
    type: string;
  }[];
  htmlBlock: string;
  aiAuditorWarnings: string[];
}

/**
 * Acts as the Content Organizer & Mapping Engine.
 * Extracts structured Thales entities from a raw syllabus text.
 */
export async function extractCurriculumFromSyllabus(
  rawText: string,
  subject: string,
  weekId: string,
  settings: UserSettings
): Promise<SyllabusExtractionResult | null> {
  const SYSTEM_PROMPT = `
ACT AS: Thales Academy Content Organizer & Mapping Engine.
TASK: Parse the following RAW SYLLABUS text for the subject "${subject}" into a structured curriculum.

STRUCTURED ENTITIES TO EXTRACT:
1. Assignments: Map to a "Pacing Plan" row format.
2. Announcements: Draft a parent-friendly Canvas announcement.
3. Resources: List all physical or digital files mentioned.
4. AI AUDITOR WARNINGS: Review the pacing and content. If you detect anomalies (e.g., a major test scheduled on a Monday, missing study guides for a test week, overlapping homework), generate a list of warnings for the teacher.

FORMATTING RULES (STRICT):
- Assignments must include: Day (Monday-Friday), Subject, Lesson Title, Homework.
- Announcements must follow Thales tone: Professional, Encouraging. Use <h2> headers.
- Resources must be listed with clear titles.
`;

  const schemaProperties = {
    rows: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.STRING },
          lessonTitle: { type: Type.STRING },
          homework: { type: Type.STRING },
          type: { type: Type.STRING }
        },
        required: ["day", "lessonTitle", "homework", "type"]
      }
    },
    announcements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          bodyHTML: { type: Type.STRING },
          suggestedPostDate: { type: Type.STRING }
        },
        required: ["title", "bodyHTML", "suggestedPostDate"]
      }
    },
    resources: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          type: { type: Type.STRING }
        },
        required: ["title", "type"]
      }
    },
    aiAuditorWarnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  };

  const requiredFields = ["rows", "announcements", "resources", "aiAuditorWarnings"];

  try {
    const parsed = await geminiHelper.generateStructuredJSON<any>(
      SYSTEM_PROMPT + "\n\nRAW SYLLABUS TEXT:\n" + rawText,
      schemaProperties,
      requiredFields
    );
    
    if (!parsed) return null;

    // Post-processing: Add Friendly URLs and Thales Formatting
    const resourcesWithUrls = (parsed.resources || []).map((r: any) => ({
      ...r,
      friendlyUrl: generateFriendlySlug('resources', r.title, Math.random().toString(36).substring(7))
    }));

    // Generate HTML Block for Page Builder
    const htmlBlock = `
<div class="thales-page-container">
  <h2 class="text-2xl font-bold border-l-4 border-amber-500 pl-4 mb-6">${subject} - Weekly Overview</h2>
  <div class="syllabus-section mb-8">
    <h3 class="text-xl font-bold mb-4">Weekly Assignments</h3>
    <table class="w-full border-collapse">
      <thead>
        <tr class="bg-slate-100">
          <th class="p-2 border">Day</th>
          <th class="p-2 border">Topic</th>
          <th class="p-2 border">Homework</th>
        </tr>
      </thead>
      <tbody>
        ${(parsed.rows || []).map((row: any) => `
          <tr>
            <td class="p-2 border font-bold">${row.day}</td>
            <td class="p-2 border">${row.lessonTitle}</td>
            <td class="p-2 border italic">${row.homework}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  <div class="resources-section">
    <h3 class="text-xl font-bold mb-4">Resources</h3>
    <ul class="list-disc pl-6 space-y-2">
      ${resourcesWithUrls.map((r: any) => `
        <li><a href="${r.friendlyUrl}" class="text-amber-600 hover:underline">${r.title}</a> (${r.type})</li>
      `).join('')}
    </ul>
  </div>
</div>
    `;

    return {
      pacingPlan: {
        weekId,
        rows: parsed.rows || []
      },
      announcements: parsed.announcements || [],
      resources: resourcesWithUrls,
      htmlBlock,
      aiAuditorWarnings: parsed.aiAuditorWarnings || []
    };
  } catch (error) {
    console.error("Failed to extract curriculum from syllabus", error);
    return null;
  }
}
