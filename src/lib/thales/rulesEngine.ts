// Thales UI & Canvas Utilities
// ACADEMIC LOGIC HAS BEEN MOVED TO SERVER CORE. 
// DO NOT ADD ACADEMIC RULES HERE.

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
  /**
   * BREVITY MANDATE (Rule 2): Strip vendor names for UI display.
   * This is a UI-only mirroring of server-side thalesify academic logic.
   */
  thalesify: (text: string): string => {
    if (!text) return "";
    let clean = text.trim();
    const forbiddenVendors = /\b(Sa[xk]s?t?o[ni]e?|Sh[iu]rl[ey]e?|Story\s*of\s*the\s*World|SOTW)\b/i;
    clean = clean.replace(forbiddenVendors, (match) => {
      const m = match.toLowerCase();
      if (m.includes('sa')) return 'Math';
      if (m.includes('sh')) return 'ELA';
      if (m.includes('story') || m.includes('sotw')) return 'History';
      return 'Standard Curriculum';
    });
    return clean;
  },

  /**
   * Alias for thalesify to support legacy codebases.
   */
  silentAuditor: (text: string): string => rulesEngine.thalesify(text),

  /**
   * Generates a unique, friendly URL slug.
   */
  generateFriendlySlug: (prefix: string, title: string, id: string): string => {
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const shortId = id.slice(0, 4);
    return `/${prefix}/${cleanTitle}-${shortId}`;
  },

  /**
   * Safe numeric parser for UI inputs.
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
   * Converts bare URLs in text into clickable links.
   */
  clickableDownloads: (html: string): string => {
    if (!html) return html;
    const urlRegex = /(?<!href="|src=")(https?:\/\/[^\s<]+)/gi;
    return html.replace(urlRegex, (url) => {
      return `<a class="instructure_file_link inline_disabled" href="${url}" target="_blank" title="Download Resource">${url}</a>`;
    });
  },

  /**
   * Wraps content in Thales Cidi Labs standard boxes and applies headers.
   */
  sanitizeForCanvas: (htmlContent: string, title: string): string => {
    if (!htmlContent) return '';
    
    // Server-side safe (no DOMParser)
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
  }
};

export const { generateFriendlySlug, safeParseNumber, sanitizeForCanvas } = rulesEngine;

