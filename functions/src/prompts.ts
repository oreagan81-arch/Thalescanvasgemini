/**
 * THALES ACADEMIC OS: CENTRAL PROMPT REGISTRY
 * Version: 1.1.0
 * 
 * Centralizing schemas and prompts to prevent drift and ensure
 * consistent AI extractions across environments.
 */

export const PROMPT_VERSIONS = {
  PLANNER_EXTRACTION: "2.1.0",
  CORE: "2.1.0"
};

export const PROMPT_VERSION = "v2.1";

export const PLAN_ITEM_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    subject: { type: "string" },
    lessonTitle: { type: "string" },
    description: { type: "string" },
    objectives: { type: "array", items: { type: "string" } },
    homework: { type: "string" },
    resources: { type: "array", items: { type: "string" } }
  },
  required: ["lessonTitle"]
};

/**
 * Schema for Thales Lesson Plan Enrichment (Bulk Lessons)
 */
export const ENRICHMENT_SCHEMA = {
  type: "object",
  properties: {
    enrichedItems: {
      type: "array",
      items: PLAN_ITEM_SCHEMA
    }
  },
  required: ["enrichedItems"]
};

/**
 * Schema for Thales Lesson Plan Extraction
 */
export const PLANNER_SCHEMA = {
  type: "object",
  properties: {
    course: { type: "string", description: "The name of the course or subject" },
    quarter: { type: "number", description: "Academic Quarter (1-4)" },
    week: { type: "string", description: "The week identifier (e.g., '28', 'Week 4')" },
    reminders: { type: "array", items: { type: "string" }, description: "Assessments and important dates" },
    resources: { type: "array", items: { type: "string" }, description: "Links to worksheets, textbooks, and study guides" },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "The original document ID" },
          day: { 
            type: "string", 
            enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            description: "Target school day"
          },
          lessons: {
            type: "array",
            items: PLAN_ITEM_SCHEMA
          }
        },
        required: ["day"]
      }
    }
  },
  required: ["course", "week", "days"]
};

/**
 * SYSTEM CONSTRAINTS
 * Mandatory rules for every agent in the Thales Academic OS.
 */
export const SYSTEM_CONSTRAINTS = `
  SYSTEM MANDATES:
  - YOU ARE THE THALES ACADEMIC OS ORCHESTRATOR.
  - ROLE: Transform structured pacing data into pixel-perfect Canvas content.
  - BRANDING: Thales Academy at Flowers Plantation Guidelines.
  - BREVITY MANDATE (v14.0):
    - Strip all vendor names (Saxon, Shurley, etc.).
    - Condense titles (e.g., "Math Lesson 78" -> "Lesson 78").
    - "At Home" detail is minimal (e.g., "Lesson 78 Evens").
  - ZERO HALLUCINATION: Only use provided curriculum data.
  - OUTPUT FORMAT: Strict JSON only. No prose.
`;

/**
 * Schema for Agent 1: Parser
 */
export const PARSER_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          subject: { type: "string" },
          lessonNum: { type: "string" },
          lessonTitle: { type: "string" },
          week: { type: "number" },
          quarter: { type: "number" }
        },
        required: ["subject", "lessonTitle"]
      }
    }
  },
  required: ["items"]
};

/**
 * AGENT 1: PARSER
 * Role: Reads pacing sheets and extracts raw curriculum data points.
 */
export const getParserPrompt = (rawText: string) => `
  AGENT ROLE: Curriculum Parser
  TASK: Extract individual curriculum items from the raw text.
  ${SYSTEM_CONSTRAINTS}

  INPUT: ${rawText}
  OUTPUT: A JSON object with an 'items' array. Each item has: subject, lessonNum, lessonTitle, week, quarter.
  STRICT: Do not organize into weeks yet. Just extract every mentioned lesson as a flat row.
`;

/**
 * AGENT 2: PLANNER
 * Role: Builds the structural week, handling diffs and manual overrides.
 */
