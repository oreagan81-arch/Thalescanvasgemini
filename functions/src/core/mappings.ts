// ============================================================================
// THE THALES INTELLIGENCE ENGINE (SERVER CORE)
// Deterministic rules for Math, Reading, Spelling, and ELA.
// ============================================================================

export const FACT_TEST_MAP: Record<number, string> = {
  1: "Addition facts starting with 5+5, 2+9",
  2: "Addition facts starting with 5+5, 2+9",
  3: "Subtraction facts starting with 9-8, 8-5",
  4: "Multiplication facts starting with 9x6, 7x1",
  5: "Addition facts starting with 5+5, 2+9",
  6: "Subtraction facts starting with 9-8, 8-5",
  7: "Subtraction facts starting with 9-8, 8-5",
  8: "Multiplication facts starting with 9x6, 7x1",
  9: "Division facts starting with 49÷7, 25÷5",
  10: "Multiplication facts starting with 9x6, 7x1",
  11: "Division facts starting with 49÷7, 25÷5",
  12: "Division facts starting with 81÷9, 48÷8",
  13: "Division facts starting with 81÷9, 48÷8",
  14: "Multiplication facts starting with 7x9, 4x4",
  15: "Multiplication facts starting with 7x9, 4x4",
  16: "Multiplication facts starting with 7x9, 4x4",
  17: "Improper fractions starting with 8/3, 12/4",
  18: "Division with remainders starting with 7÷2, 16÷3",
  19: "Improper fractions starting with 8/3, 12/4",
  20: "Reducing fractions to lowest terms starting with 2/10, 3/9",
  21: "Improper fractions starting with 8/3, 12/4",
  22: "Simplifying fractions starting with 6/4, 10/8",
  23: "Reducing fractions to lowest terms starting with 2/10, 3/9"
};

export const POWER_UP_MAP: Record<number, string> = {
  1: "A", 2: "A", 3: "B", 4: "C", 5: "A", 6: "B", 7: "B", 8: "C", 9: "D", 10: "C",
  11: "D", 12: "E", 13: "E", 14: "F", 15: "F", 16: "F", 17: "H", 18: "G", 19: "H",
  20: "I", 21: "H", 22: "J", 23: "I"
};

export interface ParsedMathTest {
  testNumber: number;
  powerUp: string;
  factSkill: string;
  timed: boolean;
  studyGuideIncluded: boolean;
  powerUpUrl: string;
}

export function parseMathTest(testNumber: number): ParsedMathTest {
  const num = typeof testNumber === 'string' ? parseInt(testNumber.replace(/[^0-9]/g, '')) : testNumber;
  const powerUp = POWER_UP_MAP[num] || "Unknown Power Up";
  return {
    testNumber: num,
    powerUp,
    factSkill: FACT_TEST_MAP[num] || "Standard Fact Practice",
    timed: true,
    studyGuideIncluded: true,
    powerUpUrl: `https://thalesacademy.instructure.com/files/power-up-${powerUp.toLowerCase()}-practice.pdf`,
  };
}

// --- READING & SPELLING MAPPINGS ---

// --- Reading Test System (Hard-Locked Logic) ---
export const FLUENCY_BANDS = [
  { range: [1, 7], wpm: 100, errors: 2 },
  { range: [8, 10], wpm: 115, errors: 2 },
  { range: [11, 13], wpm: 130, errors: 2 }
] as const;

export function resolveFluency(testNum: number) {
  return FLUENCY_BANDS.find(b =>
    testNum >= b.range[0] && testNum <= b.range[1]
  );
}

// --- HARD MAP (NO DRIFT) ---
export const READING_TEST_MAP: Record<number, number> = {
  80: 8,
  90: 9,
  100: 10,
  110: 11,
  120: 12,
  130: 13
};

export function resolveReadingTest(lessonNum: number) {
  return READING_TEST_MAP[lessonNum] || null;
}

export interface FluencyBenchmark {
  wpm: number;
  errorLimit: number;
  label: string;
}

