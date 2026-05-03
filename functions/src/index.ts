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
  ENRICHMENT_SCHEMA,
  getParserPrompt, 
  getEnrichmentPrompt,
  PROMPT_VERSION
} from './prompts';
import { rulesEngine } from './rulesEngine';
import { jobService, JobStatus, Job } from './jobService';
import { AiPipeline } from './core/pipeline';
import { canvasApiToken, canvasRequest } from './core/canvas';
import { diffEngine } from './canvas/diffEngine';

import { getSystemConfig as getSystemConfigService, updateSystemConfig as updateSystemConfigService } from './control/config';
import { trackMetrics as trackMetricsService } from './control/metrics';
import { updateJob, createJob } from './control/jobs';

import { db } from './lib/db';

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

/**
 * Generates a SHA-256 hash.
 */
function generateHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export const startAiPlanGeneration = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  
  const input = request.data;
  const config = await getSystemConfigService();
  const configSnapshot = {
    model: config.model,
    promptVersion: config.promptVersion,
    rules: config.rules
  };
  const jobId = await createJob(input, configSnapshot);
  
  // Asynchronous processing triggered
  (async () => {
    try {
      await updateJob(jobId, { status: "running" });

      if (!config.features.enableAI) {
        throw new Error("AI disabled globally.");
      }

      const pipeline = new AiPipeline(process.env.GEMINI_API_KEY || "", jobId, request.auth.uid, config);

      // PARSE INPUT
      await updateJob(jobId, { progress: 20 });
      const structuralPlan = await pipeline.parseInput(input.rawText, input.quarter || 1, input.weekId || "1");
      
      // STAGE 2: GENERATE STRUCTURE & CONTENT
      await updateJob(jobId, { progress: 60 });
      let finalPlan = await pipeline.buildWeekStructure(structuralPlan);
      
      // STAGE 3: DAY PROCESSING (VALIDATION/ENRICHMENT)
      await updateJob(jobId, { status: "running", progress: 80 });
      const courseInfo = `${finalPlan.course}, Quarter ${finalPlan.quarter}, Week ${finalPlan.weekId}`;
      
      const jobSnapshot = await db.collection('jobs').doc(jobId).get();
      const jobData = jobSnapshot.data() as Job;
      const isRetry = (jobData.attempts || 1) > 1;
      
      for (let i = 0; i < finalPlan.days.length; i++) {
        let day = finalPlan.days[i];
        
        await pipeline.processDay(day, courseInfo, config.promptVersion, getEnrichmentPrompt, ENRICHMENT_SCHEMA as any, jobId, {
            updateStep: async (jid: string, step: string, status: string) => await logJob(jid, `Step ${step}: ${status}`)
        }, false, isRetry);
      }

      await updateJob(jobId, {
        status: "completed",
        progress: 100
      });

    } catch (e: any) {
      console.error(e);
      await updateJob(jobId, { status: "failed" });
      await logJob(jobId, "FAILED: " + e.message);
    }
  })();

  return { jobId };
});

export const getJobStatus = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  
  const { jobId } = request.data;
  if (!jobId) throw new HttpsError("invalid-argument", "jobId is required.");

  const jobSnap = await db.collection('jobs').doc(jobId).get();
  if (!jobSnap.exists()) {
    throw new HttpsError("not-found", `Job ${jobId} not found.`);
  }

  const jobData = jobSnap.data();
  return {
    id: jobData?.id,
    status: jobData?.status,
    progress: jobData?.progress,
    steps: jobData?.steps || {},
    result: jobData?.result,
    error: jobData?.error,
    updatedAt: jobData?.updatedAt?.toDate().toISOString()
  };
});

