# 🏛️ THALES ACADEMIC OS v2 — ENTERPRISE GUIDE

Welcome to Thales Academic OS v2, the premium Command Center rebuilt exclusively for Mr. Owen Reagan.

## 🚀 LAUNCH CHECKLIST

1. **Deploy Firebase Functions:** 
   Navigate to `/functions` and run `firebase deploy --only functions`.
   Ensure `google-cloud/secret-manager` access is given to the functions.
2. **Environment Variables:**
   Add your Canvas LMS access token to Secret Manager (or Firebase secrets) under `CANVAS_API_TOKEN`.
   Ensure `GEMINI_API_KEY` is present.
3. **Database:**
   Firestore rules have already been deployed and locked down specifically to `owen.reagan@thalesacademy.org`.
4. **Build the Client:**
   Run `npm run build` and `npm run preview` to test production builds.
5. **Set up Canvas Mapping:**
   Make sure Canvas Course IDs and Mapping rules are updated in the Settings page.

---

## 📘 USER MANUAL

### 1. The Command Center (Dashboard)
Your starting point. Here you can see a high-level view of current intelligence health, deploy status, and AI system integrators. Look for the "Run Validator" button before doing Friday deployments.

### 2. The Premium Weekly Planner
Replaces the old spreadsheet. 
- **Navigation:** Use the Week Selector at the top right to switch weeks.
- **Drag & Drop:** Use the left rim grip of any lesson card to drag it.
- **AI Assist:** Click the "Wand" icon on a row or the main "AI Auto-Fill" button. Type rapid, messy notes like "math test 4, reteaching 2" and Gemini 2.5 Flash will automatically format and lock it into the correct deterministic slots.

### 3. Engine Rules (Determinism)
You no longer have to manually think about when a study guide generates for Math, or blocking homework on Fridays. The determinism engine (located in `src/lib/rulesEngine.ts`) strictly enforces assignments based on the Subject and Lesson Type you select.
- **Math:** Auto-adds Fact Test & Study Guides when "Test" is selected. No odds/evens on test days.
- **Reading/Spelling:** Literacy block combinations are strictly managed.
- **Fridays:** Auto-blocks homework outputs.

### 4. Resource Brain
The system maps existing Canvas files. It uses fuzzy matching and prior history (e.g., matching "MTH_L102_SB_v3_FINAL.pdf" -> "Student Book L102"). Nightly syncs are handled by Cloud Scheduler pub/sub triggers.

### 5. Deploying to Canvas
Never accidently overwrite pages again.
- Clicking "Deploy" uses idempotent logic per week. 
- Only assignments satisfying the Determinism rules are posted.
- Diff preview will be shown before existing pages are touched.

### 6. Announcements & Newsletters
Run the AI Generator via the Announcements tab to consume the weekly planner tasks and format a clean, parent-facing summary automatically.

---

## 🔒 SECURITY NOTICES
- Only users logging in through Google with `owen.reagan@thalesacademy.org` can bypass the Guard router.
- Firestore strictly enforces the same rule at the Database Layer (`request.auth.token.email_verified == true`).
- Do not expose Canvas API keys in the Vite frontend. Use Cloud Functions (`onCall`) where necessary.
