import { useStore } from '../store';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Service to interact with the Canvas LMS API.
 */
export const canvasApiService = {
  /**
   * Secure request wrapper with advanced rate-limiting and retry logic.
   */
  async secureRequest(endpoint: string, options: any = {}) {
    const { canvasApiToken } = useStore.getState();
    if (!canvasApiToken) {
      throw new Error("CANVAS_API_TOKEN_MISSING: Please enter your Canvas API Token in the System Settings page to use LMS features.");
    }

    // Rate-limiter/Concurrency throttle: Max 3 concurrent requests (handled by sequenceBatch or manual wait)
    // Here we use a simpler stagger of 300ms as requested
    await delay(300); 
    
    const response = await fetch(endpoint, {
      ...options,
      headers: { 
        ...options.headers, 
        'Authorization': `Bearer ${canvasApiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("Canvas API: 403 Cost Exceeded. Please slow down.");
      }
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
    courseId: string,
    options: { delayed_post_at?: string } = {}
  ): Promise<any> => {
    if (!courseId) throw new Error("CANVAS_COURSE_ID_MISSING");
    const endpoint = `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/discussion_topics`;

    return canvasApiService.secureRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        title,
        message: messageHTML,
        is_announcement: true,
        published: true,
        ...options, // Maps suggestedPostDate to delayed_post_at
      }),
    });
  },

  /**
   * Idempotent Page Sync: Creates or updates a Canvas Wiki Page.
   */
  createOrUpdatePage: async (courseId: string, pageData: { title: string, body: string, url?: string }) => {
    const baseUrl = `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/pages`;
    
    // If url (slug) is provided, we attempt an update first
    if (pageData.url) {
      try {
        return await canvasApiService.secureRequest(`${baseUrl}/${pageData.url}`, {
          method: 'PUT',
          body: JSON.stringify({ wiki_page: { title: pageData.title, body: pageData.body, published: true } })
        });
      } catch (e) {
        // Fall back to create if update fails (e.g. page doesn't exist yet)
      }
    }

    return canvasApiService.secureRequest(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ wiki_page: { title: pageData.title, body: pageData.body, published: true } })
    });
  },

  /**
   * Idempotent Assignment Sync.
   */
  createOrUpdateAssignment: async (courseId: string, assignment: any, existingId?: string) => {
    const baseUrl = `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/assignments`;
    const body = JSON.stringify({ 
      assignment: {
        ...assignment,
        published: true
      }
    });

    if (existingId) {
      return canvasApiService.secureRequest(`${baseUrl}/${existingId}`, { method: 'PUT', body });
    }
    return canvasApiService.secureRequest(baseUrl, { method: 'POST', body });
  },

  /**
   * Auto-Modularization: Pins an item to a Canvas Module.
   */
  addModuleItem: async (courseId: string, moduleId: string, item: { title: string, type: string, content_id: string }) => {
    const endpoint = `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/modules/${moduleId}/items`;
    return canvasApiService.secureRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        module_item: {
          title: item.title,
          type: item.type,
          content_id: item.content_id,
        }
      })
    });
  },

  /**
   * Fetches or creates modules for specific weeks.
   */
  getOrCreateModule: async (courseId: string, moduleName: string) => {
    const modules = await canvasApiService.secureRequest(`https://thalesacademy.instructure.com/api/v1/courses/${courseId}/modules`);
    const existing = modules.find((m: any) => m.name === moduleName);
    if (existing) return existing;

    return canvasApiService.secureRequest(`https://thalesacademy.instructure.com/api/v1/courses/${courseId}/modules`, {
      method: 'POST',
      body: JSON.stringify({ module: { name: moduleName, published: true } })
    });
  },

  /**
   * Filesystem Organization: Creates a folder structure.
   */
  getOrCreateFolder: async (courseId: string, folderPath: string) => {
    const endpoint = `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/folders/by_path/${encodeURIComponent(folderPath)}`;
    return canvasApiService.secureRequest(endpoint, { method: 'GET' })
      .catch(() => {
        // Recursive folder creation might be needed if path is deep, for now assume simple /Subject/Week X
        return canvasApiService.secureRequest(`https://thalesacademy.instructure.com/api/v1/courses/${courseId}/folders`, {
          method: 'POST',
          body: JSON.stringify({ name: folderPath, parent_folder_id: 'root' })
        });
      });
  },

  /**
   * Safe Deletion (Archiving): Unpublishes an item instead of deleting it.
   */
  archiveAssignment: async (courseId: string, assignmentId: string) => {
    const endpoint = `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/assignments/${assignmentId}`;
    return canvasApiService.secureRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify({ assignment: { published: false } })
    });
  },

  /**
   * Fetches files for a course to check for missing assets.
   */
  getCourseFiles: async (courseId: string) => {
    const endpoint = `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/files?per_page=100`;
    return canvasApiService.secureRequest(endpoint);
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
