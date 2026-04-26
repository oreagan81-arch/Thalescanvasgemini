import { 
  startOfISOWeek, 
  addDays, 
  format, 
  isWithinInterval, 
  parseISO,
  differenceInWeeks
} from 'date-fns';
import { 
  calculatePacingWeek, 
  ACADEMIC_CALENDAR_25_26,
  AcademicBreak 
} from '../lib/calendarMappings';

export interface AcademicContext {
  quarter: number;
  week: number;
  year: string;
}

const ACADEMIC_YEAR = '2025-26';
const CALENDAR_DATA = [
  { quarter: 1, start: '2025-07-21', end: '2025-09-19' },
  { quarter: 2, start: '2025-10-13', end: '2025-12-19' },
  { quarter: 3, start: '2026-01-12', end: '2026-03-13' },
  { quarter: 4, start: '2026-04-06', end: '2026-06-12' }
];

export { calculatePacingWeek, ACADEMIC_CALENDAR_25_26 };
export type { AcademicBreak };

export const calendarService = {
  calculatePacingWeek,
  getAcademicContext: (date: Date = new Date()): AcademicContext => {
    const pacing = calculatePacingWeek(date);
    // Rough mapping of pacing week to quarter for backward compatibility
    // Quarters are roughly 9-10 instructional weeks
    let quarter = 1;
    if (pacing.weekNumber > 27) quarter = 4;
    else if (pacing.weekNumber > 18) quarter = 3;
    else if (pacing.weekNumber > 9) quarter = 2;

    const weekInQuarter = ((pacing.weekNumber - 1) % 9) + 1;

    return { 
      quarter, 
      week: weekInQuarter, 
      year: '2025-26' 
    };
  },

  /**
   * Generates the Monday-Friday dates for a specific Q/W context.
   */
  getDatesForContext: (quarter: number, week: number) => {
    const qData = CALENDAR_DATA.find(q => q.quarter === quarter);
    if (!qData) return [];

    const qStart = parseISO(qData.start);
    const weekStart = addDays(qStart, (week - 1) * 7);
    
    return [0, 1, 2, 3, 4].map(dayOffset => {
      const date = addDays(weekStart, dayOffset);
      return {
        label: format(date, 'EEEE'),
        formatted: format(date, 'MM/dd/yy'),
        iso: format(date, 'yyyy-MM-dd')
      };
    });
  },

  /**
   * Helper to format the unique week identifier used for Firestore keys.
   * Format: Q{Q}_W{W} (e.g., Q4_W3)
   */
  getWeekId: (context: AcademicContext) => {
    return `Q${context.quarter}_W${context.week}`;
  }
};
