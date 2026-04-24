import { GoogleGenAI, Type } from "@google/genai";
import { THALES_PROTOCOL_INVARIANTS } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface AuditReport {
  score: number;
  summary: string;
  findings: {
    file: string;
    issue: string;
    severity: "high" | "medium" | "low";
    suggestedFix: string;
  }[];
}

export const protocolService = {
  runDeepAudit: async (repoFullName: string, token: string): Promise<AuditReport> => {
    try {
      // 1. Fetch File Tree from GitHub
      const treeRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/trees/main?recursive=1`, {
        headers: { Authorization: `token ${token}` }
      });
      const treeData = await treeRes.json();
      
      // Filter for interesting files (curriculum, config, or code)
      const relevantFiles = (treeData.tree || [])
        .filter((f: any) => f.type === 'blob' && /\.(ts|js|json|md)$/.test(f.path))
        .slice(0, 10);

      // 2. Fetch File Contents
      const fileContents = await Promise.all(relevantFiles.map(async (file: any) => {
        const res = await fetch(file.url, { headers: { Authorization: `token ${token}` }});
        const data = await res.json();
        // GitHub content is base64
        const content = data.content ? atob(data.content.replace(/\n/g, '')) : '';
        return { path: file.path, content };
      }));

      // 3. Command Gemini to Audit against Invariants
      const systemPrompt = `
        You are the Thales Protocol Architect. 
        Audit the provided codebase/files against these STRICT THALES INVARIANTS:
        ${THALES_PROTOCOL_INVARIANTS}
        
        Return a JSON audit report. Be thorough and critical.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Audit this data: ${JSON.stringify(fileContents)}`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json"
        }
      });

      if (!response.text) throw new Error("Audit engine returned no data");
      return JSON.parse(response.text.trim());
    } catch (err) {
      console.error("Audit Engine Critical Failure:", err);
      throw err;
    }
  }
};
