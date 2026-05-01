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
import { SNOW_DAY_MESSAGE, CURRICULUM_SHEET_URL } from '../constants';

export interface PlannerRow {
  id?: string;
  userId: string;
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
  order: number;
  deployStatus: 'Draft' | 'Ready' | 'Deployed' | 'Failed';
  canvasId?: string; // Track Canvas page/assignment ID
  canvasUrl?: string; // Track Canvas direct link
  lastModified?: any;
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION_NAME = 'planner_rows';

export const plannerService = {
  subscribeToWeek: (userId: string, weekId: string, callback: (rows: PlannerRow[]) => void) => {
    if (!userId) return () => {};

    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      where('weekId', '==', weekId),
      limit(100)
    );

    const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    return onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PlannerRow[];

      const sortedRows = rows.sort((a, b) => {
        const dayDiff = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
        if (dayDiff !== 0) return dayDiff;
        return (a.order || 0) - (b.order || 0);
      });

      callback(sortedRows);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    });
  },

  addRow: async (row: Omit<PlannerRow, 'id' | 'userId'>) => {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Authentication required");

    try {
      return await addDoc(collection(db, COLLECTION_NAME), {
        ...row,
        userId,
        order: row.order || Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
    }
  },

  updateRow: async (id: string, updates: Partial<PlannerRow>) => {
    try {
      const rowRef = doc(db, COLLECTION_NAME, id);
      return await updateDoc(rowRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    }
  },

  deleteRow: async (id: string) => {
    try {
      const rowRef = doc(db, COLLECTION_NAME, id);
      return await deleteDoc(rowRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
    }
  },

  syncFromGoogleSheet: async (weekId: string) => {
    try {
      // 1. Get the store to access settings
      const { useStore } = await import('../store');
      const store = useStore.getState();
      const url = store.pacingGuideUrl;
      const apiKey = store.geminiApiKey;

      if (!apiKey) {
        throw new Error("Gemini API Key is required for intelligence-based sync. Please add it in Settings.");
      }

      // 2. Fetch the sheet via our proxy
      console.log(`📡 Fetching curriculum from: ${url}`);
      const proxyUrl = `/api/proxy/google-sheets?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error("Failed to fetch Google Sheet. Ensure the sheet is public (Anyone with link can view).");
      }
      
      const rawText = await response.text();

      // 3. Parse with Gemini
      const { pacingImportService } = await import('./service.pacingImport');
      const pacingWeeks = await pacingImportService.parse(rawText, apiKey);

      // 4. Update the master store
      store.setPlannerData(pacingWeeks);
      store.setLastSynced(new Date());

      // 5. If specific weekId is provided, we can auto-populate Firestore for that week if it's empty
      // Extract numeric week from QxWy or Wx
      const weekNum = parseInt(weekId.split('_').pop()?.substring(1) || "0") || parseInt(weekId.substring(1)) || 0;
      const weekData = pacingWeeks.find(pw => pw.weekNumber === weekNum);

      if (weekData) {
        // Here we could trigger a specific population logic, but for now we'll just return success
        // and let the user click "Generate Week Shell" or similar if they need daily rows.
        return { 
          success: true, 
          message: `Master Pacing Synced. Week ${weekNum} identified as: ${weekData.mathLesson}`,
          data: pacingWeeks
        };
      }

      return { success: true, message: "Master Pacing Guide Synchronized.", data: pacingWeeks };
    } catch (error) {
      console.error("Sync Error:", error);
      throw error;
    }
  },

  triggerSnowDay: async (weekId: string, day: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Authentication required");

    const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const dayIndex = DAYS_ORDER.indexOf(day);
    if (dayIndex === -1) return;

    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('userId', '==', userId),
        where('weekId', '==', weekId)
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as PlannerRow));

      const batch = writeBatch(db);

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

      for (let i = dayIndex; i < DAYS_ORDER.length - 1; i++) {
          const currentDay = DAYS_ORDER[i];
          const nextDay = DAYS_ORDER[i + 1];
          
          const currentData = rows.filter(r => r.day === currentDay);
          const nextDayRows = rows.filter(r => r.day === nextDay);

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
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
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
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
  },

  generateWeekShell: async (weekId: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Authentication required");

    try {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const subjects = ['Math', 'Reading', 'Spelling', 'Language Arts', 'Science', 'History'];
      
      const batch = writeBatch(db);
      for (const day of days) {
        for (const subject of subjects) {
          const ref = doc(collection(db, COLLECTION_NAME));
          batch.set(ref, {
            userId,
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
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
  }
};
