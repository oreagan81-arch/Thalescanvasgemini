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
      where('weekId', '==', weekId)
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

      for (const id of toDelete) {
        const ref = doc(db, COLLECTION_NAME, id);
        await deleteDoc(ref);
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

    try {
      for (const row of plannerRows) {
        if (!row.lessonTitle) continue;
        
        const q = query(
          collection(db, COLLECTION_NAME), 
          where('userId', '==', userId),
          where('rowId', '==', row.id || row.rowId)
        );
        const snap = await getDocs(q);
        
        if (snap.empty) {
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

          await addDoc(collection(db, COLLECTION_NAME), {
            userId,
            weekId,
            rowId: row.id || row.rowId,
            subject: row.subject,
            title: assignmentTitle,
            courseId: targetCourseId,
            type: 'Assignment',
            dueDate: serverTimestamp(),
            status: 'Pending',
            createdAt: serverTimestamp(),
            ...mathData
          });
        }
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
