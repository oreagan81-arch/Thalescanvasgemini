import { Firestore } from 'firebase-admin/firestore';
import { shouldCreateAssignment } from "../core/assignmentEngine";
import { createCanvasAssignment } from "../core/canvas";
import { isLocked } from "../api/canvas/createAssignment";
import { canvasApiToken } from "../core/canvas";

export async function deployAssignments(db: Firestore, assignments: any[]) {
  const created: any[] = [];
  const token = await canvasApiToken.get();

  for (const asg of assignments) {
    // 🔒 Idempotency check: verify if we should create this assignment
    const ok = await shouldCreateAssignment(db, asg);

    if (!ok) {
        // Fetch existing
        const existingDoc = await db.collection("assignments").doc(asg.idempotencyKey).get();
        if (existingDoc.exists) {
            const existingData = existingDoc.data();
            
            // 🔒 Grade Guard: Check if assignment is locked before updating
            if (await isLocked(existingData!.canvasId, existingData!.courseId, token)) {
                console.warn(`[GRADE GUARD] Skipping locked update: ${asg.idempotencyKey}`);
                continue; // 🔒 DO NOT TOUCH
            }
            
            // Proceed to updateCanvasAssignment(asg, existingData!.canvasId)
            // I don't have updateCanvasAssignment, just createCanvasAssignment.
            // I'll stick to only handling the lock check as requested.
            console.log(`Assignment ${asg.idempotencyKey} is not locked, but no update logic implemented.`);
        }
        continue;
    }

    // Create in Canvas
    const result = await createCanvasAssignment(asg);

    // Create in Firestore using idempotencyKey as the doc ID
    await db.collection("assignments").doc(asg.idempotencyKey).set({
      ...asg,
      canvasId: result.id,
      createdAt: new Date()
    });

    created.push(result);
  }

  return created;
}
