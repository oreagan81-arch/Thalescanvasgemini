import { startOfISOWeek, addDays, format, parseISO } from 'date-fns';
import { calculatePacingWeek, ACADEMIC_CALENDAR_25_26, AcademicBreak } from '../lib/calendarMappings';

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
    let calculationDate = new Date(date);
    const day = date.getDay();
    const hours = date.getHours();

    // Friday 4pm rollover logic
    if ((day === 5 && hours >= 16) || day === 6 || day === 0) {
      const daysToNextMonday = day === 0 ? 1 : (8 - day);
      calculationDate.setDate(calculationDate.getDate() + daysToNextMonday);
      calculationDate.setHours(12, 0, 0, 0);
    }

    const pacing = calculatePacingWeek(calculationDate);
    const calcTimestamp = calculationDate.getTime();
    
    // Find matched quarter using date ranges
    const currentQ = CALENDAR_DATA.find(q => {
      const start = parseISO(q.start + "T00:00:00").getTime();
      const end = parseISO(q.end + "T23:59:59").getTime();
      return calcTimestamp >= start && calcTimestamp <= end;
    });

    if (currentQ) {
      const firstWeekOfQuarter = calculatePacingWeek(parseISO(currentQ.start + "T12:00:00")).weekNumber;
      const weekInQuarter = Math.max(1, pacing.weekNumber - firstWeekOfQuarter + 1);
      return { quarter: currentQ.quarter, week: weekInQuarter, year: ACADEMIC_YEAR };
    }

    // Handle breaks (return next upcoming quarter)
    const nextQ = CALENDAR_DATA.find(q => parseISO(q.start + "T00:00:00").getTime() > calcTimestamp);
    return { quarter: nextQ?.quarter || 4, week: 1, year: ACADEMIC_YEAR };
  },

  getDatesForContext: (quarter: number, week: number) => {
    const qData = CALENDAR_DATA.find(q => q.quarter === quarter);
    if (!qData) return [];
    const qStart = parseISO(qData.start + "T12:00:00");
    const weekStart = addDays(qStart, (week - 1) * 7);
    return [0, 1, 2, 3, 4].map(dayOffset => {
      const date = addDays(weekStart, dayOffset);
      return { label: format(date, 'EEEE'), formatted: format(date, 'MM/dd/yy'), iso: format(date, 'yyyy-MM-dd') };
    });
  },

  getWeekId: (context: AcademicContext) => {
    return `Q${context.quarter}_W${context.week}`;
  }
};
