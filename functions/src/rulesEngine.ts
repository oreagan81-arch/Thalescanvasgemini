
export interface RawItem {
  subject: string;
  lessonNum: string;
  lessonTitle: string;
  week: number;
  quarter: number;
}

export interface DayPlan {
  day: string;
  lessons: {
    subject: string;
    lessonNum: string;
    lessonTitle: string;
    description?: string;
    objectives?: string[];
    homework?: string;
  }[];
}

export interface WeeklyPlan {
  weekId: string;
  quarter: number;
  days: DayPlan[];
}

export const rulesEngine = {
  /**
   * Deterministically maps extracted items to a 5-day week.
   */
  buildStructuralWeek: (items: RawItem[], weekId: string, quarter: number): WeeklyPlan => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const structure: WeeklyPlan = {
      weekId,
      quarter,
      days: days.map(day => ({ day, lessons: [] }))
    };

    // Very basic mapping for now: Math/ELA/Reading usually happen every day if provided
    // In a real Thales app, we might check pacing indexes.
    // For the "Planner" agent role, we just want a structural skeleton.
    
    items.forEach((item, index) => {
      // Simple heuristic: distribute items across days if not specified
      const dayIndex = index % 5;
      structure.days[dayIndex].lessons.push({
        subject: item.subject,
        lessonNum: item.lessonNum,
        lessonTitle: item.lessonTitle
      });
    });

    return structure;
  },

  /**
   * Audits content for Thales Academy standards.
   */
  validateThalesRules: (plan: WeeklyPlan): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const forbiddenVendors = /\b(Sa[xk]s?t?o[ni]e?|Sh[iu]rl[ey]e?|Story\s*of\s*the\s*World|SOTW)\b/i;

    plan.days.forEach(day => {
      // RULE: Friday - Assessments only, no "In Class" instructional blocks
      if (day.day === 'Friday') {
        const hasInstructional = day.lessons.some(l => 
          l.description?.toLowerCase().includes('instruction') || 
          l.description?.toLowerCase().includes('teaching')
        );
        if (hasInstructional) {
          errors.push(`Friday Role Violation: Instructional content detected for ${day.day}. Fridays are reserved for assessments.`);
        }
      }

      day.lessons.forEach(lesson => {
        // RULE: Brevity - No Vendor Names
        const combined = `${lesson.lessonTitle} ${lesson.description || ''} ${lesson.homework || ''}`;
        if (forbiddenVendors.test(combined)) {
          errors.push(`Brevity Mandate Violation: Vendor name detected in lesson "${lesson.lessonTitle}".`);
        }

        // RULE: Reading Checkout - 100 WPM
        if (lesson.subject.toLowerCase().includes('reading') && lesson.lessonTitle.toLowerCase().includes('checkout')) {
          if (!combined.includes('100 words per minute') && !combined.includes('100 WPM')) {
            errors.push(`Reading Rule Violation: Missing "100 WPM" goal for Reading Checkout.`);
          }
        }
      });
    });

    return { isValid: errors.length === 0, errors };
  }
};
