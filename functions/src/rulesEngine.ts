
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
    lessonNum?: string;
    lessonTitle: string;
    description?: string;
    objectives?: string[];
    homework?: string;
    resources?: string[];
  }[];
  homework?: string; // Total homework summary
  resources?: string[]; // Day-specific resources
  error?: boolean;
  message?: string;
}

export interface WeeklyPlan {
  weekId: string;
  quarter: number;
  days: DayPlan[];
  reminders?: string[];
  resources?: string[];
}

export const rulesEngine = {
  /**
   * Enforces Thales Academy specific formatting guidelines (v14.0)
   * This handles the "Brevity Mandate" and "Vendor Stripping".
   */
  thalesify: (text: string, subject: string): string => {
    if (!text) return "";
    let clean = text.trim();

    // 1. Math Brevity: "Saxon Math Lesson 78 - [Title]" -> "Lesson 78"
    if (subject.toLowerCase().includes('math')) {
      const match = clean.match(/Lesson\s+(\d+)/i);
      return match ? `Lesson ${match[1]}` : clean;
    }

    // 2. Reading/Spelling Brevity: "Reading Lesson 133 - [Title]" -> "Reading Lesson 133"
    if (subject.toLowerCase().includes('reading')) {
      const match = clean.match(/Reading\s+Lesson\s+(\d+)/i);
      return match ? `Reading Lesson ${match[1]}` : clean;
    }
    if (subject.toLowerCase().includes('spelling')) {
      const match = clean.match(/Spelling\s+Lesson\s+(\d+)/i);
      return match ? `Spelling Lesson ${match[1]}` : clean;
    }

    // 3. ELA (Shurley): "Shurley English Chapter 9, Lesson 8 - [Title]" -> "Chapter 9, Lesson 8"
    if (subject.toLowerCase().includes('ela') || subject.toLowerCase().includes('english')) {
      // Handle "Chapter 12.6" or "12.6" -> "Chapter 12, Lesson 6"
      const dotMatch = clean.match(/(?:Chapter\s+)?(\d+)\.(\d+)/i);
      if (dotMatch) {
        return `Chapter ${dotMatch[1]}, Lesson ${dotMatch[2]}`;
      }

      const match = clean.match(/Chapter\s+(\d+),\s+Lesson\s+(\d+)/i);
      return match ? `Chapter ${match[1]}, Lesson ${match[2]}` : clean;
    }

    // 4. Science/History: "Unit: [Title]; Chapter [X]: [Sub]" -> "[Title], Chapter [X]"
    if (subject.toLowerCase().match(/science|history/)) {
      const parts = clean.split(/[:;-]/);
      if (parts.length >= 2) {
        const unit = parts[0].replace(/Unit/i, '').trim();
        const chapter = parts[1].match(/Chapter\s+\d+/i)?.[0] || parts[1].trim();
        return `${unit}, ${chapter}`;
      }
    }

    return clean;
  },

  /**
   * Deterministically parses raw text or CSV/TSV data into a structural week.
   * COMPONENT: Agent 1 (PARSER)
   */
  deterministicParse: (rawText: string, quarter?: number, weekId?: string): WeeklyPlan => {
    const lines = rawText.split(/\r?\n/).map(l => l.split(/[\t,]/));
    const headerRow = lines.find(row => row.some(cell => /\d+\/\d+/.test(cell)));
    const rawItems: RawItem[] = [];

    if (headerRow) {
      const subjects: Record<string, string[]> = {};
      lines.forEach(row => {
        const firstCell = row[0]?.toLowerCase().trim();
        if (firstCell.includes('math')) subjects['math'] = row;
        else if (firstCell.includes('reading')) subjects['reading'] = row;
        else if (firstCell.includes('shurley') || firstCell.includes('english')) subjects['ela'] = row;
        else if (firstCell.includes('history')) subjects['history'] = row;
        else if (firstCell.includes('science')) subjects['science'] = row;
        else if (firstCell.includes('spelling')) subjects['spelling'] = row;
      });

      for (let i = 1; i < headerRow.length; i++) {
        if (!headerRow[i]) continue;
        const currentWeek = Math.ceil(i / 5);
        
        // Add Math
        if (subjects['math']?.[i]) {
          rawItems.push({
            subject: 'Math',
            lessonNum: '',
            lessonTitle: subjects['math'][i].trim(),
            week: currentWeek,
            quarter: quarter || 1
          });
        }
        // Add ELA
        if (subjects['ela']?.[i]) {
          rawItems.push({
            subject: 'ELA',
            lessonNum: '',
            lessonTitle: subjects['ela'][i].trim(),
            week: currentWeek,
            quarter: quarter || 1
          });
        }
        // Add Reading
        if (subjects['reading']?.[i]) {
          rawItems.push({
            subject: 'Reading',
            lessonNum: '',
            lessonTitle: subjects['reading'][i].trim(),
            week: currentWeek,
            quarter: quarter || 1
          });
        }
        // Add History/Sci
        const histSci = subjects['history']?.[i] || subjects['science']?.[i];
        if (histSci) {
          rawItems.push({
            subject: 'History/Science',
            lessonNum: '',
            lessonTitle: histSci.trim(),
            week: currentWeek,
            quarter: quarter || 1
          });
        }
      }
    } else {
      // Fallback: If no header found, treat each line as a lesson title
      lines.forEach(row => {
        if (row[0] && row[0].length > 3) {
          rawItems.push({
            subject: 'Curriculum',
            lessonNum: '',
            lessonTitle: row[0].trim(),
            week: 1,
            quarter: quarter || 1
          });
        }
      });
    }

    // Filter items by week if possible
    const weekNum = weekId ? parseInt(weekId.replace(/\D/g, '')) : 1;
    const filteredItems = rawItems.filter(item => !weekId || item.week === weekNum);

    return rulesEngine.buildStructuralWeek(filteredItems.length > 0 ? filteredItems : rawItems, weekId || '1', quarter || 1);
  },

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
      });
    });

    return { isValid: errors.length === 0, errors };
  },

  /**
   * Final structural validation and default assignment.
   * Ensures all required fields exist and fills missing optional fields.
   */
  validateAgenda: (data: any): WeeklyPlan => {
    if (!data || typeof data !== 'object') {
      throw new Error("Invalid agenda data: must be an object.");
    }

    // Required root fields
    if (!data.weekId) throw new Error("Missing required field: weekId");
    if (typeof data.quarter !== 'number') data.quarter = 1;

    // Optional root fields with defaults
    if (!data.reminders || !Array.isArray(data.reminders)) data.reminders = [];
    if (!data.resources || !Array.isArray(data.resources)) data.resources = [];

    if (!data.days || !Array.isArray(data.days)) {
      throw new Error("Invalid format: 'days' must be an array.");
    }

    // Days validation
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    data.days.forEach((day: any) => {
      if (!day.day || !validDays.includes(day.day)) {
        throw new Error(`Invalid or missing day identifier: ${day.day || 'undefined'}`);
      }
      
      // Ensure lessons array exists
      if (!day.lessons || !Array.isArray(day.lessons)) day.lessons = [];
      
      day.lessons.forEach((lesson: any) => {
        // Required lesson fields
        if (!lesson.subject) throw new Error(`Missing subject in ${day.day} lesson`);
        if (!lesson.lessonTitle) throw new Error(`Missing lessonTitle in ${day.day} ${lesson.subject} lesson`);

        // Defaults for optional lesson fields
        if (lesson.lessonNum === undefined) lesson.lessonNum = "";
        if (!lesson.objectives || !Array.isArray(lesson.objectives)) {
          lesson.objectives = [];
        }
        if (lesson.description === undefined) {
          lesson.description = "";
        }
        if (!lesson.resources || !Array.isArray(lesson.resources)) {
          lesson.resources = [];
        }
        // Homework remains optional but we ensure it's a string if present or null/undefined is fine
      });
    });

    return data as WeeklyPlan;
  },

  /**
   * Proactively applies deterministic Thales Academy rules.
   * This is NOT AI; it is deterministic business logic.
   * COMPONENT: Agent 4 (ENFORCER)
   */
  applyHardRules: (plan: WeeklyPlan): WeeklyPlan => {
    // 1. Weekly Level Defaults
    if (!plan.reminders) plan.reminders = [];
    if (!plan.resources || plan.resources.length === 0) {
      plan.resources = [
        "4th Grade Reading Workbook",
        "4th Grade Reading Textbook",
        "4th Grade Master Spelling List"
      ];
    }

    plan.days = plan.days.map(day => {
      // 2. Day Level Defaults (The "System Rules Layer")
      if (!day.resources) day.resources = [];
      if (!day.homework) day.homework = "";

      // Friday Weekend Message
      if (day.day === 'Friday' && !day.homework.includes('wonderful weekend')) {
        day.homework = (day.homework + "\nHave a wonderful weekend!").trim();
      }

      // 3. Subject-Specific Hard Rules
      
      // Reading/Spelling Combined Mandate
      const readingIdx = day.lessons.findIndex(l => l.subject.toLowerCase().includes('reading'));
      const spellingIdx = day.lessons.findIndex(l => l.subject.toLowerCase().includes('spelling'));
      
      if (readingIdx !== -1 && spellingIdx !== -1) {
        const reading = day.lessons[readingIdx];
        const spelling = day.lessons[spellingIdx];
        
        reading.subject = "Reading/Spelling";
        reading.lessonTitle = `${rulesEngine.thalesify(reading.lessonTitle, 'Reading')}, ${rulesEngine.thalesify(spelling.lessonTitle, 'Spelling')}`;
        reading.description = reading.lessonTitle;
        
        if (reading.homework || spelling.homework) {
          reading.homework = `At Home: ${reading.homework || 'Review'}, ${spelling.homework || 'Review'}`;
        }
        
        // Remove individual spelling
        day.lessons.splice(spellingIdx, 1);
      }

      // Friday - Assessment Focus
      if (day.day === 'Friday') {
        const subjects = day.lessons.map(l => l.subject.toLowerCase());
        if (subjects.some(s => s.includes('reading')) && !day.lessons.some(l => l.lessonTitle.toLowerCase().includes('fluency'))) {
          day.lessons.push({
            subject: 'Assessments',
            lessonTitle: 'Mastery Test & Fluency Check',
            description: 'Mastery assessment and reading fluency check.',
            homework: 'No Homework'
          });
        }
      }

      // 4. Individual Lesson Polishing
      day.lessons.forEach(lesson => {
        // Enforce Brevity Mandate (Rule 2)
        lesson.lessonTitle = rulesEngine.thalesify(lesson.lessonTitle, lesson.subject);
        
        // Remove Objectives (Rule 3)
        lesson.objectives = [];

        // Simplify Descriptions
        if (lesson.description && lesson.description.length > 5) {
          // If the AI output a long block, we enforce the title-as-description rule for student clarity
          lesson.description = lesson.lessonTitle;
        }

        // Standardize Math Homework
        if (lesson.subject.toLowerCase().includes('math') && lesson.homework) {
          const match = lesson.lessonTitle.match(/Lesson\s+(\d+)/i);
          if (match) lesson.homework = `Lesson ${match[1]} Evens`;
        }
      });

      return day;
    });

    return plan;
  },

  /**
   * Applies Thales Academy rules to a single day.
   */
  applyDayRules: (day: DayPlan): DayPlan => {
    // 1. Day Level Defaults
    if (!day.resources) day.resources = [];
    if (!day.homework) day.homework = "";

    // Friday Weekend Message
    if (day.day === 'Friday' && !day.homework.includes('wonderful weekend')) {
      day.homework = (day.homework + "\nHave a wonderful weekend!").trim();
    }

    // 2. Reading/Spelling Combined Mandate
    const readingIdx = day.lessons.findIndex(l => l.subject.toLowerCase().includes('reading'));
    const spellingIdx = day.lessons.findIndex(l => l.subject.toLowerCase().includes('spelling'));
    
    if (readingIdx !== -1 && spellingIdx !== -1) {
      const reading = day.lessons[readingIdx];
      const spelling = day.lessons[spellingIdx];
      
      reading.subject = "Reading/Spelling";
      reading.lessonTitle = `${rulesEngine.thalesify(reading.lessonTitle, 'Reading')}, ${rulesEngine.thalesify(spelling.lessonTitle, 'Spelling')}`;
      reading.description = reading.lessonTitle;
      
      if (reading.homework || spelling.homework) {
        reading.homework = `At Home: ${reading.homework || 'Review'}, ${spelling.homework || 'Review'}`;
      }
      
      day.lessons.splice(spellingIdx, 1);
    }

    // 3. Friday - Assessment Focus
    if (day.day === 'Friday') {
      const subjects = day.lessons.map(l => l.subject.toLowerCase());
      if (subjects.some(s => s.includes('reading')) && !day.lessons.some(l => l.lessonTitle.toLowerCase().includes('fluency'))) {
        day.lessons.push({
          subject: 'Assessments',
          lessonTitle: 'Mastery Test & Fluency Check',
          description: 'Mastery assessment and reading fluency check.',
          homework: 'No Homework'
        });
      }
    }

    // 4. Individual Lesson Polishing
    day.lessons.forEach(lesson => {
      lesson.lessonTitle = rulesEngine.thalesify(lesson.lessonTitle, lesson.subject);
      lesson.objectives = [];
      if (lesson.description && lesson.description.length > 5) {
        lesson.description = lesson.lessonTitle;
      }
      if (lesson.subject.toLowerCase().includes('math') && lesson.homework) {
        const match = lesson.lessonTitle.match(/Lesson\s+(\d+)/i);
        if (match) lesson.homework = `Lesson ${match[1]} Evens`;
      }
    });

    return day;
  },

  /**
   * Validates if a day plan meets the minimum structural requirements.
   */
  validateDay: (day: any): boolean => {
    if (!day || typeof day !== 'object') return false;
    if (!day.day || !day.lessons || !Array.isArray(day.lessons)) return false;
    
    // Check for critical missing logic/content
    const hasEmptyLessons = day.lessons.some((l: any) => !l.subject || !l.lessonTitle);
    if (hasEmptyLessons) return false;

    return true;
  }
};
