
import { geminiHelper } from '../lib/geminiHelper';
import { AcademicBreak } from '../lib/calendarMappings';

export const calendarSyncService = {
  /**
   * Simulates scraping the Thales Academy calendar and uses AI to extract break dates.
   * In a production environment, this would hit a proxy or Cloud Function to get the HTML.
   */
  syncCalendar: async (apiKey: string): Promise<AcademicBreak[]> => {
    // Simulated HTML/Text content from the Thales Calendar page
    const simulatedSource = `
      Thales Academy Academic Calendar 2025-26
      - Labor Day: Sept 1, 2025 (No School)
      - Fall Break (Track Out): Sept 20 - Oct 12, 2025
      - Thanksgiving Break: Nov 24 - 28, 2025
      - Winter Break (Track Out): Dec 20, 2025 - Jan 11, 2026
      - MLK Day: Jan 19, 2026
      - Spring Break (Track Out): March 14 - April 5, 2026
      - Memorial Day: May 25, 2026
      - Summer Break: June 13 - July 19, 2026
    `;

    const prompt = `
      SOURCE CONTENT: "${simulatedSource}"
      
      Task: Extract academic breaks from the provided text for the 2025-26 year.
      Return a list of objects with: name, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), and pausesPacingWeek (boolean).
      
      Rules:
      - "pausesPacingWeek" should be true ONLY for week-long breaks (Track Outs, Thanksgiving, Winter/Spring/Summer breaks).
      - Single-day holidays should have startDate and endDate same.
    `;

    const schema = {
      breaks: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            startDate: { type: "STRING" },
            endDate: { type: "STRING" },
            pausesPacingWeek: { type: "BOOLEAN" }
          },
          required: ["name", "startDate", "endDate", "pausesPacingWeek"]
        }
      }
    };

    try {
      const result = await geminiHelper.generateStructuredJSON<{ breaks: AcademicBreak[] }>(
        prompt,
        schema,
        ['breaks'],
        apiKey
      );
      return result.breaks;
    } catch (error) {
      console.error("Calendar Sync AI Error:", error);
      throw new Error("Failed to parse calendar data using AI.");
    }
  }
};
