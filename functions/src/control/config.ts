import { db } from "../lib/db";
import { CallableRequest, HttpsError } from "firebase-functions/v2/https";

export async function getSystemConfig() {
  const doc = await db.collection("system_config").doc("global").get();
  return doc.data();
}

export async function updateSystemConfig(updates: any) {
  await db.collection("system_config").doc("global").update(updates);
}
