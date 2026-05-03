import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

export interface Alert {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  createdAt: any;
  read: boolean;
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'alerts'),
      where('read', '==', false),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newAlerts: Alert[] = [];
      snapshot.forEach((doc) => {
        newAlerts.push({ id: doc.id, ...doc.data() } as Alert);
      });
      setAlerts(newAlerts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { alerts, loading };
}
