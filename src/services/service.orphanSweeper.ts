import { canvasApiService } from './canvasApiService';
import { useStore } from '../store';

export interface FileCleanupPlan {
  fileId: number;
  originalName: string;
  newName: string;
  targetFolderName: string;
}

export const orphanSweeperService = {
  /**
   * Scans the root folder of a Canvas course for disorganized files.
   */
  async getOrphanedFiles(courseId: string) {
    // 1. Get the designated root folder for the course
    const rootFolder = await canvasApiService.get(`https://thalesacademy.instructure.com/api/v1/courses/${courseId}/folders/by_path/`);
    // Note: Canvas often returns a list if we use /folders/root, but by_path/ without path returns the true root.
    // However, the common standard is to look for files that have no parent_folder in a certain context or just specifically the true root.
    
    // Let's try to get the specific root folder ID
    const folders = await canvasApiService.get(`https://thalesacademy.instructure.com/api/v1/courses/${courseId}/folders?per_page=100`);
    const root = folders.find((f: any) => f.parent_folder_id === null) || folders[0];
    
    if (!root) throw new Error("Could not identify Canvas root folder.");

    // 2. Fetch all files currently sitting in that folder
    const files = await canvasApiService.get(`https://thalesacademy.instructure.com/api/v1/folders/${root.id}/files?per_page=100`);
    return files;
  },

  /**
   * Passes messy filenames to Gemini to categorize and rename them standardly.
   */
  async analyzeFiles(files: any[]): Promise<FileCleanupPlan[]> {
    if (files.length === 0) return [];
    
    const { geminiApiKey } = useStore.getState();
    const apiKey = geminiApiKey || (import.meta.env.VITE_GEMINI_API_KEY as string);
    if (!apiKey) throw new Error("Gemini API Key missing.");

    // Strip payload down to save token context window
    const fileList = files.map(f => ({ id: f.id, name: f.display_name }));

    const systemPrompt = `
      You are an expert academic file organizer for Thales Academy. Analyze the following list of messy Canvas file names.
      For each file:
      1. Infer the subject, week number (if applicable), and asset type (e.g., Worksheet, Quiz, Reading, Slides, ParentLetter).
      2. Standardize the name to this exact format: "[Subject]_[Week]_[AssetType].[ext]" (e.g., "Math_W1_Worksheet.pdf"). Preserve the original file extension.
      3. Determine the target folder it belongs in, strictly formatted as "Week [Number]" (e.g., "Week 1"). 
      4. If it doesn't clearly fit a specific week, assign it to "General Resources".

      Return a JSON array of objects with this exact schema:
      [{
        "fileId": number,
        "originalName": string,
        "newName": string,
        "targetFolderName": string
      }]
      
      Respond ONLY with valid, raw JSON. Do not use markdown blocks or preamble.
    `;

    // Use Gemini 1.5 Flash for speed and accuracy in classification tasks
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: JSON.stringify(fileList) }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { 
            temperature: 0.1, 
            responseMimeType: "application/json" 
          }
        })
      }
    );

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || "Gemini Analysis Failed");
    }

    const result = await response.json();
    let text = result.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("JSON Parse Error on Gemini Response:", text);
        throw new Error("AI returned malformed data.");
    }
  },

  /**
   * Executes the AI's cleanup plan by creating folders and moving files via the Canvas API.
   */
  async executeCleanup(courseId: string, plan: FileCleanupPlan[]) {
    // 1. Get all existing folders to avoid duplicating folders
    const existingFolders = await canvasApiService.get(`https://thalesacademy.instructure.com/api/v1/courses/${courseId}/folders?per_page=100`);
    const folderMap = new Map<string, number>(); // Name -> ID
    existingFolders.forEach((f: any) => folderMap.set(f.name, f.id));

    // 2. Process each file in the plan
    for (const item of plan) {
      let targetFolderId = folderMap.get(item.targetFolderName);

      // Create folder if it doesn't exist yet
      if (!targetFolderId) {
        const newFolder = await canvasApiService.post(`https://thalesacademy.instructure.com/api/v1/courses/${courseId}/folders`, {
          name: item.targetFolderName
        });
        targetFolderId = newFolder.id;
        folderMap.set(item.targetFolderName, targetFolderId as number);
      }

      // Move and rename the file in Canvas
      await canvasApiService.put(`https://thalesacademy.instructure.com/api/v1/files/${item.fileId}`, {
        name: item.newName,
        parent_folder_id: targetFolderId
      });
    }
  }
};