export const startAnnouncementGeneration = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  
  const input = request.data;
  const config = await getSystemConfigService();
  const configSnapshot = {
    model: config.model,
    promptVersion: config.promptVersion,
    rules: config.rules
  };
  const jobId = await createJob(input, configSnapshot);

  (async () => {
    try {
      await updateJob(jobId, { status: "running" });

      const { command, plannerRows, settings, weekId } = input;
      
      await logJob(jobId, "Starting announcement generation...");

      const mathTestNum = command.match(/math\s*test\s*(\d+)/i)?.[1];
      let curriculumContext = "";
      if (mathTestNum) {
         curriculumContext += `\nMath Test ${mathTestNum} detected.`;
      }

      const prompt = `
        TASK: Draft a parent announcement for Thales Academy.
        USER COMMAND: ${command}
        ACADEMIC CONTEXT: ${JSON.stringify(plannerRows)}
        TONE PREFERENCE: ${settings?.tone || 'Warm'}
        ${curriculumContext}
        
        RULES:
        - Use Cidi Labs dp-box and dp-header tags.
        - Friday Agenda Rule: Omit instructional sections on Fridays, focus on assessments.
        - Brevity Mandate: Strip all vendor names (Saxon, Shurley, etc).
        - Friday Rule: If today is Friday, keep it brief and celebratory.
      `;

      // Use the new generator
      const text = await generateWithControl(prompt, "generate", config, genAI, request.auth.uid);

      await updateJob(jobId, {
        status: "completed",
        progress: 100,
        result: {
          title: `${settings?.course || 'Thales Academy'} Update - ${weekId}`,
          bodyHTML: text,
          suggestedPostDate: new Date().toISOString()
        }
      });
    } catch (e: any) {
      await updateJob(jobId, { status: "failed" });
      await logJob(jobId, "FAILED: " + e.message);
    }
  })();
  
  return { jobId };
});

export const deployPages = onCall({ secrets: [canvasApiToken] }, async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const { pages, force } = request.data;
  const token = canvasApiToken.value();
  
  if (!Array.isArray(pages)) {
    throw new HttpsError("invalid-argument", "The 'pages' argument must be an array.");
  }

  const deployed = [];
  for (const page of pages) {
    if (!page.id || !page.courseId) continue;

    // 1. Transactional Lock
    const lockKey = generateHash(`deploy_page_${page.id}`);
    const lockRef = db.collection('locks').doc(lockKey);
    
    try {
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(lockRef);
        if (snap.exists() && snap.data()!.expiresAt.toDate() > new Date()) {
          throw new Error(`Deployment lock active for ${page.title}`);
        }
        transaction.set(lockRef, { 
          expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 60000) 
        });
      });

      // 2. Fetch Shadow State
      const pageRef = db.collection('canvas_pages').doc(page.id);
      const pageSnap = await pageRef.get();
      const shadowCopy = pageSnap.exists() ? pageSnap.data() : null;
      
      const currentHash = generateHash(page.html + page.title);
      let canvasId = page.canvasId || shadowCopy?.canvasId;
      
      if (!canvasId) {
        canvasId = await diffEngine.findResourceIdByTitle(page.courseId, page.title, 'pages', token);
      }

      // 3. DIFF SYNC LAYER
      if (canvasId && shadowCopy?.contentHash === currentHash && !force) {
        console.log(`[SYNC SKIP] Page "${page.title}" matches remote state.`);
        deployed.push(page.title);
        continue;
      }

      // 4. Remote Action
      let result;
      if (canvasId) {
        console.log(`[SYNC UPDATE] Pushing diff for "${page.title}" (${canvasId})`);
        result = await canvasRequest(`courses/${page.courseId}/pages/${canvasId}`, 'PUT', {
          wiki_page: { title: page.title, body: page.html }
        }, token);
      } else {
        console.log(`[SYNC CREATE] Initializing new page "${page.title}"`);
        result = await canvasRequest(`courses/${page.courseId}/pages`, 'POST', {
          wiki_page: { title: page.title, body: page.html, published: false }
        }, token);
        canvasId = result.url.split('/').pop();
      }
      
      // 5. Update Shadow Copy
      await pageRef.set({
        id: page.id,
        courseId: page.courseId,
        title: page.title,
        canvasId: canvasId || result.page_id || result.url?.split('/').pop(),
        contentHash: currentHash,
        status: 'Deployed',
        lastSyncedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      deployed.push(page.title);
      await lockRef.delete();

    } catch (error: any) {
      console.error(`Diff-Sync Error (${page.title}): ${error.message}`);
    }
  }
  return { success: true, deployed: deployed.length, titles: deployed };
});

