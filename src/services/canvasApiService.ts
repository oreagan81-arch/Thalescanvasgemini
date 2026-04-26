import { useStore } from '../store';

interface QueueItem {
  endpoint: string;
  options: RequestInit;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  retries: number;
}

class CanvasConcurrencyQueue {
  private queue: QueueItem[] = [];
  private activeRequests = 0;
  
  // Enterprise-grade tuning based on Canvas LMS API limits
  private readonly MAX_CONCURRENT = 3;
  private readonly DELAY_MS = 300;
  private readonly MAX_RETRIES = 3;

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Adds a request to the queue and returns a promise that resolves
   * when the request successfully completes its turn in the queue.
   */
  public enqueue(endpoint: string, options: RequestInit = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        endpoint,
        options,
        resolve,
        reject,
        retries: 0
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    // Stop if we are at maximum capacity or the queue is empty
    if (this.activeRequests >= this.MAX_CONCURRENT || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.activeRequests++;

    try {
      const { canvasApiToken } = useStore.getState();
      if (!canvasApiToken) {
        throw new Error("CANVAS_API_TOKEN_MISSING: Please configure your Canvas API Token in Settings.");
      }

      // Enforce the baseline delay to prevent sudden request bursts
      await this.delay(this.DELAY_MS);

      // INTEGRATION: Map external URL to local proxy for CORS and Token security
      const proxyEndpoint = item.endpoint.replace('https://thalesacademy.instructure.com/api/v1/', '/api/canvas/');
      const fetchUrl = proxyEndpoint === item.endpoint ? item.endpoint : proxyEndpoint;

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${canvasApiToken}`,
        ...item.options.headers,
      };

      const response = await fetch(fetchUrl, {
        ...item.options,
        headers,
      });

      if (!response.ok) {
        // Catch Rate Limiting (403 Cost Exceeded / 429 Too Many Requests)
        if ((response.status === 403 || response.status === 429) && item.retries < this.MAX_RETRIES) {
          console.warn(`[Canvas API] Rate Limit Hit on ${item.endpoint}. Queuing retry ${item.retries + 1}/${this.MAX_RETRIES}...`);
          
          item.retries++;
          
          // Backoff WITHOUT holding an activeRequest slot
          // We let the current "worker" finish, and re-enqueue the item with a delay
          setTimeout(() => {
            this.queue.unshift(item);
            this.processQueue();
          }, 2000 * item.retries);
          
          return; // Finally block will release the slot for other waitings
        } else {
          const errorText = await response.text();
          let parsedError;
          try { parsedError = JSON.parse(errorText); } catch { parsedError = { message: errorText }; }
          throw new Error(parsedError.message || `Canvas API Error ${response.status}`);
        }
      }

      // Canvas sometimes returns empty 200/204 responses (especially on DELETE or PUT)
      const text = await response.text();
      const data = text ? JSON.parse(text) : { success: true };
      
      item.resolve(data);

    } catch (error) {
      item.reject(error);
    } finally {
      this.activeRequests--;
      // Fire next items (potentially multiple if slots opened up)
      this.processQueue(); 
    }
  }
}

// Instantiate a single global queue for the application
export const canvasQueue = new CanvasConcurrencyQueue();

export const canvasApiService = {
  /**
   * Universal Request Wrapper: Handles CORS Proxying and Auth via the Queue
   */
  async secureRequest(endpoint: string, options: RequestInit = {}) {
    return canvasQueue.enqueue(endpoint, options);
  },

  async getCourseFiles(courseId: string) {
    const url = `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/files?per_page=100`;
    return this.secureRequest(url);
  },

  async getAssignments(courseId: string) {
    const url = `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/assignments?per_page=50`;
    return this.secureRequest(url);
  },

  async createAnnouncement(courseId: string, title: string, message: string) {
    const url = `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/discussion_topics`;
    return this.secureRequest(url, {
      method: 'POST',
      body: JSON.stringify({
        title,
        message,
        is_announcement: true,
        published: true
      })
    });
  },

  async createOrUpdateAssignment(courseId: string, data: any, existingId?: string) {
    const method = existingId ? 'PUT' : 'POST';
    const url = existingId 
      ? `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/assignments/${existingId}`
      : `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/assignments`;
      
    return this.secureRequest(url, {
      method,
      body: JSON.stringify({ assignment: data })
    });
  },

  async createOrUpdatePage(courseId: string, data: { title: string, body: string, url?: string }) {
    const method = data.url ? 'PUT' : 'POST';
    const slug = data.url;
    const url = slug
      ? `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/pages/${slug}`
      : `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/pages`;
    
    // Remove url from payload to prevent Canvas error
    const { url: _, ...wikiData } = data;
    return this.secureRequest(url, {
      method,
      body: JSON.stringify({ wiki_page: wikiData })
    });
  },

  async getOrCreateModule(courseId: string, name: string) {
    // List modules to see if it exists
    const modules: any[] = await this.get(`https://thalesacademy.instructure.com/api/v1/courses/${courseId}/modules?per_page=100`);
    const existing = modules.find(m => m.name === name);
    if (existing) return existing;

    // Create if not
    return this.post(`https://thalesacademy.instructure.com/api/v1/courses/${courseId}/modules`, {
      module: { name }
    });
  },

  async addModuleItem(courseId: string, moduleId: string, data: { title: string, type: string, content_id: string }) {
    const url = `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/modules/${moduleId}/items`;
    return this.post(url, { module_item: data });
  },

  async postAnnouncement(title: string, message: string, courseId: string, options: any = {}) {
    const url = `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/discussion_topics`;
    return this.secureRequest(url, {
      method: 'POST',
      body: JSON.stringify({
        title,
        message,
        is_announcement: true,
        published: true,
        ...options
      })
    });
  },

  // Standard REST helpers for newer components
  get: (endpoint: string) => 
    canvasQueue.enqueue(endpoint, { method: 'GET' }),
    
  post: (endpoint: string, data: any) => 
    canvasQueue.enqueue(endpoint, { method: 'POST', body: JSON.stringify(data) }),
    
  put: (endpoint: string, data: any) => 
    canvasQueue.enqueue(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
    
  delete: (endpoint: string) => 
    canvasQueue.enqueue(endpoint, { method: 'DELETE' })
};
