import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { validateAssignmentPayload, AssignmentPayload } from './validateAssignmentPayload';

interface TestResult {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  payload: AssignmentPayload;
}

export async function testAssignmentWrite(payload: AssignmentPayload): Promise<TestResult> {
  const validation = validateAssignmentPayload(payload);
  
  if (!validation.valid) {
    console.error('\n🚨 FIRESTORE FAILURE DETECTED (Pre-Write Validation)');
    validation.errors.forEach(err => {
      console.error(`Field: ${err.field}`);
      console.error(`Value: "${err.value}"`);
      console.error(`Expected: ${err.expected}`);
      console.error(`Violation: ${err.violation}\n`);
    });
    
    return {
      success: false,
      errorMessage: `Validation failed: ${validation.errors.map(e => e.violation).join(', ')}`,
      payload
    };
  }

  try {
    const docRef = doc(db, 'assignments', payload.idempotencyKey);
    await setDoc(docRef, {
      ...payload,
      createdAt: new Date().toISOString()
    });
    
    console.log(`✅ Successfully wrote assignment: ${payload.idempotencyKey}`);
    return { success: true, payload };
  } catch (error: any) {
    console.error('\n🚨 FIRESTORE FAILURE DETECTED (Runtime)', error);
    
    return {
      success: false,
      errorCode: error.code,
      errorMessage: error.message,
      payload
    };
  }
}