export function getReadingFluencyBenchmark(testNumber: number): FluencyBenchmark {
  const meta = resolveFluency(testNumber);
  if (meta) {
    return { wpm: meta.wpm, errorLimit: meta.errors, label: `The goal of this fluency check is to read ${meta.wpm} words per minute with ${meta.errors} or fewer errors.` };
  }
  // Fallback if not in bands
  return { wpm: 130, errorLimit: 2, label: "The goal of this fluency check is to read 130 words per minute with 2 or fewer errors." };
}

export interface SpellingTestData {
  lessonsCovered: string;
  words: string[];
}

export const SPELLING_TEST_MAP: Record<number, SpellingTestData> = {
  1: { lessonsCovered: "1-5", words: ["write", "right", "happy", "review", "straightest", "building", "misquote", "view", "sleepless", "research", "study", "cheapest", "equal", "wander", "unhappy", "source", "unequal", "childless", "listening", "sign", "cloudless", "lightest", "stretch", "rebuild", "people"] },
  2: { lessonsCovered: "1-10", words: ["feat", "feet", "fight", "darkness", "searching", "spelling", "remarkable", "useless", "stretching", "sleeping", "unbreakable", "answer", "careless", "style", "quote", "uneven", "picture", "stretched", "resource", "author", "largest", "please", "quietness", "question", "lovable"] },
  3: { lessonsCovered: "1-15", words: ["clothes", "close", "package", "delightful", "biggest", "soreness", "helpful", "choice", "person", "sailboat", "unlikely", "school", "choking", "final", "thoughtful", "sketch", "mistake", "fitness", "lightly", "different", "running", "stopped", "quietly", "wreck", "hopelessly"] },
  4: { lessonsCovered: "1-20", words: ["hole", "whole", "together", "cloudy", "reserve", "strength", "carry", "grabbed", "length", "presented", "childish", "caught", "rainy", "fancy", "valuable", "speaker", "quietest", "misspell", "shopper", "selfish", "sunny", "listened", "normal", "search", "straighten"] },
  5: { lessonsCovered: "1-25", words: ["right", "write", "uneven", "skating", "shopping", "biggest", "purely", "helplessness", "copying", "different", "playful", "carefully", "equally", "graceful", "mighty", "fudge", "noisy", "wonderfully", "really", "designer", "frosty", "stylish", "related", "teacher", "safely"] },
  6: { lessonsCovered: "1-30", words: ["Vary", "Very", "Foolish", "Friendliness", "Nights", "Conform", "Happiness", "Shiny", "Carried", "Easy", "Lunches", "Studied", "Disease", "Informal", "Reporter", "Strength", "Fanciest", "Classes", "Scratch", "Schools", "Drying", "Finally", "Sleepy", "Delighted", "Sadness"] },
  7: { lessonsCovered: "1-35", words: ["Through", "Lone", "Stepping", "Deserve", "Worrying", "Boxes", "Defining", "Normally", "Constrict", "Signs", "Copied", "Inside", "Resign", "Changing", "Planned", "Confine", "Lately", "Tried", "Happiest", "Pitiful", "Children", "Varied", "Lucky", "Wrapper", "Maddest"] },
  8: { lessonsCovered: "1-40", words: ["Whose", "Loan", "Misplaced", "Foolishly", "Blow", "Tricky", "Breakable", "Incurable", "Remain", "Claim", "Leave", "Conserve", "Throw", "Patches", "Pointless", "Studied", "Design", "Forcefully", "Harmlessly", "Lonely", "Stylish", "Sturdiest", "Safely", "Voltage", "Starring"] },
  9: { lessonsCovered: "1-45", words: ["Whether", "Weather", "Studying", "Confusing", "Loneliest", "Foxes", "Dosage", "Slammed", "Clapping", "Fluid", "Played", "Stitches", "Removal", "Contest", "Retract", "Leader", "Pitied", "Flatten", "Undefeated", "Contract", "Spray", "Flying", "Text", "Happily", "Stylishly"] },
  10: { lessonsCovered: "1-50", words: ["Plain", "Write", "Pause", "Darkness", "Refine", "Cause", "Invaluable", "Bloomed", "Easily", "Cloudiness", "Relate", "Placement", "Yellow", "Scratches", "Earliest", "Watches", "Payment", "Strangely", "Department", "Poison", "Planner", "Flowers", "Toughest", "Lengthening", "Unlucky"] },
  11: { lessonsCovered: "1-55", words: ["Sale", "Right", "Safest", "Basement", "Sturdiest", "Barred", "Misplaced", "Luckily", "Refreshment", "Confirmed", "Earlier", "Strangeness", "Sources", "Cloudiest", "Unlucky", "Unmistakable", "Forceful", "Questionable", "Gain", "Contracted", "Resigned", "Investment", "Reacting", "Signal", "Stained"] },
  12: { lessonsCovered: "1-60", words: ["Sale", "Sail", "Heavy", "Refinement", "Trial", "Breathe", "Cause", "Speediest", "Aren't", "Joyful", "Touched", "Wrapping", "Didn't", "Personally", "Flier", "Carrier", "Load", "Removing", "Unsnapped", "Misprinted", "Shipment", "Drainage", "Stranger", "Wonderful", "Reacting"] },
  13: { lessonsCovered: "1-65", words: ["Their", "They're", "Worrying", "Cried", "Sadder", "Hasn't", "Express", "Unrelated", "Stain", "Friendliest", "Reserving", "Toughest", "Denying", "Loneliest", "Business", "Helplessly", "Confirmed", "What's", "Exchange", "Scratched", "Tricky", "Let's", "Foolishly", "Worrier", "Strengthening"] },
  14: { lessonsCovered: "1-70", words: ["Weather", "Here", "Town", "Doesn't", "Noisiness", "Painter", "Brown", "Choicest", "Heaviest", "Luckily", "Explained", "Il", "Recently", "Relate", "Exported", "Shouldn't", "Regained", "Children", "Loudly", "Patches", "Hottest", "Foxes", "Quick", "Soundness", "Proud"] },
  15: { lessonsCovered: "1-75", words: ["Right", "Vary", "Athlete", "Everyone", "Stranger", "Wondered", "Listening", "Sudden", "Preserve", "Confronted", "Statement", "Request", "Express", "Let's", "Studying", "Delighted", "Delightful", "Replacement", "Hurried", "Danger", "Straight", "Finished", "Several", "Racing", "Beauty"] },
  16: { lessonsCovered: "1-80", words: ["Piece", "Peace", "Type", "Before", "Gripping", "Counting", "House", "That's", "Nightly", "Exclaim", "Suddenly", "Ground", "Restricted", "Quiz", "Peaceful", "Loneliest", "Chief", "Il", "Largely", "Aren't", "First", "Haven't", "Roughest", "Breathe", "Beautiful"] },
  17: { lessonsCovered: "1-85", words: ["They're", "Very", "Second", "Exciting", "Govern", "Prolong", "Grief", "Surprise", "Reason", "Trapped", "Misspell", "Briefly", "Sturdiest", "Active", "Likeliness", "Stories", "Unplanned", "Relative", "Explain", "Carries", "Greatest", "Proclaim", "Thief", "Babies", "Worries"] },
  18: { lessonsCovered: "1-90", words: ["Threw", "Through", "Department", "Expressive", "Action", "Personal", "Hotter", "Repression", "Winners", "Inactive", "Thoughts", "Hasn't", "Nastily", "Cities", "Babyish", "Reasonable", "Station", "Painter", "Actively", "They'd", "Rewrap", "Reaction", "Blackness", "Export", "Heaviest"] },
  19: { lessonsCovered: "1-95", words: ["Feat", "Their", "Thoughtless", "Worthy", "Slipping", "Refine", "Stepped", "Flattest", "Famous", "Benches", "Globe", "Movement", "Replace", "Wouldn't", "Fashion", "Strengthen", "Various", "Loudly", "Powerful", "Beautiful", "Expression", "Misspelling", "Relation", "Breath", "Dangerous"] },
  20: { lessonsCovered: "1-100", words: ["Piece", "Here", "Scribe", "Dripping", "Worthiness", "Exercised", "Nineteen", "Provision", "Athletes", "Glorious", "Resolve", "Refine", "Joyfully", "Fashionable", "Quickest", "Poisonous", "Carriage", "Tension", "Morning", "Tricky", "Contraction", "Throughout", "Roominess", "Foolishly", "Tripped"] },
  21: { lessonsCovered: "1-105", words: ["Their", "Peace", "Furious", "Listen", "Nervous", "Hurries", "Proportion", "Different", "Snapping", "Interested", "Photograph", "Government", "Crease", "Thirst", "Script", "Brief", "Settle", "Agree", "Strict", "Children", "Creative", "Relatively", "Tense", "Delightful", "Spirit"] },
  22: { lessonsCovered: "1-110", words: ["Clothes", "Weather", "Protect", "Instead", "Stretch", "Rejection", "Pressure", "Detective", "Scripts", "Author", "Edgy", "Progression", "Healthy", "Concept", "Conquest", "Anybody", "Feature", "Rather", "Seize", "Station", "Receptive", "Except", "Treatment", "Texture", "Chiefly"] },
  23: { lessonsCovered: "1-115", words: ["Right", "Whose", "Logic", "Passion", "Snapped", "Retain", "Exception", "Maintain", "Physical", "Deceptive", "Featuring", "Science", "Development", "Pleasure", "Relatively", "Detain", "Preserve", "Scripture", "Projecting", "Fashionable", "Contain", "Protective", "Deception", "Union", "Tension"] },
  24: { lessonsCovered: "1-120", words: ["Their", "Feet", "Where", "Together", "Friendly", "Straight", "Shopper", "Valuable", "Different", "Enough", "Sport", "Helpless", "Shaping", "Strengthening", "Sign", "Teach", "School", "Greatest", "Really", "Misspell", "Refreshing", "Light", "Should", "Planned", "Undefeated"] }
};

