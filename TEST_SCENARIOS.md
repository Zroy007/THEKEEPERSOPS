# Verification Test Scenarios & Audit Runbook

This document provides step-by-step verification procedures for an independent technical auditor to validate every functional domain of the **Browser Workflow Operations Platform**.

---

## Scenario 1: Application Startup & Liveness Probe
- **Preconditions**: Node.js v20+ installed, repository dependencies installed via `npm install`.
- **Steps**:
  1. Start the server using `npm run dev` or `npm start`.
  2. Execute HTTP GET request against the liveness endpoint:
     ```bash
     curl -s http://localhost:3000/health
     ```
  3. Execute HTTP GET request against the deep readiness endpoint:
     ```bash
     curl -s http://localhost:3000/ready
     ```
- **Expected Results**:
  - `/health` returns HTTP 200 with `{ "status": "UP", "timestamp": "..." }`.
  - `/ready` returns HTTP 200 with memory RSS, heap statistics, and active queue counts.

---

## Scenario 2: Super Admin Authentication & Initial Password Change
- **Preconditions**: Application booted with default seed database.
- **Steps**:
  1. Authenticate with initial bootstrap credentials:
     ```bash
     curl -s -X POST http://localhost:3000/api/auth/login \
       -H "Content-Type: application/json" \
       -d '{"email": "superadmin@ops-control.internal", "password": "SUPERADMIN_TEMPORARY_PASSWORD_CHANGE_ON_FIRST_LOGIN"}'
     ```
  2. Inspect response JSON for token and `mustChangePassword` flag.
  3. Change the password with an authenticated request:
     ```bash
     curl -s -X POST http://localhost:3000/api/auth/change-password \
       -H "Authorization: Bearer <TOKEN>" \
       -H "Content-Type: application/json" \
       -d '{
         "currentPassword": "SUPERADMIN_TEMPORARY_PASSWORD_CHANGE_ON_FIRST_LOGIN",
         "newPassword": "NewSecurePassword2026!",
         "confirmPassword": "NewSecurePassword2026!"
       }'
     ```
- **Expected Results**:
  - Login returns HTTP 200 with a valid JWT token and `mustChangePassword: true`.
  - Password change returns HTTP 200, updates the PBKDF2 hash, and clears the `mustChangePassword` flag.
  - UI automatically displays `PasswordChangeModal` upon first login.

---

## Scenario 3: Backend RBAC Permission Enforcement
- **Preconditions**: Valid JWT token for an account with `VIEWER` role.
- **Steps**:
  1. Attempt a mutating administrative operation using the viewer token:
     ```bash
     curl -s -X POST http://localhost:3000/api/admin/users \
       -H "Authorization: Bearer <VIEWER_TOKEN>" \
       -H "Content-Type: application/json" \
       -d '{"name": "Hacker", "email": "hacker@test.com", "role": "ADMIN"}'
     ```
  2. Repeat the same request using a `SUPERADMIN` token.
- **Expected Results**:
  - Viewer request is rejected with HTTP 403 Forbidden: `{"error": "Forbidden: missing required permission 'users.create'"}`.
  - Super Admin request succeeds with HTTP 201 Created and logs an audit trail record.

---

## Scenario 4: Job Creation & Dynamic Ingestion
- **Preconditions**: Server running, operator authenticated.
- **Steps**:
  1. Submit a new job via REST API or UI **+ New Job** modal:
     ```bash
     curl -s -X POST http://localhost:3000/api/jobs \
       -H "Content-Type: application/json" \
       -d '{
         "shopName": "Nordic Apparel Lab",
         "email": "nordic.lab@outfit-mail.org",
         "passwordReference": "sec://vault/passwords/nordic",
         "proxyReference": "proxy://residential-pool:10001",
         "priority": "HIGH",
         "runMode": "AUTO",
         "autoStart": true
       }'
     ```
  2. Query the job table: `GET http://localhost:3000/api/jobs`.
- **Expected Results**:
  - Returns HTTP 201 with newly generated `jobId` (e.g. `JOB-00000X`).
  - Status is initialized to `QUEUED`.
  - The job immediately appears in the Jobs grid and Dashboard metrics.

---

