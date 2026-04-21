import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

// We extract the key from process.env where Vite exposes it if allowed, 
// or if we're calling server-side, it's injected. Standard AI Studio apps 
// inject into process.env.GEMINI_API_KEY through Vite's define.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function suggestPlannerRow(notes: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview", // Use Pro for complex reasoning in determining rules
    contents: `You are a curriculum assistant at Thales Academy. 
Given these teacher notes: "${notes}"
Return a structured planner row object. Use school subjects strictly 
(Math, Reading, Spelling, Language Arts, Science, History) and Types 
(Lesson, Test, Quiz, Project, Review, CP).`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          lessonNum: { type: Type.STRING },
          lessonTitle: { type: Type.STRING },
          type: { type: Type.STRING },
          homework: { type: Type.STRING },
          reminder: { type: Type.STRING }
        },
        required: ["subject", "lessonNum", "lessonTitle", "type"]
      }
    }
  });

  if (response.text) {
    return JSON.parse(response.text.trim());
  }
  return null;
}

export async function draftAnnouncement(weekMetadata: any, plannerRows: any[]) {
  const prompt = `Draft a parent-facing announcement for this week.
Week: ${weekMetadata.label}
Rows: ${JSON.stringify(plannerRows)}
Make it sound warm, professional, and highlight upcoming tests/quizzes and Friday notices. Sign off as 'Mr. Reagan'.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt
  });

  return response.text;
}
