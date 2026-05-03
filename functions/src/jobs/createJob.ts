import * as admin from 'firebase-admin';
import { JobStatus, Job } from '../jobService';

const db = admin.firestore();

/**
 * Creates a new job record in Firestore.
 */
export async function createJob<T>(
    userId: string, 
    type: string, 
    payload: T, 
    options?: { 
        customId?: string, 
        maxAttempts?: number,
        configSnapshot?: any 
    }
): Promise<string> {
    const { customId, maxAttempts = 3, configSnapshot } = options || {};
    const jobRef = customId ? db.collection('jobs').doc(customId) : db.collection('jobs').doc();
    const jobId = jobRef.id;

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
      configSnapshot,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await jobRef.set(newJob);
    console.log(`[JOBS] Created job ${jobId} of type ${type}`);
    return jobId;
}
