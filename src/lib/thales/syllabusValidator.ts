import { z } from 'zod';
import { parse, isValid, format } from 'date-fns';

/**
 * Zod Schema for a Single Syllabus Row
 * Enforces required columns and handles date transformation.
 */
export const syllabusRowSchema = z.object({
  Date: z.string().transform((val, ctx) => {
    // Standardize common formats
    const formats = [
      'MM/dd/yyyy', 
      'M/d/yyyy', 
      'MM/dd/yy', 
      'M/d/yy', 
      'yyyy-MM-dd',
      'MMM d, yyyy', // Aug 12, 2024
      'MMMM d, yyyy' // August 12, 2024
    ];
    
    for (const f of formats) {
      const parsed = parse(val.trim(), f, new Date());
      if (isValid(parsed)) return parsed;
    }

    // Fallback for native Date parsing if formatted parse fails
    const nativeParsed = new Date(val);
    if (isValid(nativeParsed)) return nativeParsed;

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Unsupported date format: "${val}". Expected MM/DD/YYYY or similar.`,
    });
    return z.NEVER;
  }),
  Module: z.preprocess((val) => String(val || '').trim(), z.string().min(1, "Module name is required.")),
  'Lesson Title': z.preprocess((val) => String(val || '').trim(), z.string().min(1, "Lesson Title is required.")),
  'Course ID': z.preprocess((val) => String(val || '').trim(), z.string().min(1, "Course ID (Canvas ID) is required.")),
}).passthrough(); // Allow extra columns like 'Notes' or 'In-Class'

export type SyllabusRow = z.infer<typeof syllabusRowSchema>;

export interface SyllabusValidationResult {
  validRows: SyllabusRow[];
  errors: { row: number; message: string }[];
  groupedByModule: Record<string, SyllabusRow[]>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    modulesCount: number;
  };
}

/**
 * validateSyllabusData
 * Validates a batch of CSV rows against the Thales Syllabus standards.
 * 
 * @param csvRows Array of raw objects from CSV/XLSX import
 * @returns Comprehensive validation results and module groupings
 */
export function validateSyllabusData(csvRows: any[]): SyllabusValidationResult {
  const validRows: SyllabusRow[] = [];
  const errors: { row: number; message: string }[] = [];
  const groupedByModule: Record<string, SyllabusRow[]> = {};

  csvRows.forEach((row, index) => {
    const result = syllabusRowSchema.safeParse(row);
    
    if (result.success) {
      const validatedRow = result.data;
      validRows.push(validatedRow);

      // Grouping logic: Automatically bucket rows by 'Module'
      const moduleName = validatedRow.Module;
      if (!groupedByModule[moduleName]) {
        groupedByModule[moduleName] = [];
      }
      groupedByModule[moduleName].push(validatedRow);
    } else {
      errors.push({
        row: index + 1,
        message: result.error.issues
          .map(e => `${e.path.join(' ')}: ${e.message}`)
          .join(' | ')
      });
    }
  });

  return {
    validRows,
    errors,
    groupedByModule,
    summary: {
      total: csvRows.length,
      valid: validRows.length,
      invalid: errors.length,
      modulesCount: Object.keys(groupedByModule).length
    }
  };
}
