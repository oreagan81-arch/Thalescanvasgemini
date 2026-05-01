import { addWeeks, parseISO, format, startOfWeek, isValid, addBusinessDays, isAfter, isSameDay } from 'date-fns';
import { geminiHelper } from '../lib/geminiHelper';
import { AcademicBreak } from '../lib/calendarMappings';
import { PacingWeek } from './service.pacingImport';

export const calendarSync = {
  /**
   * Takes existing pacing rows and repositions them relative to a new start date.
   */
  migratePacing(oldData: PacingWeek[], newStartDate: string): PacingWeek[] {
    const newStart = parseISO(newStartDate);
    
    if (!isValid(newStart)) {
      throw new Error("Invalid start date provided for migration.");
    }

    const firstMonday = startOfWeek(newStart, { weekStartsOn: 1 });

    return oldData.map((week, index) => {
      // Calculate current quarter/week (9, 9, 9, 10 weeks)
      const totalWeeks = index + 1;
      let quarter = 1;
      let weekInQuarter = totalWeeks;

      if (totalWeeks >= 28) {
        quarter = 4;
        weekInQuarter = totalWeeks - 27;
      } else if (totalWeeks >= 19) {
        quarter = 3;
        weekInQuarter = totalWeeks - 18;
      } else if (totalWeeks >= 10) {
        quarter = 2;
        weekInQuarter = totalWeeks - 9;
      } else {
        quarter = 1;
        weekInQuarter = totalWeeks;
      }
      
      const newWeekId = `Q${quarter}_W${weekInQuarter}`;

      // Calculate the new Monday for this specific week (for logging or future date fields)
      const shiftedMonday = addWeeks(firstMonday, index);
      
      return {
        ...week,
        weekId: newWeekId,
        assignments: (week.assignments || []).map((a: any) => ({
          ...a,
          completed: false,
          syncedToCanvas: false
        }))
      };
    });
  },

  /**
   * Shifts all dates (week starts and assignments) forward by X business days
   * starting from a specific target date (e.g., a Snow Day).
   */
  shiftDates(plannerData: any[], fromDate: string, daysToShift: number = 1): any[] {
    const shiftStart = parseISO(fromDate);
    if (!isValid(shiftStart)) throw new Error("Invalid start date for shift.");

    return plannerData.map(week => {
      let newWeekStartDate = week.startDate;
      
      // Shift the overall week's start date if it falls on or after the snow day
      if (week.startDate) {
        const wDate = parseISO(week.startDate);
        if (isAfter(wDate, shiftStart) || isSameDay(wDate, shiftStart)) {
          // addBusinessDays automatically skips Saturdays and Sundays!
          newWeekStartDate = format(addBusinessDays(wDate, daysToShift), 'yyyy-MM-dd');
        }
      }

      // Shift individual assignment due dates
      const newAssignments = (week.assignments || []).map((a: any) => {
        if (!a.dueDate && !a.date) return a;
        
        // Handle whichever date field the assignment uses
        const dateField = a.dueDate ? 'dueDate' : 'date';
        const aDate = parseISO(a[dateField]);
        
        if (isAfter(aDate, shiftStart) || isSameDay(aDate, shiftStart)) {
          return {
            ...a,
            [dateField]: format(addBusinessDays(aDate, daysToShift), 'yyyy-MM-dd'),
            syncedToCanvas: false // Flag this so it gets picked up by your Pre-Flight Diff later
          };
        }
        return a;
      });

      return {
        ...week,
        startDate: newWeekStartDate,
        assignments: newAssignments
      };
    });
  }
};

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
