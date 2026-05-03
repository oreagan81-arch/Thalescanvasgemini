import { db } from "../lib/db";
import { FieldValue } from "firebase-admin/firestore";

export async function sendAlert(message: string, severity: 'info' | 'warning' | 'error' = 'error') {
  await db.collection("alerts").add({
    message,
    severity,
    createdAt: FieldValue.serverTimestamp(),
    read: false
  });
}
