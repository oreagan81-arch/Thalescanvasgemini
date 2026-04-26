import { canvasApiService } from './canvasApiService';
import { PacingWeek } from './service.pacingImport';
import { rulesEngine } from '../lib/thales/rulesEngine';

export const deepLinkSyncService = {
  /**
   * Executes a two-pass sync to tightly couple Canvas Pages with their respective Assignments.
   * Pass 1: Create/Update Assignments and capture URLs.
   * Pass 2: Inject those URLs into the Page HTML and publish.
   */
  async executeTwoPassSync(courseId: string, weekData: PacingWeek) {
    try {
      const assignmentLinks: Record<string, string> = {};
      
      // We combine majorTests and any other assignments if they exist
      const allAssignments = [
        ...(weekData.majorTests || []).map(test => ({ title: test, type: 'Test/Quiz' })),
        ...(weekData.assignments || [])
      ];

      // --- PASS 1: Create Assignments and collect their live Canvas URLs ---
      if (allAssignments.length > 0) {
        const assignmentPromises = allAssignments.map(async (assignment: any) => {
          const payload = {
            assignment: {
              name: assignment.title,
              description: rulesEngine.silentAuditor(assignment.description || `Learning Focus: ${assignment.title}`),
              submission_types: assignment.type?.toLowerCase().includes('quiz') ? ['online_quiz'] : ['online_upload'],
              points_possible: 100,
              due_at: assignment.dueDate ? new Date(assignment.dueDate).toISOString() : null,
              published: true
            }
          };
          
          // The canvasApiService queue handles rate limiting and concurrency automatically
          const createdAssignment = await canvasApiService.post(`https://thalesacademy.instructure.com/api/v1/courses/${courseId}/assignments`, payload);
          assignmentLinks[assignment.title] = createdAssignment.html_url;
          return createdAssignment;
        });

        await Promise.all(assignmentPromises);
      }

      // --- PASS 2: Generate Page HTML with Injected Deep Links ---
      const pageTitle = `Week ${weekData.weekNumber} Overview: ${weekData.mathLesson.split(':')[0] || 'Weekly Curriculum'}`;
      
      let curriculumHtml = `<h3>Weekly Curriculum Focus</h3><table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">`;
      curriculumHtml += `<tr style="background-color: #f2f2f2;"><th style="padding: 8px; border: 1px solid #ddd;">Subject</th><th style="padding: 8px; border: 1px solid #ddd;">Topic</th></tr>`;
      curriculumHtml += `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Math</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${rulesEngine.silentAuditor(weekData.mathLesson)}</td></tr>`;
      
      // MERGED RULE: Reading & Spelling
      curriculumHtml += `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Reading & Spelling</strong></td><td style="padding: 8px; border: 1px solid #ddd;">Reading: ${weekData.readingWeek}<br/>Spelling: ${weekData.spellingFocus}</td></tr>`;
      
      curriculumHtml += `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>ELA</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${weekData.elaChapter}</td></tr>`;
      curriculumHtml += `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>History/Science</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${weekData.historyScience}</td></tr>`;
      curriculumHtml += `</table>`;

      let actionItemsHtml = `<h3 style="margin-top: 20px;">Assignments & Assessments</h3><p>Click the links below to access your assignments for this week:</p><ul>`;
      
      if (allAssignments.length > 0) {
        allAssignments.forEach((assignment: any) => {
          const url = assignmentLinks[assignment.title];
          if (url) {
            actionItemsHtml += `<li><strong><a href="${url}" target="_blank" title="Go to Assignment">${assignment.title}</a></strong> - ${assignment.type || 'Standard'}</li>`;
          } else {
            actionItemsHtml += `<li><strong>${assignment.title}</strong> - ${assignment.type || 'Standard'}</li>`;
          }
        });
      } else {
        actionItemsHtml += `<li>No specific assignments scheduled for this week.</li>`;
      }
      actionItemsHtml += `</ul>`;

      // FRIDAY RULE: Brief note if applicable
      const fridayNote = `<p style="font-size: 0.9em; color: #666; font-style: italic; margin-top: 15px;">Note: Friday sessions focus strictly on assessments and review.</p>`;

      const finalBodyHtml = curriculumHtml + actionItemsHtml + fridayNote;
      
      // Apply Cidi Labs (DesignPlus) wrappers and headers via Rules Engine
      const headerHtml = `<h2 class="dp-header">${pageTitle}</h2>`;
      const finalHtml = rulesEngine.sanitizeForCanvas(headerHtml + finalBodyHtml, pageTitle);

      // Create or Update the Canvas Page
      const pagePayload = {
        wiki_page: {
          title: pageTitle,
          body: finalHtml,
          published: true
        }
      };

      // We use the 'pages' endpoint. Canvas automatically handles Create vs Update based on the title/slug.
      const createdPage = await canvasApiService.post(`https://thalesacademy.instructure.com/api/v1/courses/${courseId}/pages`, pagePayload);
      
      return { 
        success: true, 
        pageUrl: createdPage.html_url,
        assignmentsCreated: Object.keys(assignmentLinks).length
      };

    } catch (error) {
      console.error(`Deep Link Sync failed for Week ${weekData.weekNumber}:`, error);
      throw error;
    }
  }
};
