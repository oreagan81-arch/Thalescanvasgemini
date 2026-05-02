// Thales Deterministic Rules Engine
import { parseMathTest, parseReadingWeek, resolveELAResource } from './mappings';

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
  gradingType?: 'pass_fail' | 'percent' | 'letter_grade' | 'points';
  omitFromFinalGrade?: boolean;
  dueDateOffset?: number;
}

export const rulesEngine = {
  generateAssignments: (row: PlannerRow): GeneratedAssignment[] => {
    // RULE 0 — FRIDAY: No assignments on Friday.
    if (row.day === 'Friday') return [];

    const assignments: GeneratedAssignment[] = [];
    const n = parseInt(row.lessonNum);

    // RULE 1 & 2 — MATH
    if (row.subject === 'Math') {
      if (row.type === 'Test') {
        assignments.push({ title: `SM5: Math Test ${row.lessonNum}`, points: 100, published: false, gradingType: 'percent' });
        assignments.push({ title: `SM5: Fact Test ${row.lessonNum}`, points: 100, published: false, gradingType: 'percent' });
        assignments.push({ title: `SM5: Study Guide ${row.lessonNum}`, points: 0, published: false, isStudyGuide: true, gradingType: 'pass_fail', omitFromFinalGrade: true });
      } else {
        // PARITY CHECK: One assignment per day (Evens OR Odds)
        const suffix = n % 2 === 0 ? 'Evens' : 'Odds';
        assignments.push({ title: `SM5: Lesson ${row.lessonNum} ${suffix}`, points: 100, published: false, gradingType: 'percent' });
      }
    } 
    // RULE 3, 4, 5 — READING
    else if (row.subject === 'Reading') {
      if (row.type === 'Lesson') {
        assignments.push({ title: `RM4: Reading HW ${row.lessonNum}`, points: 100, published: false, gradingType: 'percent' });
      } else if (row.type === 'Test') {
        const normalizedN = n > 14 ? Math.round(n / 10) : n;
        assignments.push({ title: `RM4: Mastery Test ${normalizedN}`, points: 100, published: false, gradingType: 'percent' });
      } else if (row.type === 'Review') {
        assignments.push({ title: `RM4: Reading Checkout ${row.lessonNum}`, points: 100, published: false, gradingType: 'percent' });
      }
    }
    // RULE 6 — SPELLING
    else if (row.subject === 'Spelling' && row.type === 'Test') {
      assignments.push({ title: `RM4: Spelling Test ${row.lessonNum}`, points: 100, published: false, gradingType: 'percent' });
    }
    // RULE 7, 8, 9 — ELA
    else if (row.subject === 'Language Arts') {
      if (row.type === 'CP') {
        assignments.push({ title: `ELA4: Classroom Practice ${row.lessonNum}`, points: 100, published: false, gradingType: 'percent' });
      } else if (row.type === 'Test') {
        const chapterNum = row.lessonNum.toString().split('.')[0];
        assignments.push({ title: `ELA4: Shurley Test ${chapterNum}`, points: 100, published: false, gradingType: 'percent' });
      }
      // Lessons return [] per Rule 9
    }
    // RULE 10 & 11 — HISTORY / SCIENCE (Always empty)

    return assignments;
  },

  generateFriendlySlug: (prefix: string, title: string, id: string): string => {
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const shortId = id.slice(0, 4);
    return `/${prefix}/${cleanTitle}-${shortId}`;
  },

  safeParseNumber: (value: any, fallback: number = 0): number => {
    if (typeof value === 'number' && !isNaN(value)) return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^0-9.-]+/g, ""));
      return isNaN(parsed) ? fallback : parsed;
    }
    return fallback;
  },

  clickableDownloads: (html: string): string => {
    if (!html) return html;
    const urlRegex = /(?<!href="|src=")(https?:\/\/[^\s<]+)/gi;
    return html.replace(urlRegex, (url) => {
      return `<a class="instructure_file_link inline_disabled" href="${url}" target="_blank" title="Download Resource">${url}</a>`;
    });
  },

  silentAuditor: (content: string): string => {
    if (!content) return content;
    const forbiddenVendors = /\b(Sa[xk]s?t?o[ni]e?(\s*Math)?|Sh[iu]rl[ey]e?(\s*(English|Grammar))?|Story\s*of\s*the\s*World|SOTW)\b/gi;
    if (forbiddenVendors.test(content)) {
      return content.replace(forbiddenVendors, (match) => {
        const m = match.toLowerCase();
        if (m.includes('sa') || m.includes('sk')) return 'Math';
        if (m.includes('sh')) return 'ELA';
        if (m.includes('story') || m.includes('sotw')) return 'History';
        return 'Standard Curriculum';
      });
    }
    return content;
  },

  sanitizeForCanvas: (htmlContent: string, title: string): string => {
    if (!htmlContent) return '';
    if (typeof DOMParser === 'undefined') {
       let sanitized = htmlContent;
       if (!sanitized.includes('dp-box')) {
          sanitized = `<div class="dp-box">\n${sanitized}\n</div>`;
       }
       return sanitized;
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const elements = doc.querySelectorAll('*');
    elements.forEach(el => el.removeAttribute('style'));
    const headers = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headers.forEach(h => { h.classList.add('dp-header'); });
    if (headers.length === 0) {
      const header = doc.createElement('h2');
      header.className = 'dp-header';
      header.textContent = title;
      doc.body.insertBefore(header, doc.body.firstChild);
    }
    let finalHtml = doc.body.innerHTML;
    if (!finalHtml.includes('dp-box')) {
      finalHtml = `<div class="dp-box">\n${finalHtml}\n</div>`;
    }
    return finalHtml;
  },

  verifyCurriculum: (type: 'math' | 'reading' | 'ela', identifier: number, generatedContent: string): { isValid: boolean; errors: string[] } => {
    const contentLower = generatedContent.toLowerCase();
    const errors: string[] = [];
    const forbiddenVendors = /\b(Sa[xk]s?t?o[ni]e?|Sh[iu]rl[ey]e?|Story\s*of\s*the\s*World|SOTW)\b/i;
    if (forbiddenVendors.test(generatedContent)) {
        errors.push("Brevity Mandate Violation: Vendor names detected in student-facing content.");
    }
    if (type === 'math') {
      const exactMathData = parseMathTest(identifier);
      if (!contentLower.includes(exactMathData.powerUp.toLowerCase())) errors.push(`Missing Power Up: ${exactMathData.powerUp}`);
      if (!contentLower.includes(exactMathData.factSkill.toLowerCase())) errors.push(`Missing Fact Skill: ${exactMathData.factSkill}`);
      return { isValid: errors.length === 0, errors };
    }
    if (type === 'reading') {
      const exactReadingData = parseReadingWeek(identifier);
      const benchmark = exactReadingData.fluencyBenchmark;
      if (!contentLower.includes(benchmark.label.toLowerCase())) errors.push(`Missing fluency benchmark: "${benchmark.label}"`);
      return { isValid: errors.length === 0, errors };
    }
    return { isValid: errors.length === 0, errors };
  }
};

export const { generateAssignments, generateFriendlySlug, safeParseNumber, silentAuditor, sanitizeForCanvas } = rulesEngine;
