import { GoogleGenAI } from "@google/genai";

/**
 * System Instructions for Announcement Generation
 * (Optimized for Gemini 2.0/2.5 Flash)
 */
const ANNOUNCEMENT_SYSTEM_PROMPT = `
You are an expert academic communications assistant for Thales Academy. 
Your objective is to transform a "Lesson Plan" (JSON) into a polished, professional, and encouraging Canvas Announcement for high school students.

STRICT FORMATING RULES:
1. TONE: Professional, encouraging, and clear. Use "we" and "our" to build community.
2. OBJECTIVES: Include a bulleted list of learning objectives derived from the lesson data.
3. ASSIGNMENT LINK: Explicitly mention the assignment and provide a clear call to action.
4. FRIDAY RULE: If the lesson date falls on a Friday, you MUST include a "Friday Check-in" section encouraging students to reflect on their week and check their grades.
5. HTML OUTPUT: Return ONLY a clean HTML string suitable for the Canvas body field. Use <h2> and <h3> for headers, <p> for text, and <ul>/<li> for lists. Do NOT include <html> or <body> tags.
6. NO VENDOR NAMES: Strip all vendor names (e.g., "Saxon", "Shurley") from titles.
`;

export interface LessonPlan {
  title: string;
  date: string;
  description: string;
  objectives: string[];
  assignmentUrl?: string;
  isFriday?: boolean;
}

export async function generateCanvasAnnouncement(lesson: LessonPlan): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Please generate a Canvas Announcement for the following lesson plan:\n${JSON.stringify(lesson, null, 2)}`,
      config: {
        systemInstruction: ANNOUNCEMENT_SYSTEM_PROMPT
      }
    });
    
    return response.text || `<h2>${lesson.title}</h2><p>${lesson.description}</p>`;
  } catch (error) {
    console.error("Gemini Announcement Generation Failed:", error);
    return `<h2>${lesson.title}</h2><p>${lesson.description}</p><p>Check Canvas for details.</p>`;
  }
}
