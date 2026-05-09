import { resolveContext } from "./assignmentEngine";

export function buildAnnouncement(row: any) {
  const ctx = resolveContext(row);

  if (ctx.subject === "Math" && ctx.type === "test") {
    return {
      powerUp: ctx.powerUp,
      testNum: ctx.testNum
    };
  }

  if (ctx.subject === "Reading" && ctx.type === "test") {
    return {
      wpm: ctx.wpm,
      testNum: ctx.testNum
    };
  }
  
  return null;
}
