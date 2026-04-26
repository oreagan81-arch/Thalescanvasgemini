import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export interface UserSettings {
  teacherName: string;
  schoolName: string;
  signature: string;
  tone: 'Warm' | 'Formal' | 'Friendly' | 'Direct';
  canvasDomain?: string;
  canvasToken?: string;
  updatedAt?: any;
}

const COLLECTION_NAME = 'settings';

export const settingsService = {
  getSettings: async (userId: string): Promise<UserSettings | null> => {
    try {
      const q = query(collection(db, COLLECTION_NAME), where('userId', '==', userId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].data() as UserSettings;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
    }
  },

  updateSettings: async (userId: string, settings: Partial<UserSettings>) => {
    try {
      const q = query(collection(db, COLLECTION_NAME), where('userId', '==', userId));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const ref = doc(db, COLLECTION_NAME, snap.docs[0].id);
        return await updateDoc(ref, {
          ...settings,
          updatedAt: serverTimestamp()
        });
      } else {
        return await addDoc(collection(db, COLLECTION_NAME), {
          userId,
          ...settings,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
  },

  subscribeSettings: (userId: string, callback: (settings: UserSettings) => void) => {
    const q = query(collection(db, COLLECTION_NAME), where('userId', '==', userId));
    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        callback(snap.docs[0].data() as UserSettings);
      } else {
        callback({
          teacherName: 'Owen Reagan',
          schoolName: 'Thales Academy',
          signature: 'Owen Reagan',
          tone: 'Warm',
          canvasDomain: 'thales.instructure.com',
          canvasToken: ''
        } as UserSettings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    });
  }
};