## Scenario 5: Dynamic Concurrency & Queue Slot Allocation
- **Preconditions**: System settings `concurrencyLimit` set to 12.
- **Steps**:
  1. Trigger the queue dispatch worker:
     ```bash
     curl -s -X POST http://localhost:3000/api/scheduler/process-queue
     ```
  2. Inspect response JSON `dispatchedCount` and `activeSessionsCount`.
- **Expected Results**:
  - Worker computes `availableSlots = 12 - runningSessionsCount`.
  - Exactly allocates available slots to highest-priority queued jobs.
  - Transitions jobs to `INITIALIZING_BROWSER` and starts GoLogin browser sessions.

---

## Scenario 6: Real-Time Concurrency Limit Update
- **Preconditions**: Authenticated as `ADMIN` or `SUPERADMIN`.
- **Steps**:
  1. In `src/pages/SystemSettingsPage.tsx` or via API, update `concurrencyLimit`:
     ```bash
     curl -s -X PATCH http://localhost:3000/api/admin/settings \
       -H "Authorization: Bearer <SUPERADMIN_TOKEN>" \
       -H "Content-Type: application/json" \
       -d '{"concurrencyLimit": 24}'
     ```
  2. Fetch settings: `GET http://localhost:3000/api/admin/settings`.
- **Expected Results**:
  - Returns HTTP 200 with updated `concurrencyLimit: 24`.
  - Creates a new version entry in `settings_history`.
  - Subsequent queue worker executions immediately recognize the 24-session capacity.

---

## Scenario 7: Workflow Job Pause and Resume
- **Preconditions**: An active running job with an associated session.
- **Steps**:
  1. Pause the job:
     ```bash
     curl -s -X POST http://localhost:3000/api/jobs/JOB-000001/pause \
       -H "Content-Type: application/json"
     ```
  2. Verify job status and session status are updated to `PAUSED`.
  3. Resume the job:
     ```bash
     curl -s -X POST http://localhost:3000/api/jobs/JOB-000001/resume \
       -H "Content-Type: application/json"
     ```
- **Expected Results**:
  - Pause stops the browser container and pauses the job state.
  - Resume restores the session and resumes workflow execution from the exact step.

---

## Scenario 8: Human Verification Checkpoint Creation & Halting
- **Preconditions**: A running workflow job entering a 2FA verification step.
- **Steps**:
  1. Progress job to 2FA state:
     ```bash
     curl -s -X POST http://localhost:3000/api/jobs/JOB-000002/advance-step \
       -H "Content-Type: application/json"
     ```
  2. Query the human task queue: `GET http://localhost:3000/api/human-tasks`.
- **Expected Results**:
  - Job transitions to `WAITING_FOR_EMAIL_OTP`.
  - Automation halts immediately (no automated scraping).
  - A new `HumanTask` is created with status `OPEN`.
  - High-priority amber banner appears on the Dashboard.

---

## Scenario 9: Human Task Resolution via Operator UI
- **Preconditions**: A pending task `HTASK-001` in `OPEN` status.
- **Steps**:
  1. Complete the task by providing the 6-digit OTP code:
     ```bash
     curl -s -X POST http://localhost:3000/api/human-tasks/HTASK-001/complete \
       -H "Content-Type: application/json" \
       -d '{"otpCode": "849201", "resolvedBy": "OP-101"}'
     ```
- **Expected Results**:
  - Task status transitions to `RESOLVED`.
  - Associated job resumes execution, advancing to `READY_FOR_SUBMISSION`.
  - Telegram alert dispatched acknowledging checkpoint resolution.

---

## Scenario 10: Technical Retry with Exponential Backoff
- **Preconditions**: A job in `ERROR` status (e.g. `NETWORK_TIMEOUT` or `CAPTCHA_BLOCKED`).
- **Steps**:
  1. Trigger retry:
     ```bash
     curl -s -X POST http://localhost:3000/api/jobs/JOB-000005/retry \
       -H "Content-Type: application/json"
     ```
  2. Inspect response retry parameters.
- **Expected Results**:
  - Evaluates matching `RetryPolicy` based on error code.
  - Calculates backoff delay (`initialBackoffMs * (multiplier ^ attempt)`).
  - Increments retry count and schedules job re-execution.

---

