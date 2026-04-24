// Thales Academy Course Routing Configuration
export const COURSE_IDS: Record<string, number> = {
  Math: 21957,
  LA: 21944,
  Reading: 21919,
  Spelling: 21919,
  History: 21934,
  Science: 21970,
  Homeroom: 22254,
};

export const SUBJECT_COLORS: Record<string, string> = {
  Math: 'text-blue-500 bg-blue-500/10',
  LA: 'text-purple-500 bg-purple-500/10',
  Reading: 'text-emerald-500 bg-emerald-500/10',
  Spelling: 'text-teal-500 bg-teal-500/10',
  History: 'text-amber-500 bg-amber-500/10',
  Science: 'text-cyan-500 bg-cyan-500/10',
  Homeroom: 'text-slate-500 bg-slate-500/10',
};

export const THALES_PROTOCOL_INVARIANTS = `
1. Friday Rule: No At Home content, no assignments (except Tests).
2. Math Test Triple: Every Math Test MUST create 3 assignments (Written Test + Fact Test + Study Guide).
3. History/Science: No assignments ever (Instruction only).
4. Language Arts: Only CP (Cumulative Practice) and Test create assignments.
5. Reading + Spelling: Together Logic (one shared page to course 21919).
6. Front Page Protection: front_page=true pages MUST have published=true.
7. Memory Precedence: Memory(>=0.6) > Templates > AI fallback.
`;

export const CURRICULUM_SHEET_URL = "https://docs.google.com/spreadsheets/d/1RpMrcQqqrDl2Gaqo2LaGTDQWvrsYwBntbYOXlIrM7LA/edit?usp=sharing";

export const NOTIFICATION_RECIPIENT = "Owen.reagan@thalesacademy.org";

export const SNOW_DAY_MESSAGE = "Snow Day-No School";
