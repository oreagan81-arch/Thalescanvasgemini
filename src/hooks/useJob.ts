import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export interface JobState {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
}

/**
 * Hook to track a background job in real-time via Firestore snapshots.
 */
export function useJob(jobId: string | null) {
  const [job, setJob] = useState<JobState | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const docRef = doc(db, 'jobs', jobId);
    
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setJob(snap.data() as JobState);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `jobs/${jobId}`);
    });

    return () => unsubscribe();
  }, [jobId]);

  return { job, loading };
}
