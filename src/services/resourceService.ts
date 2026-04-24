import { 
  collection, 
  query, 
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

export interface ResourceFile {
  id?: string;
  fileId: string;
  rawName: string;
  cleanName: string;
  subject: string;
  type: string;
  canvasUrl: string;
  mappedTo?: string; // rowId it's mapped to
  createdAt?: any;
}

const COLLECTION_NAME = 'resources';

export const resourceService = {
  subscribeAll: (callback: (resources: ResourceFile[]) => void) => {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ResourceFile[];
      callback(data);
    });
  },

  addResource: async (resource: Omit<ResourceFile, 'id'>) => {
    return await addDoc(collection(db, COLLECTION_NAME), {
      ...resource,
      createdAt: serverTimestamp()
    });
  },

  updateMapping: async (id: string, rowId: string | null) => {
    const ref = doc(db, COLLECTION_NAME, id);
    return await updateDoc(ref, {
      mappedTo: rowId
    });
  },

  // Simulate a Canvas Sync for demonstration/dev
  syncCanvasFiles: async () => {
    // In a real app, this would be an API call to a backend that talks to Canvas
    // For now we simulate adding some files to the registry
    const mockFiles = [
      { fileId: 'canvas_101', rawName: 'math_quiz_v2_final.pdf', cleanName: 'Math Quiz 24', subject: 'Math', type: 'Quiz', canvasUrl: '#' },
      { fileId: 'canvas_202', rawName: 'reading_passage_winn_dixie.docx', cleanName: 'Ch 4 Passage', subject: 'Reading', type: 'Lesson', canvasUrl: '#' },
      { fileId: 'canvas_303', rawName: 'science_ecosystems_slides.pptx', cleanName: 'Ecosystems Intro', subject: 'Science', type: 'Lesson', canvasUrl: '#' },
      { fileId: 'canvas_404', rawName: 'spelling_list_week_24.pdf', cleanName: 'Spelling List 24', subject: 'Spelling', type: 'Lesson', canvasUrl: '#' },
    ];

    for (const file of mockFiles) {
      // Check if exists first to avoid duplicates in mock
      const q = query(collection(db, COLLECTION_NAME));
      const snap = await getDocs(q);
      const exists = snap.docs.some(d => d.data().fileId === file.fileId);
      
      if (!exists) {
        await resourceService.addResource(file);
      }
    }
  }
};
