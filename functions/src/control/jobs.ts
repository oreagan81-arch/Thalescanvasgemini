import { db } from "../lib/db";
import { FieldValue } from "firebase-admin/firestore";
import { sendAlert } from "./alerts";

export async function createJob(payload: any, configSnapshot?: any) {
  const ref = await db.collection("jobs").add({
    status: "pending",
    payload,
    configSnapshot,
    progress: 0,
    logs: [],
    createdAt: Date.now()
  });

  return ref.id;
}

export async function updateJob(jobId: string, updates: any) {
  if (updates.status === 'failed') {
      await sendAlert(`Job ${jobId} failed`);
  }
  await db.collection("jobs").doc(jobId).update({
    ...updates,
    updatedAt: Date.now()
  });
}

export async function logJob(jobId: string, message: string) {
  await db.collection("jobs").doc(jobId).update({
    logs: FieldValue.arrayUnion({
      message,
      time: Date.now()
    })
  });
}
