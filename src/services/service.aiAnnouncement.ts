import { askGemini } from "../lib/geminiHelper";
import { 
  extractMathTestNumber, 
  parseMathTest, 
  extractReadingWeekNumber, 
  parseReadingWeek,
  parseELATest
} from "../lib/thales/mappings";
import { UserSettings } from "./service.settings";

export interface CanvasAnnouncement {
  title: string;
  bodyHTML: string;
  suggestedPostDate: string; // ISO
  requiredAttachments: string[];
  toneAnalysis: string;
}

/**
 * Generates a Canvas Announcement for parents using Gemini AI with deterministic curriculum data.
 */
export async function generateCanvasAnnouncement(
  command: string, 
  quarter: number, 
  settings: UserSettings
): Promise<CanvasAnnouncement | null> {
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

  // 2. MASTER SYSTEM PROMPT
  const SYSTEM_PROMPT = `
ACT AS: Thales Academy "Announcement Communications Director".
TEACHER IDENTITY: ${settings.teacherName} at ${settings.schoolName}.
TONE: ${settings.tone} (Encouraging, professional, clear, and perfectly focused on student success).

TASK: Generate a polished Parent Announcement for Canvas based on the user's command.

CURRICULUM INJECTION:
${curriculumContext}

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
   - Ensure the closing matches the signature: ${settings.signature}.

OUTPUT FORMAT (STRICT JSON):
{
  "title": "Announcement Title with Emoji",
  "bodyHTML": "Full formatted HTML body",
  "suggestedPostDate": "ISO-8601 string",
  "requiredAttachments": ["Name of resource", ...],
  "toneAnalysis": "Brief 1-sentence analysis of how it meets the ${settings.tone} tone"
}

Only return JSON. No commentary.
`;

  const result = await askGemini(SYSTEM_PROMPT + "\n\nUser Command: " + command);
  
  if (!result) return null;

  try {
    const cleanJson = result.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Failed to parse Canvas Announcement JSON", error);
    // Rough fallback if JSON parsing fails
    return null;
  }
}
