export type Severity = 'ERROR' | 'WARN' | 'INFO';

export interface Finding {
  severity: Severity;
  course: string;
  category: 'page' | 'assignment' | 'structure';
  rule: string;
  expected: string;
  actual: string;
  field?: string;
}

export function validateCanvasAudit(auditData: any): Finding[] {
  const findings: Finding[] = [];

  const addFinding = (f: Omit<Finding, 'course'>, courseName: string) => {
    findings.push({ ...f, course: courseName });
  };

  const getSubject = (courseName: string = "") => {
    const lower = courseName.toLowerCase();
    if (lower.includes("math")) return "Math";
    if (lower.includes("reading")) return "Reading";
    if (lower.includes("ela") || lower.includes("english")) return "ELA";
    if (lower.includes("history")) return "History";
    if (lower.includes("science")) return "Science";
    if (lower.includes("spelling")) return "Spelling";
    return "Unknown";
  };

  for (const [courseName, data] of Object.entries(auditData.courses)) {
    const d = data as any;
    const subject = getSubject(courseName);

    // --- PAGE RULES ---
    if (d.page) {
      const p = d.page;

      if (p.published === false) {
        addFinding({ severity: 'ERROR', category: 'page', rule: 'Page published', expected: 'true', actual: 'false' }, courseName);
      }

      if (p.missing_days && p.missing_days.length > 0) {
        p.missing_days.forEach((day: string) => {
          addFinding({ severity: 'ERROR', category: 'page', rule: 'Required Day Block', expected: `${day} present`, actual: 'Missing' }, courseName);
        });
      }

      if (['Math', 'Reading', 'ELA'].includes(subject)) {
        if (!p.has_reminders_section) {
          addFinding({ severity: 'WARN', category: 'page', rule: 'Reminders Section', expected: 'Present', actual: 'Missing' }, courseName);
        }
        if (!p.has_resources_section) {
          addFinding({ severity: 'WARN', category: 'page', rule: 'Resources Section', expected: 'Present', actual: 'Missing' }, courseName);
        }
      }

      if (['History', 'Science'].includes(subject)) {
        if (p.has_at_home_sections > 0) {
          addFinding({ severity: 'ERROR', category: 'page', rule: 'No At Home Sections', expected: '0', actual: p.has_at_home_sections.toString() }, courseName);
        }
      }

      if (p.body_text && /Friday.*?At Home/is.test(p.body_text)) {
        addFinding({ severity: 'ERROR', category: 'page', rule: 'Friday At Home', expected: 'None', actual: 'Found At Home under Friday' }, courseName);
      }

      if (subject === 'Reading') {
        const inClassMatch = /<h4[^>]*>.*?In Class.*?<\/h4>(.*?)<h4/is.exec(p.body);
        if (inClassMatch) {
          const inClassText = inClassMatch[1];
          if (!inClassText.includes("Reading:") || !inClassText.includes("Spelling:")) {
            addFinding({ severity: 'WARN', category: 'page', rule: 'Reading In Class Labels', expected: '"Reading:" and "Spelling:"', actual: 'Missing one or both' }, courseName);
          }
        }
      }

      if (subject === 'Math' && p.prefix_found !== 'SM5:') {
        addFinding({ severity: 'WARN', category: 'page', rule: 'Prefix Content Match', expected: 'SM5:', actual: p.prefix_found }, courseName);
      } else if (subject === 'Reading' && p.prefix_found !== 'RM4:') {
        addFinding({ severity: 'WARN', category: 'page', rule: 'Prefix Content Match', expected: 'RM4:', actual: p.prefix_found }, courseName);
      } else if (subject === 'ELA' && p.prefix_found !== 'ELA4:') {
        addFinding({ severity: 'WARN', category: 'page', rule: 'Prefix Content Match', expected: 'ELA4:', actual: p.prefix_found }, courseName);
      }

      const updatedDate = new Date(p.updated_at);
      const daysSinceUpdate = (Date.now() - updatedDate.getTime()) / (1000 * 3600 * 24);
      if (daysSinceUpdate > 7) {
        addFinding({ severity: 'WARN', category: 'page', rule: 'Recent Update', expected: '< 7 days ago', actual: `${Math.round(daysSinceUpdate)} days ago` }, courseName);
      }
    } else {
      addFinding({ severity: 'ERROR', category: 'page', rule: 'Page Exists', expected: 'Page data returned', actual: 'null/Missing' }, courseName);
    }

    // --- ASSIGNMENT RULES ---
    if (d.assignments && Array.isArray(d.assignments)) {
      
      if (['History', 'Science'].includes(subject) && d.assignments.length > 0) {
        addFinding({ severity: 'ERROR', category: 'assignment', rule: 'No Assignments for Science/History', expected: '0 assignments', actual: `${d.assignments.length} assignments found` }, courseName);
      }

      let mathTestCount = 0;
      let mathFactTestCount = 0;
      let mathStudyGuideCount = 0;
      let isMathTestWeek = false;

      let hasReadingCheckout = false;
      let isReadingTestWeek = false;

      d.assignments.forEach((a: any) => {
        const title = a.name;
        const isStudyGuide = title.toLowerCase().includes("study guide");
        const isTest = title.toLowerCase().includes("test");

        // Rule 10: Submission types
        if (!a.submission_types?.includes("on_paper")) {
           addFinding({ severity: 'ERROR', category: 'assignment', rule: 'Submission Type', expected: '["on_paper"]', actual: JSON.stringify(a.submission_types), field: title }, courseName);
        }

        // Rule 11 & 12: Grading Type & Points
        if (isStudyGuide) {
          if (a.grading_type !== 'pass_fail') addFinding({ severity: 'ERROR', category: 'assignment', rule: 'Grading Type', expected: 'pass_fail', actual: a.grading_type, field: title }, courseName);
          if (a.points_possible !== 0) addFinding({ severity: 'ERROR', category: 'assignment', rule: 'Points Possible', expected: '0', actual: String(a.points_possible), field: title }, courseName);
          if (a.omit_from_final_grade !== true) addFinding({ severity: 'ERROR', category: 'assignment', rule: 'Omit from Final Grade', expected: 'true', actual: String(a.omit_from_final_grade), field: title }, courseName);
        } else {
          if (a.grading_type !== 'points') addFinding({ severity: 'ERROR', category: 'assignment', rule: 'Grading Type', expected: 'points', actual: a.grading_type, field: title }, courseName);
          if (a.points_possible !== 100) addFinding({ severity: 'ERROR', category: 'assignment', rule: 'Points Possible', expected: '100', actual: String(a.points_possible), field: title }, courseName);
        }

        // Rule 14 & 15: Due At logic (ET)
        if (a.due_at) {
          const due = new Date(a.due_at);
          // Convert to ET string conceptually to check hours
          const etString = due.toLocaleString("en-US", { timeZone: "America/New_York", hour12: false });
          const parts = etString.split(", ");
          if (parts.length >= 2) {
            const timePart = parts[1];
            const timeParts = timePart.split(":");
            if (timeParts.length >= 2) {
              const hour = timeParts[0];
              const minute = timeParts[1];
              
              if (hour !== "23" || minute !== "59") {
                addFinding({ severity: 'ERROR', category: 'assignment', rule: 'Due Time', expected: '23:59 ET', actual: timePart, field: title }, courseName);
              }
            }
          }

          const dayOfWeek = due.getDay(); // 0 is Sunday, 5 is Friday
          if (dayOfWeek === 5 && !isTest) {
             addFinding({ severity: 'ERROR', category: 'assignment', rule: 'Due Day', expected: 'Not Friday for non-tests', actual: 'Friday', field: title }, courseName);
          }
        }

        // Title rules
        if (subject === 'Math') {
          if (!title.startsWith("SM5:")) addFinding({ severity: 'ERROR', category: 'assignment', rule: 'Title Prefix', expected: 'SM5:', actual: title, field: title }, courseName);
          
          if (title.includes("Test")) isMathTestWeek = true;
          if (title.includes("Lesson") && title.includes("Test")) mathTestCount++;
          if (title.includes("Fact Test")) mathFactTestCount++;
          if (title.includes("Study Guide")) mathStudyGuideCount++;

          if (title.includes("Lesson") && !isTest && !title.match(/SM5: Lesson \d+ (Evens|Odds)/i)) {
             addFinding({ severity: 'ERROR', category: 'assignment', rule: 'Math Title Format', expected: 'SM5: Lesson N Evens/Odds', actual: title, field: title }, courseName);
          }
        }

        if (subject === 'Reading') {
          if (!title.startsWith("RM4:")) addFinding({ severity: 'ERROR', category: 'assignment', rule: 'Title Prefix', expected: 'RM4:', actual: title, field: title }, courseName);
          
          if (title.includes("Reading Test")) isReadingTestWeek = true;
          if (title.includes("Checkout")) hasReadingCheckout = true;

          if (title.includes("Reading HW") && !title.match(/RM4: Reading HW \d+/)) {
            addFinding({ severity: 'ERROR', category: 'assignment', rule: 'Reading Title Format', expected: 'RM4: Reading HW N', actual: title, field: title }, courseName);
          }
          if (title.includes("Spelling") && !isTest) {
            addFinding({ severity: 'ERROR', category: 'assignment', rule: 'Spelling Assignments', expected: 'No assignments for Spelling lessons', actual: title, field: title }, courseName);
          }
        }

        if (subject === 'ELA') {
          if (!title.startsWith("ELA4:")) addFinding({ severity: 'ERROR', category: 'assignment', rule: 'Title Prefix', expected: 'ELA4:', actual: title, field: title }, courseName);
          if (!title.includes("Classroom Practice") && !title.includes("Test")) {
            addFinding({ severity: 'ERROR', category: 'assignment', rule: 'ELA Assignment Types', expected: 'Only CP or Test', actual: title, field: title }, courseName);
          }
        }

        // Group matching
        const groupName = d.assignment_groups.find((g: any) => g.id === a.assignment_group_id)?.name || "Unknown";
        if (subject === 'Math' && title.includes("Lesson") && !isTest) {
          if (groupName !== "Homework/Class Work") addFinding({ severity: 'ERROR', category: 'structure', rule: 'Assignment Group', expected: 'Homework/Class Work', actual: groupName, field: title }, courseName);
        }
      });

      // Weekly Aggregations Checks
      if (subject === 'Math' && isMathTestWeek) {
        if (mathTestCount + mathFactTestCount + mathStudyGuideCount !== 3) {
          addFinding({ severity: 'ERROR', category: 'structure', rule: 'Math Test Week Structure', expected: 'Exactly 3 assignments (Test, Fact Test, Study Guide)', actual: `${mathTestCount+mathFactTestCount+mathStudyGuideCount} found` }, courseName);
        }
      }

      if (subject === 'Reading' && isReadingTestWeek && !hasReadingCheckout) {
        addFinding({ severity: 'ERROR', category: 'structure', rule: 'Reading Test Week Structure', expected: 'Checkout assignment present', actual: 'Missing Checkout' }, courseName);
      }
    }
  }

  return findings;
}
