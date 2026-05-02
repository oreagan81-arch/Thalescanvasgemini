import { geminiHelper } from '../lib/geminiHelper';

export interface PacingDay {
  date: string;
  mathLesson: string;
  readingWeek: string;
  spellingFocus: string;
  historyScience: string;
  elaChapter: string;
}

export interface PacingWeek {
  weekNumber: number;
  weekId: string;
  days: PacingDay[];
  topic: string;
  mathLesson?: string;
  readingWeek?: string;
  elaChapter?: string;
  historyScience?: string;
  spellingFocus?: string;
  majorTests?: string[];
  assignments?: any[];
}

export const pacingImportService = {
  parse: (rawText: string): PacingWeek[] => {
    return pacingImportService.parseGoogleSheetText(rawText);
  },

  parseGoogleSheetText: (rawText: string): PacingWeek[] => {
    // Deterministic CSV/TSV Parser for Thales Pacing Guides
    const lines = rawText.split(/\r?\n/).map(l => l.split(/[\t,]/));
    if (lines.length < 2) return [];

    const headerRow = lines.find(row => row.some(cell => /\d+\/\d+/.test(cell)));
    if (!headerRow) return [];

    const subjects: Record<string, string[]> = {};
    lines.forEach(row => {
      const firstCell = row[0]?.toLowerCase().trim();
      if (firstCell.includes('math')) subjects['math'] = row;
      else if (firstCell.includes('reading')) subjects['reading'] = row;
      else if (firstCell.includes('shurley') || firstCell.includes('english')) subjects['ela'] = row;
      else if (firstCell.includes('spelling')) subjects['spelling'] = row;
      else if (firstCell.includes('history')) subjects['history'] = row;
      else if (firstCell.includes('science')) subjects['science'] = row;
    });

    const weeks: PacingWeek[] = [];
    const weeksMap: Record<number, PacingWeek> = {};

    for (let i = 1; i < headerRow.length; i++) {
        const date = headerRow[i];
        if (!date) continue;

        const weekNum = Math.ceil(i / 5);
        if (!weeksMap[weekNum]) {
            weeksMap[weekNum] = {
                weekNumber: weekNum,
                weekId: `Week ${weekNum}`,
                days: [],
                topic: "",
                majorTests: [],
                assignments: []
            };
            weeks.push(weeksMap[weekNum]);
        }

        const dayData: PacingDay = {
            date,
            mathLesson: (subjects['math']?.[i] || "").replace(/saxon\s+/i, '').trim(),
            readingWeek: (subjects['reading']?.[i] || "").trim(),
            spellingFocus: (subjects['spelling']?.[i] || "").trim(),
            historyScience: (subjects['history']?.[i] || subjects['science']?.[i] || "").trim(),
            elaChapter: (subjects['ela']?.[i] || "").replace(/shurley\s+/i, '').trim(),
        };

        weeksMap[weekNum].days.push(dayData);
        
        // Populate compatibility fields from the first available day in the week
        if (!weeksMap[weekNum].mathLesson) {
            weeksMap[weekNum].mathLesson = dayData.mathLesson;
            weeksMap[weekNum].readingWeek = dayData.readingWeek;
            weeksMap[weekNum].elaChapter = dayData.elaChapter;
            weeksMap[weekNum].historyScience = dayData.historyScience;
            weeksMap[weekNum].spellingFocus = dayData.spellingFocus;
            weeksMap[weekNum].topic = dayData.mathLesson.split(':')[0] || "New Topic";
        }
    }

    return weeks;
  }
};
