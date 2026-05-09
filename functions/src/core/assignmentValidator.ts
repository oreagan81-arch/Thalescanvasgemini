// 🔒 HARD VALIDATION LAYER (RUN BEFORE ANY DB WRITE)
export function validateAssignment(asg: any) {
  if (!asg) throw new Error("Assignment is undefined");
  if (!asg.title || typeof asg.title !== "string") {
    throw new Error("Invalid title");
  }
  if (!asg.idempotencyKey || typeof asg.idempotencyKey !== "string") {
    throw new Error("Invalid idempotencyKey");
  }
  if (!asg.due_at || !asg.due_at.includes("T")) {
    throw new Error("Invalid due date format");
  }
  if (!asg.group || typeof asg.group !== "string") {
    throw new Error("Invalid assignment group");
  }
  // 🔥 CRITICAL: block undefined anywhere
  Object.entries(asg).forEach(([key, val]) => {
    if (val === undefined) {
      throw new Error(`Undefined field detected: ${key}`);
    }
  });
  return true;
}

export function cleanString(str: any): string {
  if (!str) return "";
  return String(str)
    .replace(/\s+/g, " ")
    .trim();
}
