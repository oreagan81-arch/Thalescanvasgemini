import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// The setup tool created Firestore Enterprise edition using this specific config structure:
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");
