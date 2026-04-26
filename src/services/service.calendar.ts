import { 
  startOfISOWeek, 
  addDays, 
  format, 
  isWithinInterval, 
  parseISO,
  differenceInWeeks
} from 'date-fns';

export interface AcademicContext {
  quarter: number;
  week: number;
  year: string;
}

/**
 * Thales Academy 2025-2026 Academic Calendar Configuration
 * Standard 10-week quarters with inter-track breaks.
 */
const ACADEMIC_YEAR = '2025-26';
const CALENDAR_DATA = [
  { quarter: 1, start: '2025-07-07', end: '2025-09-12' },
  { quarter: 2, start: '2025-10-06', end: '2025-12-12' },
  { quarter: 3, start: '2026-01-05', end: '2026-03-13' },
  { quarter: 4, start: '2026-04-06', end: '2026-06-12' }
];

export const calendarService = {
  /**
   * Identifies the current academic quarter and week based on a date.
   * If between quarters, it defaults to the next upcoming quarter's week 1.
   */
  getAcademicContext: (date: Date = new Date()): AcademicContext => {
    for (const q of CALENDAR_DATA) {
      const qStart = parseISO(q.start);
      const qEnd = parseISO(q.end);
      
      if (isWithinInterval(date, { start: qStart, end: qEnd })) {
        // Calculate week within quarter (1-indexed)
        const weekNum = differenceInWeeks(date, qStart) + 1;
        return { quarter: q.quarter, week: Math.min(weekNum, 10), year: ACADEMIC_YEAR };
      }
    }

    // Default: Check if we are before a quarter starts
    for (const q of CALENDAR_DATA) {
      if (date < parseISO(q.start)) {
        return { quarter: q.quarter, week: 1, year: ACADEMIC_YEAR };
      }
    }

    // Fallback to end of year
    return { quarter: 4, week: 10, year: ACADEMIC_YEAR };
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
