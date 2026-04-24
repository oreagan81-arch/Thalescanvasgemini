import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot,
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface UserSettings {
  teacherName: string;
  schoolName: string;
  signature: string;
  tone: 'Warm' | 'Formal' | 'Friendly' | 'Direct';
  canvasDomain?: string;
  canvasToken?: string;
  updatedAt?: any;
}

const COLLECTION_NAME = 'user_settings';

export const settingsService = {
  getSettings: async (userId: string): Promise<UserSettings | null> => {
    const q = query(collection(db, 'user_settings'), where('userId', '==', userId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as UserSettings;
    }
    return null;
  },

  updateSettings: async (userId: string, settings: Partial<UserSettings>) => {
    const q = query(collection(db, 'user_settings'), where('userId', '==', userId));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      const ref = doc(db, 'user_settings', snap.docs[0].id);
      return await updateDoc(ref, {
        ...settings,
        updatedAt: serverTimestamp()
      });
    } else {
      return await addDoc(collection(db, 'user_settings'), {
        userId,
        ...settings,
        updatedAt: serverTimestamp()
      });
    }
  },

  subscribeSettings: (userId: string, callback: (settings: UserSettings) => void) => {
    const q = query(collection(db, 'user_settings'), where('userId', '==', userId));
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
    });
  }
};
