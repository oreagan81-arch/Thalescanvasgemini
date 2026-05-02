import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from 'firebase-admin';
import { GoogleGenAI } from "@google/genai";
import { Resend } from 'resend';
import * as crypto from 'crypto';
import { 
  PLANNER_SCHEMA, 
  PARSER_SCHEMA,
  getParserPrompt, 
  getGeneratorPrompt 
} from './prompts';
import { rulesEngine } from './rulesEngine';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const canvasApiToken = defineSecret('CANVAS_API_TOKEN');
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY || "");

/**
 * Never Crash Contract Wrapper
 */
const neverCrash = (handler: (request: CallableRequest<any>) => Promise<any>) => {
    return onCall(async (request: CallableRequest<any>) => {
        try {
            return await handler(request);
        } catch (error: any) {
            console.error("[CRITICAL FAILURE]", error);
            // Return a safe error structure instead of crashing
            return {
                success: false,
                error: error.message || "An unexpected system error occurred. Please retry.",
                timestamp: new Date().toISOString()
            };
        }
    });
};

async function canvasRequest(path: string, method: string, body: any, token: string) {
  const url = `https://thalesacademy.instructure.com/api/v1/${path}`;
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 2s, 4s, 8s...
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.log(`[CANVAS API] Retry attempt ${attempt} for ${path}. Waiting ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }

      const res = await fetch(url, {
        method,
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.ok) {
        return await res.json();
      }

      const status = res.status;
      const errorText = await res.text();
      lastError = new Error(`Canvas API error: ${status} ${errorText}`);

      // Retry on 429 (Rate Limit) or 5xx (Server Errors)
      if (status === 429 || (status >= 500 && status <= 599)) {
        console.warn(`[CANVAS API] Transient error ${status} on attempt ${attempt + 1}. Retrying...`);
        continue;
      }

      // Permanent errors (400 Bad Request, 401 Unauthorized, 404 Not Found) - do not retry
      throw lastError;

    } catch (error: any) {
      // If we threw inside the block (e.g. permanent error), re-throw immediately
      if (error.message.includes('Canvas API error')) {
        throw error;
      }

      // Network errors (fetch failures) are worth retrying
      lastError = error;
      console.error(`[CANVAS API] Network error on attempt ${attempt + 1}: ${error.message}`);
      if (attempt === maxRetries - 1) throw lastError;
    }
  }

  throw lastError || new Error(`Canvas API failed after ${maxRetries} attempts`);
}

/**
 * Generates a SHA-256 hash.
 */
function generateHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Creates a job tracking document in Firestore with an optional specific ID for locking.
 */
async function createJob(userId: string, type: string, customId?: string) {
  const jobRef = customId ? db.collection('jobs').doc(customId) : db.collection('jobs').doc();
  const jobId = jobRef.id;

  // Check if job already exists and is active (Locking)
  if (customId) {
    const snap = await jobRef.get();
    if (snap.exists()) {
      const data = snap.data();
      if (data?.status === 'pending' || data?.status === 'processing') {
        console.log(`[LOCK] Ongoing job found: ${jobId}`);
        return jobId;
      }
    }
  }

  await jobRef.set({
    id: jobId,
    userId,
    type,
    status: 'pending',
    progress: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return jobId;
}

/**
 * Updates an existing job's status.
 */
async function updateJob(jobId: string, updates: any) {
  await db.collection('jobs').doc(jobId).update({
    ...updates,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

export const startAiPlanGeneration = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  
  const { rawText, existingState, historicalContext, weekId, quarter } = request.data;
  if (!rawText) throw new HttpsError("invalid-argument", "Raw text is required.");

  const userId = request.auth.uid;
  // Hash includes context for idempotency
  const inputHash = generateHash(`${userId}_${rawText}_${JSON.stringify(existingState || {})}_${JSON.stringify(historicalContext || {})}`);
  
  // 1. CACHE CHECK
  const existingJobSnap = await db.collection('jobs').doc(inputHash).get();
  if (existingJobSnap.exists()) {
    const jobData = existingJobSnap.data();
    if (jobData?.status === 'completed') {
      console.log(`[CACHE HIT] Returning existing result for ${inputHash}`);
      return { jobId: inputHash, status: 'completed', result: jobData.result };
    }
  }

  const jobId = await createJob(userId, 'AI_PLAN', inputHash);

  // Check if we should actually start it
  const jobSnap = await db.collection('jobs').doc(jobId).get();
  const jobData = jobSnap.data();
  if (jobData?.status === 'processing') {
    return { jobId, status: jobData.status };
  }

  // Trigger processing asynchronously
  (async () => {
    try {
      await updateJob(jobId, { status: 'processing', progress: 10 });
      
      const stateStr = existingState ? JSON.stringify(existingState) : undefined;
      const historyStr = historicalContext ? JSON.stringify(historicalContext) : undefined;
      
      // AGENT 1: PARSER (Flash) - High volume extraction
      await updateJob(jobId, { progress: 20 });
      const parserModel = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json", responseSchema: PARSER_SCHEMA as any }
      });
      const parserResult = await parserModel.generateContent(getParserPrompt(rawText));
      const rawTextResult = parserResult.response.text();
      const rawItems = JSON.parse(rawTextResult).items || [];

      // AGENT 2: PLANNER (JS Rules Engine) - Structural integrity
      await updateJob(jobId, { progress: 40 });
      let structuralPlan = rulesEngine.buildStructuralWeek(rawItems, weekId || 'Unknown', quarter || 1);
      
      // Merge with existing state if present (Diffing)
      if (existingState && existingState.days) {
         structuralPlan.days = structuralPlan.days.map((day: any) => {
           const existingDay = existingState.days.find((d: any) => d.day === day.day);
           if (existingDay) {
             // Preserve lessons that were already in the state if they still make sense
             return existingDay;
           }
           return day;
         });
      }

      // AGENT 3: GENERATOR (Gemini Pro) - Deep academic content
      await updateJob(jobId, { progress: 65 });
      const generatorModel = genAI.getGenerativeModel({ 
        model: "gemini-1.5-pro",
        generationConfig: { responseMimeType: "application/json", responseSchema: PLANNER_SCHEMA as any }
      });
      const generatorResult = await generatorModel.generateContent(getGeneratorPrompt(JSON.stringify(structuralPlan)));
      const enrichedText = generatorResult.response.text();
      let enrichedPlan = JSON.parse(enrichedText);

      // AGENT 4: VALIDATOR (JS Logic) - Rule enforcement
      await updateJob(jobId, { progress: 90 });
      const validation = rulesEngine.validateThalesRules(enrichedPlan as any);
      
      // Deterministic sanitize (Vendor stripping)
      enrichedPlan.days = enrichedPlan.days.map((day: any) => ({
        ...day,
        lessons: (day.lessons || []).map((lesson: any) => ({
          ...lesson,
          lessonTitle: lesson.lessonTitle.replace(/Saxon|Shurley|SOTW/gi, 'Standard').trim(),
          lesson: lesson.lesson?.replace(/Saxon|Shurley|SOTW/gi, 'Standard').trim(), // Handle both field names if varied
          objectives: (lesson.objectives || []).map((obj: string) => obj.replace(/Saxon|Shurley|SOTW/gi, 'Standard'))
        }))
      }));

      await updateJob(jobId, { 
        status: 'completed', 
        progress: 100, 
        result: enrichedPlan,
        metadata: { validationErrors: validation.errors }
      });
    } catch (e: any) {
      console.error("[MULTI-AGENT FLOW FAILED]", e);
      await updateJob(jobId, { status: 'failed', error: e.message || "Unknown processing error" });
    }
  })();

  return { jobId };
});

export const deployPages = onCall({ secrets: [canvasApiToken] }, async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const { pages } = request.data;
  const token = canvasApiToken.value();
  
  if (!Array.isArray(pages)) {
    throw new HttpsError("invalid-argument", "The 'pages' argument must be an array.");
  }

  const deployed = [];
  for (const page of pages) {
    // Implement per-page lock to prevent duplicates
    const lockKey = generateHash(`deploy_${page.courseId}_${page.title}`);
    const lockRef = db.collection('locks').doc(lockKey);
    
    try {
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(lockRef);
        if (snap.exists()) {
          const data = snap.data()!;
          const expiresAt = data.expiresAt.toDate();
          if (expiresAt > new Date()) {
            throw new Error(`Deployment lock already held for ${page.title}`);
          }
        }
        transaction.set(lockRef, {
          courseId: page.courseId,
          title: page.title,
          expiresAt: admin.firestore.FieldValue.serverTimestamp() // We'll update this to a proper timestamp after the write
        });
      });

      const result = await canvasRequest(`courses/${page.courseId}/pages`, 'POST', {
        wiki_page: { title: page.title || 'Weekly Agenda', body: page.html, published: false }
      }, token);
      
      deployed.push(result.title);

      // Keep lock for 5 mins to prevent accidental double-clicks causing immediate duplicates
      await lockRef.update({
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });

    } catch (error: any) {
      console.error(`Failed to deploy page or lock held: ${error.message}`);
    }
  }
  return { success: true, deployed: deployed.length, titles: deployed };
});

export const deployAssignments = onCall({ secrets: [canvasApiToken] }, async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const token = canvasApiToken.value();
  const { assignments } = request.data;

  if (!Array.isArray(assignments)) {
    throw new HttpsError("invalid-argument", "The 'assignments' argument must be an array.");
  }

  const results = [];
  for (const assign of assignments) {
    // Lock per assignment to prevent duplicates
    const lockKey = generateHash(`assign_${assign.courseId}_${assign.title}`);
    const lockRef = db.collection('locks').doc(lockKey);

    try {
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(lockRef);
        if (snap.exists()) {
          const data = snap.data()!;
          if (data.expiresAt.toDate() > new Date()) {
            throw new Error(`Lock held for assignment ${assign.title}`);
          }
        }
        transaction.set(lockRef, {
          type: 'assignment',
          expiresAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      const res = await canvasRequest(`courses/${assign.courseId}/assignments`, 'POST', {
        assignment: { 
          name: assign.title, 
          points_possible: assign.points, 
          published: false,
          description: assign.description || ""
        }
      }, token);
      
      await db.collection('assignments').doc(assign.id).update({
        status: 'Deployed', 
        canvasId: res.id.toString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await lockRef.update({ expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
      results.push(res.id);
    } catch (error: any) {
      console.error(`Assignment deploy skip: ${error.message}`);
    }
  }
  return { success: true, count: results.length };
});

export const deployAnnouncements = onCall({ secrets: [canvasApiToken] }, async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const token = canvasApiToken.value();
  const { announcements } = request.data;

  if (!Array.isArray(announcements)) {
    throw new HttpsError("invalid-argument", "The 'announcements' argument must be an array.");
  }

  for (const ann of announcements) {
    // Lock per announcement
    const lockKey = generateHash(`ann_${ann.courseId}_${ann.title}`);
    const lockRef = db.collection('locks').doc(lockKey);

    try {
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(lockRef);
        if (snap.exists() && snap.data()!.expiresAt.toDate() > new Date()) {
          throw new Error("Lock held");
        }
        transaction.set(lockRef, { expiresAt: admin.firestore.FieldValue.serverTimestamp() });
      });

      await canvasRequest(`courses/${ann.courseId}/discussion_topics`, 'POST', {
        title: ann.title, 
        message: ann.content, 
        is_announcement: true, 
        published: true
      }, token);
      
      await db.collection('announcements').doc(ann.id).update({ 
        status: 'Posted',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await lockRef.update({ expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
    } catch (error: any) {
      console.error(`Announcement deploy skip: ${error.message}`);
    }
  }
  return { success: true };
});

export const generateAIResponse = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const { prompt } = request.data;
  if (!prompt) throw new HttpsError("invalid-argument", "Prompt is required.");

  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
  const result = await model.generateContent(prompt);
  return { result: result.response.text() };
});

export const runWeekValidator = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const { weekId } = request.data;
  const snapshot = await db.collection('planner_rows').where('weekId', '==', weekId).get();
  const errors = [];
  if (snapshot.empty) errors.push(`No data found for week ${weekId}.`);
  return { valid: errors.length === 0, errors };
});

export const generateNewsletter = onCall(async (request: CallableRequest<any>) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    return { success: true, message: "Newsletter stub updated with auth check." };
});


/**
 * 1. Admin Notifications: Friday Deploy Sync
 * Triggers an email summary to the administrator detailing Canvas deployment success/failures.
 */
export const fridayDeploySync = neverCrash(async (request: CallableRequest<any>) => {
    const { successList = [], failureList = [], weekId } = request.data;
    const adminEmail = process.env.ADMIN_EMAIL;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!adminEmail || !resendApiKey) {
        throw new HttpsError("failed-precondition", "Admin email or Resend API key missing.");
    }

    const htmlBody = `
      <h2>Friday Deploy Sync Report</h2>
      <p>The automated Canvas pacing sync has completed for week ${weekId || 'unknown'}.</p>
      <h3 style="color: green;">✅ Successful Subjects:</h3>
      <ul>${successList.map((s: string) => `<li>${s}</li>`).join('') || '<li>None</li>'}</ul>
      <h3 style="color: red;">❌ Failed Subjects:</h3>
      <ul>${failureList.map((f: string) => `<li>${f}</li>`).join('') || '<li>None</li>'}</ul>
    `;

    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: adminEmail,
      subject: `Canvas Sync: Friday Deployment Report - Week ${weekId || 'N/A'}`,
      html: htmlBody
    });

    return { success: true, message: "Deployment report sent successfully." };
});

/**
 * 2. Dynamic Sheet Mapping
 * Scans column A of the pacing guide for dates and saves their row mappings into Firestore.
 * Implements chunked batch writes to handle large sheets.
 */
export const importSheetData = neverCrash(async (request: CallableRequest<any>) => {
    const { spreadsheetData, mode } = request.data;
    
    if (!Array.isArray(spreadsheetData)) {
        throw new HttpsError("invalid-argument", "spreadsheetData is required and must be an array.");
    }
    
    // If 'rescan' is passed, we rebuild the contentMapRegistry
    if (mode === "rescan") {
        const registryRef = db.collection("contentMapRegistry");
        
        // 1. Delete existing docs in chunks of 500
        let snapshot = await registryRef.limit(500).get();
        while (!snapshot.empty) {
            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            snapshot = await registryRef.limit(500).get();
        }

        // 2. Identify and save new mappings in chunks of 500
        const mappings: { date: string, row: number }[] = [];
        spreadsheetData.forEach((row: any[], index: number) => {
            const colA = row[0];
            if (typeof colA === 'string' && /^[A-Z][a-z]{2,8}\s\d{1,2}$/.test(colA.trim())) {
                mappings.push({
                    date: colA.trim(),
                    row: index + 1
                });
            }
        });

        // 3. Commit new mappings in batches of 500
        for (let i = 0; i < mappings.length; i += 500) {
            const chunk = mappings.slice(i, i + 500);
            const batch = db.batch();
            chunk.forEach(m => {
                const docRef = registryRef.doc();
                batch.set(docRef, {
                    dateString: m.date,
                    rowNumber: m.row,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch.commit();
        }
        
        return { success: true, message: `Successfully rescanned sheet and created ${mappings.length} dynamic mappings.` };
    }

    return { success: true, message: "Standard import executed without rescan." };
});

/**
 * Morning Digest: Mon-Fri at 5 AM.
 * Summarizes the day's academic lessons and provides an AI encouraging brief.
 */
export const morningDigest = onSchedule("0 5 * * 1-5", async (event) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!adminEmail || !resendApiKey) {
        console.error("Morning Digest aborted: ADMIN_EMAIL or RESEND_API_KEY missing.");
        return;
    }

    // Identify Today (Simplified Date string matching the registry format)
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    
    console.log(`Generating Morning Digest for ${dateStr}`);

    // 1. Fetch today's pacing rows from Firestore
    // We try to find rows where day matches current day and week matches current week, 
    // or direct date match if supported.
    const rowsSnap = await db.collection('planner_rows')
        .where('date', '==', dateStr) 
        .get();

    if (rowsSnap.empty) {
        console.log("No pacing rows found for today.");
        return;
    }

    const rows = rowsSnap.docs.map(d => d.data());
    const lessonList = rows.map(r => `${r.subject}: ${r.lessonTitle}`).join('\n');

    // 2. AI Encouraging Brief via Gemini
    const aiPrompt = `
        You are a supportive academic assistant for Thales Academy. 
        Here is the lesson plan for today (${dateStr}):
        ${lessonList}
        
        Write a 2-3 sentence encouraging brief about these lessons for the school admin. 
        Focus on the value of the topics being taught today. Keep it professional and uplifting.
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    const result = await model.generateContent(aiPrompt);
    const brief = result.response.text();

    // 3. Send via Resend
    const resend = new Resend(resendApiKey);
    await resend.emails.send({
        from: 'Thales OS <notifications@thales-os.app>',
        to: adminEmail,
        subject: `☀️ Morning Digest: ${dateStr}`,
        html: `
            <h2>Good Morning, Administrator!</h2>
            <p>Here is your academic digest for today, ${dateStr}:</p>
            <h3>Today's Focus:</h3>
            <ul>
                ${rows.map(r => `<li><strong>${r.subject}:</strong> ${r.lessonTitle}</li>`).join('')}
            </ul>
            <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; border-left: 4px solid #0065a7;">
                <p><em>${brief}</em></p>
            </div>
            <p>Have a productive day at Thales Academy!</p>
        `
    });
    console.log("Morning Digest sent successfully.");
});

