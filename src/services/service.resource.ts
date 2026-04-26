import { 
  collection, 
  query, 
  where,
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot,
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export interface ResourceFile {
  id?: string;
  userId: string;
  fileId: string;
  rawName: string;
  cleanName: string;
  subject: string;
  type: string;
  canvasUrl: string;
  mappedTo?: string;
  createdAt?: any;
}

const COLLECTION_NAME = 'resources';

export const resourceService = {
  subscribeAll: (callback: (resources: ResourceFile[]) => void, maxResults = 100) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return () => {};

    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      limit(maxResults)
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ResourceFile[];
      
      // Manual in-memory sort to avoid index requirement
      data.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      callback(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    });
  },

  addResource: async (resource: Omit<ResourceFile, 'id' | 'userId'>) => {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Authentication required");

    try {
      return await addDoc(collection(db, COLLECTION_NAME), {
        ...resource,
        userId,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
    }
  },

  updateMapping: async (id: string, rowId: string | null) => {
    try {
      const ref = doc(db, COLLECTION_NAME, id);
      return await updateDoc(ref, {
        mappedTo: rowId
      });
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    }
  },

  syncCanvasFiles: async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Authentication required");

    try {
      const mockFiles = [
        { fileId: 'canvas_101', rawName: 'math_quiz_v2_final.pdf', cleanName: 'Math Quiz 24', subject: 'Math', type: 'Quiz', canvasUrl: '#' },
        { fileId: 'canvas_202', rawName: 'reading_passage_winn_dixie.docx', cleanName: 'Ch 4 Passage', subject: 'Reading', type: 'Lesson', canvasUrl: '#' },
        { fileId: 'canvas_303', rawName: 'science_ecosystems_slides.pptx', cleanName: 'Ecosystems Intro', subject: 'Science', type: 'Lesson', canvasUrl: '#' },
        { fileId: 'canvas_404', rawName: 'spelling_list_week_24.pdf', cleanName: 'Spelling List 24', subject: 'Spelling', type: 'Lesson', canvasUrl: '#' },
      ];

      for (const file of mockFiles) {
        const q = query(collection(db, COLLECTION_NAME), where('userId', '==', userId), where('fileId', '==', file.fileId));
        const snap = await getDocs(q);
        
        if (snap.empty) {
          await resourceService.addResource(file);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
  },

  /**
   * Rule #4: Resolve Resource URL.
   * Matches a local filename/title to the verified Canvas cloud URL.
   */
  resolveResource: (resources: ResourceFile[], target: string): string | null => {
    const match = resources.find(r => 
      r.cleanName.toLowerCase() === target.toLowerCase() || 
      r.rawName.toLowerCase() === target.toLowerCase()
    );
    return match ? match.canvasUrl : null;
  }
};
