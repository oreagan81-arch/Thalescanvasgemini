# Security Specification: Thales Academic OS

## Data Invariants
1. **Subject Authenticity**: A planner row must always belong to a valid Thales subject defined in `COURSE_IDS`.
2. **Friday Restriction**: Assignments cannot be created for Friday (except Tests).
3. **Identity Pinning**: User settings are strictly pinned to the document ID matching `request.auth.uid`.

## The "Dirty Dozen" Payloads (Red Team Audit)
1. **Unauthorized Setting Overwrite**: Attempting to update `settings/LITERAL_UID` from a different account.
2. **Ghost Assignment Injection**: Creating an assignment for a week without a parent `Week` document.
3. **PII Harvesting**: `get` request on `users/` collection by a non-admin.
4. **Role Escalation**: Setting `role: 'admin'` during user profile creation.
5. **ID Poisoning**: Injecting 1MB junk string as `plannerRowId`.
6. **Relational Sync Bypass**: Updating `canvas_pages` without a corresponding `planner_rows` entry.
7. **Friday Violation**: Force-pushing an assignment with `dueDate` on a Friday.
8. **Impersonation**: Setting `teacherName` to "Headmaster" while authenticated as a different teacher.
9. **Resource Scraping**: List query on `announcements` without a `where` clause on `ownerId`.
10. **Shadow Field Injection**: Adding `isAuthorized: true` to a planner row payload.
11. **Canvas Token Exfiltration**: Attempting to read `settings/{uid}` without being the owner.
12. **Deployment Log Forgery**: Inserting a 'SUCCESS' log for a non-existent deployment task.

## Test Runner (Logic checks)
- Verify `isOwner()` helper blocks all cross-user accesses.
- Verify `isValidId()` blocks oversized path variables.
- Verify `isValidPlannerRow()` enforces Thales subject list.
