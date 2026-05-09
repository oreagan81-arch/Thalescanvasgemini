import { canvasRequest } from "../../core/canvas";

/**
 * Checks if a Canvas assignment is locked by verifying if any students 
 * have already submitted work or received grades.
 */
export async function isLocked(canvasId: string, courseId: string, token: string): Promise<boolean> {
  const submissions = await getSubmissions(courseId, canvasId, token);
  return submissions.some((s: any) => s.score !== null || s.submitted_at);
}

/**
 * Placeholder for fetching submissions from Canvas API.
 * Needs actual courseId and assignmentId context.
 */
async function getSubmissions(courseId: string, assignmentId: string, token: string): Promise<any[]> {
  // GET /api/v1/courses/:course_id/assignments/:assignment_id/submissions
  return await canvasRequest(`courses/${courseId}/assignments/${assignmentId}/submissions`, 'GET', null, token);
}
