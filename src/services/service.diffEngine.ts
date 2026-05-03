import { functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { PacingWeek } from './service.pacingImport';

export const diffEngine = {
  /**
   * Delegates the sync operation to the server.
   * Client only sends the desired state.
   */
  async syncToCanvas(localData: PacingWeek[], courseId: string) {
    try {
      const executeSync = httpsCallable(functions, 'executeSync');
      const response = await executeSync({ localData, courseId });
      return response.data;
    } catch (error) {
      console.error("Server-side sync failed:", error);
      throw error;
    }
  },

  /**
   * Gets a pre-flight diff from the server.
   */
  async getDiffFromServer(localData: PacingWeek[], courseId: string) {
    try {
      const generateSyncDiff = httpsCallable(functions, 'generateSyncDiff');
      const response = await generateSyncDiff({ localData, courseId });
      return response.data as any;
    } catch (error) {
      console.error("Server-side diff generation failed:", error);
      throw error;
    }
  }
};
