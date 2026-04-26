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
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export interface Announcement {
  id?: string;
  userId: string;
  weekId: string;
  subject?: string;
  content: string;
  status: 'Draft' | 'Posted';
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION_NAME = 'announcements';

export const announcementService = {
  subscribeByWeek: (weekId: string, callback: (announcements: Announcement[]) => void) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return () => {};

    const q = query(
      collection(db, COLLECTION_NAME),
      where('weekId', '==', weekId),
      where('userId', '==', userId)
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Announcement[];

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

  subscribeAll: (callback: (announcements: Announcement[]) => void) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return () => {};

    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Announcement[];
      callback(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    });
  },

  upsert: async (weekId: string, content: string, subject?: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Authentication required");

    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('weekId', '==', weekId),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      
      const updateData: any = {
        content,
        updatedAt: serverTimestamp()
      };
      if (subject) updateData.subject = subject;

      if (!snapshot.empty) {
        const existingDoc = snapshot.docs[0];
        return await updateDoc(doc(db, COLLECTION_NAME, existingDoc.id), updateData);
      } else {
        return await addDoc(collection(db, COLLECTION_NAME), {
          userId,
          weekId,
          subject: subject || '',
          content,
          status: 'Draft',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
  }
};
