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
   * Fix 5: NaN & Type Guarding
   */
  safeParseNumber: (value: any, fallback: number = 0): number => {
    if (typeof value === 'number' && !isNaN(value)) return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^0-9.-]+/g, ""));
      return isNaN(parsed) ? fallback : parsed;
    }
    return fallback;
  },

  /**
   * Upgrade: Regex Clickable Downloads
   * Detects raw HTTP strings and wraps them in Canvas native preview styling.
   */
  clickableDownloads: (html: string): string => {
    if (!html) return html;
    // Regex for URLs not already inside an href or src
    const urlRegex = /(?<!href="|src=")(https?:\/\/[^\s<]+)/gi;
    return html.replace(urlRegex, (url) => {
      return `<a class="instructure_file_link inline_disabled" href="${url}" target="_blank" title="Download Resource">${url}</a>`;
    });
  },

  /**
   * Fix 5: Brevity Mandate Enforcement (Silent Auditor)
   */
  silentAuditor: (content: string): string => {
    if (!content) return content;
    
    // Flag and remove specific curriculum vendors
    const forbiddenVendors = /(Saxon|Shurley|Story of the World)/gi;
    if (forbiddenVendors.test(content)) {
      console.warn("RulesEngine: Silent Auditor flagged and redacted a vendor name.");
      return content.replace(forbiddenVendors, (match) => {
        if (match.toLowerCase().includes('saxon')) return 'Math';
        if (match.toLowerCase().includes('shurley')) return 'ELA';
        if (match.toLowerCase().includes('story of the world')) return 'History';
        return 'Standard Curriculum';
      });
    }
    
    return content;
  },

  /**
   * Fix 6: Cidi Labs (DesignPlus) Enforcement
   * Canvas requires specific structural wrappers (dp-box) and header classes (dp-header).
   */
  sanitizeForCanvas: (htmlContent: string, title: string): string => {
    if (!htmlContent) return '';
    if (typeof DOMParser === 'undefined') {
       // Server-side or primitive fallback
       let sanitized = htmlContent;
       if (!sanitized.includes('dp-box')) {
         sanitized = `<div class="dp-box">\n${sanitized}\n</div>`;
       }
       return sanitized;
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    // Remove prohibited inline styles
    const elements = doc.querySelectorAll('*');
    elements.forEach(el => el.removeAttribute('style'));

    // Enforce dp-header class on all headers
    const headers = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headers.forEach(h => {
      h.classList.add('dp-header');
    });

    // Ensure at least one header exists
    if (headers.length === 0) {
      const header = doc.createElement('h2');
      header.className = 'dp-header';
      header.textContent = title;
      doc.body.insertBefore(header, doc.body.firstChild);
    }

    // Enforce dp-box wrapper
    let finalHtml = doc.body.innerHTML;
    if (!finalHtml.includes('dp-box')) {
      finalHtml = `<div class="dp-box">\n${finalHtml}\n</div>`;
    }

    return finalHtml;
  },

  /**
   * Verifies curriculum accuracy against the Intelligence Engine Pedagogical Rules.
   */
  verifyCurriculum: (
    type: 'math' | 'reading' | 'ela', 
    identifier: number, 
    generatedContent: string
  ): { isValid: boolean; errors: string[] } => {
    const contentLower = generatedContent.toLowerCase();
    const errors: string[] = [];

    // Brevity Mandate Audit
    if (contentLower.includes('saxon') || contentLower.includes('shurley')) {
        errors.push("Brevity Mandate Violation: Vendor names detected in student-facing content.");
    }

    if (type === 'math') {
      const exactMathData = parseMathTest(identifier);
      if (!contentLower.includes(exactMathData.powerUp.toLowerCase())) {
        errors.push(`Missing Power Up: ${exactMathData.powerUp}`);
      }
      if (!contentLower.includes(exactMathData.factSkill.toLowerCase())) {
        errors.push(`Missing Fact Skill: ${exactMathData.factSkill}`);
      }
      return { isValid: errors.length === 0, errors };
    }

    if (type === 'reading') {
      const exactReadingData = parseReadingWeek(identifier);
      const benchmark = exactReadingData.fluencyBenchmark;
      
      // Reading Checkout Enforcement - Strict prompt alignment
      const expectedGoal = `${benchmark.wpm} words per minute (WPM) with ${benchmark.errorLimit} or fewer errors`;
      if (!contentLower.includes(expectedGoal.toLowerCase()) && !contentLower.includes(`${benchmark.wpm} wpm`)) {
          errors.push(`Reading Checkout Rule Violation: Missing "${expectedGoal}" fluency goal.`);
      }

      if (!contentLower.includes(benchmark.label.toLowerCase())) {
         errors.push(`Missing fluency benchmark: "${benchmark.label}"`);
      }
      return { isValid: errors.length === 0, errors };
    }

    return { isValid: errors.length === 0, errors };
  }
};

// Named exports for compatibility
export const { generateAssignments, generateFriendlySlug, safeParseNumber, silentAuditor, sanitizeForCanvas } = rulesEngine;
