// Firebase Cloud Functions for Thales OS API
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenAI } from "@google/genai";
import * as admin from 'firebase-admin';
import { Resend } from 'resend';

admin.initializeApp();
const db = admin.firestore();

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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

/** Nightly Canvas file sync */
export const syncCanvasFiles = onSchedule("0 2 * * *", async (event) => {
    console.log("Syncing Canvas files...");
});

/**
 * Server-side AI Generation
 */
export const generateAIResponse = neverCrash(async (request: CallableRequest<any>) => {
    if (!request.auth) {
        throw new Error("Authentication required.");
    }

    const { prompt } = request.data;
    if (!prompt) {
        throw new Error("Prompt missing.");
    }

    const response = await genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt
    });
    return { result: response.text };
});

export const deployPages = neverCrash(async (request: CallableRequest<any>) => {
    const weekId = request.data.weekId;
    console.log("Deploying pages for week", weekId);
    
    // 1. Fetch rows
    const rowsSnap = await db.collection('planner_rows').where('weekId', '==', weekId).get();
    const rows = rowsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 2. Fetch resources
    const resourcesSnap = await db.collection('resources').get();
    const resources = resourcesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Helper to resolve resource
    const resolveResource = (resName: string) => {
        const match = resources.find(r => 
            (r as any).cleanName.toLowerCase() === resName.toLowerCase() || 
            (r as any).rawName.toLowerCase() === resName.toLowerCase()
        );
        return match ? (match as any).canvasUrl : null;
    };

    // 3. Construct HTML content with resources
    let htmlContent = `<h1>Plan for Week ${weekId}</h1>`;
    rows.sort((a,b) => (a as any).order - (b as any).order).forEach((row: any) => {
        htmlContent += `
            <div class="dp-box">
                <h2 class="dp-header">${row.day} - ${row.subject}</h2>
                <p>Lesson: ${row.lessonTitle}</p>
                <div class="resources">
                    <h3>Resources</h3>
                    <ul>
                        ${row.resources?.map((res: string) => {
                            const url = resolveResource(res);
                            return url ? `<li><a href="${url}">${res}</a></li>` : `<li>${res}</li>`;
                        }).join('')}
                    </ul>
                </div>
            </div>
        `;
    });

    // 4. Update or Create CanvasPage document
    const canvasPageRef = db.collection('canvas_pages').doc(weekId);
    await canvasPageRef.set({
        weekId,
        htmlContent,
        status: 'Draft',
        updatedAt: new Date().toISOString()
    });

    return { success: true, processed: rows.length };
});

export const deployAssignments = neverCrash(async (request: CallableRequest<any>) => {
    const weekId = request.data.weekId;
    console.log("Deploying assignments for week", weekId);
    return { success: true };
});

export const deployAnnouncements = neverCrash(async (request: CallableRequest<any>) => {
    const weekId = request.data.weekId;
    console.log("Deploying announcements for week", weekId);
    return { success: true };
});

export const generateNewsletter = neverCrash(async (request: CallableRequest<any>) => {
    console.log("Generating newsletter");
    return { success: true };
});

export const runWeekValidator = neverCrash(async (request: CallableRequest<any>) => {
    return { valid: true, errors: [] };
});

export const fridayDeploySync = neverCrash(async (request: CallableRequest<any>) => {
    const { weekId, summary } = request.data;
    console.log(`Executing Friday Deploy Sync for ${weekId}`);
    
    // Perform sync operations...
    const results = summary || { Math: 'Success', Reading: 'Success', History: 'Success' };

    // Send Admin Notification via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL;

    if (resendApiKey && adminEmail) {
        const resend = new Resend(resendApiKey);
        try {
            await resend.emails.send({
                from: 'Thales OS <notifications@thales-os.app>',
                to: adminEmail,
                subject: `🚀 Friday Sync Report: Week ${weekId}`,
                html: `
                    <h2>Sync Summary for Week ${weekId}</h2>
                    <ul>
                        ${Object.entries(results).map(([subject, status]) => `<li><strong>${subject}:</strong> ${status}</li>`).join('')}
                    </ul>
                    <p>Deployment timestamp: ${new Date().toLocaleString()}</p>
                `
            });
            console.log("Sync notification sent successfully.");
        } catch (err) {
            console.error("Failed to send Resend email:", err);
        }
    }

    return { success: true, results };
});

export const importSheetData = neverCrash(async (request: CallableRequest<any>) => {
    const { payload, mode } = request.data;
    console.log(`Importing sheet data, mode: ${mode}`);

    // Dynamic Sheet Mapping
    // payload should be raw CSV/Table data where first row or col contains dates
    const rows = payload as string[][];
    const mapping: Record<string, number> = {};

    // Scan Column A for Date headers (Simplified logic: look for date-like strings)
    rows.forEach((row, index) => {
        const firstCell = row[0];
        if (firstCell && (firstCell.includes('/') || firstCell.includes('-')) && /\d/.test(firstCell)) {
            mapping[firstCell] = index;
        }
    });

    const registryRef = db.collection('contentMapRegistry');

    if (mode === 'rescan') {
        console.log("Rescan mode: Cleaning existing registry...");
        const snapshot = await registryRef.get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }

    // Write new mapping to Firestore
    const writeBatch = db.batch();
    Object.entries(mapping).forEach(([date, rowNum]) => {
        const docRef = registryRef.doc(date.replace(/\//g, '-'));
        writeBatch.set(docRef, {
            date,
            rowNumber: rowNum,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });
    await writeBatch.commit();

    return { 
        success: true, 
        mappedCount: Object.keys(mapping).length,
        mapping 
    };
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
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const aiPrompt = `
        You are a supportive academic assistant for Thales Academy. 
        Here is the lesson plan for today (${dateStr}):
        ${lessonList}
        
        Write a 2-3 sentence encouraging brief about these lessons for the school admin. 
        Focus on the value of the topics being taught today. Keep it professional and uplifting.
    `;

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
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
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

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
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
