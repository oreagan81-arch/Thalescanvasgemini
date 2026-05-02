import { db, auth } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { canvasApiService } from "./canvasApiService";

/**
 * Thales Sync Engine v2
 * High-reliability synchronization that prevents duplicate assignments 
 * by mapping Sheet Row IDs (or other external keys) to Canvas IDs.
 */
export class SyncEngine {
  private customAppId: string | null = null;

  constructor(appId?: string) {
    if (appId) this.customAppId = appId;
  }

  private get appId(): string {
    return this.customAppId || auth.currentUser?.uid || "system-global";
  }

  /**
   * Tracks an item in Firestore to prevent double-creation.
   * Path: artifacts/{appId}/public/mappings/{externalId}
   */
  private async getCanvasIdMapping(externalId: string): Promise<{ canvasId: string, contentHash?: string } | null> {
    try {
      const currentAppId = this.appId;
      const mapRef = doc(db, 'artifacts', currentAppId, 'public', 'mappings', externalId);
      const snap = await getDoc(mapRef);
      if (snap.exists()) {
        const data = snap.data();
        return { canvasId: data.canvasId, contentHash: data.contentHash };
      }
      return null;
    } catch (err) {
      console.warn(`[SyncEngine] Mapping lookup failed for ${externalId}:`, err);
      return null;
    }
  }

  /**
   * Simple hash function for content comparison.
   */
  private generateContentHash(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  /**
   * Saves the mapping between external identification and Canvas resource ID.
   */
  private async saveMapping(externalId: string, canvasId: string, contentHash: string) {
    try {
      const currentAppId = this.appId;
      const mapRef = doc(db, 'artifacts', currentAppId, 'public', 'mappings', externalId);
      await setDoc(mapRef, { 
        canvasId, 
        contentHash,
        lastSync: new Date().toISOString(),
        externalId,
        appId: currentAppId
      }, { merge: true });
    } catch (err) {
      console.error(`[SyncEngine] Failed to save mapping for ${externalId}:`, err);
    }
  }

  /**
   * Core Sync Logic: Assignment
   * Automatically resolves whether to perform a POST (create) or PUT (update) based on stored mapping.
   */
  async syncAssignment(courseId: string, assignmentData: any, externalId: string) {
    // 1. Resolve existing ID from mapping
    const mapping = await this.getCanvasIdMapping(externalId);
    const contentHash = this.generateContentHash(assignmentData);

    // Smart Sync: Skip if content is identical
    if (mapping && mapping.contentHash === contentHash) {
      console.log(`[SyncEngine] SKIPPING assignment update for ${externalId}: Content Hash Match.`);
      return { id: mapping.canvasId, html_url: `https://thalesacademy.instructure.com/courses/${courseId}/assignments/${mapping.canvasId}` };
    }

    // 2. Delegate to canvasApiService for the heavy lifting
    console.log(`[SyncEngine] Syncing assignment for ${externalId}. Mode: ${mapping ? 'UPDATE' : 'CREATE'}`);
    
    const canvasResponse = await canvasApiService.createOrUpdateAssignment(
      courseId,
      assignmentData,
      mapping?.canvasId || undefined
    );

    // 3. Persist the mapping for future runs
    if (canvasResponse && canvasResponse.id) {
      await this.saveMapping(externalId, canvasResponse.id.toString(), contentHash);
    }

    return canvasResponse;
  }

  /**
   * Syncs a Canvas Page using the same deduplication logic.
   */
  async syncPage(courseId: string, pageData: { title: string, body: string, url?: string }, externalId: string) {
    const mapping = await this.getCanvasIdMapping(externalId);
    const contentHash = this.generateContentHash(pageData);

    // Smart Sync: Skip if content is identical
    if (mapping && mapping.contentHash === contentHash) {
      console.log(`[SyncEngine] SKIPPING page update for ${externalId}: Content Hash Match.`);
      return { url: mapping.canvasId, html_url: `https://thalesacademy.instructure.com/courses/${courseId}/pages/${mapping.canvasId}` };
    }

    const pagePayload = {
      ...pageData,
      url: mapping?.canvasId || pageData.url
    };

    const canvasResponse = await canvasApiService.createOrUpdatePage(courseId, pagePayload);

    if (canvasResponse && (canvasResponse.url || canvasResponse.page_id)) {
      const idToStore = canvasResponse.url || canvasResponse.page_id.toString();
      await this.saveMapping(externalId, idToStore, contentHash);
    }

    return canvasResponse;
  }
}

// Export a default instance for general use
export const syncEngine = new SyncEngine();
