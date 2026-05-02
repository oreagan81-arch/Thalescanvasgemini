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
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { SPELLING_TEST_MAP } from '../lib/thales/mappings';

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

export function getSpellingFocusWords(testNumber: number): string[] {
  const entry = SPELLING_TEST_MAP[testNumber];
  if (!entry) return [];
  return entry.words.slice(20, 25); // Words 21-25
}

export const announcementService = {
  subscribeByWeek: (userId: string, weekId: string, callback: (announcements: Announcement[]) => void) => {
    if (!userId) return () => {};

    const q = query(
      collection(db, COLLECTION_NAME),
      where('weekId', '==', weekId),
      where('userId', '==', userId),
      limit(50)
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

  subscribeAll: (userId: string, callback: (announcements: Announcement[]) => void) => {
    if (!userId) return () => {};

    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      limit(100)
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
    if (!userId) throw new Error("User not authenticated.");
    
    let finalContent = content;

    // Inject Spelling Focus Words
    if (subject?.toLowerCase().includes('spelling')) {
      // Q4_W3 -> Week 33 absolute example logic
      const qNum = parseInt(weekId.split('_')[0].replace('Q', ''));
      const wNum = parseInt(weekId.split('_')[1].replace('W', ''));
      const absWeek = ((qNum - 1) * 9) + wNum; // Simplified instructional week mapping
      
      const focusWords = getSpellingFocusWords(absWeek);
      if (focusWords.length > 0 && !finalContent.includes(focusWords[0])) {
        finalContent += '\n\n📝 This week\'s 5 focus spelling words: ' + focusWords.join(', ');
      }
    }

    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('weekId', '==', weekId),
        where('userId', '==', userId),
        limit(1)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const docRef = doc(db, COLLECTION_NAME, snapshot.docs[0].id);
        await updateDoc(docRef, { 
          content: finalContent, 
          subject: subject || '',
          updatedAt: serverTimestamp() 
        });
        return snapshot.docs[0].id;
      } else {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
          userId,
          weekId,
          content: finalContent,
          subject: subject || '',
          status: 'Draft',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        return docRef.id;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
  }
};
