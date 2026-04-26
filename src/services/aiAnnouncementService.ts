import { geminiHelper, GeneratedAnnouncement } from "../lib/geminiHelper";
import { Type } from "@google/genai";

export { type GeneratedAnnouncement };

/**
 * AI Service for generating parent announcements with curriculum intelligence.
 */
export async function generateCanvasAnnouncement(command: string, currentDateStr: string): Promise<GeneratedAnnouncement | null> {
  const systemPrompt = `
ACT AS: Thales Academy "Week Ahead Newsletter Strategist".

DATE CALCULATION RULES:
- The user provided a current date of ${currentDateStr}.
- Based on this reference date, calculate the specific calendar dates for the UPCOMING week (Monday through Friday).
- Include the academic "Week Number" (guess based on month if not specified, usually Weeks 1-36) and the calculated "Date Range" (e.g., April 27 - May 1) in the generated title.

CURRICULUM SYNTHESIS RULES:
- Synthesize a brief Math focus (e.g., "Division with remainders", "Two-digit multiplication") and a Reading/ELA focus based on typical 4th-grade pacing.
- Reading/ELA focus MUST include a target WPM fluency benchmark (e.g., "130 WPM") and a specific grammar focus (e.g., "Subject-Verb Agreement").

THE TEST SCHEDULE RULES:
- Create a clear bulleted list of next week's assessments.
- ALWAYS schedule the Spelling Test for Thursday.
- ALWAYS schedule the Math Test for Friday.

THE AGENDA LINK (CRITICAL):
- You MUST include a clear "Action Item" directing parents to the weekly agenda.
- Format this as a hyperlink using the inferred Week Number: <a href="/pages/week-X-agenda" style="color: #2563eb; text-decoration: underline;">Week X Agenda Page</a>.

TONE:
- Informative, warm, and forward-looking.
`;

  const schemaProperties = {
    title: {
      type: Type.STRING,
      description: "The formatted title of the newsletter including date range and week number."
    },
    bodyHTML: {
      type: Type.STRING,
      description: "HTML formatted string with <p>, <ul>, <li>, and <strong> tags."
    },
    requiredAttachments: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of files that must be attached to this announcement."
    },
    toneAnalysis: {
      type: Type.STRING,
      description: "Analysis of how the response captures the informative, warm, and forward-looking tone."
    }
  };

  const requiredFields = ["title", "bodyHTML", "requiredAttachments", "toneAnalysis"];

  try {
    const response = await geminiHelper.generateStructuredJSON<GeneratedAnnouncement>(
      systemPrompt + "\n\nUser Command: " + command,
      schemaProperties,
      requiredFields
    );
    return response;
  } catch (error) {
    console.error("AI Announcement Engine Failed:", error);
    throw error;
  }
}
