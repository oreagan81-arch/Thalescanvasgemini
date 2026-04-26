import { canvasApiService } from './canvasApiService';
import { PacingWeek } from './service.pacingImport';
import { useStore } from '../store';

export interface DiffResult {
  additions: PacingWeek[];
  updates: PacingWeek[];
  deletions: any[]; // These are Canvas items that no longer exist in your local planner
}

export const diffEngine = {
  /**
   * Compares the local planner data against the current state of a Canvas course.
   * Returns a categorized list of actions needed to sync them.
   */
  async generateDiff(localData: PacingWeek[], courseId: string): Promise<DiffResult> {
    try {
      // 1. Fetch lightweight index of current Canvas Modules and Items
      // We assume modules correspond roughly to 'weeks' or 'units'
      const modules: any[] = await canvasApiService.get(`https://thalesacademy.instructure.com/api/v1/courses/${courseId}/modules?per_page=100`);
      
      const canvasItemsMap = new Map();
      
      // Fetch items for each module to build a comprehensive map of what exists on Canvas
      for (const mod of modules) {
          const items: any[] = await canvasApiService.get(`https://thalesacademy.instructure.com/api/v1/courses/${courseId}/modules/${mod.id}/items?per_page=100`);
          items.forEach(item => {
              // Store by title or some unique identifier we can match against local data
              canvasItemsMap.set(item.title, { ...item, moduleId: mod.id }); 
          });
      }

      const diff: DiffResult = {
        additions: [],
        updates: [],
        deletions: []
      };

      const localTitlesHandled = new Set<string>();

      // 2. Compare Local Data to Canvas Data
      for (const week of localData) {
        // Adjusting to match PacingWeek properties (weekNumber instead of weekId)
        // And using readingWeek as a proxy for 'topic' if not present
        const topic = (week as any).topic || week.readingWeek || "Unit " + week.weekNumber;
        const expectedTitle = `Week ${week.weekNumber}: ${topic}`; 
        localTitlesHandled.add(expectedTitle);

        const existingCanvasItem = canvasItemsMap.get(expectedTitle);

        if (!existingCanvasItem) {
          // It's in local but not in Canvas -> Add
          diff.additions.push(week);
        } else {
          // It exists in both. 
           diff.updates.push(week);
        }
      }

      // 3. Find Orphaned Items in Canvas (Exist in Canvas, but removed from Local Planner)
      canvasItemsMap.forEach((canvasItem, title) => {
          // Only flag items that follow our naming convention but aren't in the current local data
          if (title.startsWith("Week ") && !localTitlesHandled.has(title)) {
              diff.deletions.push(canvasItem);
          }
      });

      return diff;

    } catch (error) {
      console.error("Failed to generate Diff:", error);
      throw error;
    }
  },

  /**
   * Executes the calculated diff against the Canvas API using the concurrency queue.
   */
  async executeDiff(courseId: string, diff: DiffResult) {
      const promises: Promise<any>[] = [];

      // Execute Additions (POST)
      for (const week of diff.additions) {
          const topic = (week as any).topic || week.readingWeek || "Unit " + week.weekNumber;
          // Create a new module for the week
          const modulePayload = { module: { name: `Week ${week.weekNumber}: ${topic}` } };
          promises.push(
              canvasApiService.post(`https://thalesacademy.instructure.com/api/v1/courses/${courseId}/modules`, modulePayload).then((newModule: any) => {
                  console.log(`Created Module: ${newModule.name}`);
              })
          );
      }

      // Execute Updates (PUT)
      for (const week of diff.updates) {
         console.log(`Queued update for ${week.weekNumber}`);
      }

      // Execute Deletions / Archiving (PUT to unpublished)
      for (const item of diff.deletions) {
          const unpublishPayload = { module_item: { published: false } };
          promises.push(
              canvasApiService.put(`https://thalesacademy.instructure.com/api/v1/courses/${courseId}/modules/${item.moduleId}/items/${item.id}`, unpublishPayload)
          );
      }

      // Wait for the queue to finish all operations
      await Promise.all(promises);
  }
};