export const deployAssignments = onCall({ secrets: [canvasApiToken] }, async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const token = canvasApiToken.value();
  const { assignments, force } = request.data;

  if (!Array.isArray(assignments)) {
    throw new HttpsError("invalid-argument", "The 'assignments' argument must be an array.");
  }

  const results = [];
  for (const assign of assignments) {
    if (!assign.id || !assign.courseId) continue;

    const lockKey = generateHash(`deploy_assign_${assign.id}`);
    const lockRef = db.collection('locks').doc(lockKey);

    try {
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(lockRef);
        if (snap.exists() && snap.data()!.expiresAt.toDate() > new Date()) {
          throw new Error(`Lock active for ${assign.title}`);
        }
        transaction.set(lockRef, { 
          expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 60000) 
        });
      });

      const assignRef = db.collection('assignments').doc(assign.id);
      const assignSnap = await assignRef.get();
      const shadowCopy = assignSnap.exists() ? assignSnap.data() : null;

      const payloadToHash = JSON.stringify({ 
        title: assign.title, 
        description: assign.description, 
        points: assign.points 
      });
      
      const currentHash = generateHash(payloadToHash);
      let canvasId = assign.canvasId || shadowCopy?.canvasId;
      
      if (!canvasId) {
        canvasId = await diffEngine.findResourceIdByTitle(assign.courseId, assign.title, 'assignments', token);
      }

      // DIFF SYNC LAYER
      if (canvasId && shadowCopy?.contentHash === currentHash && !force) {
        console.log(`[SYNC SKIP] Assignment "${assign.title}" matches remote state.`);
        results.push(canvasId);
        continue;
      }

      let res;
      if (canvasId) {
        console.log(`[SYNC UPDATE] Syncing Assignment "${assign.title}" (${canvasId})`);
        res = await canvasRequest(`courses/${assign.courseId}/assignments/${canvasId}`, 'PUT', {
          assignment: { 
            name: assign.title, 
            points_possible: assign.points, 
            description: assign.description || ""
          }
        }, token);
      } else {
        console.log(`[SYNC CREATE] Creating Assignment "${assign.title}"`);
        res = await canvasRequest(`courses/${assign.courseId}/assignments`, 'POST', {
          assignment: { 
            name: assign.title, 
            points_possible: assign.points, 
            published: false,
            description: assign.description || ""
          }
        }, token);
        canvasId = res.id.toString();
      }
      
      await assignRef.set({
        canvasId,
        contentHash: currentHash,
        status: 'Deployed', 
        lastSyncedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await lockRef.delete();
      results.push(canvasId);
    } catch (error: any) {
      console.error(`Assignment Sync Failure: ${error.message}`);
    }
  }
  return { success: true, count: results.length };
});

/**
 * Audits curriculum data against Thales Academy rules.
 */
export const auditCurriculum = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const { items } = request.data;
  
  if (!Array.isArray(items)) {
    throw new HttpsError("invalid-argument", "Missing required field: items (array).");
  }

  const results = items.map(item => {
    const { type, identifier, content, weekNumber } = item;
    const audit = rulesEngine.verifyCurriculum(type, identifier, content);
    return { weekNumber, audit };
  });

  return { success: true, results };
});

/**
 * Suggests assignments based on planner data using the master rules engine.
 */
export const suggestAssignments = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const { plannerRows } = request.data;
  
  if (!Array.isArray(plannerRows)) {
    throw new HttpsError("invalid-argument", "plannerRows must be an array.");
  }

  const suggestions = plannerRows.map(row => ({
    rowId: row.id,
    assignments: rulesEngine.generateAssignments(row)
  }));

  return { success: true, suggestions };
});

export const deployAnnouncements = onCall({ secrets: [canvasApiToken] }, async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const token = canvasApiToken.value();
  const { announcements, force } = request.data;

  if (!Array.isArray(announcements)) {
    throw new HttpsError("invalid-argument", "The 'announcements' argument must be an array.");
  }

  for (const ann of announcements) {
    if (!ann.id || !ann.courseId) continue;

    const lockKey = generateHash(`deploy_ann_${ann.id}`);
    const lockRef = db.collection('locks').doc(lockKey);

    try {
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(lockRef);
        if (snap.exists() && snap.data()!.expiresAt.toDate() > new Date()) {
          throw new Error("Lock active");
        }
        transaction.set(lockRef, { 
          expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 60000) 
        });
      });

      const annRef = db.collection('announcements').doc(ann.id);
      const annSnap = await annRef.get();
      const shadowCopy = annSnap.exists() ? annSnap.data() : null;

      const currentHash = generateHash(ann.content + ann.title);
      let canvasId = ann.canvasId || shadowCopy?.canvasId;
      
      if (!canvasId) {
        canvasId = await diffEngine.findResourceIdByTitle(ann.courseId, ann.title, 'discussion_topics', token);
      }

      // DIFF SYNC LAYER
      if (canvasId && shadowCopy?.contentHash === currentHash && !force) {
        console.log(`[SYNC SKIP] Announcement "${ann.title}" matches remote state.`);
        continue;
      }

      if (canvasId) {
        console.log(`[SYNC UPDATE] Syncing Announcement "${ann.title}" (${canvasId})`);
        await canvasRequest(`courses/${ann.courseId}/discussion_topics/${canvasId}`, 'PUT', {
          title: ann.title, 
          message: ann.content
        }, token);
      } else {
        console.log(`[SYNC CREATE] Posting Announcement "${ann.title}"`);
        const res = await canvasRequest(`courses/${ann.courseId}/discussion_topics`, 'POST', {
          title: ann.title, 
          message: ann.content, 
          is_announcement: true, 
          published: true
        }, token);
        canvasId = res.id.toString();
      }
      
      await annRef.set({ 
        canvasId,
        contentHash: currentHash,
        status: 'Posted',
        lastSyncedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await lockRef.delete();
    } catch (error: any) {
      console.error(`Announcement Sync Failure: ${error.message}`);
    }
  }
  return { success: true };
});

