import { geminiHelper } from '../lib/geminiHelper';
import { 
  extractMathTestNumber, 
  parseMathTest, 
  extractReadingWeekNumber, 
  parseReadingWeek,
  parseELATest
} from "../lib/thales/mappings";
import { useStore } from '../store';

export interface GeneratedAnnouncement {
  title: string;
  bodyHTML: string;
  suggestedPostDate: string; // ISO
  requiredAttachments: string[];
  toneAnalysis: string;
}

export const aiAnnouncementService = {
  generateCanvasAnnouncement: async (command: string, currentDate: string, apiKey: string): Promise<GeneratedAnnouncement> => {
    // 1. DETERMINISTIC DATA HYDRATION
    const mathTestNum = extractMathTestNumber(command);
    const readingWeekNum = extractReadingWeekNumber(command);
    const elaMatch = command.match(/ela\s*chapter\s*(\d+)/i);
    const elaChapterNum = elaMatch ? parseInt(elaMatch[1], 10) : null;
    
    let curriculumContext = "";
    
    if (mathTestNum !== null) {
      const math = parseMathTest(mathTestNum);
      curriculumContext += `
  MATH CURRICULUM DATA (STRICT):
  - Test Number: ${math.testNumber}
  - Power Up Letter: ${math.powerUp}
  - Fact Skill: ${math.factSkill}
  - Power Up Download URL: ${math.powerUpUrl}
  - Practice Instruction: Parents should use a timer for practice (Goal: 1 minute).
  `;
    }
    
    if (readingWeekNum !== null) {
      const reading = parseReadingWeek(readingWeekNum);
      curriculumContext += `
  READING/LA CURRICULUM DATA (STRICT):
  - Week Number: ${reading.weekNumber}
  - Complete Spelling Words: ${reading.spellingWords.join(", ")}
  - Reading Fluency Benchmark: ${reading.fluencyBenchmark.label}
  - Checkout Story: ${reading.checkoutPage}
  - Extraction Note: Identify the 5 hardest spelling words from the list above to feature in the body.
  `;
    }
  
    if (elaChapterNum !== null) {
      const ela = parseELATest(elaChapterNum);
      curriculumContext += `
  ELA (SHURLEY ENGLISH) CURRICULUM DATA (STRICT):
  - Chapter Number: ${ela.chapter}
  - Grammar Focus: ${ela.grammarFocus}
  - Note: ELA operates on a completely separate logic structure. Do NOT apply Reading/Spelling maps.
  `;
    }

    const prompt = `
      COMMAND: "${command}"
      CURRENT DATE: ${currentDate}
      
      CURRICULUM INJECTION:
      ${curriculumContext}

      Task: Generate a Parent Announcement or "Week Ahead" Friday Update for Canvas.
      
      SPECIFIC PROTOCOLS:
      1. MATH LOGIC:
         - Explicitly name the Power Up letter and specific Fact Skill.
         - Instruct parents to use a timer for practice (Goal: 1 minute).
         - Provide the Power Up Download URL as a link.
      2. READING LOGIC:
         - State the exact Fluency Benchmark label (e.g., "115 WPM with 2 or fewer errors").
         - Review the complete spelling list and extract ONLY the 5 hardest/representative words to feature as a "Sneak Peek" in the announcement body.
      3. ELA LOGIC:
         - Focus on the Chapter's specific Grammar themes. 
         - Ensure the announcement is distinct from Reading/Spelling.
      4. FORMATTING:
         - MUST start with an <h2> or <h3> Thales-standard header in the bodyHTML.
         - Use bolding for test dates and key terms.
         - Use bullet points for lists.
    `;

    const schema = {
      title: { type: "STRING", description: "The title of the Canvas Announcement" },
      bodyHTML: { type: "STRING", description: "The HTML content, starting with an <h2>" },
      suggestedPostDate: { type: "STRING", description: "ISO-8601 string for when to post" },
      requiredAttachments: { 
        type: "ARRAY", 
        items: { type: "STRING" },
        description: "List of files the teacher needs to upload manually"
      },
      toneAnalysis: { type: "STRING", description: "A brief description of the tone" }
    };

    return geminiHelper.generateStructuredJSON<GeneratedAnnouncement>(
      prompt, 
      schema, 
      ['title', 'bodyHTML', 'suggestedPostDate', 'requiredAttachments', 'toneAnalysis'], 
      apiKey
    );
  }
};
