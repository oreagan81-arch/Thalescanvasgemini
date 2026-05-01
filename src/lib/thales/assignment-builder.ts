import { useStore } from '../../store';
import { generateAssignmentTitle, resolveAssignmentGroup } from './assignment-logic';
import { isFridayHomeworkBlocked, FRIDAY_SKIP_REASON } from './friday-rules';

export interface AppConfig {
  assignmentPrefixes: Record<string, string>;
  courseIds: Record<string, string>;
}

export interface PacingCell {
    subject: string;
    type: string;
    lessonNum: string;
    isNoClass?: boolean;
}

export interface BuiltAssignment {
  rowKey: string;
  subject: string;
  day: string;
  dayIndex: number;
  lessonNum: string;
  type: string;
  title: string;
  description: string;
  points: number;
  gradingType: string;
  assignmentGroup: string;
  courseId: number;
  dueDate: string | null;
  omitFromFinal: boolean;
  contentHash: string;
  isSynthetic: boolean;
  skipReason: string | null;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Mock ContentMapEntry for now as it wasn't provided
export interface ContentMapEntry { key: string; value: string; }

export async function buildAssignment(
  pacingCell: PacingCell,
  dayIndex: number,
  config: AppConfig,
  contentMap: ContentMapEntry[],
  options?: { dayOffset?: number; isGas?: boolean },
): Promise<BuiltAssignment> {
  const { subject, type, lessonNum } = pacingCell;
  const day = DAYS[dayIndex + (options?.dayOffset ?? 0)] || '';
  const isSynthetic = !!options?.isGas;
  const prefix = config.assignmentPrefixes[subject] || subject;
  const dueDate = '2024-08-19'; // Should be dynamic in prod

  const base: BuiltAssignment = {
    rowKey: `${subject}_${dayIndex}_${type}_${lessonNum}_${isSynthetic ? 'syn' : 'org'}`,
    subject, day, dayIndex, lessonNum, type,
    title: '', description: '', points: 0, gradingType: 'points',
    assignmentGroup: '', courseId: 0, dueDate: null, omitFromFinal: false,
    contentHash: '', isSynthetic, skipReason: 'Not built',
  };

  const courseId = config.courseIds[subject];
  if (!courseId) return { ...base, skipReason: 'NO_COURSE_ID' };

  const title = generateAssignmentTitle(subject, type, lessonNum, prefix);
  const groupInfo = resolveAssignmentGroup(subject, type);

  let skipReason: string | null = null;
  if (isFridayHomeworkBlocked(day, type)) skipReason = FRIDAY_SKIP_REASON;
  if (subject === 'History' || subject === 'Science') skipReason = `${subject} — no assignments`;
  if (subject === 'Language Arts' && !['CP', 'Classroom Practice', 'Test'].includes(type)) skipReason = 'LA — only CP and Test create assignments';
  if (pacingCell.isNoClass) skipReason = 'No class';

  return {
    ...base,
    title,
    description: `<p>Auto-generated description for ${subject} ${type} ${lessonNum}.</p>`,
    points: groupInfo.points,
    gradingType: groupInfo.gradingType,
    assignmentGroup: groupInfo.groupName,
    courseId: parseInt(courseId),
    dueDate,
    omitFromFinal: groupInfo.omitFromFinal || type === 'Study Guide',
    contentHash: 'hash-placeholder', // Implement your hash logic here
    skipReason,
  };
}

/** Expand a Math row into multiple assignments (Written + Fact + Study Guide) */
export async function expandMathRow(
  dayIndex: number,
  cell: PacingCell,
  options: { config: AppConfig; contentMap: ContentMapEntry[]; weekDates?: string[] },
): Promise<BuiltAssignment[]> {
  const { config, contentMap } = options;
  const assignments: BuiltAssignment[] = [];

  // 1. Main Written Test
  assignments.push(await buildAssignment({ ...cell, type: 'Test' }, dayIndex, config, contentMap));

  // 2. Fact Test (same day)
  assignments.push(await buildAssignment({ ...cell, type: 'Fact Test' }, dayIndex, config, contentMap, { isGas: true }));

  // 3. Study Guide (day before)
  if (dayIndex > 0) {
    assignments.push(await buildAssignment({ ...cell, type: 'Study Guide' }, dayIndex - 1, config, contentMap, { isGas: true, dayOffset: -1 }));
  }

  return assignments;
}

