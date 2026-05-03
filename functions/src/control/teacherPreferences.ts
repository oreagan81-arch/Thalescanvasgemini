import { db } from "../lib/db";

export interface TeacherPreferences {
  tone: string;
  rigor: string;
}

export async function getTeacherPreferences(userId: string): Promise<TeacherPreferences> {
  const doc = await db.collection("teacherPreferences").doc(userId).get();
  if (!doc.exists) {
    return { tone: "standard", rigor: "medium" }; // Defaults
  }
  return doc.data() as TeacherPreferences;
}

export async function saveTeacherPreferences(userId: string, prefs: TeacherPreferences) {
  await db.collection("teacherPreferences").doc(userId).set(prefs, { merge: true });
}