export function getSpellingWords(testNum: number): string[] {
  const data = SPELLING_TEST_MAP[testNum];
  if (!data) return [];
  return data.words.slice(0, 5); // deterministic, first 5
}

export function getChallengeWords(testNum: number): string[] {
  const data = SPELLING_TEST_MAP[testNum];
  if (!data || data.words.length < 25) return []; // Require full list
  return [
    data.words[4],
    data.words[9],
    data.words[14],
    data.words[19],
    data.words[24]
  ];
}

export interface ParsedReadingWeek {
  weekNumber: number;
  spellingLessonsCovered: string;
  spellingWords: string[];
  fluencyBenchmark: FluencyBenchmark;
  checkoutPage?: string;
}

export function parseReadingWeek(weekNumber: number, checkoutTestNumber: number = weekNumber): ParsedReadingWeek {
  const spellingData = SPELLING_TEST_MAP[weekNumber];
  return {
    weekNumber,
    spellingLessonsCovered: spellingData ? spellingData.lessonsCovered : "N/A",
    spellingWords: spellingData ? spellingData.words : ["Review words from previous week"],
    fluencyBenchmark: getReadingFluencyBenchmark(checkoutTestNumber)
  };
}

// --- ELA (SHURLEY ENGLISH) MAPPINGS ---
export const ELA_SHORTHAND: Record<string, { label: string; module: string }> = {
  cp: { label: "Classroom Practice", module: "Language Arts - 4th Grade Shurley Classroom Practices" },
  cc: { label: "Chapter Checkup", module: "Language Arts - 4th Grade Chapter Checkups" },
  test: { label: "Chapter Test", module: "Language Arts - 4th Grade Tests" }
};
