import { githubService } from './service.github';
import { plannerService, PlannerRow } from './service.planner';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface PacingUpdate {
  weekId: string;
  rows: Partial<PlannerRow>[];
}

export const syncService = {
  pullPacingUpdates: async (repoFullName: string, token: string) => {
    try {
      // 1. Fetch Pacing File from GitHub
      const pacingContent = await githubService.getFileContent(repoFullName, 'pacing.json', token);
      const updates = JSON.parse(pacingContent) as PacingUpdate[];
      
      let totalUpdated = 0;

      // 2. Process each week update
      for (const update of updates) {
        const { weekId, rows } = update;
        
        // Find existing rows for this week
        const q = query(collection(db, 'planner_rows'), where('weekId', '==', weekId));
        const snap = await getDocs(q);
        const existingRows = snap.docs.map(d => ({ id: d.id, ...d.data() } as PlannerRow));

        const batch = writeBatch(db);

        rows.forEach(newRow => {
          // Find matching existing row by Day and Subject
          const target = existingRows.find(e => e.day === newRow.day && e.subject === newRow.subject);
          
          if (target) {
            // Update existing
            batch.update(doc(db, 'planner_rows', target.id!), {
              ...newRow,
              updatedAt: serverTimestamp()
            });
            totalUpdated++;
          } else {
            // Create new if missing (shell generation fallback)
            const ref = doc(collection(db, 'planner_rows'));
            batch.set(ref, {
              ...newRow,
              weekId,
              deployStatus: 'Draft',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            totalUpdated++;
          }
        });

        await batch.commit();
      }

      return { 
        success: true, 
        message: `Synchronized ${totalUpdated} nodes from cloud repository.` 
      };
    } catch (err) {
      console.error("Sync Protocol Failure:", err);
      throw err;
    }
  }
};
