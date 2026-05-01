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
  private async getCanvasIdMapping(externalId: string): Promise<string | null> {
    try {
      const currentAppId = this.appId;
      const mapRef = doc(db, 'artifacts', currentAppId, 'public', 'mappings', externalId);
      const snap = await getDoc(mapRef);
      return snap.exists() ? snap.data().canvasId : null;
    } catch (err) {
      console.warn(`[SyncEngine] Mapping lookup failed for ${externalId}:`, err);
      return null;
    }
  }

  /**
   * Saves the mapping between external identification and Canvas resource ID.
   */
  private async saveMapping(externalId: string, canvasId: string) {
    try {
      const currentAppId = this.appId;
      const mapRef = doc(db, 'artifacts', currentAppId, 'public', 'mappings', externalId);
      await setDoc(mapRef, { 
        canvasId, 
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
    // 1. Resolve existing ID from mapping or provided data
    const existingCanvasId = await this.getCanvasIdMapping(externalId);

    // 2. Delegate to canvasApiService for the heavy lifting (Queue, CORS, Retry)
    console.log(`[SyncEngine] Syncing assignment for ${externalId}. Mode: ${existingCanvasId ? 'UPDATE' : 'CREATE'}`);
    
    const canvasResponse = await canvasApiService.createOrUpdateAssignment(
      courseId,
      assignmentData,
      existingCanvasId || undefined
    );

    // 3. Persist the mapping for future runs
    if (canvasResponse && canvasResponse.id) {
      await this.saveMapping(externalId, canvasResponse.id.toString());
    }

    return canvasResponse;
  }

  /**
   * Syncs a Canvas Page using the same deduplication logic.
   */
  async syncPage(courseId: string, pageData: { title: string, body: string, url?: string }, externalId: string) {
    const existingCanvasUrl = await this.getCanvasIdMapping(externalId);
    
    const pagePayload = {
      ...pageData,
      url: existingCanvasUrl || pageData.url
    };

    const canvasResponse = await canvasApiService.createOrUpdatePage(courseId, pagePayload);

    if (canvasResponse && (canvasResponse.url || canvasResponse.page_id)) {
      const idToStore = canvasResponse.url || canvasResponse.page_id.toString();
      await this.saveMapping(externalId, idToStore);
    }

    return canvasResponse;
  }
}

// Export a default instance for general use
export const syncEngine = new SyncEngine();
