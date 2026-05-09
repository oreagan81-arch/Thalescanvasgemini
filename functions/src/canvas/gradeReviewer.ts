
import { CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenAI } from "@google/genai";
import { canvasRequest } from "../core/canvas";

const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY || "");

export interface GradeInquiry {
  studentName: string | null;
  metric: "average" | "list" | "summary";
  category: string | "all";
  period: "Q1" | "Q2" | "Q3" | "Q4" | "YTD";
  subject: string | "all";
}

const QUARTER_DATES = {
  Q1: { start: "2025-08-01", end: "2025-10-15" },
  Q2: { start: "2025-10-16", end: "2025-12-31" },
  Q3: { start: "2026-01-01", end: "2026-03-15" },
  Q4: { start: "2026-03-16", end: "2026-06-01" },
};

export async function resolveGradeInquiry(query: string): Promise<GradeInquiry> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `
    Analyze the student grade inquiry.
    Goal: Extract the student name, the metric requested (average, specific grade, count), and the category (test, homework, all).
    
    CONTEXT:
    - Subject categories: "Math", "ELA", "Reading", "Science", "History".
    - Assignment types: "Test", "Homework", "Fact Test", "Checkout", "Classroom Practice".
    - Periods: "Q1", "Q2", "Q3", "Q4", "Year to Date".
    
    INPUT: "${query}"
    
    OUTPUT SCHEMA (JSON):
    {
      "studentName": string | null,
      "metric": "average" | "list" | "summary",
      "category": string | "all",
      "period": "Q1" | "Q2" | "Q3" | "Q4" | "YTD",
      "subject": string | "all"
    }
    
    Return ONLY valid JSON.
  `;

  const result = await model.generateContent(prompt);
  const response = result.response.text();
  try {
    const jsonStr = response.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse Gemini response for grade inquiry:", response);
    return {
      studentName: null,
      metric: "summary",
      category: "all",
      period: "YTD",
      subject: "all"
    };
  }
}

export async function getStudentGrades(courseId: string, token: string) {
  // 1. Get Students
  const students = await canvasRequest(`courses/${courseId}/users?enrollment_type[]=student&per_page=100`, 'GET', null, token);
  
  // 2. Get Assignments
  const assignments = await canvasRequest(`courses/${courseId}/assignments?per_page=100`, 'GET', null, token);
  
  // 3. Get Submissions
  const submissions = await canvasRequest(`courses/${courseId}/students/submissions?student_ids[]=all&per_page=100`, 'GET', null, token);

  return { students, assignments, submissions };
}

export function filterGrades(data: any, inquiry: GradeInquiry) {
  const { students, assignments, submissions } = data;
  
  // Find Student
  let targetStudents = students;
  if (inquiry.studentName) {
    targetStudents = students.filter((s: any) => 
      s.short_name.toLowerCase().includes(inquiry.studentName!.toLowerCase()) ||
      s.name.toLowerCase().includes(inquiry.studentName!.toLowerCase())
    );
  }

  // Filter Assignments by Period & Category
  const period = QUARTER_DATES[inquiry.period as keyof typeof QUARTER_DATES];
  const filteredAssignments = assignments.filter((a: any) => {
    if (!a.due_at) return inquiry.period === "YTD";
    const due = new Date(a.due_at);
    
    let inPeriod = true;
    if (period) {
      inPeriod = due >= new Date(period.start) && due <= new Date(period.end);
    }
    
    const catMatch = inquiry.category === "all" || a.name.toLowerCase().includes(inquiry.category.toLowerCase());
    const subMatch = inquiry.subject === "all" || a.name.toLowerCase().includes(inquiry.subject.toLowerCase());
    
    return inPeriod && catMatch && subMatch;
  });

  const assignmentIds = new Set(filteredAssignments.map((a: any) => a.id));

  // Results Map
  const results = targetStudents.map((s: any) => {
    const studentSubmissions = submissions.filter((sub: any) => 
      sub.user_id === s.id && assignmentIds.has(sub.assignment_id)
    );

    const scores = studentSubmissions
      .filter((sub: any) => sub.score !== null && sub.score !== undefined)
      .map((sub: any) => {
        const assignment = filteredAssignments.find((a: any) => a.id === sub.assignment_id);
        const maxPoints = assignment?.points_possible || 100;
        return (sub.score / maxPoints) * 100;
      });

    const avg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null;
    
    return {
      studentId: s.id,
      name: s.name,
      average: avg ? Math.round(avg * 10) / 10 : null,
      submissionCount: scores.length,
      lowGrades: scores.filter(s => s < 80).length,
      details: studentSubmissions.map((sub: any) => {
        const assignment = filteredAssignments.find((a: any) => a.id === sub.assignment_id);
        return {
          assignmentName: assignment?.name,
          score: sub.score,
          max: assignment?.points_possible,
          percent: Math.round((sub.score / (assignment?.points_possible || 100)) * 100)
        };
      })
    };
  });

  return results;
}