/**
 * Nightly Error Monitor: 11 PM.
 * Scans deployLogs for errors in the last 24 hours and alerts admin.
 */
export const nightlyErrorMonitor = onSchedule("0 23 * * *", async (event) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!adminEmail || !resendApiKey) return;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const errorSnap = await db.collection('deployLogs')
        .where('status', '==', 'ERROR')
        .where('createdAt', '>=', twentyFourHoursAgo)
        .get();

    if (errorSnap.empty) {
        console.log("No critical deployment errors detected in the last 24 hours.");
        return;
    }

    const errors = errorSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const resend = new Resend(resendApiKey);
    await resend.emails.send({
        from: 'Thales OS <alerts@thales-os.app>',
        to: adminEmail,
        subject: `⚠️ Nightly Error Alert: ${errors.length} Failures Detected`,
        html: `
            <h2>Deployment Error Report</h2>
            <p>The following deployment errors occurred in the last 24 hours:</p>
            <ul>
                ${errors.map((e: any) => `<li><strong>ID:</strong> ${e.id} | <strong>Message:</strong> ${e.message || 'Unknown Error'}</li>`).join('')}
            </ul>
            <p>Please check the Thales OS Dashboard for details.</p>
        `
    });
    console.log(`Sent alert for ${errors.length} deployment errors.`);
});

