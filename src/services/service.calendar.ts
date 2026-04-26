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
    // Rollover logic: Friday at 4pm (16:00)
    let calculationDate = new Date(date);
    const day = date.getDay(); // 0: Sunday, 5: Friday, 6: Saturday
    const hours = date.getHours();

    // If Friday after 4pm, or Saturday/Sunday, treat as "Next Week"
    if ((day === 5 && hours >= 16) || day === 6 || day === 0) {
      const daysToNextMonday = day === 0 ? 1 : (8 - day);
      calculationDate.setDate(calculationDate.getDate() + daysToNextMonday);
      calculationDate.setHours(12, 0, 0, 0);
    }

    const pacing = calculatePacingWeek(calculationDate);
    
    // Thales Academic Structure (Instructional Weeks):
    // Q1: Weeks 1-9   (9 weeks)
    // Q2: Weeks 10-18 (9 weeks)
    // Q3: Weeks 19-27 (9 weeks)
    // Q4: Weeks 28-37 (10 weeks)
    let quarter = 1;
    let weekInQuarter = pacing.weekNumber;

    if (pacing.weekNumber >= 28) {
      quarter = 4;
      weekInQuarter = pacing.weekNumber - 27;
    } else if (pacing.weekNumber >= 19) {
      quarter = 3;
      weekInQuarter = pacing.weekNumber - 18;
    } else if (pacing.weekNumber >= 10) {
      quarter = 2;
      weekInQuarter = pacing.weekNumber - 9;
    } else {
      quarter = 1;
      weekInQuarter = pacing.weekNumber;
    }

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

    // Use T12:00:00 to prevent timezone shifts from pushing the date to the previous day (Sunday)
    const qStart = parseISO(qData.start + "T12:00:00");
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
