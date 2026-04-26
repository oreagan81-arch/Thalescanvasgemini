import { geminiHelper } from '../lib/geminiHelper';

export interface PacingWeek {
  weekNumber: number;
  dates: string;
  mathLesson: string;
  readingWeek: string; 
  spellingFocus: string;
  historyScience: string;
  elaChapter: string;
  majorTests: string[];
}

export const pacingImportService = {
  parse: async (rawText: string, apiKey: string): Promise<PacingWeek[]> => {
    return pacingImportService.parseGoogleSheetText(rawText, apiKey);
  },

  parseGoogleSheetText: async (rawText: string, apiKey: string): Promise<PacingWeek[]> => {
    const prompt = `
      TASK: Parse the following raw text from a Thales Academy Pacing Google Sheet into a structured JSON array.
      
      DATA:
      ${rawText}
      
      EXTRACTION RULES:
      1. Identify the 40 weeks of the school year.
      2. For each week, extract: Week Number, Dates, Math Lesson, Reading Week, Spelling Focus, History/Science, ELA Chapter.
      3. Identify any major assessments or tests.
      
      Return ONLY a JSON array.
    `;

    const schema = {
      pacing: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            weekNumber: { type: "NUMBER" },
            dates: { type: "STRING" },
            mathLesson: { type: "STRING" },
            readingWeek: { type: "STRING" },
            spellingFocus: { type: "STRING" },
            historyScience: { type: "STRING" },
            elaChapter: { type: "STRING" },
            majorTests: { type: "ARRAY", items: { type: "STRING" } }
          },
          required: ["weekNumber", "mathLesson", "readingWeek"]
        }
      }
    };

    try {
      const result = await geminiHelper.generateStructuredJSON<{ pacing: PacingWeek[] }>(
        prompt,
        schema,
        ['pacing'],
        apiKey
      );
      return result.pacing;
    } catch (error) {
      console.error("Pacing Import Error:", error);
      throw new Error("The Intelligence Engine failed to map the spreadsheet data. Please verify the text was copied correctly.");
    }
  }
};
