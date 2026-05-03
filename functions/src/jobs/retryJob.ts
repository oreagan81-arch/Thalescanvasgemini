import * as admin from 'firebase-admin';
import { JobStatus, Job, jobService } from '../jobService';

const db = admin.firestore();

/**
 * Resets a failed job to pending if attempts are remaining.
 */
export async function retryJob(jobId: string): Promise<boolean> {
    const jobRef = db.collection('jobs').doc(jobId);
    const snap = await jobRef.get();
    
    if (!snap.exists()) throw new Error(`Job ${jobId} not found`);
    const data = snap.data() as Job;

    if (data.status !== JobStatus.FAILED) {
        console.warn(`[JOBS] Job ${jobId} is not in a failed state. status=${data.status}`);
        return false;
    }

    const nextAttempt = (data.attempts || 1) + 1;
    const maxAttempts = data.maxAttempts || 3;

    if (nextAttempt > maxAttempts) {
        console.error(`[JOBS] Max attempts reached for job ${jobId}`);
        return false;
    }

    console.log(`[JOBS] Retrying job ${jobId} (Attempt ${nextAttempt} of ${maxAttempts})`);
    
    await jobRef.update({
        status: JobStatus.PENDING,
        attempts: admin.firestore.FieldValue.increment(1),
        progress: 0,
        error: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await jobService.addLog(jobId, { 
        step: 'RETRY', 
        message: `Job reset for attempt ${nextAttempt}.` 
    });

    return true;
}
