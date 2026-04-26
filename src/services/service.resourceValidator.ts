import { canvasApiService } from './canvasApiService';
import { useStore } from '../store';

export interface MissingAsset {
  weekId: string;
  assignmentTitle: string;
  reason: string;
}

export const resourceValidatorService = {
  /**
   * Cross-references planned assignments with available Canvas files
   * to catch missing PDFs, worksheets, or resources.
   */
  async findMissingAssets(courseId: string, plannerData: any[]): Promise<MissingAsset[]> {
    const { geminiApiKey } = useStore.getState();
    if (!geminiApiKey) throw new Error("Gemini API Key missing from store.");

    // 1. Fetch all files currently in the Canvas course
    const files = await canvasApiService.get(`https://thalesacademy.instructure.com/api/v1/courses/${courseId}/files?per_page=100`);
    const fileNames = files.map((f: any) => f.display_name);

    // 2. Extract all assignments that might require a file from the Planner
    const assignments = plannerData.flatMap(week =>
      (week.assignments || []).map((a: any) => ({
        weekId: week.weekId,
        title: a.title,
        type: a.type
      }))
    );

    if (assignments.length === 0) return [];

    const systemPrompt = `
      You are an elite academic auditor. Your job is to prevent broken links by comparing planned assignments with uploaded files.
      
      Compare the list of planned assignments with the list of available files in Canvas.
      Identify which assignments likely require a physical file (like a "Worksheet", "Quiz", "Reading", or "Packet") but DO NOT have a logical matching file in the Canvas list.
      
      Be forgiving with naming conventions (e.g. "Ch 3 Quiz" matches "Chapter_3_Quiz_v2.pdf").
      
      THALES SPECIFIC MAPPING RULES:
      - Assignments titled "Grammar Classroom Practice X" match files typically starting with "CP X" or found in folders named "Shurley Classroom Practices".
      - Assignments titled "Grammar Chapter Checkup X" match files starting with "CC X" or "Checkup X".
      
      Return a JSON array of missing assets using this exact schema:
      [{
        "weekId": "string",
        "assignmentTitle": "string",
        "reason": "string (Why it seems missing, e.g., 'No file found resembling Chapter 3 Quiz')"
      }]
      
      Return ONLY raw JSON. Do not wrap in markdown blocks.
    `;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: `Assignments:\n${JSON.stringify(assignments)}\n\nFiles in Canvas:\n${JSON.stringify(fileNames)}` }
              ]
            }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { 
              temperature: 0.1, 
              responseMimeType: "application/json" 
            }
          })
        }
      );

      if (!response.ok) throw new Error("Gemini Analysis Failed");
      
      const result = await response.json();
      let text = result.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      
      // Sanitize potential markdown injection
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      return JSON.parse(text);
    } catch (error) {
      console.error("Resource Validator Error:", error);
      throw error;
    }
  }
};
