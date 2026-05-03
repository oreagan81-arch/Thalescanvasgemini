import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Metric } from '../types';

export const getDailyMetrics = async (): Promise<Metric | null> => {
  const today = new Date().toISOString().split("T")[0];
  const docRef = doc(db, "metrics", `daily_${today}`);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as Metric;
  }
  return null;
};
