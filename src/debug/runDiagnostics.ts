import { AssignmentPayload } from './validateAssignmentPayload';
import { testAssignmentWrite } from './firestoreWriteTest';

export async function runAssignmentDiagnostics(assignments: AssignmentPayload[]) {
  console.log('🚀 Running Assignment Diagnostics...');
  
  const results = {
    total: assignments.length,
    passed: 0,
    failed: 0,
    failures: [] as any[]
  };

  for (const assignment of assignments) {
    const result = await testAssignmentWrite(assignment);
    
    if (result.success) {
      results.passed++;
    } else {
      results.failed++;
      results.failures.push(result);
    }
  }

  console.log(`
📊 DIAGNOSTICS SUMMARY
Total: ${results.total}
Passed: ${results.passed}
Failed: ${results.failed}
`);

  return results;
}
