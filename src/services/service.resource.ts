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
import { useStore } from '../store';
import { canvasApiService } from './canvasApiService';

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
  subscribeAll: (userId: string, callback: (resources: ResourceFile[]) => void, maxResults = 100) => {
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

  updateCleanName: async (id: string, newName: string) => {
    try {
      const ref = doc(db, COLLECTION_NAME, id);
      return await updateDoc(ref, {
        cleanName: newName,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    }
  },

  getAllResources: async (userId: string): Promise<ResourceFile[]> => {
    try {
      const q = query(collection(db, COLLECTION_NAME), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResourceFile));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
      return [];
    }
  },

  syncCanvasFiles: async () => {
    const userId = auth.currentUser?.uid;
    const { canvasCourseIds } = useStore.getState();
    if (!userId) throw new Error("Authentication required");

    const homeroomId = canvasCourseIds['Homeroom'];
    if (!homeroomId) return;

    try {
      const files = await canvasApiService.getCourseFiles(homeroomId);
      
      for (const file of files) {
        const q = query(
          collection(db, COLLECTION_NAME), 
          where('userId', '==', userId), 
          where('fileId', '==', file.id.toString())
        );
        const snap = await getDocs(q);
        
        if (snap.empty) {
          await resourceService.addResource({
            fileId: file.id.toString(),
            rawName: file.display_name,
            cleanName: file.display_name.split('.')[0],
            subject: 'General', // Default, logic below can refine
            type: 'File',
            canvasUrl: file.url
          });
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