/**
 * Jaccard Similarity Algorithm (Intersection over Union)
 * Used to detect near-duplicate assignment titles in Canvas.
 */
function getJaccardSimilarity(s1: string, s2: string): number {
    const set1 = new Set(s1.toLowerCase().trim().split(/\s+/));
    const set2 = new Set(s2.toLowerCase().trim().split(/\s+/));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Duplicate Sweeper: Cleans up cluttered Canvas courses
 */
export const sweepDuplicates = neverCrash(async (request: CallableRequest<any>) => {
    const { courseId } = request.data;
    if (!courseId) throw new Error("courseId is required");

    const token = process.env.CANVAS_API_TOKEN;
    if (!token) {
        throw new Error("CANVAS_API_TOKEN not configured. Please add it to your function environment variables.");
    }

    // 1. Fetch all Canvas assignments for the course
    const baseUrl = `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/assignments`;
    const response = await fetch(`${baseUrl}?per_page=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
        throw new Error(`Canvas API Error: ${response.status} ${response.statusText}`);
    }
    
    const assignments: any[] = await response.json();
    const results: any[] = [];
    const deletedIds = new Set<string>();

    // 2. Pairwise Comparison using Jaccard Similarity
    for (let i = 0; i < assignments.length; i++) {
        for (let j = i + 1; j < assignments.length; j++) {
            const a1 = assignments[i];
            const a2 = assignments[j];
            
            // Skip if either was already marked for deletion in this pass
            if (deletedIds.has(a1.id) || deletedIds.has(a2.id)) continue;

            const similarity = getJaccardSimilarity(a1.name, a2.name);

            if (similarity >= 0.80) {
                // High Similarity: Check for submissions before deleting
                if (!a2.has_submitted_submissions) {
                    console.log(`[Sweeper] High similarity (${Math.round(similarity * 100)}%) detected. Deleting duplicate: ${a2.name} (ID: ${a2.id})`);
                    await fetch(`${baseUrl}/${a2.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    deletedIds.add(a2.id);
                    results.push({ action: 'DELETE', id: a2.id, name: a2.name, similarity });
                }
            } else if (similarity >= 0.50) {
                // Moderate Similarity: Unpublish and flag
                console.log(`[Sweeper] Moderate similarity (${Math.round(similarity * 100)}%) detected. Unpublishing: ${a2.name} (ID: ${a2.id})`);
                await fetch(`${baseUrl}/${a2.id}`, {
                    method: 'PUT',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ assignment: { published: false, comment: `[SYSTEM] Potential duplicate of ${a1.name}` } })
                });
                results.push({ action: 'UNPUBLISH', id: a2.id, name: a2.name, similarity });
            }
        }
    }

    return { 
        success: true, 
        courseId, 
        processedCount: assignments.length, 
        actionsTaken: results.length,
        details: results 
    };
});

