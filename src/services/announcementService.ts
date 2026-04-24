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

export interface Announcement {
  id?: string;
  weekId: string;
  content: string;
  status: 'Draft' | 'Posted';
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION_NAME = 'announcements';

export const announcementService = {
  subscribeByWeek: (weekId: string, callback: (announcements: Announcement[]) => void) => {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('weekId', '==', weekId)
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Announcement[];

      // Manual sort for index efficiency
      const sorted = data.sort((a,b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });

      callback(sorted);
    });
  },

  subscribeAll: (callback: (announcements: Announcement[]) => void) => {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Announcement[];
      callback(data);
    });
  },

  upsert: async (weekId: string, content: string) => {
    // Check if one exists for the week
    const q = query(collection(db, COLLECTION_NAME), where('weekId', '==', weekId));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const existingDoc = snapshot.docs[0];
      return await updateDoc(doc(db, COLLECTION_NAME, existingDoc.id), {
        content,
        updatedAt: serverTimestamp()
      });
    } else {
      return await addDoc(collection(db, COLLECTION_NAME), {
        weekId,
        content,
        status: 'Draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  }
};
