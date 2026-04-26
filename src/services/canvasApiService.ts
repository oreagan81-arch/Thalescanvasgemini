import { useStore } from '../store';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Service to interact with the Canvas LMS API.
 */
export const canvasApiService = {
  /**
   * Secure request wrapper with stagger logic to avoid flood protection.
   */
  async secureRequest(endpoint: string, options: any = {}) {
    const { canvasApiToken } = useStore.getState();
    if (!canvasApiToken) throw new Error("CANVAS_API_TOKEN_MISSING");

    await delay(200); // 200ms stagger
    
    const response = await fetch(endpoint, {
      ...options,
      headers: { 
        ...options.headers, 
        'Authorization': `Bearer ${canvasApiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Canvas API Error: ${response.status} - ${errorData.errors?.[0]?.message || response.statusText}`);
    }

    return response.json();
  },

  /**
   * Posts an announcement to a specific Canvas course.
   */
  postAnnouncement: async (
    title: string,
    messageHTML: string,
    courseId: string
  ): Promise<any> => {
    if (!courseId) {
      throw new Error("CANVAS_COURSE_ID_MISSING");
    }

    const endpoint = `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/discussion_topics`;

    return canvasApiService.secureRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        title,
        message: messageHTML,
        is_announcement: true,
        published: true,
      }),
    });
  },

  /**
   * Sequence wrapper to process multiple requests one-by-one with stagger.
   */
  async sequenceBatch<T, R>(items: T[], processor: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    for (const item of items) {
      results.push(await processor(item));
    }
    return results;
  }
};
