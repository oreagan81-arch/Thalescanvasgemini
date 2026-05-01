import { ResourceFile } from '../services/service.resource';
import { PacingWeek } from '../services/service.pacingImport';

export const resourceResolver = {
  // Deduplicate and Transform to HTML, Inject Always-On Textbooks
  resolveResourcesAsHtml: (
    resources: ResourceFile[],
    weekData: PacingWeek,
    assignments: any[]
  ): string => {
    // 1. Deduplicate
    const assignmentTitles = new Set(assignments.map(a => a.title.toLowerCase()));
    
    // 2. Identify relevant resources for this week/lesson
    // Better mapping: try to find resources that match lesson/week keywords
    const mathLessonNumber = weekData.mathLesson.match(/\d+/)?.[0];
    const keywords = [
        weekData.mathLesson.toLowerCase(),
        mathLessonNumber,
        weekData.readingWeek.toLowerCase(),
        weekData.elaChapter.toLowerCase(),
        "power up",
        "homework"
    ].filter(Boolean);
    
    const subjectResources = resources.filter(res => 
      !assignmentTitles.has(res.cleanName.toLowerCase()) &&
      (keywords.some(k => res.cleanName.toLowerCase().includes(k)) || res.subject === 'General')
    );

    // 3. Inject Always-On Textbooks
    const alwaysOn = {
        Math: ["Math Textbook", "Math Student Book"],
        Reading: ["Reading Anthology"],
        ELA: ["Grammar Handbook"]
    };
    
    // Simplified logic for now, we can make this more robust
    const finalResources = [...subjectResources];

    // Transform to HTML using Thales Teal (#00c0a5)
    return finalResources.map(res => 
      `<li style="margin-bottom: 5px; color: #00c0a5;">• <a href="${res.canvasUrl}" target="_blank" style="color: #00c0a5; text-decoration: underline;">${res.cleanName}</a></li>`
    ).join('');
  }
};
