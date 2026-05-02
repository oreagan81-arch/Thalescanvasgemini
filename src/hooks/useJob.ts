import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

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
    }, (err) => {
      console.error("Job subscription error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [jobId]);

  return { job, loading };
}
