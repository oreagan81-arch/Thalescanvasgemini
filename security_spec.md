# Thales Canvas Gemini Security Specification

## 1. Data Invariants
- **User Scoping**: Most data (Planner, Announcements, Assignments) belongs to a specific teacher and must be isolated by their Auth UID.
- **Artifact Scoping**: To support potential multi-app or multi-instance deployments, data is scoped under `/artifacts/{appId}/`.
- **Relational Integrity**: Assessments/Assignments must reference valid week IDs.
- **Immutable Fields**: `userId`, `createdAt`, and `appId` references must be immutable once written.
- **Identity Verification**: All writes require a signed-in user with a verified email.

## 2. The Dirty Dozen Payloads (Red Team Tests)

### T1: Identity Spoofing (Planner)
```json
// Path: /artifacts/thales-v1/users/attacker_uid/planner_rows/doc_1
{
  "userId": "victim_uid",
  "weekId": "week-1",
  ...
}
```
*Expected*: PERMISSION_DENIED (UID mismatch).

### T2: Phantom Artifact Access
```json
// Path: /artifacts/other_school_id/users/my_uid/settings/profile
{ "teacherName": "Attacker" }
```
*Expected*: PERMISSION_DENIED (if we implement strict appId validation, though usually, we allow users to their own UID across artifacts if it's the same project).

### T3: Global Data Scraping (Public)
```json
// Request: LIST /artifacts/thales-v1/public/data
```
*Expected*: PERMISSION_DENIED (Must require at least auth, and potentially specific query filters).

### T4: Schema Poisoning (1MB String)
```json
{ "lessonTitle": "A".repeat(1000000) }
```
*Expected*: PERMISSION_DENIED (Size limits).

### T5: State Shortcut (Assignment)
```json
{ "status": "Deployed" } // When creating
```
*Expected*: PERMISSION_DENIED (If creation must start as 'Pending').

### T6: Invalid ID Poisoning
```json
// Path: /artifacts/thales-v1/users/my_uid/planner_rows/!!!INVALID!!!
```
*Expected*: PERMISSION_DENIED (isValidId fails).

### T7: PII Leakage (Settings)
```json
// Request: GET /artifacts/thales-v1/settings/victim_uid
```
*Expected*: PERMISSION_DENIED (Not owner).

### T8: Admin Privilege Escalation
```json
{ "role": "admin" } // On self-profile update
```
*Expected*: PERMISSION_DENIED (Role is immutable/system-only).

### T9: Cross-User Week Modification
```json
// Request: UPDATE /weeks/week-1
```
*Expected*: PERMISSION_DENIED (Requires admin email).

### T10: Orphaned Resource (Missing Week)
```json
{ "weekId": "non-existent-week" }
```
*Expected*: PERMISSION_DENIED (Via exists() check).

### T11: Timestamp Forgery
```json
{ "updatedAt": "2000-01-01T00:00:00Z" }
```
*Expected*: PERMISSION_DENIED (Must match request.time).

### T12: Key Injection
```json
{ "ghostField": true }
```
*Expected*: PERMISSION_DENIED (hasOnly / keys().size() failure).

## 3. Test Runner (Draft)
A `firestore.rules.test.ts` will focus on these 12 vectors.
