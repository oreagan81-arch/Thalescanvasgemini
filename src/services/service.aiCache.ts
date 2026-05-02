import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp, 
  Timestamp 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

const COLLECTION_NAME = 'ai_generation_cache';
const CACHE_TTL_DAYS = 7;

export interface AICacheEntry {
  hash: string;
  payload: any;
  createdAt: Timestamp;
}

export const aiCacheService = {
  /**
   * Retrieves a cached AI result if it hasn't expired.
   */
  get: async <T>(hash: string): Promise<T | null> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, hash);
      const snap = await getDoc(docRef);
      
      if (!snap.exists()) return null;
      
      const data = snap.data() as AICacheEntry;
      const now = new Date();
      const expiryDate = new Date(data.createdAt.toDate());
      expiryDate.setDate(expiryDate.getDate() + CACHE_TTL_DAYS);
      
      if (now > expiryDate) {
        console.log(`[CACHE] Entry expired for ${hash}`);
        return null;
      }
      
      console.log(`[CACHE] Hit for ${hash}`);
      return data.payload as T;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${COLLECTION_NAME}/${hash}`);
      return null;
    }
  },

  /**
   * Stores an AI result in the cache.
   */
  set: async (hash: string, payload: any): Promise<void> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, hash);
      await setDoc(docRef, {
        hash,
        payload,
        createdAt: serverTimestamp()
      });
      console.log(`[CACHE] Saved entry ${hash}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${hash}`);
    }
  }
};