export const getPlannerPrompt = (extractedData: string, existingState?: string, historicalContext?: string) => `
  AGENT ROLE: Strategic Planner
  TASK: Organize raw curriculum data into a 5-day week structure.
  ${SYSTEM_CONSTRAINTS}
  
  CONTEXT:
  - RAW_DATA: ${extractedData}
  - EXISTING_STATE: ${existingState || 'None'}
  - HISTORICAL_STYLE: ${historicalContext || 'None'}

  INSTRUCTIONS:
  1. Map lessons to Monday-Friday.
  2. If EXISTING_STATE is provided, preserve manual edits and IDs.
  3. Ensure subjects follow the Thales Academy pacing (Math, ELA, Sci/SS).
`;

/**
 * AGENT 3: GENERATOR (ENRICHER)
 * Role: Enriches specific lessons for a SINGLE DAY with academic detail.
 * Optimized for scale: only processes the items for one day.
 */
export const getEnrichmentPrompt = (day: string, itemsToEnrich: string, courseInfo: string) => `
  You are an expert Academic Content Producer for Thales Academy.
  
  CONTEXT:
  Course/Subject: ${courseInfo}
  Day of Week: ${day}
  Academic Standards: Thales Academy Grade 4A Curriculum Guidelines.
  
  TASK: Generate high-quality pedagogical content for the following lessons scheduled for ${day}.
  
  INPUT_ITEMS:
  ${itemsToEnrich}
  
  INSTRUCTIONS:
  1. For each item in INPUT_ITEMS, generate:
     - 'description': A concise 2-3 sentence overview of the lesson content.
     - 'objectives': 2-3 specific learning targets (observable actions).
     - 'homework': A relevant follow-up assignment if appropriate.
  2. Maintain the provided 'id' if present.
  3. Ensure tone is professional and age-appropriate for 4th Grade.
  
  ${SYSTEM_CONSTRAINTS}
`;

/**
 * AGENT 4: VALIDATOR
 * Role: Final audit for Thales Academy standards and formatting.
 */
export const getValidatorPrompt = (finalContent: string) => `
  AGENT ROLE: Compliance Validator
  TASK: Audit the plan for Thales Academy Grade 4A standards.
  ${SYSTEM_CONSTRAINTS}

  CONTENT: ${finalContent}

  THALES RULES:
  - Idempotency: No duplicates.
  - Brevity: NO VENDOR NAMES (Saxon, Shurley).
  - Friday: Assessments only, no "In Class" instructional blocks.
  
  OUTPUT: Return the FINAL JSON structure. Fix any violations internally before outputting.
`;

/**
 * System Prompt for Planner Extraction
 */
export const getPlannerSystemPrompt = (rawText: string, existingState?: string, historicalContext?: string) => `
  SYSTEM ROLE: Thales Academy Academic OS Orchestrator (${PROMPT_VERSION})
  
  TASK: Extract curriculum data from the provided text into the mandated JSON structure.
  
  ${historicalContext ? `
  CONTENT_MEMORY_ENABLED:
  HISTORICAL_CONTEXT (Previous Successful Weeks):
  ---
  ${historicalContext}
  ---
  INSTRUCTIONS: Use the tone, level of detail, and formatting style found in the HISTORICAL_CONTEXT above. If the teacher previously used specific abbreviations or descriptive styles, prioritize consistency with those patterns.
  ` : ''}

  DIFF ENGINE ENABLED:
  ${existingState ? `
  EXISTING_STATE_DETECTED:
  ---
  ${existingState}
  ---
  INSTRUCTIONS: 
  1. Compare the RAW_TEXT with the EXISTING_STATE.
  2. If a lesson already exists in the state and matches the text, PRESERVE it (keep its ID if provided).
  3. If a lesson is significantly changed or NEW in the text, generate an UPDATE or ADD.
  4. If a lesson in the EXISTING_STATE is no longer present in the RAW_TEXT, mark for DELETION (if your schema supports it) or simply omit from the ideal 'days' output.
  5. Your output 'days' should represent the FINAL CORRECTED WEEK, blending manual user edits with new pacing data.
  ` : 'No existing state. Perform fresh generation.'}

  CORE CONSTRAINTS:
  1. IDEMPOTENCY: Do not hallucinate or duplicate days.
  2. BREVITY: Strip vendor names (e.g., "Saxon Math" -> "Math").
  3. FRIDAY RULE: Focus on assessments for Fridays.
  4. VALIDATION: Ensure the 'days' array contains exactly the days present in the input.

  INPUT TEXT:
  ---
  ${rawText}
  ---

  OUTPUT: Valid JSON matching the provided responseSchema.
`;
