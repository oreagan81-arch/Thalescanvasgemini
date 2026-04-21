// Thales Deterministic Rules Engine

export type SubjectOptions = 'Math' | 'Reading' | 'Spelling' | 'Language Arts' | 'Science' | 'History';
export type LessonType = 'Lesson' | 'Test' | 'Quiz' | 'Project' | 'Review' | 'CP';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';

export interface PlannerRow {
  id: string;
  subject: SubjectOptions;
  lessonNum: string;
  lessonTitle: string;
  type: LessonType;
  day: DayOfWeek;
}

export interface GeneratedAssignment {
  title: string;
  points: number;
  published: boolean;
  isStudyGuide?: boolean;
}

export function generateAssignments(row: PlannerRow): GeneratedAssignment[] {
  const assignments: GeneratedAssignment[] = [];

  // Friday Rule - No homework on Friday unless Test prep / Project
  // We handle this broadly by assigning fewer things on Fridays, but let's 
  // explicitly define rules per subject first.

  if (row.subject === 'Math') {
    if (row.type === 'Test') {
      assignments.push({ title: `Math Test ${row.lessonNum}`, points: 100, published: false });
      assignments.push({ title: `Fact Test ${row.lessonNum}`, points: 100, published: false });
      assignments.push({ title: `Study Guide ${row.lessonNum}`, points: 0, published: false, isStudyGuide: true });
    } else {
      // Regular week - assuming Math allows Odds/Evens
      if (row.day !== 'Friday') {
        assignments.push({ title: `Math Homework (Evens/Odds) ${row.lessonNum}`, points: 10, published: false });
      }
    }
  }

  else if (row.subject === 'Language Arts') {
    if (row.type === 'CP' || row.type === 'Test') {
      assignments.push({ title: `Language Arts ${row.type === 'Test' ? 'Test' : 'CP'} ${row.lessonNum}`, points: row.type === 'Test' ? 100 : 20, published: false });
    }
  }

  else if (row.subject === 'Science' || row.subject === 'History') {
    if (['Test', 'Quiz', 'Project'].includes(row.type)) {
      assignments.push({ title: `${row.subject} ${row.type} ${row.lessonNum}`, points: row.type === 'Project' ? 50 : 100, published: false });
    }
  }

  // Reading / Spelling often grouped
  else if (row.subject === 'Reading' || row.subject === 'Spelling') {
    if (row.type === 'Test') {
      assignments.push({ title: `${row.subject} Test ${row.lessonNum}`, points: 100, published: false });
    }
  }

  return assignments;
}
