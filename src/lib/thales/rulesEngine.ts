// Thales Deterministic Rules Engine
import { parseMathTest, parseReadingWeek } from './mappings';

export type SubjectOptions = 'Math' | 'Reading' | 'Spelling' | 'Language Arts' | 'Science' | 'History';
export type LessonType = 'Lesson' | 'Test' | 'Quiz' | 'Project' | 'Review' | 'CP';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';

export interface PlannerRow {
  id: string;
  subject: SubjectOptions;
  lessonNum: string;
  lessonTitle: string;
  type: LessonType;
  day: DayOfWeek;
}

export interface GeneratedAssignment {
  title: string;
  points: number;
  published: boolean;
  isStudyGuide?: boolean;
}

export const rulesEngine = {
  /**
   * Rule #1: Assignment Generation Logic.
   * Deterministically creates required Canvas assignments based on the pacing row.
   */
  generateAssignments: (row: PlannerRow): GeneratedAssignment[] => {
    const assignments: GeneratedAssignment[] = [];

    if (row.subject === 'Math') {
      if (row.type === 'Test') {
        assignments.push({ title: `Math Test ${row.lessonNum}`, points: 100, published: false });
        assignments.push({ title: `Fact Test ${row.lessonNum}`, points: 100, published: false });
        assignments.push({ title: `Study Guide ${row.lessonNum}`, points: 0, published: false, isStudyGuide: true });
      } else {
        if (row.day !== 'Friday') {
          assignments.push({ title: `Math Homework (Evens/Odds) ${row.lessonNum}`, points: 10, published: false });
        }
      }
    }
    else if (row.subject === 'Language Arts') {
      if (row.type === 'CP' || row.type === 'Test') {
        assignments.push({ title: `Language Arts ${row.type === 'Test' ? 'Test' : 'CP'} ${row.lessonNum}`, points: row.type === 'Test' ? 100 : 20, published: false });
      }
    }
    else if (row.subject === 'Science' || row.subject === 'History') {
      if (['Test', 'Quiz', 'Project'].includes(row.type)) {
        assignments.push({ title: `${row.subject} ${row.type} ${row.lessonNum}`, points: row.type === 'Project' ? 50 : 100, published: false });
      }
    }
    else if (row.subject === 'Reading' || row.subject === 'Spelling') {
      if (row.type === 'Test') {
        assignments.push({ title: `${row.subject} Test ${row.lessonNum}`, points: 100, published: false });
      }
    }

    return assignments;
  },

  /**
   * Rule #2: Friendly URL Slug Generator.
   * Converts internal IDs and titles into human-readable Canvas paths.
   */
  generateFriendlySlug: (prefix: string, title: string, id: string): string => {
    const cleanTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    const shortId = id.slice(0, 4);
    return `/${prefix}/${cleanTitle}-${shortId}`;
  },

  /**
   * Validates and sanitizes HTML for Canvas compliance.
   * Upgraded to use DOMParser to safely strip inline styles and inject Thales Headers.
   */
  sanitizeForCanvas: (htmlContent: string, title: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    const elements = doc.querySelectorAll('*');
    elements.forEach(el => el.removeAttribute('style'));

    const firstChild = doc.body.firstElementChild;
    if (!firstChild || !['H2', 'H3'].includes(firstChild.tagName)) {
      const header = doc.createElement('h2');
      header.textContent = title;
      doc.body.insertBefore(header, doc.body.firstChild);
    }

    return doc.body.innerHTML;
  },

  /**
   * New Method: Verifies curriculum accuracy against the Intelligence Engine
   * Upgraded to return specific error messages instead of just a boolean.
   */
  verifyCurriculum: (
    type: 'math' | 'reading' | 'ela', 
    identifier: number, 
    generatedContent: string
  ): { isValid: boolean; errors: string[] } => {
    const contentLower = generatedContent.toLowerCase();
    const errors: string[] = [];

    if (type === 'math') {
      const exactMathData = parseMathTest(identifier);
      
      if (!contentLower.includes(exactMathData.powerUp.toLowerCase())) {
        errors.push(`Missing required Power Up: ${exactMathData.powerUp}`);
      }
      if (!contentLower.includes(exactMathData.factSkill.toLowerCase())) {
        errors.push(`Missing required Fact Skill: ${exactMathData.factSkill}`);
      }
      
      return { isValid: errors.length === 0, errors };
    }

    if (type === 'reading') {
      const exactReadingData = parseReadingWeek(identifier);
      const fluencyLabel = exactReadingData.fluencyBenchmark.label.toLowerCase();
      
      if (!contentLower.includes(fluencyLabel)) {
         errors.push(`Missing exact fluency benchmark string: "${exactReadingData.fluencyBenchmark.label}"`);
      }

      return { isValid: errors.length === 0, errors };
    }

    return { isValid: true, errors: [] };
  }
};

// Named exports for compatibility
export const { generateAssignments, generateFriendlySlug } = rulesEngine;
