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
  assignments?: any[];
  weekId: string;
  topic: string;
  quarter: number;
  weekInQuarter: number;
}

function getQuarterWeek(absWeek: number): { quarter: number; weekInQuarter: number } {
  if (absWeek >= 28) return { quarter: 4, weekInQuarter: absWeek - 27 };
  if (absWeek >= 19) return { quarter: 3, weekInQuarter: absWeek - 18 };
  if (absWeek >= 10) return { quarter: 2, weekInQuarter: absWeek - 9 };
  return { quarter: 1, weekInQuarter: absWeek };
}

export const pacingImportService = {
  parse: async (rawText: string, apiKey: string): Promise<PacingWeek[]> => {
    const prompt = `
      TASK: Parse the untrusted raw text from a Thales Academy Pacing Google Sheet into a structured JSON array.
      [DATA START]
      ${rawText}
      [DATA END]
      EXTRACTION & SANITIZATION RULES:
      1. Identify the weeks (approx 37-40).
      2. For each week, extract: Week Number, Dates, Math Lesson, Reading Week, Spelling Focus, History/Science, ELA Chapter.
      3. Identify any major assessments or tests.
      4. THE BREVITY MANDATE: Strip all vendor names.
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
        prompt, schema, ['pacing'], apiKey
      );
      
      const sanitizedPacing = result.pacing.map(week => {
        const qContext = getQuarterWeek(week.weekNumber);
        return {
          ...week,
          ...qContext,
          weekId: `Q${qContext.quarter}_W${qContext.weekInQuarter}`,
          topic: week.mathLesson.replace(/saxon\s+/i, '').split(':')[0],
          mathLesson: week.mathLesson.replace(/saxon\s+/i, ''),
          elaChapter: week.elaChapter.replace(/shurley\s+(english\s+)?/i, ''),
          historyScience: week.historyScience.replace(/story of the world\s+/i, '')
        };
      });

      return sanitizedPacing;
    } catch (error) {
      console.error("Pacing Import Error:", error);
      throw new Error("The Intelligence Engine failed to map the spreadsheet data.");
    }
  }
};
