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
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export interface CanvasPage {
  id?: string;
  userId: string;
  weekId: string;
  htmlContent: string;
  status: 'Draft' | 'Deployed';
  canvasPageId?: string;
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION_NAME = 'canvas_pages';

export const canvasPageService = {
  subscribeByWeek: (userId: string, weekId: string, callback: (pages: CanvasPage[]) => void) => {
    if (!userId) return () => {};

    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      where('weekId', '==', weekId)
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CanvasPage[];

      const sorted = data.sort((a,b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });

      callback(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    });
  },

  upsert: async (weekId: string, htmlContent: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Authentication required");

    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('userId', '==', userId),
        where('weekId', '==', weekId)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const existingDoc = snapshot.docs[0];
        return await updateDoc(doc(db, COLLECTION_NAME, existingDoc.id), {
          htmlContent,
          updatedAt: serverTimestamp()
        });
      } else {
        return await addDoc(collection(db, COLLECTION_NAME), {
          userId,
          weekId,
          htmlContent,
          status: 'Draft',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
  },

  updateStatus: async (id: string, status: 'Draft' | 'Deployed', canvasPageId?: string) => {
    try {
      const ref = doc(db, COLLECTION_NAME, id);
      return await updateDoc(ref, {
        status,
        canvasPageId,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    }
  },

  replayPage: async (id: string) => {
    try {
      const ref = doc(db, COLLECTION_NAME, id);
      return await updateDoc(ref, {
        status: 'Draft',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    }
  },

  cleanDuplicates: async (weekId: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Authentication required");

    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('userId', '==', userId),
        where('weekId', '==', weekId)
      );
      const snap = await getDocs(q);
      const pages = snap.docs.map(d => ({ id: d.id, ...d.data() } as CanvasPage));
      
      if (pages.length <= 1) return 0;

      const sorted = pages.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      const [latest, ...oldOnes] = sorted;

      for (const p of oldOnes) {
        if (p.status !== 'Deployed') {
          await deleteDoc(doc(db, COLLECTION_NAME, p.id!));
        }
      }
      return oldOnes.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
  }
};
