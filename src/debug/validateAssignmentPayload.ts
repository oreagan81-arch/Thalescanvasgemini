export interface AssignmentPayload {
  title: any;
  group: any;
  idempotencyKey: any;
  due_at: any;
  subject: any;
  [key: string]: any;
}

export interface FieldError {
  field: string;
  value: any;
  expected: string;
  violation: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
  cleanedPayload: any;
}

const ALLOWED_GROUPS = [
  'Homework/Class Work',
  'Homework',
  'Written Assessments',
  'Fact Assessments',
  'Reading Assessments',
  'Check Outs'
];

export function validateAssignmentPayload(payload: AssignmentPayload): ValidationResult {
  const errors: FieldError[] = [];

  // Required Fields Validation
  const requiredFields = ['title', 'group', 'idempotencyKey', 'due_at', 'subject'];
  requiredFields.forEach(field => {
    if (payload[field] == null) {
      errors.push({
        field: field,
        value: payload[field],
        expected: 'Field must be present and not null',
        violation: 'Field is missing or null'
      });
    }
  });

  if (errors.length > 0) {
    return { valid: false, errors, cleanedPayload: payload };
  }

  // Title Validation
  const titleRegex = /^(SM5|RM4|ELA4)(: ?| )?.+/;
  if (typeof payload.title !== 'string' || !titleRegex.test(payload.title)) {
    errors.push({
      field: 'title',
      value: payload.title,
      expected: '^(SM5|RM4|ELA4)(: ?| )?.+',
      violation: 'Title does not match required naming convention.'
    });
  }

  // Group Validation
  if (!ALLOWED_GROUPS.includes(payload.group)) {
    errors.push({
      field: 'group',
      value: payload.group,
      expected: ALLOWED_GROUPS.join(' | '),
      violation: 'Group is not in the allowed list.'
    });
  }

  // Idempotency Key Validation
  const keyRegex = /^[a-zA-Z0-9\-_]+$/;
  if (typeof payload.idempotencyKey !== 'string' || !keyRegex.test(payload.idempotencyKey)) {
    errors.push({
      field: 'idempotencyKey',
      value: payload.idempotencyKey,
      expected: '^[a-zA-Z0-9\-_]+$',
      violation: 'Key contains invalid characters.'
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    cleanedPayload: payload
  };
}
