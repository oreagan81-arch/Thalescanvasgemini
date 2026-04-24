import DOMPurify from 'dompurify';

export const sanitizeHTML = (html: string) => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'h1', 'h2', 'h3', 'h4', 
      'br', 'div', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr'
    ],
    ALLOWED_ATTR: ['href', 'target', 'style', 'class', 'id', 'rel'],
  });
};

/**
 * Use this hook to safely render HTML in components
 */
export const useSafeHTML = (html: string) => {
  return { __html: sanitizeHTML(html) };
};
