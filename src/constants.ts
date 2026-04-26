/**
 * THALES ACADEMY — SHARED CORE INFRASTRUCTURE
 * Version 2.0.0 | 2025–2026 Academic Year
 * Registry of Course IDs and Thales-compliant settings.
 */

export const DOMAIN = "thalesacademy.instructure.com";
export const BASE_API = `https://${DOMAIN}/api/v1`;

// --- The Single Source of Truth for Course IDs ---
export const THALES_COURSE_REGISTRY: Record<string, number> = {
  math: 21957,
  reading: 21919, // Covers Reading and Spelling
  ela: 21944,     // Language Arts
  history: 21934,
  science: 21970,
  homeroom: 22254, // Newsletter / Announcements
};

export const ENVIRONMENT = "DEVELOPMENT"; // DEVELOPMENT | STAGING | PRODUCTION
export const ENABLE_FRIDAY_RULE = true;   // Thales rule: Friday = delete In Class section

export const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "Accept": "application/json",
};

// Compatibility aliases for legacy services
export const COURSE_IDS = THALES_COURSE_REGISTRY;
export const NOTIFICATION_RECIPIENT = "OReagan81@gmail.com";
export const SNOW_DAY_MESSAGE = "❄️ SNOW DAY — NO SCHOOL";
export const CURRICULUM_SHEET_URL = "https://docs.google.com/spreadsheets/d/thales-curriculum-2025";

export const THALES_PROTOCOL_INVARIANTS = `
1. **Curriculum Alignment**: All generated content must strictly follow the Thales Academy pacing guide for the 2025-2026 year.
2. **HTML Compliance**:
   - No inline styles are allowed (e.g., no style="...").
   - Every page or announcement must begin with an <h2> or <h3> tag.
   - Use standard HTML tables for agendas, formatted with Thales-themed headers.
3. **Tone and Voice**: Professional, warm, and authoritative. Use the teacher's selected tone (Warm/Formal/Friendly/Direct).
4. **Security**: Never output sensitive URLs or API keys in the Canvas body.
5. **Deterministic Logic**: If a Math Test is detected, automatically include the Power Up and Fact Skill in the communication.
6. **Friday Handshake**: On Fridays, "In Class" instructions are replaced with specific "Friday Completion" checklists.
7. **Mapping Integrity**: Only valid Course IDs from the registry may be targeted for deployments.
`;
