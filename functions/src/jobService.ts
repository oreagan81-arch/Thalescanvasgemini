import * as admin from 'firebase-admin';

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface JobLog {
  step: string;
  message?: string;
  input?: any;
  output?: any;
  error?: string;
  time: number;
}

export interface Job<T = any, R = any> {
  id: string;
  userId: string;
  type: string;
  status: JobStatus;
  payload: T;
  result?: R;
  progress: number;
  attempts: number;
  maxAttempts: number;
  error?: string;
  logs: JobLog[];
  steps: Record<string, 'pending' | 'running' | 'done' | 'failed'>;
  intermediateState?: any;
  createdAt: admin.firestore.Timestamp | any;
  updatedAt: admin.firestore.Timestamp | any;
}

const db = admin.firestore();

/**
 * Robust Job Queue Service for Firestore
 */
export const jobService = {
  /**
   * Creates or retrieves a job. If a failed job exists with retries left, resets it to pending.
   */
  async getOrCreateJob<T>(userId: string, type: string, payload: T, options?: { customId?: string, maxAttempts?: number }): Promise<string> {
    const { customId, maxAttempts = 3 } = options || {};
    const jobRef = customId ? db.collection('jobs').doc(customId) : db.collection('jobs').doc();
    const jobId = jobRef.id;

    if (customId) {
      const snap = await jobRef.get();
      if (snap.exists()) {
        const data = snap.data() as Job;
        
        // If already successful, return it
        if (data.status === JobStatus.COMPLETED) {
          return jobId;
        }

        // If currently running, return it
        if (data.status === JobStatus.PENDING || data.status === JobStatus.PROCESSING) {
          console.log(`[JobQueue] Active job found: ${jobId} (${data.status})`);
          return jobId;
        }

        // If failed, check if we can retry
        if (data.status === JobStatus.FAILED) {
          const nextAttempt = (data.attempts || 1) + 1;
          if (nextAttempt > (data.maxAttempts || maxAttempts)) {
            console.error(`[JobQueue] Max attempts reached for ${jobId}`);
            throw new Error("Maximum retry attempts reached for this operation.");
          }

          console.log(`[JobQueue] Retrying failed job: ${jobId} (Attempt ${nextAttempt})`);
          await jobRef.update({
            status: JobStatus.PENDING,
            attempts: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          return jobId;
        }
      }
    }

    // Create new job
    const newJob: Partial<Job> = {
      id: jobId,
      userId,
      type,
      payload,
      status: JobStatus.PENDING,
      progress: 0,
      attempts: 1,
      maxAttempts,
      logs: [],
      steps: {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await jobRef.set(newJob);
    console.log(`[JobQueue] Created new job: ${jobId} of type ${type}`);
    return jobId;
  },

  /**
   * Updates a specific step status.
   */
  async updateStep(jobId: string, step: string, status: 'pending' | 'running' | 'done' | 'failed') {
    await db.collection('jobs').doc(jobId).update({
      [`steps.${step}`]: status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  },

  /**
   * Updates job fields.
   */
  async updateProgress(jobId: string, updates: Partial<Job>) {
    await db.collection('jobs').doc(jobId).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  },

  /**
   * Appends a log entry to the job.
   */
  async addLog(jobId: string, entry: Omit<JobLog, 'time'>) {
    await db.collection('jobs').doc(jobId).update({
      logs: admin.firestore.FieldValue.arrayUnion({
        ...entry,
        time: Date.now()
      }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  },

  /**
   * Wraps a processing task with automatic status updates and error handling.
   */
  async runProcessor<T, R>(jobId: string, processor: (job: Job<T>) => Promise<R>) {
    const jobRef = db.collection('jobs').doc(jobId);
    
    try {
      // 1. Initial Fetch
      const snap = await jobRef.get();
      if (!snap.exists()) throw new Error(`Job ${jobId} not found`);
      const job = snap.data() as Job<T>;

      // Avoid double processing if already running (though typically handled by getOrCreateJob)
      if (job.status === JobStatus.PROCESSING) {
         console.warn(`[JobQueue] Job ${jobId} is already processing.`);
         return;
      }

      // 2. Mark as Processing
      await this.updateProgress(jobId, { status: JobStatus.PROCESSING, progress: 5 });
      await this.addLog(jobId, { step: 'START', message: 'Beginning job processing.' });

      // 3. Execute
      const result = await processor(job);

      // 4. Mark Complete
      await this.updateProgress(jobId, {
        status: JobStatus.COMPLETED,
        progress: 100,
        result
      });
      await this.addLog(jobId, { step: 'FINISH', message: 'Job completed successfully.' });

      return result;
    } catch (error: any) {
      console.error(`[JobQueue] Job ${jobId} failed:`, error);
      
      const errorMessage = error.message || String(error);
      const isRetriable = !errorMessage.includes('fatal') && !errorMessage.includes('unrecoverable');

      await this.updateProgress(jobId, {
        status: JobStatus.FAILED,
        error: errorMessage
      });

      await this.addLog(jobId, {
        step: 'ERROR',
        message: `Task failed: ${errorMessage}`,
        error: error.stack
      });

      throw error;
    }
  }
};
