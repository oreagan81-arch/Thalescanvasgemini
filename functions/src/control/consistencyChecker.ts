import { PacingWeek } from "../canvas/diffEngine";
import { rulesEngine } from "../rulesEngine";

export interface ConsistencyReport {
  structureIssues: string[];
  toneIssues: string[];
  ruleViolations: string[];
}

export function checkConsistency(weeks: PacingWeek[]): ConsistencyReport {
  const report: ConsistencyReport = {
    structureIssues: [],
    toneIssues: [],
    ruleViolations: []
  };

  if (weeks.length < 2) return report;

  // 1. Structure Drift: Compare daily lesson counts
  const weekDayCounts = weeks.map(w => w.days.length);
  const firstCount = weekDayCounts[0];
  weekDayCounts.forEach((count, idx) => {
    if (count !== firstCount) {
      report.structureIssues.push(`Week ${weeks[idx].weekNumber} has ${count} days, expected ${firstCount}.`);
    }
  });

  // 2. Rule Violations: Check against rulesEngine
  weeks.forEach(week => {
    // This is a simplified check assuming we can convert PacingWeek to some Plan structure the rules engine accepts
    // Based on the fields, it might require some mapping. For now, focus on known fields.
    const ruleAudit = rulesEngine.validateThalesRules(week as any);
    if (!ruleAudit.isValid) {
      report.ruleViolations.push(...ruleAudit.errors.map(e => `Week ${week.weekNumber}: ${e}`));
    }
  });

  // 3. Tone Drift: Simplified check (look for significant changes in topic length or keyword presence)
  // Real tone drift usually requires LLM, but we can do a heuristic.
  const topics = weeks.map(w => w.topic);
  topics.forEach((topic, idx) => {
    if (topic.length > 50) {
      report.toneIssues.push(`Week ${weeks[idx].weekNumber} topic might be too long/complex: "${topic}"`);
    }
  });

  return report;
}
