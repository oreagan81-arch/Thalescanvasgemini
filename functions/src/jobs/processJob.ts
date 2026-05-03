import * as admin from 'firebase-admin';
import { JobStatus, Job, jobService } from '../jobService';

const db = admin.firestore();

/**
 * Executes the core processing logic for a job.
 */
export async function processJob<T, R>(jobId: string, processor: (job: Job<T>) => Promise<R>): Promise<R | undefined> {
    const jobRef = db.collection('jobs').doc(jobId);
    
    try {
      const snap = await jobRef.get();
      if (!snap.exists()) throw new Error(`Job ${jobId} not found`);
      const job = snap.data() as Job<T>;

      if (job.status === JobStatus.PROCESSING) {
         console.warn(`[JOBS] Job ${jobId} is already being processed.`);
         return;
      }

      // Mark as Processing
      await jobService.updateProgress(jobId, { status: JobStatus.PROCESSING, progress: 10 });
      await jobService.addLog(jobId, { step: 'PROCESSING_START', message: 'Job picked up for processing.' });

      const result = await processor(job);

      // Finalize
      await jobService.updateProgress(jobId, {
        status: JobStatus.COMPLETED,
        progress: 100,
        result
      });
      await jobService.addLog(jobId, { step: 'PROCESSING_SUCCESS', message: 'Job successfully processed.' });

      return result;

    } catch (error: any) {
      console.error(`[JOBS] Job ${jobId} failed:`, error);
      
      const errorMessage = error.message || String(error);
      await jobService.updateProgress(jobId, {
        status: JobStatus.FAILED,
        error: errorMessage
      });

      await jobService.addLog(jobId, {
        step: 'PROCESSING_ERROR',
        message: `Execution failed: ${errorMessage}`,
        error: error.stack,
        input: job.payload
      });

      throw error;
    }
}