/**
 * AI File Classification: Categorizes Canvas files using historical rules and Gemini
 */
export const classifyCanvasFiles = neverCrash(async (request: CallableRequest<any>) => {
    const { filename } = request.data;
    if (!filename) throw new Error("filename is required");

    // 1. Query Firestore learningRules first (Historical matches)
    const rulesRef = db.collection('learningRules');
    const existingRule = await rulesRef.where('filename', '==', filename).limit(1).get();

    if (!existingRule.empty) {
        console.log(`[Classifier] Cache hit for ${filename}`);
        return { 
            source: 'learning_rules', 
            classification: existingRule.docs[0].data() 
        };
    }

    // 2. AI Inference via Gemini
    console.log(`[Classifier] Cache miss for ${filename}. Querying Gemini...`);
    
    const prompt = `
        You are an expert academic data classifier for Thales Academy.
        Categorize the following filename into a subject (Math, ELA, History, Science) and identify the lesson number.
        
        Filename: "${filename}"
        
        Return exactly this JSON structure:
        {
          "subject": "Math | ELA | History | Science | Other",
          "lessonNum": "string or null",
          "isTest": boolean,
          "confidence": number (0.0 to 1.0)
        }
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Clean and Parse JSON
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const classification = JSON.parse(jsonMatch ? jsonMatch[0] : text);

        // 3. Persist for future learning
        await rulesRef.add({
            filename,
            ...classification,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { source: 'gemini_ai', classification };
    } catch (err) {
        console.error("[Classifier] Failed to parse AI response:", text);
        throw new Error("AI Classification failed to generate valid data.");
    }
});
