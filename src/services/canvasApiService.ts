import { useStore } from '../store';

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface QueueItem {
  endpoint: string;
  options: RequestOptions;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  retries: number;
}

export class CanvasConcurrencyQueue {
  private queue: QueueItem[] = [];
  private activeRequests = 0;
  private readonly MAX_CONCURRENT = 5;
  private readonly DELAY_MS = 150;
  private readonly MAX_RETRIES = 3;

  async secureRequest(endpoint: string, options: RequestOptions = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ endpoint, options, resolve, reject, retries: 0 });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.activeRequests >= this.MAX_CONCURRENT || this.queue.length === 0) return;
    const item = this.queue.shift();
    if (!item) return;
    
    this.activeRequests++;

    try {
      const { dryRun } = useStore.getState();
      
      // Force proxy usage
      const proxyEndpoint = item.endpoint.replace('https://thalesacademy.instructure.com/api/v1/', '/api/canvas/');
      if (proxyEndpoint === item.endpoint) {
        throw new Error('PROXY_REQUIRED: All Canvas calls must route through /api/canvas/');
      }

      if (dryRun) {
        console.log(`[DRY_RUN] Would call: ${proxyEndpoint}`, item.options);
        item.resolve({ dryRun: true, endpoint: proxyEndpoint });
        return;
      }

      await new Promise(r => setTimeout(r, this.DELAY_MS));

      const headers = {
        'Content-Type': 'application/json',
        ...item.options.headers,
      };

      const response = await fetch(proxyEndpoint, { ...item.options, headers });

      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
           throw new Error(`CANVAS_AUTH_ERROR: Server proxy refused authentication.`);
        }
        if (item.retries < this.MAX_RETRIES && response.status >= 500) {
          item.retries++;
          this.queue.push(item);
          return;
        }
        const errorText = await response.text();
        throw new Error(`Canvas API Error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      item.resolve(data);
    } catch (error) {
      item.reject(error);
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  // --- Domain Methods (Maintained for backward Compatibility) ---
  
  async getCourseFiles(courseId: string) {
    const url = `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/files?per_page=100`;
    return this.secureRequest(url);
  }

  async getAssignments(courseId: string) {
    const url = `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/assignments?per_page=50`;
    return this.secureRequest(url);
  }

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
  }

  async createOrUpdateAssignment(courseId: string, data: any, existingId?: string) {
    const method = existingId ? 'PUT' : 'POST';
    const url = existingId 
      ? `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/assignments/${existingId}`
      : `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/assignments`;
      
    return this.secureRequest(url, {
      method,
      body: JSON.stringify({ assignment: data })
    });
  }

  async createOrUpdatePage(courseId: string, data: { title: string, body: string, url?: string, published?: boolean }) {
    const slug = data.url;
    let method = slug ? 'PUT' : 'POST';
    const url = slug
      ? `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/pages/${slug}`
      : `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/pages`;
    
    // Remove url from payload to prevent Canvas error
    const { url: _, ...wikiData } = data;
    return this.secureRequest(url, {
      method,
      body: JSON.stringify({ wiki_page: wikiData })
    });
  }

  async getOrCreateModule(courseId: string, name: string) {
    const modules: any[] = await this.get(`https://thalesacademy.instructure.com/api/v1/courses/${courseId}/modules?per_page=100`);
    const existing = modules.find(m => m.name === name);
    if (existing) return existing;

    return this.post(`https://thalesacademy.instructure.com/api/v1/courses/${courseId}/modules`, {
      module: { name }
    });
  }

  async addModuleItem(courseId: string, moduleId: string, data: { title: string, type: string, content_id: string }) {
    const url = `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/modules/${moduleId}/items`;
    return this.post(url, { module_item: data });
  }

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
  }

  // REST Shorthands
  get(endpoint: string) { return this.secureRequest(endpoint, { method: 'GET' }); }
  post(endpoint: string, data: any) { return this.secureRequest(endpoint, { method: 'POST', body: JSON.stringify(data) }); }
  put(endpoint: string, data: any) { return this.secureRequest(endpoint, { method: 'PUT', body: JSON.stringify(data) }); }
  delete(endpoint: string) { return this.secureRequest(endpoint, { method: 'DELETE' }); }

  async checkStatus() {
    try {
      const response = await fetch('/api/canvas-status');
      const data = await response.json();
      return data.configured as boolean;
    } catch (err) {
      console.error("Canvas status check failed:", err);
      return false;
    }
  }
}

export const canvasApiService = new CanvasConcurrencyQueue();
