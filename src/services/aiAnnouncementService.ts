import { geminiHelper } from '../lib/geminiHelper';

export interface GeneratedAnnouncement {
  title: string;
  bodyHTML: string;
  requiredAttachments: string[];
  toneAnalysis: string;
}

export const aiAnnouncementService = {
  generateCanvasAnnouncement: async (command: string, currentDate: string, apiKey: string): Promise<GeneratedAnnouncement> => {
    const prompt = `
      COMMAND: "${command}"
      CURRENT DATE: ${currentDate}
      
      Task: Generate a Parent Announcement or "Week Ahead" Friday Update for Canvas.
      
      CRITICAL RULES TO FOLLOW:
      1. If "Week Ahead" or "Friday Update", calculate next week's dates based on CURRENT DATE. State the Math focus (e.g., Division with remainders) and the Reading/ELA focus using deterministic WPM goals. Schedule Spelling on Thursday, Math on Friday. Include a hyperlink to the Agenda Page.
      2. If "Math Test", identify the Power Up letter, Fact Skill, and instruct parents to practice with a timer.
      3. If "Reading Week", state the exact Fluency Benchmark (e.g., 130 WPM with 2 or fewer errors) and select the 5 hardest spelling words to feature.
      4. ALWAYS adhere to the Thales Academy HTML formatting rules (<h2> header, no inline styles).
    `;

    const schema = {
      title: { type: "STRING", description: "The title of the Canvas Announcement" },
      bodyHTML: { type: "STRING", description: "The HTML content, starting with an <h2>" },
      requiredAttachments: { 
        type: "ARRAY", 
        items: { type: "STRING" },
        description: "List of files the teacher needs to upload manually (e.g., PDFs, Study Guides)"
      },
      toneAnalysis: { type: "STRING", description: "A brief 3-5 word description of the tone (e.g., 'Warm, professional, forward-looking')" }
    };

    // Force structured JSON using our Enterprise Gemini Helper
    return geminiHelper.generateStructuredJSON<GeneratedAnnouncement>(
      prompt, 
      schema, 
      ['title', 'bodyHTML', 'requiredAttachments', 'toneAnalysis'], 
      apiKey
    );
  }
};
