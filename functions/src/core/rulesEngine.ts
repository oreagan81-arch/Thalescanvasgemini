/**
 * THALES ACADEMIC OS - MASTER RULES ENGINE (v14.0)
 * SOLE SOURCE OF TRUTH FOR ACADEMIC LOGIC.
 */

import { parseMathTest, parseReadingWeek, getReadingFluencyBenchmark, resolveReadingTest, getSpellingWords, getChallengeWords } from './mappings';

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
  homework?: string;
  resources?: string[];
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
   * BREVITY MANDATE (Rule 2): Strip vendor names and standardize lesson titles.
   */
  thalesify: (text: string, subject: string): string => {
    if (!text) return "";
    let clean = text.trim();

    // Remove Forbidden Vendors
    const forbiddenVendors = /\b(Sa[xk]s?t?o[ni]e?|Sh[iu]rl[ey]e?|Story\s*of\s*the\s*World|SOTW)\b/i;
    clean = clean.replace(forbiddenVendors, (match) => {
      const m = match.toLowerCase();
      if (m.includes('sa')) return 'Math';
      if (m.includes('sh')) return 'ELA';
      if (m.includes('story') || m.includes('sotw')) return 'History';
      return 'Standard Curriculum';
    });

    // Subject-Specific Polishing
    const s = subject.toLowerCase();
    if (s.includes('math')) {
      const match = clean.match(/Lesson\s+(\d+)/i);
      return match ? `Lesson ${match[1]}` : clean;
    }
    if (s.includes('reading')) {
      const match = clean.match(/Reading\s+Lesson\s+(\d+)/i);
      return match ? `Reading Lesson ${match[1]}` : clean;
    }
    if (s.includes('spelling')) {
      const match = clean.match(/Spelling\s+Lesson\s+(\d+)/i);
      return match ? `Spelling Lesson ${match[1]}` : clean;
    }
    if (s.includes('ela') || s.includes('english')) {
      const dotMatch = clean.match(/(?:Chapter\s+)?(\d+)\.(\d+)/i);
      if (dotMatch) return `Chapter ${dotMatch[1]}, Lesson ${dotMatch[2]}`;
      const match = clean.match(/Chapter\s+(\d+),\s+Lesson\s+(\d+)/i);
      return match ? `Chapter ${match[1]}, Lesson ${match[2]}` : clean;
    }

    return clean;
  },

  /**
   * FRIDAY RULE: No instructional sections, only assessments.
   */
  isInstructional: (content: string): boolean => {
    const keywords = ['instruction', 'teaching', 'introduction', 'guided practice', 'direct instruction'];
    const lower = content.toLowerCase();
    return keywords.some(k => lower.includes(k));
  },

  /**
   * APPLY ACADEMIC LOGIC (Master Enforcer)
   */
  applyDayRules: (day: DayPlan): DayPlan => {
    if (!day.resources) day.resources = [];
    if (!day.homework) day.homework = "";

    // 1. Friday Assessment Lockdown
    if (day.day === 'Friday') {
      day.lessons = day.lessons.filter(l => !rulesEngine.isInstructional(l.description || ""));
      // Weekend Cheer
      if (!day.homework.includes('wonderful weekend')) {
        day.homework = (day.homework + "\nHave a wonderful weekend!").trim();
      }
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

    // 3. Curriculum Injection (The "Truth" Layer)
    day.lessons.forEach(lesson => {
      lesson.lessonTitle = rulesEngine.thalesify(lesson.lessonTitle, lesson.subject);
      lesson.objectives = []; // Rule: Strip Objectives

      // Math Evens/Odds Logic
      if (lesson.subject.toLowerCase().includes('math')) {
        const match = lesson.lessonTitle.match(/Lesson\s+(\d+)/i);
        if (match) {
          const num = parseInt(match[1]);
          lesson.homework = `Lesson ${num} ${num % 2 === 0 ? 'Evens' : 'Odds'}`;
        }
      }

      // Reading Fluency Injection
      if (lesson.subject.toLowerCase().includes('reading')) {
        const match = lesson.lessonTitle.match(/\d+/);
        if (match) {
          const benchmark = getReadingFluencyBenchmark(parseInt(match[0]));
          if (lesson.description && !lesson.description.includes(benchmark.label)) {
            lesson.description += `\n\nFluency Goal: ${benchmark.label}`;
          }
        }
      }
    });

    return day;
  },

  /**
   * ACADEMIC ASSIGNMENT GENERATION (Rule 1-11)
   */
  generateAssignments: (row: any, existing: any[] = []): any[] => {
    // RULE 0 — FRIDAY: No assignments on Friday.
    if (row.day === 'Friday') return [];

    const assignments: any[] = [];
    const n = parseInt(row.lessonNum) || 0;

    const safePush = (item: any) => {
      if (!existing.some(a => a.title === item.title) && !assignments.some(a => a.title === item.title)) {
        assignments.push(item);
      }
    };

    // RULE 1 & 2 — MATH
    if (row.subject === 'Math') {
      if (row.type === 'Test') {
        rulesEngine.buildMathTest(row.lessonNum).forEach(safePush);
        // Study guide
        safePush({ title: `SM5: Study Guide ${row.lessonNum}`, points: 0, published: false, isStudyGuide: true, gradingType: 'pass_fail', omitFromFinalGrade: true });
      } else {
        const suffix = n % 2 === 0 ? 'Evens' : 'Odds';
        safePush({ title: `SM5: Lesson ${row.lessonNum} ${suffix}`, points: 100, published: false, gradingType: 'percent' });
      }
    } 
    // RULE 3, 4, 5 — READING (LOCKED LOGIC)
    else if (row.subject === 'Reading') {
      rulesEngine.buildReadingAssignments(row).forEach(safePush);
    }
    // RULE 6 — SPELLING
    else if (row.subject === 'Spelling' && row.type === 'Test') {
      rulesEngine.buildSpellingAssignments(row).forEach(safePush);
    }
    // RULE 7, 8, 9 — ELA
    else if (row.subject === 'Language Arts') {
      if (row.type === 'CP') {
        safePush({ title: `ELA4: Classroom Practice ${row.lessonNum}`, points: 100, published: false, gradingType: 'percent' });
      } else if (row.type === 'Test') {
        const chapterNum = row.lessonNum.toString().split('.')[0];
        safePush({ title: `ELA4: Shurley Test ${chapterNum}`, points: 100, published: false, gradingType: 'percent' });
      }
    }

    return assignments;
  },

  buildReadingAssignments: (obj: any) => {
    const list: any[] = [];
    const lessonNum = parseInt(obj.lessonNum);

    const testNum = resolveReadingTest(lessonNum);
    if (!testNum) return list;

    // 🔥 SINGLE SOURCE OF TRUTH
    const checkoutNum = testNum;

    list.push({ title: `RM4: Reading Test ${testNum}`, points: 100, published: false, gradingType: 'percent' });
    list.push({ title: `RM4: Checkout ${checkoutNum}`, points: 100, published: false, gradingType: 'percent' });

    return list;
  },

  buildSpellingAssignments: (obj: any) => {
    const list: any[] = [];
    if (obj.subject === 'Spelling' && obj.type === 'Test') {
      const testNum = parseInt(obj.lessonNum);
      if (testNum >= 1 && testNum <= 24) {
        list.push({ title: `RM4: Spelling Test ${testNum}`, points: 100, published: false, gradingType: 'percent' });
      }
    }
    return list;
  },

  buildMathTest: (num: number) => {
    return [
      { title: `SM5: Math Test ${num}`, points: 100, published: false, gradingType: 'percent' },
      { title: `SM5: Fact Test ${num}`, points: 100, published: false, gradingType: 'percent' }
    ];
  },

  /**
   * VERIFY CURRICULUM ACCURACY (Rule Audit)
   */
  verifyCurriculum: (type: 'math' | 'reading' | 'ela', identifier: number, content: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const lower = content.toLowerCase();

    // Global: Vendor Check
    const forbiddenVendors = /\b(Sa[xk]s?t?o[ni]e?|Sh[iu]rl[ey]e?|Story\s*of\s*the\s*World|SOTW)\b/i;
    if (forbiddenVendors.test(content)) {
        errors.push("Brevity Mandate Violation: Vendor names detected in student-facing content.");
    }

    if (type === 'math') {
      const data = parseMathTest(identifier);
      if (!lower.includes(data.powerUp.toLowerCase())) errors.push(`Missing Power Up: ${data.powerUp}`);
      if (!lower.includes(data.factSkill.toLowerCase())) errors.push(`Missing Fact Skill: ${data.factSkill}`);
    } else if (type === 'reading') {
      const benchmark = getReadingFluencyBenchmark(identifier);
      if (!lower.includes(benchmark.wpm.toString())) errors.push(`Missing/Incorrect Fluency Benchmark: Goal should be ${benchmark.wpm} WPM.`);
    }

    return { isValid: errors.length === 0, errors };
  },

  /**
   * Structural Integrity Check
   */
  validateDay: (day: any): boolean => {
    if (!day || typeof day !== 'object') return false;
    if (!day.day || !day.lessons || !Array.isArray(day.lessons)) return false;
    const hasEmptyLessons = day.lessons.some((l: any) => !l.subject || !l.lessonTitle);
    return !hasEmptyLessons;
  },

  /**
   * STAGE 1: Deterministic Parser
   * Extracts structural info from raw text WITHOUT AI for high speed and direct mapping.
   */
  deterministicParse: (rawText: string, quarter: number, weekId: string): WeeklyPlan => {
    const lines = rawText.split('\n');
    const days: DayPlan[] = [];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    dayNames.forEach(dayName => {
      const dayLines = lines.filter(l => l.includes(dayName));
      const lessons: any[] = [];

      // Extract Math
      const mathMatch = rawText.match(new RegExp(`${dayName}.*?Math:?\\s*(.*?)(?=\\n|$)`, 'i'));
      if (mathMatch) lessons.push({ subject: 'Math', lessonTitle: mathMatch[1].trim() });

      // Extract Reading
      const readingMatch = rawText.match(new RegExp(`${dayName}.*?Reading:?\\s*(.*?)(?=\\n|$)`, 'i'));
      if (readingMatch) lessons.push({ subject: 'Reading', lessonTitle: readingMatch[1].trim() });

      // Extract Spelling
      const spellingMatch = rawText.match(new RegExp(`${dayName}.*?Spelling:?\\s*(.*?)(?=\\n|$)`, 'i'));
      if (spellingMatch) lessons.push({ subject: 'Spelling', lessonTitle: spellingMatch[1].trim() });

      // Extract LA
      const laMatch = rawText.match(new RegExp(`${dayName}.*?(?:ELA|Language Arts):?\\s*(.*?)(?=\\n|$)`, 'i'));
      if (laMatch) lessons.push({ subject: 'Language Arts', lessonTitle: laMatch[1].trim() });

      days.push({ day: dayName, lessons });
    });

    return { weekId: weekId.toString(), quarter, days };
  },

  /**
   * STAGE 2: Build Structural Week
   * Ensures a standard Thales 5-day shell exists.
   */
  buildStructuralWeek: (existingDays: DayPlan[] = [], weekId: string, quarter: number): WeeklyPlan => {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const days = dayNames.map(name => {
      const existing = existingDays.find(d => d.day === name);
      return existing || { day: name, lessons: [] };
    });
    return { weekId, quarter, days };
  },

  /**
   * GLOBAL: Resource Sync (Action 1)
   */
  validateAgenda: (plan: WeeklyPlan): WeeklyPlan => {
    // Basic structural sanitization
    plan.days = plan.days.map(d => rulesEngine.applyDayRules(d));
    return plan;
  },

  /**
   * GLOBAL: Thales Rules Audit (Action 2)
   */
  validateThalesRules: (plan: WeeklyPlan): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    if (plan.days.length !== 5) errors.push("Week must have exactly 5 days.");
    return { isValid: errors.length === 0, errors };
  },

  /**
   * GLOBAL: Hard Rules (Action 3)
   */
  applyHardRules: (plan: WeeklyPlan): WeeklyPlan => {
    // Enforce Friday Assessment Rule on every day check
    plan.days = plan.days.map(d => rulesEngine.applyDayRules(d));
    return plan;
  }
};
