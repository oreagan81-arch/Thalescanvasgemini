import * as admin from 'firebase-admin';

export interface LogMetrics {
  step: string;
  duration?: number;
  tokens?: number;
  error?: string;
  message?: string;
  extra?: Record<string, any>;
}

export class ObservabilityLogger {
  private jobId?: string;
  private db = admin.firestore();

  constructor(jobId?: string) {
    this.jobId = jobId;
  }

  /**
   * Tracks a step with associated metrics.
   */
  async track(metrics: LogMetrics): Promise<void> {
    const entry = {
      ...metrics,
      timestamp: Date.now(),
    };

    // Structured logging for Cloud Logging
    console.log(JSON.stringify({ 
      severity: metrics.error ? 'ERROR' : 'INFO', 
      jobId: this.jobId,
      ...entry 
    }));

    // If job ID is present, persist to Firestore for UI observability
    if (this.jobId) {
      try {
        await this.db.collection('jobs').doc(this.jobId).update({
          logs: admin.firestore.FieldValue.arrayUnion(entry),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (err) {
        console.error('[OBSERVABILITY] Failed to persist log to Firestore', err);
      }
    }
  }

  /**
   * Helper to time a function execution.
   */
  async trace<T>(step: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      await this.track({ step, duration });
      return result;
    } catch (error: any) {
      const duration = Date.now() - start;
      await this.track({ step, duration, error: error.message || String(error) });
      throw error;
    }
  }
}
