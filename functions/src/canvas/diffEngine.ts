
import { canvasRequest } from '../core/canvas';

export interface PacingWeek {
  weekNumber: number;
  weekId: string;
  days: any[];
  topic: string;
  readingWeek?: string;
  // ... other fields as needed
}

export interface DiffResult {
  additions: any[];
  updates: any[];
  deletions: any[];
}

export const diffEngine = {
  /**
   * Finds a resource ID by title in Canvas.
   */
  async findResourceIdByTitle(
      courseId: string,
      title: string,
      type: 'pages' | 'assignments' | 'discussion_topics',
      token: string
  ): Promise<string | null> {
      const endpoint = `courses/${courseId}/${type}?per_page=100`;
      const items = await canvasRequest(endpoint, 'GET', null, token);
      const item = items.find((i: any) =>
          (type === 'pages' && i.title === title) ||
          (type === 'assignments' && i.name === title) ||
          (type === 'discussion_topics' && i.title === title)
      );
      return item ? item.id.toString() : null;
  },

  /**
   * Generates a diff between desired local state and remote Canvas state.
   */
  async generateDiff(localData: PacingWeek[], courseId: string, token: string): Promise<DiffResult> {
    try {
      // 1. Fetch modules from Canvas
      const modules: any[] = await canvasRequest(`courses/${courseId}/modules?per_page=100`, 'GET', null, token);
      
      const canvasItemsMap = new Map();
      
      // For each module, fetch items (to match our title-based mapping)
      // Note: In a production app, we might want to optimize this with a single fetch if possible 
      // or parallelize with concurrency limits.
      for (const mod of modules) {
          // We can also just track modules themselves if we are syncing at the module level
          canvasItemsMap.set(mod.name, mod);
      }

      const diff: DiffResult = {
        additions: [],
        updates: [],
        deletions: []
      };

      const localTitlesHandled = new Set<string>();

      // 2. Compare Local Data to Canvas Data
      for (const week of localData) {
        const topic = (week as any).topic || week.readingWeek || "Unit " + week.weekNumber;
        const expectedTitle = `Week ${week.weekNumber}: ${topic}`; 
        localTitlesHandled.add(expectedTitle);

        const existingCanvasItem = canvasItemsMap.get(expectedTitle);

        if (!existingCanvasItem) {
          diff.additions.push(week);
        } else {
          diff.updates.push({ ...week, canvasId: existingCanvasItem.id });
        }
      }

      // 3. Find Orphaned Modules in Canvas
      canvasItemsMap.forEach((canvasItem, title) => {
          if (title.startsWith("Week ") && !localTitlesHandled.has(title)) {
              diff.deletions.push(canvasItem);
          }
      });

      return diff;

    } catch (error) {
      console.error("[DIFF_ENGINE] Failed to generate sync diff:", error);
      throw error;
    }
  }
};
