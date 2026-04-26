import { canvasApiService } from './canvasApiService';
import { assignmentService, Assignment } from './service.assignment';
import { canvasPageService, CanvasPage } from './service.canvasPage';
import { rulesEngine } from '../lib/thales/rulesEngine';
import { useStore } from '../store';
import { db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export const canvasSyncService = {
  /**
   * Two-Pass Sync Engine:
   * 1. Sync Assignments first -> capture URLs.
   * 2. Inject URLs into Page HTML -> Sync Page.
   * 3. Auto-Modularization: Pin to week module.
   */
  syncWeekToCanvas: async (weekId: string, assignments: Assignment[], page: CanvasPage) => {
    const { canvasCourseIds } = useStore.getState();
    const homeroomId = canvasCourseIds['Homeroom'] || '22254';
    
    const results = {
      assignments: [] as { id: string, canvasUrl: string }[],
      pageUrl: '',
      moduleStatus: ''
    };

    // PASS 1: Assignments
    console.log("PASS 1: Syncing Assignments...");
    for (const assign of assignments) {
      if (assign.status === 'Deployed' && assign.canvasId) continue;

      const canvasAssign = await canvasApiService.createOrUpdateAssignment(
        assign.courseId.toString(),
        {
          name: assign.title,
          due_at: assign.dueDate ? (assign.dueDate.toDate ? assign.dueDate.toDate().toISOString() : assign.dueDate) : null,
          points_possible: assign.title.toLowerCase().includes('quiz') ? 50 : 100,
          submission_types: ['online_upload']
        },
        assign.canvasId
      );

      // Update local assignment
      await assignmentService.updateStatus(assign.id!, 'Deployed', canvasAssign.id.toString());
      // Track URL for injection
      results.assignments.push({ id: assign.id!, canvasUrl: canvasAssign.html_url });
    }

    // PASS 2: Page HTML Injection & Deployment
    console.log("PASS 2: Injecting Links and Deploying Page...");
    let finalHtml = page.htmlContent;
    
    // Inject assignment links
    results.assignments.forEach(a => {
      const escapedTitle = assignments.find(original => original.id === a.id)?.title;
      if (escapedTitle) {
        const linkHtml = `<p><a class="instructure_file_link" href="${a.canvasUrl}" target="_blank">Direct Link: ${escapedTitle}</a></p>`;
        finalHtml += `\n${linkHtml}`;
      }
    });

    // Apply Clickable Downloads regex
    finalHtml = rulesEngine.clickableDownloads(finalHtml);
    // Apply Cidi Labs Sanitization
    finalHtml = rulesEngine.sanitizeForCanvas(finalHtml, `Weekly Agenda - ${weekId}`);

    const canvasPage = await canvasApiService.createOrUpdatePage(homeroomId, {
      title: `Weekly Agenda: ${weekId.replace('_', ' ')}`,
      body: finalHtml,
      url: page.canvasPageId // Use existing slug if present
    });

    results.pageUrl = canvasPage.html_url;
    await canvasPageService.updateStatus(page.id!, 'Deployed', canvasPage.url);

    // AUTO-MODULARIZATION
    console.log("STEP 3: Auto-Modularization...");
    try {
      const moduleName = `Agender: ${weekId.replace('_', ' ')}`;
      const module = await canvasApiService.getOrCreateModule(homeroomId, moduleName);
      
      await canvasApiService.addModuleItem(homeroomId, module.id.toString(), {
         title: `Weekly Agenda: ${weekId.replace('_', ' ')}`,
         type: 'Page',
         content_id: canvasPage.url
      });
      
      results.moduleStatus = 'Pinned to Module';
    } catch (err) {
      console.warn("Modularization failed, but content is deployed.", err);
      results.moduleStatus = 'Manual placement needed';
    }

    return results;
  },

  /**
   * Pre-Flight Diff Engine:
   * Compares local queue with actual Canvas state to prevent blind syncing.
   */
  getCanvasDiff: async (courseId: string, weekId: string, localAssignments: Assignment[]) => {
    try {
      // 1. Fetch current assignments from Canvas for this course
      const canvasAssignments = await canvasApiService.secureRequest(
        `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/assignments?per_page=100`
      );

      const diff = {
        toAdd: [] as Assignment[],
        toUpdate: [] as { local: Assignment, remote: any }[],
        toArchive: [] as any[] // Remote items no longer in local list
      };

      // Find items to add or update
      localAssignments.forEach(local => {
        const remote = canvasAssignments.find((r: any) => 
          r.id.toString() === local.canvasId || r.name === local.title
        );

        if (!remote) {
          diff.toAdd.push(local);
        } else if (local.status !== 'Deployed') {
          diff.toUpdate.push({ local, remote });
        }
      });

      // Find orphans (on Canvas but not in local planner for this week)
      // This is a simplified logic: usually identified by custom prefix or tag
      // For now, tracking by name pattern
      canvasAssignments.forEach((remote: any) => {
        const isInLocal = localAssignments.some(l => 
          l.canvasId === remote.id.toString() || l.title === remote.name
        );
        if (!isInLocal && remote.name.includes(weekId)) {
          diff.toArchive.push(remote);
        }
      });

      return diff;
    } catch (err) {
      console.error("Diff Engine Error:", err);
      return null;
    }
  }
};
