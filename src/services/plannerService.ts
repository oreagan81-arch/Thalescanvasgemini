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
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SNOW_DAY_MESSAGE, CURRICULUM_SHEET_URL } from '../constants';

export interface PlannerRow {
  id?: string;
  weekId: string;
  day: string;
  subject: string;
  lessonNum: string;
  lessonTitle: string;
  type: 'Lesson' | 'Test' | 'Quiz' | 'Project' | 'Review' | 'CP';
  resources: string[];
  homework: string;
  reminder: string;
  notes: string;
  deployStatus: 'Draft' | 'Ready' | 'Deployed' | 'Failed';
  lastModified?: any;
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION_NAME = 'planner_rows';

export const plannerService = {
  subscribeToWeek: (weekId: string, callback: (rows: PlannerRow[]) => void) => {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('weekId', '==', weekId)
    );

    const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    return onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PlannerRow[];

      // Local sort to avoid complex Firestore Indexes
      const sortedRows = rows.sort((a, b) => {
        const dayDiff = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
        if (dayDiff !== 0) return dayDiff;
        return a.subject.localeCompare(b.subject);
      });

      callback(sortedRows);
    });
  },

  addRow: async (row: Omit<PlannerRow, 'id'>) => {
    return await addDoc(collection(db, COLLECTION_NAME), {
      ...row,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  },

  updateRow: async (id: string, updates: Partial<PlannerRow>) => {
    const rowRef = doc(db, COLLECTION_NAME, id);
    return await updateDoc(rowRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  },

  deleteRow: async (id: string) => {
    const rowRef = doc(db, COLLECTION_NAME, id);
    return await deleteDoc(rowRef);
  },

  syncFromGoogleSheet: async (weekId: string) => {
    console.log(`📡 Inbound Sync: Fetching curriculum from Thales Master Sheet... (${CURRICULUM_SHEET_URL})`);
    // Simulation: In a production environment, this would call a cloud function 
    // that parses the Google Sheet via API.
    await new Promise(r => setTimeout(r, 1500));
    
    // We update current state
    return { success: true, message: "Curriculum nodes synchronized." };
  },

  triggerSnowDay: async (weekId: string, day: string) => {
    const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const dayIndex = DAYS_ORDER.indexOf(day);
    if (dayIndex === -1) return;

    const q = query(collection(db, COLLECTION_NAME), where('weekId', '==', weekId));
    const snap = await getDocs(q);
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as PlannerRow));

    const batch = writeBatch(db);

    // 1. Clear the snow day
    const snowDayRows = rows.filter(r => r.day === day);
    snowDayRows.forEach(r => {
      batch.update(doc(db, COLLECTION_NAME, r.id!), {
        lessonTitle: SNOW_DAY_MESSAGE,
        lessonNum: 'N/A',
        notes: 'Snow Day - No School',
        homework: '',
        resources: [],
        updatedAt: serverTimestamp()
      });
    });

    // 2. Shift subsequent days forward
    for (let i = dayIndex; i < DAYS_ORDER.length - 1; i++) {
        const currentDay = DAYS_ORDER[i];
        const nextDay = DAYS_ORDER[i + 1];
        
        const currentData = rows.filter(r => r.day === currentDay);
        const nextDayRows = rows.filter(r => r.day === nextDay);

        // This is complex for a simple batch without a temp swap, 
        // but for Thales OS, we update next day with current day data.
        nextDayRows.forEach(targetRow => {
            const source = currentData.find(s => s.subject === targetRow.subject);
            if (source && source.lessonTitle !== SNOW_DAY_MESSAGE) {
                batch.update(doc(db, COLLECTION_NAME, targetRow.id!), {
                    lessonTitle: source.lessonTitle,
                    lessonNum: source.lessonNum,
                    type: source.type,
                    homework: source.homework,
                    resources: source.resources,
                    updatedAt: serverTimestamp()
                });
            }
        });
    }

    await batch.commit();
  },

  cleanDuplicates: async (weekId: string) => {
    const q = query(collection(db, COLLECTION_NAME), where('weekId', '==', weekId));
    const snap = await getDocs(q);
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as PlannerRow));
    
    const seen = new Set();
    const toDelete: string[] = [];

    rows.forEach(row => {
      const key = `${row.day}_${row.subject}_${row.lessonTitle}`;
      if (seen.has(key)) {
        toDelete.push(row.id!);
      } else {
        seen.add(key);
      }
    });

    for (const id of toDelete) {
      await plannerService.deleteRow(id);
    }
    
    return toDelete.length;
  },

  generateWeekShell: async (weekId: string) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const subjects = ['Math', 'Reading', 'Spelling', 'Language Arts', 'Science', 'History'];
    
    const batch = writeBatch(db);
    for (const day of days) {
      for (const subject of subjects) {
        const ref = doc(collection(db, COLLECTION_NAME));
        batch.set(ref, {
          weekId,
          day,
          subject,
          lessonNum: '',
          lessonTitle: '',
          type: 'Lesson',
          resources: [],
          homework: '',
          reminder: '',
          notes: '',
          deployStatus: 'Draft',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }
    await batch.commit();
  }
};
