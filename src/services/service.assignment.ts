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
  limit,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { COURSE_IDS, NOTIFICATION_RECIPIENT } from '../constants';
import { extractMathTestNumber, parseMathTest } from '../lib/thales/mappings';

export interface Assignment {
  id?: string;
  userId: string;
  weekId: string;
  rowId: string;
  subject: string;
  title: string;
  courseId: number;
  type: 'Assignment' | 'Quiz' | 'Discussion';
  dueDate: any;
  status: 'Pending' | 'Drafted' | 'Deployed';
  canvasId?: string;
  isGraded?: boolean;
  confidence?: number;
  createdAt?: any;
  testNumber?: number;
  powerUp?: string;
  factSkill?: string;
  isTimed?: boolean;
  hasStudyGuide?: boolean;
}

const COLLECTION_NAME = 'assignments';

export const assignmentService = {
  subscribeByWeek: (weekId: string, callback: (assignments: Assignment[]) => void) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return () => {};

    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      where('weekId', '==', weekId),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Assignment[];

      const sortedData = data.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      callback(sortedData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    });
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
      const assignments = snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment));
      
      const seen = new Set();
      const toDelete: string[] = [];

      assignments.forEach(item => {
        const key = `${item.courseId}_${item.title}`;
        if (seen.has(key)) {
          if (!item.isGraded) {
            toDelete.push(item.id!);
          }
        } else {
          seen.add(key);
        }
      });

      if (toDelete.length > 0) {
        const batch = writeBatch(db);
        toDelete.forEach(id => {
          batch.delete(doc(db, COLLECTION_NAME, id));
        });
        await batch.commit();
      }

      return toDelete.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
  },

  unpublishLowConfidence: async (id: string, reason: string) => {
    try {
      const ref = doc(db, COLLECTION_NAME, id);
      return await updateDoc(ref, {
        status: 'Pending',
        isDraft: true,
        needsReview: true,
        reviewReason: reason
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    }
  },

  generateFromPlanner: async (weekId: string, plannerRows: any[], courseIdsMap?: Record<string, string>) => {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Authentication required");

    const batch = writeBatch(db);
    let writesQueued = 0;

    try {
      // Sync Efficiency: Cache existing rowIds for the current week to prevent redundant writes
      const existingQ = query(
        collection(db, COLLECTION_NAME), 
        where('userId', '==', userId),
        where('weekId', '==', weekId)
      );
      const existingSnap = await getDocs(existingQ);
      const existingRowIds = new Set(existingSnap.docs.map(d => d.data().rowId));

      for (const row of plannerRows) {
        const rowId = row.id || row.rowId;
        if (!row.lessonTitle || existingRowIds.has(rowId)) continue;
        
        let targetCourseId = (COURSE_IDS as any)[row.subject] || COURSE_IDS.Homeroom;
        if (courseIdsMap && courseIdsMap[row.subject]) {
          targetCourseId = parseInt(courseIdsMap[row.subject]);
        } else if (courseIdsMap && courseIdsMap['Homeroom']) {
          targetCourseId = parseInt(courseIdsMap['Homeroom']);
        }
        
        const testNum = extractMathTestNumber(row.lessonTitle);
        let assignmentTitle = `[${row.subject}] ${row.lessonTitle}`;
        let mathData = {};

        if (testNum !== null) {
          const details = parseMathTest(testNum);
          assignmentTitle = `[MATH TEST ${testNum}] ${details.factSkill} (${details.powerUp})`;
          mathData = {
            testNumber: testNum,
            powerUp: details.powerUp,
            factSkill: details.factSkill,
            isTimed: details.timed,
            hasStudyGuide: details.studyGuideIncluded
          };
        }

        const newRef = doc(collection(db, COLLECTION_NAME));
        batch.set(newRef, {
          userId,
          weekId,
          rowId,
          subject: row.subject,
          title: assignmentTitle,
          courseId: targetCourseId,
          type: 'Assignment',
          dueDate: serverTimestamp(),
          status: 'Pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          ...mathData
        });
        writesQueued++;

        // Batch limit is 500
        if (writesQueued >= 450) {
          await batch.commit();
          writesQueued = 0;
        }
      }
      
      if (writesQueued > 0) {
        await batch.commit();
        console.log(`Successfully batched ${writesQueued} assignments.`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
  },

  updateStatus: async (id: string, status: 'Drafted' | 'Deployed', canvasId?: string) => {
    try {
      const ref = doc(db, COLLECTION_NAME, id);
      return await updateDoc(ref, {
        status,
        canvasId,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    }
  }
};
