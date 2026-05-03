import * as Diff from 'diff';
import { GoogleGenAI } from "@google/genai";

export async function analyzeAiOutputChanges(
    oldOutput: string,
    newOutput: string,
    genAI: GoogleGenAI
): Promise<string> {
    const diff = Diff.createTwoFilesPatch('old', 'new', oldOutput, newOutput);
    
    // Generate an explanation for the changes
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
    const prompt = `
    Compare the following AI output changes and provide a concise summary of what was changed and why it matters.
    
    DIFF:
    \`\`\`
    ${diff}
    \`\`\`
    
    Keep the explanation brief (max 3 sentences).
    `;
    
    const result = await model.generateContent(prompt);
    return result.response.text();
}