export const generateAIResponse = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const { prompt } = request.data;
  if (!prompt) throw new HttpsError("invalid-argument", "Prompt is required.");

  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
  let result;
  try {
    result = await model.generateContent(prompt);
  } catch (err) {
    console.error("AI FAILURE", err);
    throw new Error("Generation failed");
  }
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
    let result;
    try {
      result = await model.generateContent(aiPrompt);
    } catch (err) {
      console.error("AI FAILURE", err);
      throw new Error("Generation failed");
    }
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
 * Executes a full sync of the local planner to Canvas.
 * Generates diff server-side and applies changes.
 */
export const executeSync = onCall({ secrets: [canvasApiToken] }, async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const { localData, courseId } = request.data;
  const token = canvasApiToken.value();

  if (!Array.isArray(localData) || !courseId) {
    throw new HttpsError("invalid-argument", "localData (array) and courseId are required.");
  }

  // 1. Generate Diff on Server
  const diff = await diffEngine.generateDiff(localData, courseId, token);

  const results = {
    added: 0,
    updated: 0,
    deleted: 0,
    errors: [] as string[]
  };

  // 2. Execute Additions
  for (const week of diff.additions) {
    try {
      const topic = (week as any).topic || week.readingWeek || ("Unit " + week.weekNumber);
      await canvasRequest(`courses/${courseId}/modules`, 'POST', {
        module: { name: `Week ${week.weekNumber}: ${topic}` }
      }, token);
      results.added++;
    } catch (err: any) {
      results.errors.push(`Failed to add week ${week.weekNumber}: ${err.message}`);
    }
  }

  // 3. Execute Deletions (Unpublish/Archive)
  for (const module of diff.deletions) {
    try {
      // For simplicity, we just unpublish the module
      await canvasRequest(`courses/${courseId}/modules/${module.id}`, 'PUT', {
        module: { published: false }
      }, token);
      results.deleted++;
    } catch (err: any) {
      results.errors.push(`Failed to archive module ${module.id}: ${err.message}`);
    }
  }

  return { success: true, results };
});

/**
 * Generates a sync diff without applying it. 
 * Used for pre-flight checks in the UI.
 */
export const generateSyncDiff = onCall({ secrets: [canvasApiToken] }, async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const { localData, courseId } = request.data;
  const token = canvasApiToken.value();

  if (!Array.isArray(localData) || !courseId) {
    throw new HttpsError("invalid-argument", "localData and courseId are required.");
  }

  const diff = await diffEngine.generateDiff(localData, courseId, token);
  return diff;
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
    let result;
    try {
      result = await model.generateContent(prompt);
    } catch (err) {
      console.error("AI FAILURE", err);
      throw new Error("Generation failed");
    }
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

// --- CONTROL PLANE FUNCTIONS ---

export const getSystemConfig = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  return await getSystemConfigService();
});

export const updateSystemConfig = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  return await updateSystemConfigService(request.data);
});

export const retryJob = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const { jobId } = request.data;
  if (!jobId) throw new HttpsError("invalid-argument", "jobId is required.");

  await updateJob(jobId, {
    status: "pending",
    retries: admin.firestore.FieldValue.increment(1)
  });

  return { success: true };
});

export const trackMetrics = trackMetricsService;
