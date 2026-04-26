import { useStore } from '../store';
import { rulesEngine } from '../lib/thales/rulesEngine';
import { GoogleGenAI, Type } from "@google/genai";

export interface ExtractedAssignment {
  title: string;
  type: "Assignment" | "Quiz" | "Test" | "Discussion";
  description: string;
}

export interface ExtractedWeek {
  weekId: string;
  subject: string;
  topic: string;
  assignments: ExtractedAssignment[];
}

/**
 * Converts a File object to a base64 string for Gemini API consumption
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const curriculumExtractionService = {
  /**
   * Sends a document (PDF or Image) to Gemini to extract structured curriculum data
   */
  async extractFromDocument(file: File): Promise<ExtractedWeek[]> {
    const { geminiApiKey } = useStore.getState();
    const apiKey = geminiApiKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : "") || "";

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY_MISSING: Please configure your Gemini API Key in Settings.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const base64Data = await fileToBase64(file);
    const mimeType = file.type;

    const systemPrompt = `
      You are an elite academic registrar and curriculum specialist. 
      Your task is to analyze the provided syllabus or pacing guide and extract all weekly instructional data.
      
      RULES:
      1. Extract every week mentioned.
      2. Identify subjects, topics, and specific assignments/tests.
      3. Friday Agenda Rule: Omit 'In Class' instructional sections for Fridays; focus exclusively on assessments.
      4. Reading Checkout Rule: For Reading assignments, include the Fluency Goal: '100 words per minute (WPM) with 2 or fewer errors.'
      5. Thales Standard: Strip vendor names from titles (e.g., 'Saxon Math 4' -> 'Math').
      6. Return ONLY a valid JSON array matching the required schema.
      
      Do not include conversational text or markdown blocks. Return raw JSON.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { text: "Extract the curriculum from this document into the required JSON format." },
          { inlineData: { mimeType, data: base64Data } }
        ],
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                weekId: { type: Type.STRING, description: "e.g., 'W1', 'W2'" },
                subject: { type: Type.STRING },
                topic: { type: Type.STRING },
                assignments: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      type: { 
                        type: Type.STRING,
                        enum: ["Assignment", "Quiz", "Test", "Discussion"]
                      },
                      description: { type: Type.STRING }
                    },
                    required: ["title", "type", "description"]
                  }
                }
              },
              required: ["weekId", "subject", "topic", "assignments"]
            },
          }
        }
      });

      const text = response.text;
      
      if (!text) throw new Error("No data returned from AI");

      let rawData = JSON.parse(text) as ExtractedWeek[];

      // Apply the Silent Auditor (Rules Engine) to sanitize vendor names
      const sanitizedData = rawData.map((week) => ({
        ...week,
        topic: rulesEngine.silentAuditor(week.topic),
        assignments: week.assignments.map((a) => ({
          ...a,
          title: rulesEngine.silentAuditor(a.title),
          description: rulesEngine.silentAuditor(a.description)
        }))
      }));

      return sanitizedData;
    } catch (error) {
      console.error("Extraction Error:", error);
      throw error;
    }
  }
};
