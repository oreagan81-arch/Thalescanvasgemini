// 🔒 THALES ASSIGNMENT ENGINE (v12 - Hardened)
import * as mappings from '../../core/mappings';

export type Subject = "Math" | "Reading" | "Spelling" | "ELA";

export type AssignmentType =
  | "math_lesson"
  | "math_test"
  | "fact_test"
  | "study_guide"
  | "reading_hw"
  | "reading_test"
  | "checkout"
  | "spelling_test"
  | "ela_cp"
  | "ela_test";

export interface AssignmentContext {
  subject: Subject;
  lessonNum: number;
  type: "lesson" | "test" | "cp";
  dateISO: string;
  isFriday: boolean;
  spellingTestNum?: number;
}

const READING_TEST_MAP: Record<number, number> = { 80: 8 };

export function resolveTestNumber(ctx: AssignmentContext): number | null {
  if (ctx.subject === "Reading") {
    return READING_TEST_MAP[ctx.lessonNum] ?? Math.ceil(ctx.lessonNum / 10);
  }

  if (ctx.subject === "Spelling") {
    return ctx.spellingTestNum ?? 1;
  }

  if (ctx.subject === "Math") {
    return ctx.lessonNum;
  }

  return null;
}

const POWER_UP_MAP: Record<number, string> = {
  1: "A",
  2: "A",
  3: "B",
  4: "C",
  5: "A",
  6: "B",
  7: "B",
  8: "C",
  9: "D",
  10: "C",
  11: "D",
  12: "E",
  13: "E",
  14: "F",
  15: "F",
  16: "F",
  17: "H",
  18: "G",
  19: "H",
  20: "I",
  21: "H",
  22: "J",
  23: "I",
};

export function resolvePowerUp(testNum: number | null) {
  if (!testNum) return null;
  return POWER_UP_MAP[testNum] || null;
}

export function resolveWPM(testNum: number | null) {
  if (!testNum) return { wpm: 0, errors: 0 };
  if (testNum <= 7) return { wpm: 100, errors: 2 };
  if (testNum <= 10) return { wpm: 115, errors: 2 };
  if (testNum <= 13) return { wpm: 130, errors: 2 };
  if (testNum === 14) return { wpm: 140, errors: 2 };

  return { wpm: 140, errors: 2 };
}

export function resolveSpellingWords(testNum?: number): string[] {
  return testNum ? mappings.getSpellingWords(testNum) : [];
}

export function resolveContext(ctx: AssignmentContext): ResolvedAssignmentContext {
  const testNum = resolveTestNumber(ctx);
  const powerUp = resolvePowerUp(testNum);
  const wpm = resolveWPM(testNum);
  const spellingWords = resolveSpellingWords(ctx.spellingTestNum);

  return {
    ...ctx,
    testNum,
    powerUp,
    wpm,
    spellingWords
  };
}

export interface ResolvedAssignmentContext extends AssignmentContext {
  testNum: number | null;
  powerUp: string | null;
  wpm: { wpm: number; errors: number };
  spellingWords: string[];
}


export function createAssignment(config: any, ctx: ResolvedAssignmentContext, isTestFamily = false) {
  const idempotencyKey = `${ctx.subject}-${ctx.lessonNum}-${config.type}`;

  return {
    ...config,
    published: false,
    gradingType: config.grading === 'pass_fail' ? 'pass_fail' : 'percent',
    omitFromFinalGrade: config.omit || false,
    due_at: `${ctx.dateISO}T23:59:00`,
    submission_types: ["on_paper"],
    idempotencyKey,
    meta: {
      isTestFamily,
      powerUp: ctx.powerUp,
      ...config.meta
    }
  };
}

export function buildAssignments(ctxRaw: AssignmentContext) {
  const ctx = resolveContext(ctxRaw) as ResolvedAssignmentContext;

  // 🔒 FRIDAY RULE (fixed with test family)
  if (ctx.isFriday && ctx.type !== "test") return [];

  const list: any[] = [];

  // 🧮 MATH
  if (ctx.subject === "Math") {
    if (ctx.type === "lesson") {
      const parity = ctx.lessonNum % 2 === 0 ? "Evens" : "Odds";

      list.push(createAssignment({
        type: "math_lesson",
        title: `SM5: Lesson ${ctx.lessonNum} ${parity}`,
        group: "Homework/Class Work",
        points: 100
      }, ctx));
    }

    if (ctx.type === "test") {
      // PRIMARY
      list.push(createAssignment({
        type: "math_test",
        title: `SM5: Lesson ${ctx.lessonNum} Test`,
        group: "Written Assessments",
        points: 100
      }, ctx, true));

      // SYNTHETIC FACT
      list.push(createAssignment({
        type: "fact_test",
        title: `SM5: Lesson ${ctx.lessonNum} Fact Test`,
        group: "Fact Assessments",
        points: 100
      }, ctx, true));

      // SYNTHETIC STUDY GUIDE
      list.push(createAssignment({
        type: "study_guide",
        title: `SM5: Lesson ${ctx.lessonNum} Study Guide`,
        group: "Homework/Class Work",
        points: 0,
        grading: "pass_fail",
        omit: true
      }, ctx, true));
    }
  }

  // 📖 READING
  if (ctx.subject === "Reading") {
    if (ctx.type === "lesson") {
      list.push(createAssignment({
        type: "reading_hw",
        title: `RM4: Reading HW ${ctx.lessonNum}`,
        group: "Homework",
        points: 100
      }, ctx));
    }

    if (ctx.type === "test") {
      list.push(createAssignment({
        type: "reading_test",
        title: `RM4: Reading Test ${ctx.testNum}`,
        group: "Assessments",
        points: 100
      }, ctx, true));

      list.push(createAssignment({
        type: "checkout",
        title: `RM4: Checkout ${ctx.testNum}`,
        group: "Check Out",
        points: 100,
        meta: { wpm: ctx.wpm }
      }, ctx, true));
    }
  }

  // 🔤 SPELLING
  if (ctx.subject === "Spelling" && ctx.type === "test") {
    list.push(createAssignment({
      type: "spelling_test",
      title: `RM4: Spelling Test ${ctx.testNum}`,
      group: "Assessments",
      points: 100
    }, ctx));
  }

  // ✍️ ELA
  if (ctx.subject === "ELA") {
    if (ctx.type === "cp") {
      list.push(createAssignment({
        type: "ela_cp",
        title: `ELA4: 4A - Shurley English Classroom Practice ${ctx.lessonNum}`,
        group: "Classwork/Homework",
        points: 100
      }, ctx));
    }

    if (ctx.type === "test") {
      list.push(createAssignment({
        type: "ela_test",
        title: `ELA4: Shurley Test`,
        group: "Assessments",
        points: 100
      }, ctx));
    }
  }

  return list;
}

export async function shouldCreateAssignment(db: any, asg: any) {
  const existing = await db
    .collection("assignments")
    .where("idempotencyKey", "==", asg.idempotencyKey)
    .limit(1)
    .get();

  return existing.empty;
}

export function buildAnnouncement(ctxRaw: AssignmentContext) {
  const ctx = resolveContext(ctxRaw);

  if (ctx.subject === "Math" && ctx.type === "test") {
    return {
      testNum: ctx.testNum,
      powerUp: ctx.powerUp,
    };
  }

  if (ctx.subject === "Reading" && ctx.type === "test") {
    return {
      testNum: ctx.testNum,
      wpm: ctx.wpm,
    };
  }

  return null;
}

