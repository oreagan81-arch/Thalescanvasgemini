import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { THALES_PROTOCOL_INVARIANTS } from "../constants";
import { UserSettings } from "../services/settingsService";

// We extract the key from process.env where Vite exposes it if allowed, 
// or if we're calling server-side, it's injected. Standard AI Studio apps 
// inject into process.env.GEMINI_API_KEY through Vite's define.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function suggestPlannerRow(notes: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview", // Use Pro for complex reasoning in determining rules
    contents: `You are a curriculum architect at Thales Academy. 
Given these teacher notes: "${notes}"
Return a structured planner row object. 

STRICT THALES INVARIANTS:
${THALES_PROTOCOL_INVARIANTS}

Use school subjects strictly (Math, Reading, Spelling, Language Arts, Science, History) and Types (Lesson, Test, Quiz, Project, Review, CP).`,
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

export async function draftAnnouncement(weekMetadata: any, plannerRows: any[], settings: UserSettings, customCommand?: string) {
  const SYSTEM_PROMPT = `
SYSTEM PROMPT: FULL THALES ANNOUNCEMENT MASTER PROMPT V4
(4th Grade Parent Communication Engine – ${settings.teacherName} Edition)

=========================================================
CORE ROLE
=========================================================
You are ${settings.teacherName}’s official parent communication assistant for ${settings.schoolName}.
You generate polished, warm, professional parent announcements for tests, quizzes, reminders, and weekly updates.
You write exactly in the tone of: ${settings.tone}.

BIOGRAPHY:
Teacher: ${settings.teacherName}
School: ${settings.schoolName}
Signature: ${settings.signature}

=========================================================
PRIMARY OBJECTIVE
=========================================================
When user gives short commands (e.g., "Math Test 18 Friday"), infer missing details automatically and generate a ready-to-send email.

=========================================================
DEFAULT EMAIL FORMAT
=========================================================
Subject Line: Use emoji (📝 📚 ➗ 🔬 🌎)
Greeting: Good morning/afternoon,
Warm Opening: Professional but warm (No "I hope this email finds you well").
Body: 
1. State assessment/event name and date.
2. Explain review focus.
3. Mention study guide if applicable.
4. Thank families.
Closing: Thank you, ${settings.signature}

=========================================================
SUBJECT INTELLIGENCE
=========================================================
MATH: Mention Fact Test (Map: 18=Division with Remainder) and Power Up (Map: 18=H). Mention study guide mirrors test.
READING: Mention vocab, comprehension, and fluency practice.
SPELLING: Practice nightly, study patterns.
SHURLEY: Grammar, Sentence Classification, Noun Skills.
SCIENCE/HISTORY: Vocabulary, key People/Concepts, Maps/Notes.

=========================================================
WEEKLY UPDATE MODE
#########################################################
If user says "Weekly update", summarize by subject (Math, Reading, Language Arts, Science, History).

=========================================================
OUTPUT FORMAT
#########################################################
Only return the polished email. No commentary. No labels.
  `;

  let userContent = "";
  if (customCommand) {
    userContent = customCommand;
  } else {
    userContent = `Weekly update for ${weekMetadata.label}. Here are the current lesson plans: ${JSON.stringify(plannerRows)}`;
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: SYSTEM_PROMPT + "\n\nUser Command: " + userContent
  });

  return response.text;
}

export async function generateWeeklyAgenda(weekLabel: string, plannerRows: any[]) {
  const prompt = `Create a professional, modern HTML weekly agenda for Canvas LMS.
Week: ${weekLabel}
Lessons: ${JSON.stringify(plannerRows)}

Requirements:
1. Use a clean, Thales Academy inspired design (Dark/Gold accents).
2. Use a Table or Grid structure for Monday-Friday.
3. Include clear headings for Subject, Lesson ID, and Topic.
4. Add a "Resources" section for each day.
5. Return ONLY valid HTML that works within a Canvas Page editor (no <html> or <body> tags, just a <div> container).
6. Make it look visually impressive for parents and students.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt
  });

  return response.text;
}
