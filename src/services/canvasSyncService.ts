import { canvasApiService } from './canvasApiService';
import { assignmentService, Assignment } from './service.assignment';
import { rulesEngine } from '../lib/thales/rulesEngine';
import { useStore } from '../store';
import { THALES_COURSE_REGISTRY } from '../constants';

export const canvasSyncService = {
  syncWeekToCanvas: async (
    weekId: string,
    subjectPages: Array<{
      subject: string;
      htmlContent: string;
      pageId?: string;
    }>,
    assignments: Assignment[]
  ) => {
    const { dryRun } = useStore.getState();
    const results = {
      assignments: [] as { id: string, canvasUrl: string }[],
      pages: [] as { subject: string, url: string }[],
      moduleStatus: ''
    };

    if (dryRun) {
      console.log("[DRY_RUN] Sync started for", weekId);
      return { ...results, moduleStatus: 'Dry Run Complete' };
    }

    // PASS 1: Assignments
    for (const assign of assignments) {
      if (assign.status === 'Deployed' && assign.canvasId) continue;
      
      try {
        const canvasAssign = await canvasApiService.createOrUpdateAssignment(
          assign.courseId.toString(),
          { 
            name: assign.title, 
            due_at: assign.dueDate ? (assign.dueDate.toDate ? assign.dueDate.toDate().toISOString() : assign.dueDate) : (typeof assign.dueDate === 'string' ? assign.dueDate : null), 
            points_possible: assign.points ?? 100, 
            grading_type: assign.gradingType || 'percent', 
            omit_from_final_grade: assign.omitFromFinalGrade || false, 
            submission_types: ['online_upload'] 
          },
          assign.canvasId
        );
        await assignmentService.updateStatus(assign.id!, 'Deployed', canvasAssign.id.toString());
        results.assignments.push({ id: assign.id!, canvasUrl: canvasAssign.html_url });
      } catch (error) {
        console.error(`Assignment deployment failed: ${assign.title}`, error);
      }
    }

    // PASS 2: Subject Pages
    for (const sPage of subjectPages) {
      const normalizedSubject = sPage.subject.toLowerCase() === 'language arts' ? 'ela' : 
                               sPage.subject.toLowerCase() === 'spelling' ? 'reading' : 
                               sPage.subject.toLowerCase();
      
      const courseId = (THALES_COURSE_REGISTRY[normalizedSubject] || THALES_COURSE_REGISTRY['homeroom'])?.toString();
      if (!courseId) continue;

      let finalHtml = rulesEngine.clickableDownloads(sPage.htmlContent);
      finalHtml = rulesEngine.sanitizeForCanvas(finalHtml, `Weekly Agenda - ${weekId.replace('_', ' ')}`);

      try {
        const canvasPage = await canvasApiService.createOrUpdatePage(courseId, {
          title: 'Weekly Agenda',
          body: finalHtml,
          published: false
        });
        
        results.pages.push({ subject: sPage.subject, url: canvasPage.html_url });
        
        // PASS 3: Module Placement
        try {
          const moduleName = `Agenda: ${weekId.replace('_', ' ')}`;
          const module = await canvasApiService.getOrCreateModule(courseId, moduleName);
          await canvasApiService.addModuleItem(courseId, module.id.toString(), {
             title: 'Weekly Agenda', type: 'Page', content_id: canvasPage.url
          });
        } catch (e) {
          console.warn(`Module placement failed for ${sPage.subject}`, e);
        }
      } catch (error) {
        console.error(`Page deployment failed for ${sPage.subject}`, error);
      }
    }

    results.moduleStatus = results.pages.length > 0 ? 'Sync Complete' : 'Nothing Syncable Found';
    return results;
  }
};
