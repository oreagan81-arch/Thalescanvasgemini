
export interface AcademicBreak {
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  pausesPacingWeek: boolean; // True for full-week breaks, False for 1-day holidays
}

// 2025-2026 Thales Academic Calendar Exceptions
// This can be expanded to include Teacher Workdays, etc.
export const ACADEMIC_CALENDAR_25_26: AcademicBreak[] = [
  { name: "Labor Day Holiday", startDate: "2025-09-01", endDate: "2025-09-01", pausesPacingWeek: false },
  { name: "Fall Break (Track Out)", startDate: "2025-09-20", endDate: "2025-10-12", pausesPacingWeek: true },
  { name: "Thanksgiving Break", startDate: "2025-11-24", endDate: "2025-11-28", pausesPacingWeek: true },
  { name: "Winter Break (Track Out)", startDate: "2025-12-20", endDate: "2026-01-11", pausesPacingWeek: true },
  { name: "Martin Luther King Jr. Holiday", startDate: "2026-01-19", endDate: "2026-01-19", pausesPacingWeek: false },
  { name: "Spring Break (Track Out)", startDate: "2026-03-14", endDate: "2026-04-05", pausesPacingWeek: true },
  { name: "Memorial Day Holiday", startDate: "2026-05-25", endDate: "2026-05-25", pausesPacingWeek: false },
  { name: "Summer Break", startDate: "2026-06-13", endDate: "2026-07-19", pausesPacingWeek: true },
];

/**
 * Helper function to find the Monday of a given week.
 */
function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(date.setDate(diff));
}

/**
 * Calculates the exact instructional week by subtracting weeks spent on major breaks.
 */
export function calculatePacingWeek(
  currentDateStr: string | Date,
  startDateStr: string | Date = "2025-07-21"
) {
  // Normalize all dates to noon to avoid DST/timezone shifts pushing days over
  const current = new Date(currentDateStr);
  const start = typeof startDateStr === 'string' ? new Date(startDateStr + "T12:00:00") : new Date(startDateStr);
  
  // Set current to noon if it's not already
  current.setHours(12, 0, 0, 0);
  start.setHours(12, 0, 0, 0);

  if (current < start) {
    return { weekNumber: 0, status: "Summer Break (Pre-Term)" };
  }

  const startMonday = getMonday(start);
  const currentMonday = getMonday(current);
  startMonday.setHours(12, 0, 0, 0);
  currentMonday.setHours(12, 0, 0, 0);

  const msInWeek = 7 * 24 * 60 * 60 * 1000;
  // Calculate difference in weeks based on Mondays at noon
  const elapsedWeeks = Math.round((currentMonday.getTime() - startMonday.getTime()) / msInWeek) + 1;

  let currentStatus = "In Session";
  let pausedWeeks = 0;

  for (const b of ACADEMIC_CALENDAR_25_26) {
    const bStart = new Date(b.startDate + "T12:00:00");
    const bEnd = new Date(b.endDate + "T12:00:00");
    bStart.setHours(12, 0, 0, 0);
    bEnd.setHours(12, 0, 0, 0);

    // 1. Is today during this break?
    // Using a inclusive range for "today"
    const todayAtNoon = current.getTime();
    if (todayAtNoon >= bStart.getTime() && todayAtNoon <= bEnd.getTime()) {
      currentStatus = b.name;
    }

    // 2. Does this break pause the week counter?
    if (b.pausesPacingWeek) {
      let checkMonday = getMonday(bStart);
      checkMonday.setHours(12, 0, 0, 0);
      
      // If the Monday of the week is before the break starts, it was an instructional week
      if (checkMonday.getTime() < bStart.getTime()) {
        checkMonday.setDate(checkMonday.getDate() + 7);
        checkMonday.setHours(12, 0, 0, 0);
      }
      
      // Count every Monday this break spans that has already passed
      while (checkMonday.getTime() <= bEnd.getTime() && checkMonday.getTime() <= currentMonday.getTime()) {
        pausedWeeks++;
        checkMonday.setDate(checkMonday.getDate() + 7);
        checkMonday.setHours(12, 0, 0, 0);
      }
    }
  }

  const activeWeekNumber = elapsedWeeks - pausedWeeks;
  return { 
    weekNumber: activeWeekNumber > 0 ? activeWeekNumber : 1, 
    status: currentStatus 
  };
}
