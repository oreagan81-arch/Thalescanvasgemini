import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app);

// Callable references
const deployPagesFn = httpsCallable(functions, 'deployPages');
const deployAssignmentsFn = httpsCallable(functions, 'deployAssignments');
const deployAnnouncementsFn = httpsCallable(functions, 'deployAnnouncements');
const runWeekValidatorFn = httpsCallable(functions, 'runWeekValidator');

export async function deployWeekPages(weekId: string) {
  try {
    const result = await deployPagesFn({ weekId });
    return result.data;
  } catch (err: any) {
    console.error("Canvas deployPages error:", err);
    throw err;
  }
}

export async function deployWeekAssignments(weekId: string) {
  try {
    const result = await deployAssignmentsFn({ weekId });
    return result.data;
  } catch (err: any) {
    console.error("Canvas deployAssignments error:", err);
    throw err;
  }
}

export async function validateWeekBeforeDeploy(weekId: string) {
  try {
    const result = await runWeekValidatorFn({ weekId });
    return result.data;
  } catch (err: any) {
    console.error("Week Validator error:", err);
    throw err;
  }
}