## Scenario 11: Merchant Reapplication & Attempt Preservation
- **Preconditions**: A job in `REJECTED` status.
- **Steps**:
  1. Trigger reapplication:
     ```bash
     curl -s -X POST http://localhost:3000/api/jobs/JOB-000003/reapply \
       -H "Content-Type: application/json" \
       -d '{"notes": "Reapplying with updated utility bill"}'
     ```
  2. Query application attempts: `GET http://localhost:3000/api/applications/JOB-000003/attempts`.
- **Expected Results**:
  - Job `currentAttemptNo` increments from 1 to 2.
  - Previous attempt remains preserved and immutable in the history ledger.
  - Job re-enters `QUEUED` status for new submission.

---

## Scenario 12: Settings History & Version Rollback
- **Preconditions**: Authenticated as `SUPERADMIN`.
- **Steps**:
  1. Make two successive changes to system settings.
  2. Query history: `GET http://localhost:3000/api/admin/settings/history`.
  3. Rollback to version 1:
     ```bash
     curl -s -X POST http://localhost:3000/api/admin/settings/rollback/v1 \
       -H "Authorization: Bearer <TOKEN>"
     ```
- **Expected Results**:
  - Previous settings are fully restored.
  - A new rollback audit entry is recorded in both settings history and audit logs.

---

## Scenario 13: Masked Secret Storage & Zero Leaks
- **Preconditions**: Authenticated as `SUPERADMIN`.
- **Steps**:
  1. Query secret metadata:
     ```bash
     curl -s http://localhost:3000/api/admin/secrets \
       -H "Authorization: Bearer <TOKEN>"
     ```
  2. Inspect the JSON payload for any plaintext secret values.
- **Expected Results**:
  - Plaintext values are never returned. All configured secrets are masked as `••••••••••••••••`.
  - Only metadata (`key`, `description`, `category`, `isSet`, `lastUpdated`) is exposed.

---

## Scenario 14: Telegram Bot Alert Test
- **Preconditions**: Operator on System Settings or Notifications page.
- **Steps**:
  1. Trigger test alert:
     ```bash
     curl -s -X POST http://localhost:3000/api/admin/settings/test-telegram \
       -H "Authorization: Bearer <TOKEN>"
     ```
- **Expected Results**:
  - If `TELEGRAM_BOT_TOKEN` is set, delivers message to Telegram chat.
  - If running in Mock Mode, records a simulated notification with status `SENT` and latency telemetry.

---

## Scenario 15: Microsoft Graph Mailbox Status Probe
- **Preconditions**: Server running.
- **Steps**:
  1. Probe mailbox status:
     ```bash
     curl -s http://localhost:3000/api/integrations/outlook/status
     ```
- **Expected Results**:
  - Returns mailbox connection status (`MOCK` or `ACTIVE`), unread message count, and timestamp.
  - Does not attempt to scrape or parse private emails, confirming the intentional human boundary.

---

## Scenario 16: Google Sheets Bi-Directional Sync & CSV Export
- **Preconditions**: Supervisor authenticated.
- **Steps**:
  1. Trigger sync: `POST http://localhost:3000/api/sheets/sync`.
  2. Download CSV export:
     ```bash
     curl -s http://localhost:3000/api/sheets/export/csv
     ```
- **Expected Results**:
  - Sync updates row counts and logs a `SheetSyncLog` record.
  - `/api/sheets/export/csv` returns valid RFC-4180 CSV content containing job and session rows.

---

## Scenario 17: Local Data Persistence Across Server Reboots
- **Preconditions**: Create a new job or modify a setting.
- **Steps**:
  1. Create a job `JOB-PERSIST-TEST`.
  2. Inspect `data/platform_db.json` on disk to verify the record was written.
  3. Restart the backend process: `npm run dev` or restart container.
  4. Query `GET http://localhost:3000/api/jobs/JOB-PERSIST-TEST`.
- **Expected Results**:
  - The job is recovered intact from `data/platform_db.json`.
  - Data remains fully durable across server restarts.

---

## Scenario 18: Automated Jest / Vitest Test Suite
- **Preconditions**: In terminal, run unit tests.
- **Steps**:
  ```bash
  npm test
  ```
- **Expected Results**:
  - All 24 unit and integration tests pass successfully (auth, queueEngine, retryEngine, superadmin, workflowEngine).
