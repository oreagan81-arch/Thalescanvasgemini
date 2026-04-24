import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  onSnapshot,
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface CanvasPage {
  id?: string;
  weekId: string;
  htmlContent: string;
  status: 'Draft' | 'Deployed';
  canvasPageId?: string; // ID in Canvas LMS if deployed
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION_NAME = 'canvas_pages';

export const canvasPageService = {
  subscribeByWeek: (weekId: string, callback: (pages: CanvasPage[]) => void) => {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('weekId', '==', weekId)
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CanvasPage[];

      // Manual sort for index efficiency
      const sorted = data.sort((a,b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });

      callback(sorted);
    });
  },

  upsert: async (weekId: string, htmlContent: string) => {
    const q = query(collection(db, COLLECTION_NAME), where('weekId', '==', weekId));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const existingDoc = snapshot.docs[0];
      return await updateDoc(doc(db, COLLECTION_NAME, existingDoc.id), {
        htmlContent,
        updatedAt: serverTimestamp()
      });
    } else {
      return await addDoc(collection(db, COLLECTION_NAME), {
        weekId,
        htmlContent,
        status: 'Draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  },

  updateStatus: async (id: string, status: 'Draft' | 'Deployed', canvasPageId?: string) => {
    const ref = doc(db, COLLECTION_NAME, id);
    return await updateDoc(ref, {
      status,
      canvasPageId,
      updatedAt: serverTimestamp()
    });
  },

  replayPage: async (id: string) => {
    const ref = doc(db, COLLECTION_NAME, id);
    // Refresh the update timestamp to trigger a "Modified" status for CI/CD
    return await updateDoc(ref, {
      status: 'Draft',
      updatedAt: serverTimestamp()
    });
  },

  cleanDuplicates: async (weekId: string) => {
    const q = query(collection(db, COLLECTION_NAME), where('weekId', '==', weekId));
    const snap = await getDocs(q);
    const pages = snap.docs.map(d => ({ id: d.id, ...d.data() } as CanvasPage));
    
    if (pages.length <= 1) return 0;

    // Keep the most recent, delete others
    const sorted = pages.sort((a, b) => b.updatedAt?.seconds - a.updatedAt?.seconds);
    const [latest, ...oldOnes] = sorted;

    for (const p of oldOnes) {
      if (p.status !== 'Deployed') { // Safer to delete non-deployed old drafts
        await deleteDoc(doc(db, COLLECTION_NAME, p.id!));
      }
    }
    return oldOnes.length;
  }
};
