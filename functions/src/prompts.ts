/**
 * THALES ACADEMIC OS: CENTRAL PROMPT REGISTRY
 * Version: 1.1.0
 * 
 * Centralizing schemas and prompts to prevent drift and ensure
 * consistent AI extractions across environments.
 */

export const PROMPT_VERSIONS = {
  PLANNER_EXTRACTION: "1.1.0"
};

/**
 * Schema for Thales Lesson Plan Extraction
 */
export const PLANNER_SCHEMA = {
  type: "object",
  properties: {
    course: { type: "string", description: "The name of the course or subject" },
    week: { type: "string", description: "The week identifier (e.g., '28', 'Week 4')" },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "The original document ID if preserving a lesson" },
          day: { 
            type: "string", 
            enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            description: "Target school day"
          },
          lesson: { type: "string", description: "The core instructional topic" },
          objectives: { 
            type: "array", 
            items: { type: "string" },
            description: "Key learning goals"
          },
          homework: { type: "string", description: "After-school assignments" },
          resources: { 
            type: "array", 
            items: { type: "string" },
            description: "Links or files mentioned"
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
  - NEVER hallucinate lesson content.
  - NEVER change provided structure or identifiers.
  - ALWAYS follow schema exactly.
  - OUTPUT must be deterministic and reusable.
  - DO NOT include explanations, preambles, or conversational text.
  - YOU ARE A SYSTEM COMPONENT, NOT A CHATBOT.
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
 * AGENT 3: GENERATOR
 * Role: Enriches the plan with objectives, homework, and resources.
 */
export const getGeneratorPrompt = (planStructure: string) => `
  AGENT ROLE: Content Generator
  TASK: Enrich the structural week plan with detailed educational content.
  ${SYSTEM_CONSTRAINTS}
  
  PLAN_STRUCTURE: ${planStructure}

  INSTRUCTIONS:
  1. Generate pedagogical objectives based on Thales Grade 4A standards.
  2. Create relevant homework assignments.
  3. Suggest instructional resources (Worksheets, Slides, etc.).
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
  - 100 WPM Fluency Goal for Reading.
  
  OUTPUT: Return the FINAL JSON structure. Fix any violations internally before outputting.
`;

/**
 * System Prompt for Planner Extraction
 */
export const getPlannerSystemPrompt = (rawText: string, existingState?: string, historicalContext?: string) => `
  SYSTEM ROLE: Thales Academy Academic OS Orchestrator (v${PROMPT_VERSIONS.PLANNER_EXTRACTION})
  
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
