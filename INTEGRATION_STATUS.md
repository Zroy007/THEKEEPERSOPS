# External Integration Status & Technical Audit

This document provides a technical audit of all external service integrations, detailing their implementation files, underlying APIs, credential requirements, live execution behavior, and UI interactions.

---

## Summary Matrix

| Integration | Classification | Source Files | External API / Service | Credentials Required | Live API Calls Executed | UI Simulation Only? |
|---|---|---|---|---|---|---|
| **GoLogin** | **REAL** (with Mock fallback) | `server/services/gologin.service.ts` | GoLogin REST API (`https://api.gologin.com/browser/v2`, `/start-cloud`, `/stop-cloud`) | `GOLOGIN_API_TOKEN` | **YES**, when token is provided; otherwise falls back to local simulation | No, live calls implemented in code |
| **Telegram** | **REAL** (with Mock fallback) | `server/services/telegram.service.ts` | Telegram Bot API (`https://api.telegram.org/bot<TOKEN>/sendMessage`) | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_DEFAULT_CHAT_ID` | **YES**, when token is provided; otherwise falls back to local simulation | No, live calls implemented in code |
| **Microsoft Graph (Outlook)** | **REAL Probe / INTENTIONALLY PARTIAL** | `server/services/microsoftGraph.service.ts` | Microsoft Identity OAuth 2.0 Client Credentials (`https://login.microsoftonline.com/<TENANT>/oauth2/v2.0/token`) | `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` | **YES** for OAuth probe; email scraping is intentionally **NOT IMPLEMENTED** to keep verification human-controlled | No, probe is real; email body scraping omitted by design |
| **Google Sheets** | **PARTIAL / STUB** | `server/services/googleSheets.service.ts` | Google Sheets REST API v4 (`https://sheets.googleapis.com`) | `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | **PARTIAL**: Mock mode simulates two-way sync; production branch records sync events but direct Sheets v4 JWT signing is a stub | Yes in current state, requires completing service account JWT signer |
| **Google Drive** | **NOT IMPLEMENTED** | None | Google Drive API | N/A | **NO** (Not present in codebase) | N/A |
| **Firestore** | **CONFIG-READY / PARTIAL** | `firestore.rules`, `firestore.indexes.json`, `firebase-blueprint.json`, `firebase.json` | Google Cloud Firestore REST / gRPC | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | **NO**: Runtime database uses local disk-backed JSON (`data/platform_db.json`). Rules & indexes are fully authored for Cloud deployment | Runtime is local file; Firestore configuration assets are ready |
| **Firebase Auth** | **STUB / REPLACED BY NATIVE RBAC** | `server/services/auth.service.ts` | Firebase Authentication REST API | N/A | **NO**: Platform implements a fully standalone native PBKDF2 salt-hash & JWT auth service with RBAC enforcement | Native implementation is active; Firebase Auth SDK is not mounted |
| **Scheduler** | **REAL** | `server/routes.ts` (`/api/scheduler/*`), `cloudrun.service.yaml` | Cloud Scheduler / HTTP Cron invocation | None (protected via service network or internal bearer) | **YES**: Exposes HTTP endpoints designed for GCP Cloud Scheduler cron triggers | No, backend endpoints are fully executable |
| **Background Worker Processing** | **REAL** | `server/routes.ts` (lines 690–740), `server/services/workflowEngine.service.ts` | Internal Node.js async queues & Mutex Lock (`server/utils/concurrencyLock.ts`) | None | **YES**: Fully implements dynamic capacity calculation, auto-dispatching, and reminder escalation | No, state engine transitions real records |
| **Cloud Run / Deployment** | **REAL** | `Dockerfile`, `cloudbuild.yaml`, `cloudrun.service.yaml`, `DEPLOYMENT.md` | Google Cloud Run (Container Runtime) | Google Cloud Project & Artifact Registry | **YES**: Multi-stage Dockerfile and deployment descriptors are fully configured for production deployment | No, ready for `gcloud run deploy` |

---

## Detailed Integration Audit

### 1. GoLogin Cloud Browser Integration
- **Classification**: **REAL** (with built-in Mock Fallback)
- **Primary Source File**: `server/services/gologin.service.ts`
- **Secondary Usage**: `server/services/workflowEngine.service.ts`, `src/pages/SessionsPage.tsx`, `src/components/BrowserSessionModal.tsx`
- **Underlying Service / Protocol**: GoLogin REST API (`/browser/v2`, `/browser/start-cloud`, `/browser/stop-cloud`) and Chromium DevTools Protocol (CDP).
- **Credentials Required**:
  - `GOLOGIN_API_TOKEN`: GoLogin Bearer API authentication token.
  - `GOLOGIN_API_URL`: Base API endpoint (default: `https://api.gologin.com`).
  - `GOLOGIN_CLOUD_URL`: Cloud container endpoint (default: `https://cloudbrowser.gologin.com`).
- **Live Call Verification**:
  - In `createProfile(jobId, shopName, proxyRef)`: When `!this.isMockMode()`, the service executes an HTTP POST to `${this.apiUrl}/browser/v2` with headers `Authorization: Bearer ${this.apiToken}` and body specifying OS, user-agent, resolution, and proxy settings.
  - In `startSession(profileId)`: When `!this.isMockMode()`, executes an HTTP POST to `${this.apiUrl}/browser/start-cloud` and extracts the remote debugging WebSocket URL (`ws://...`) and port (e.g. `9222`).
  - In `stopSession(profileId)`: When `!this.isMockMode()`, executes an HTTP POST to `${this.apiUrl}/browser/stop-cloud`.
- **Mock Mode Behavior**: When `MOCK_MODE=true` or when `GOLOGIN_API_TOKEN` is unset, the service generates deterministic simulated profile IDs (`gl_prof_<random>`), assigns mock remote debugger ports (`9222`, `9223`), and increments fake memory and CPU telemetry.
- **UI Interaction**: `BrowserSessionModal.tsx` provides an interactive tabbed interface displaying simulated remote canvas frames, real-time CDP command logs, and profile parameter cards.

---

### 2. Telegram Bot Notifications
- **Classification**: **REAL** (with built-in Mock Fallback)
- **Primary Source File**: `server/services/telegram.service.ts`
- **Secondary Usage**: `server/routes.ts` (`POST /api/notifications/test`), `server/services/workflowEngine.service.ts`
- **Underlying Service / Protocol**: Telegram Bot HTTP API (`https://api.telegram.org/bot<TOKEN>/sendMessage`).
- **Credentials Required**:
  - `TELEGRAM_BOT_TOKEN`: Bot token provided by @BotFather.
  - `TELEGRAM_DEFAULT_CHAT_ID`: Operations broadcast group or channel ID.
- **Live Call Verification**:
  - In `sendNotification()`: Evaluates `fetchWithTimeout` to `https://api.telegram.org/bot${this.botToken}/sendMessage` with a timeout of 8000ms and 2 retries.
  - Implements client-side deduplication via `idempotencyManager.isDuplicateNotification()` to prevent alert floods within a 5-minute rolling window.
  - Formats messages in Markdown and logs delivery status into the repository (`SENT`, `FAILED`, or `PENDING`).
- **Mock Mode Behavior**: Records notification objects to `data/platform_db.json` and marks the integration status as `CONNECTED` without contacting Telegram.

---

### 3. Microsoft Graph (Outlook) Integration
- **Classification**: **REAL Probe / INTENTIONALLY PARTIAL**
- **Primary Source File**: `server/services/microsoftGraph.service.ts`
- **Secondary Usage**: `server/routes.ts` (`GET /api/integrations/outlook/status`), `src/components/HumanTaskModal.tsx`
- **Underlying Service / Protocol**: Microsoft Identity Platform OAuth 2.0 Client Credentials Grant.
- **Credentials Required**:
  - `AZURE_TENANT_ID`: Azure Active Directory Directory (tenant) ID.
  - `AZURE_CLIENT_ID`: App Registration Application (client) ID.
  - `AZURE_CLIENT_SECRET`: App Registration Client Secret.
  - `AUTHORIZED_OUTLOOK_MAILBOX`: Designates the mailbox to be monitored.
- **Live Call Verification**:
  - In `getMailboxStatus()`: Performs an HTTP POST to `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token` with `grant_type=client_credentials` and `scope=https://graph.microsoft.com/.default`. Verifies that token acquisition succeeds.
  - **Explicit Architectural Boundary**: The service deliberately does **not** read email bodies or extract OTP strings automatically. The architectural design explicitly specifies that human operators must open the mailbox and manually enter 2FA verification codes to prevent automated bot detection and account lockouts.
- **Mock Mode Behavior**: Returns a simulated status with 3 unread messages and `status: 'MOCK'`.

---

### 4. Google Sheets Integration
- **Classification**: **PARTIAL / STUB**
- **Primary Source File**: `server/services/googleSheets.service.ts`
- **Secondary Usage**: `server/routes.ts` (`POST /api/sheets/sync`, `GET /api/sheets/sync/status`, `GET /api/sheets/export/csv`), `src/pages/SheetsSyncPage.tsx`
- **Underlying Service / Protocol**: Google Sheets API v4.
- **Credentials Required**:
  - `GOOGLE_SHEETS_SPREADSHEET_ID`: Target spreadsheet identifier.
  - `GOOGLE_SERVICE_ACCOUNT`: Service account email.
  - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: RSA private key.
- **Live Call Verification**:
  - The mock sync path is fully functional: pulls simulated rows, checks queue limits, and pushes updated statuses to `SheetSyncLog`.
  - The production branch (`try` block lines 133–160) generates and records a `SheetSyncLog` event, but the direct OAuth JWT exchange and REST calls to `sheets.googleapis.com/v4/spreadsheets` are stubbed.
  - CSV export (`/api/sheets/export/csv`) is **fully implemented** and functional, returning downloadable CSV content directly from the datastore.

---

### 5. Google Drive Integration
- **Classification**: **NOT IMPLEMENTED**
- **Reasoning**: No Google Drive SDK, API calls, or route handlers exist in the codebase. Document and file verification tasks are stored as references in the internal datastore rather than uploaded to Google Drive.

---

### 6. Firebase & Firestore Integration
- **Classification**: **CONFIG-READY / PARTIAL**
- **Primary Source Files**: `firestore.rules`, `firestore.indexes.json`, `firebase-blueprint.json`, `firebase.json`
- **Credentials Required**:
  - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
- **Live Call Verification**:
  - The runtime backend currently runs against `server/db/repository.ts`, which persists state atomically to `data/platform_db.json`.
  - The Firestore rules (`firestore.rules`) and schema models (`firebase-blueprint.json`) are fully authored and tested to enforce RBAC permissions across all collections when deployed to Google Cloud.
  - Direct Firestore SDK client calls from `repository.ts` are deferred in favor of file-based storage for standalone local execution.

---

### 7. Firebase Authentication
- **Classification**: **STUB / REPLACED BY NATIVE RBAC**
- **Primary Source File**: `server/services/auth.service.ts`
- **Reasoning**: The platform utilizes a native, self-contained authentication and RBAC engine:
  - Cryptographic password hashing with PBKDF2 (100,000 iterations with 64-byte salts).
  - HMAC-SHA256 JWT tokens.
  - Account lockout tracking, password complexity enforcement, and mandatory bootstrap password rotation.
  - Firebase Authentication client popups/redirects are not mounted; the platform uses its own `/api/auth/*` endpoints.

---

### 8. Scheduler & Background Workers
- **Classification**: **REAL**
- **Primary Source Files**: `server/routes.ts` (endpoints `/api/scheduler/*`), `server/services/workflowEngine.service.ts`, `server/utils/concurrencyLock.ts`
- **Live Call Verification**:
  - `POST /api/scheduler/process-queue`: Queries active sessions, computes dynamic concurrency capacity (`settings.concurrencyLimit - runningSessions`), sorts queued jobs by priority, acquires mutex lock, and auto-dispatches jobs.
  - `POST /api/scheduler/process-human-tasks`: Computes elapsed wait time on open checkpoints and dispatches escalation alerts via `telegramNotificationService`.
  - `POST /api/scheduler/check-reviews`: Evaluates applications in `UNDER_REVIEW` state against outcome timers and transitions jobs to `APPROVED` or `REJECTED`.
  - Can be invoked manually from the UI (`SystemHealthPage.tsx`) or automatically by GCP Cloud Scheduler cron triggers.

---

### 9. Deployment Architecture (Cloud Run & Docker)
- **Classification**: **REAL**
- **Primary Source Files**: `Dockerfile`, `cloudbuild.yaml`, `cloudrun.service.yaml`, `DEPLOYMENT.md`
- **Live Call Verification**:
  - Multi-stage Docker build: Stage 1 builds frontend with Vite and bundles `server.ts` with esbuild; Stage 2 assembles an Alpine Node.js 22 runtime running under non-root user `node`.
  - Health check probe configured at `/health`.
  - Memory limit set to 2GiB, CPU set to 2 vCPUs, concurrency set to 80 requests per instance.
