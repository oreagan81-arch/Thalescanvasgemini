import { addWeeks, parseISO, format, startOfWeek, isValid } from 'date-fns';
import { PacingWeek } from '../../services/service.pacingImport';

/**
 * Migrates existing pacing data to a new school year
 */
export const calendarSync = {
  /**
   * Takes existing pacing rows and repositions them relative to a new start date.
   * Useful for transitioning from 2025-26 to 2026-27.
   */
  migratePacing(oldData: PacingWeek[], newStartDate: string): PacingWeek[] {
    const newStart = parseISO(newStartDate);
    
    if (!isValid(newStart)) {
      throw new Error("Invalid start date provided for migration.");
    }

    // Ensure we start on the Monday of the selected week
    const firstMonday = startOfWeek(newStart, { weekStartsOn: 1 });

    return oldData.map((week, index) => {
      // Calculate the new Monday for this specific week
      const shiftedMonday = addWeeks(firstMonday, index);
      
      return {
        ...week,
        // Update weekId if needed, though usually sequential
        weekId: `W${index + 1}`,
        // Note: You might want to update a 'date' field if your PacingWeek includes it
        // assignments usually inherit the week's context
        assignments: (week.assignments || []).map((a: any) => ({
          ...a,
          completed: false, // Reset completion status for the new year
          syncedToCanvas: false
        }))
      };
    });
  }
};
