import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  deleteDoc,
  doc,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Template {
  id?: string;
  title: string;
  command: string;
  subject?: string;
  createdBy: string;
  createdAt?: any;
}

export const templateService = {
  subscribeTemplates: (userId: string, callback: (templates: Template[]) => void) => {
    const q = query(
      collection(db, 'templates'),
      where('createdBy', '==', userId)
    );

    return onSnapshot(q, (snapshot) => {
      const templates = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Template[];
      
      templates.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      callback(templates);
    });
  },

  createTemplate: async (userId: string, title: string, command: string, subject?: string) => {
    return addDoc(collection(db, 'templates'), {
      title,
      command,
      subject: subject || 'General',
      createdBy: userId,
      createdAt: serverTimestamp()
    });
  },

  deleteTemplate: async (templateId: string) => {
    return deleteDoc(doc(db, 'templates', templateId));
  }
};
