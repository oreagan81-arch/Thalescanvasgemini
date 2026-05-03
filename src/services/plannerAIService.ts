import { rulesEngine } from '../lib/thales/rulesEngine';
import { canvasApiService } from './canvasApiService';
import { aiCacheService } from './service.aiCache';
import { generateHash } from '../lib/utils';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

export interface AIPlanDay {
  id?: string;
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
  lesson: string;
  objectives: string[];
  homework: string;
  resources: string[];
}

export interface AIPlannerResult {
  course: string;
  week: string;
  days: AIPlanDay[];
}

export const plannerAIService = {
  /**
   * STAGE 1: PARSE (Delegated to Backend)
   * Triggers a Cloud Function to handle the heavy AI extraction.
   */
  async startParseTask(rawText: string, existingState?: any, historicalContext?: any, targetDays?: string[]): Promise<string> {
    const startAiPlanGeneration = httpsCallable(functions, 'startAiPlanGeneration');
    const response = await startAiPlanGeneration({ rawText, existingState, historicalContext, targetDays });
    const data = response.data as { jobId: string };
    return data.jobId;
  },

  /**
   * STAGE 2: VALIDATE (Rules Engine)
   * Enforces Thales Invariants and the Brevity Mandate.
   */
  async validate(data: AIPlannerResult): Promise<{ isValid: boolean; errors: string[]; sanitized: AIPlannerResult }> {
    const errors: string[] = [];
    const itemsToAudit: any[] = [];

    const sanitized: AIPlannerResult = {
      ...data,
      days: data.days.map(d => {
        // Apply Silent Auditor (Brevity Mandate)
        const cleanLesson = rulesEngine.silentAuditor(d.lesson || "");
        const cleanHomework = rulesEngine.silentAuditor(d.homework || "");
        
        // Prepare list for bulk audit
        const subjectType = (data.course || "").toLowerCase().includes('math') ? 'math' :
                           (data.course || "").toLowerCase().includes('reading') ? 'reading' :
                           (data.course || "").toLowerCase().includes('english') || (data.course || "").toLowerCase().includes('ela') ? 'ela' : null;
        
        if (subjectType) {
          const lessonMatch = (d.lesson || "").match(/\d+/);
          if (lessonMatch) {
            itemsToAudit.push({
              type: subjectType,
              identifier: parseInt(lessonMatch[0]),
              content: d.lesson || "",
              day: d.day
            });
          }
        }

        return {
          ...d,
          lesson: cleanLesson,
          homework: cleanHomework,
          objectives: d.objectives?.map(obj => rulesEngine.silentAuditor(obj)) || []
        };
      })
    };

    // Bulk Audit on Server
    if (itemsToAudit.length > 0) {
      try {
        const auditFn = httpsCallable(functions, 'auditCurriculum');
        const { data: result } = await auditFn({ items: itemsToAudit }) as any;
        if (result.success && result.results) {
          result.results.forEach((r: any) => {
            if (!r.audit.isValid) {
              const auditItem = itemsToAudit.find(orig => orig.identifier === r.identifier && orig.type === r.type);
              errors.push(...r.audit.errors.map((err: string) => `[${auditItem?.day || 'Audit'}] ${err}`));
            }
          });
        }
      } catch (err) {
        console.warn("[VALIDATION] Audit failed:", err);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized
    };
  },

  /**
   * STAGE 3: GENERATE (HTML/Content)
   * Produces Thales-branded HTML fragments for Canvas LMS following the structured agenda logic.
   */
  generateHTML(data: AIPlannerResult): string {
    const courseTitle = data.course || 'Curriculum Overview';
    const weekId = data.week || 'Active Week';

    return `
      <div class="dp-box">
        <h2 class="dp-header">${courseTitle} | Week ${weekId}</h2>
        <div style="padding: 20px;">
          ${data.days.map(d => {
            const isFriday = d.day === 'Friday';
            const lessonDisplay = isFriday 
              ? `<span style="color: #c87800; font-weight: bold;">ASSESSMENT DAY</span>` 
              : d.lesson;

            return `
              <div style="margin-bottom: 25px; border-bottom: 1px solid #f0f0f0; padding-bottom: 15px;">
                <h3 style="color: #0065a7; margin-top: 0; margin-bottom: 8px; font-size: 1.2em;">${d.day}</h3>
                <div style="margin-bottom: 12px;">
                  <div style="font-weight: 500; font-size: 1.1em;">${lessonDisplay}</div>
                  ${d.objectives && d.objectives.length > 0 ? `
                    <ul style="color: #555; font-size: 0.9em; margin: 8px 0; padding-left: 20px;">
                      ${d.objectives.map(o => `<li>${o}</li>`).join('')}
                    </ul>` : ''}
                </div>
                <div style="background-color: #fdfdfd; border: 1px solid #eee; padding: 12px; border-radius: 6px;">
                  <div style="font-size: 0.75rem; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Homework & Checklist</div>
                  <div style="margin-bottom: 10px;">${d.homework || "None scheduled."}</div>
                  ${d.resources && d.resources.length > 0 ? `
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                      ${d.resources.map(r => rulesEngine.clickableDownloads(r)).join('')}
                    </div>` : ''}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  },

  /**
   * STAGE 4: POST (Canvas API)
   * Synchronizes the generated content with the institutional LMS.
   */
  async postToCanvas(courseId: string, title: string, html: string): Promise<any> {
    try {
      const sanitized = rulesEngine.sanitizeForCanvas(html, title);
      return await canvasApiService.createOrUpdatePage(courseId, {
        title: title,
        body: sanitized,
        published: false
      });
    } catch (error) {
      console.error("Canvas Stage 4 Post Error:", error);
      throw new Error(`Deployment Failure: ${error instanceof Error ? error.message : 'Unknown Canvas API Error'}`);
    }
  },

  /**
   * Orchestrates the 4-stage pipeline with a caching layer.
   */
  async orchestratePlanSync(rawText: string, options: { apiKey?: string; courseId?: string; title?: string } = {}): Promise<{ html: string; fromCache: boolean }> {
    // 1. Generate local hash of input
    const inputHash = await generateHash(rawText);
    
    // 2. Check Cache
    const cachedHtml = await aiCacheService.get<string>(inputHash);
    if (cachedHtml) {
      return { html: cachedHtml, fromCache: true };
    }

    // Note: Due to the job system being async, this high-level orchestrator 
    // would now likely be used inside a Component that handles the Job lifecycle.
    // For now, we maintain this structure for backward compatibility.
    throw new Error("Local orchestration disabled. Use plannerAIService.startParseTask() and useJob() hook for backend-driven sync.");
  }
};

