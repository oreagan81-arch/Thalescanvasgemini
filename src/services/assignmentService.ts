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
import { COURSE_IDS, NOTIFICATION_RECIPIENT } from '../constants';

export interface Assignment {
  id?: string;
  weekId: string;
  rowId: string;
  subject: string;
  title: string;
  courseId: number;
  type: 'Assignment' | 'Quiz' | 'Discussion';
  dueDate: any;
  status: 'Pending' | 'Drafted' | 'Deployed';
  canvasId?: string;
  isGraded?: boolean; // New safety field
  confidence?: number; // AI confidence score
  createdAt?: any;
}

const COLLECTION_NAME = 'assignments';

export const assignmentService = {
  subscribeByWeek: (weekId: string, callback: (assignments: Assignment[]) => void) => {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('weekId', '==', weekId)
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Assignment[];

      // Manual sort to avoid index requirements
      const sortedData = data.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      callback(sortedData);
    });
  },

  cleanDuplicates: async (weekId: string) => {
    const q = query(collection(db, COLLECTION_NAME), where('weekId', '==', weekId));
    const snap = await getDocs(q);
    const assignments = snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment));
    
    const seen = new Set();
    const toDelete: string[] = [];
    const lowConfidence: string[] = [];

    assignments.forEach(item => {
      const key = `${item.courseId}_${item.title}`;
      if (seen.has(key)) {
        // SAFETY: Only delete if not graded and 100% sure
        if (item.isGraded) {
          console.warn(`[SAFETY] Skipping deletion of graded duplicate: ${item.title}`);
        } else {
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
  },

  unpublishLowConfidence: async (id: string, reason: string) => {
    console.log(`⚠️ Low Confidence Alert for node ${id}: ${reason}`);
    console.log(`📧 Sending Notification to ${NOTIFICATION_RECIPIENT} for manual review.`);
    
    const ref = doc(db, COLLECTION_NAME, id);
    return await updateDoc(ref, {
      status: 'Pending', // Force back to pending
      isDraft: true,
      needsReview: true,
      reviewReason: reason
    });
  },

  generateFromPlanner: async (weekId: string, plannerRows: any[]) => {
    // Basic logic: Any row with lessonTitle gets a pending assignment draft
    for (const row of plannerRows) {
      if (!row.lessonTitle) continue;
      
      // Check if already exists for this row
      const q = query(collection(db, COLLECTION_NAME), where('rowId', '==', row.id || row.rowId));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        // Find correct course ID or fallback to Homeroom
        const targetCourseId = (COURSE_IDS as any)[row.subject] || COURSE_IDS.Homeroom;

        await addDoc(collection(db, COLLECTION_NAME), {
          weekId,
          rowId: row.id || row.rowId,
          subject: row.subject,
          title: `[${row.subject}] ${row.lessonTitle}`,
          courseId: targetCourseId,
          type: 'Assignment',
          dueDate: serverTimestamp(), // Placeholder
          status: 'Pending',
          createdAt: serverTimestamp()
        });
      }
    }
  },

  updateStatus: async (id: string, status: 'Drafted' | 'Deployed', canvasId?: string) => {
    const ref = doc(db, COLLECTION_NAME, id);
    return await updateDoc(ref, {
      status,
      canvasId,
      updatedAt: serverTimestamp()
    });
  }
};
