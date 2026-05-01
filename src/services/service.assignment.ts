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
import { rulesEngine } from '../lib/thales/rulesEngine';

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
  points?: number;
  gradingType?: 'pass_fail' | 'percent' | 'letter_grade' | 'points';
  omitFromFinalGrade?: boolean;
  canvasId?: string;
  canvasUrl?: string; // Track Canvas link
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
  subscribeByWeek: (userId: string, weekId: string, callback: (assignments: Assignment[]) => void) => {
    if (!userId) return () => {};

    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      where('weekId', '==', weekId),
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
      // Sync Efficiency: Cache existing rowIds and Assignment titles/subjects for the current week to prevent redundant writes
      const existingQ = query(
        collection(db, COLLECTION_NAME), 
        where('userId', '==', userId),
        where('weekId', '==', weekId)
      );
      const existingSnap = await getDocs(existingQ);
      const existingRowIds = new Set(existingSnap.docs.map(d => d.data().rowId));
      const existingAssignmentKeys = new Set(existingSnap.docs.map(d => `${d.data().title}_${d.data().subject}`));

      // 1. Resolve Academic Context for Date calculation
      const [qStr, wStr] = weekId.split('_');
      const quarter = parseInt(qStr.substring(1));
      const weekNum = parseInt(wStr.substring(1));
      const { calendarService } = await import('./service.calendar');
      const weekDates = calendarService.getDatesForContext(quarter, weekNum);

      for (const row of plannerRows) {
        // --- Thales Rules Engine: Explicit Blockers ---
        // 1. History/Science: No assignments ever
        if (row.subject === 'Science' || row.subject === 'History') continue;
        
        // 2. Language Arts: Only CP (Classroom Practice) or Test allowed
        if (row.subject === 'Language Arts' && !(row.type === 'CP' || row.type === 'Test')) continue;

        // 3. Friday Rule: No homework, only Tests allowed
        if (row.day === 'Friday' && row.type !== 'Test') continue;
        // ----------------------------------------------

        const rowId = row.id || row.rowId;
        
        // Use Thales deterministic rules to generate assignments
        const generated = rulesEngine.generateAssignments(row);

        for (const gen of generated) {
          // Robust deduplication: check both rowId and title/subject
          if (!row.lessonTitle || existingRowIds.has(rowId) || existingAssignmentKeys.has(`${gen.title}_${row.subject}`)) continue;
          
          let targetCourseId = (COURSE_IDS as any)[row.subject] || COURSE_IDS.Homeroom;
          if (courseIdsMap && courseIdsMap[row.subject]) {
            targetCourseId = parseInt(courseIdsMap[row.subject]);
          } else if (courseIdsMap && courseIdsMap['Homeroom']) {
            targetCourseId = parseInt(courseIdsMap['Homeroom']);
          }

          // Calculate Dynamic Due Date
          const dayInfo = weekDates.find(d => d.label === row.day);
          let dueDate: any = serverTimestamp();
          if (dayInfo) {
            const baseDate = new Date(dayInfo.iso + "T12:00:00");
            if (gen.dueDateOffset) {
              baseDate.setDate(baseDate.getDate() + gen.dueDateOffset);
            }
            dueDate = baseDate;
          }
          
          const newRef = doc(collection(db, COLLECTION_NAME));
          batch.set(newRef, {
            userId,
            weekId,
            rowId,
            subject: row.subject,
            title: rulesEngine.silentAuditor(gen.title),
            courseId: targetCourseId,
            type: gen.isStudyGuide ? 'Assignment' : 'Assignment', // Distinguish more if needed
            points: gen.points,
            gradingType: gen.gradingType,
            omitFromFinalGrade: gen.omitFromFinalGrade,
            dueDate,
            status: 'Pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          writesQueued++;
          // Register the new key to prevent duplicates within this same batch
          existingAssignmentKeys.add(`${gen.title}_${row.subject}`);
        }

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
  },

  shiftAssignments: async (weekId: string, fromDate: Date, days: number = 1) => {
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
      
      const batch = writeBatch(db);
      assignments.forEach(a => {
        const dueDate = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
        if (dueDate >= fromDate) {
          // Add days, skip weekends logic could go here
          const newDate = new Date(dueDate);
          newDate.setDate(newDate.getDate() + days);
          batch.update(doc(db, COLLECTION_NAME, a.id!), {
            dueDate: newDate,
            updatedAt: serverTimestamp()
          });
        }
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
  }
};
