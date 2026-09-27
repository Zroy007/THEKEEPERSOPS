# Extensible Workflow Lifecycle Architecture

## 1. Overview & Architectural Philosophy

The **Workflow Operations Platform** orchestrates human-in-the-loop multi-step merchant registration and shop onboarding pipelines. In high-concurrency browser automation and compliance operations:

> **Core Principle**: Shop/application creation is only one phase of a longer operational lifecycle.

The system departs from flat, monolithic job state machines in favor of an **extensible, hierarchical lifecycle engine**. The platform accommodates:
- Multi-phase progression (preparatory credential staging, anti-detect browser container provisioning, registration form navigation, human security checkpoints, application submission, merchant review polling, and post-approval store management).
- Explicit human governance over all sensitive identity and multi-factor verification checkpoints (Email OTP, SMS/Phone OTP, government identification documents, biometric selfies).
- Complete historical auditability where past attempts, execution durations, and step runs are preserved immutably.
- Future extensibility allowing operators and administrators to register new automation steps or verification checkpoints dynamically without altering database schemas or rewriting the workflow core.
- Strict operational separation between the **canonical production database** (high-integrity transactional state store) and **operator-facing Google Sheets** (collaborative reporting and intake surface).

---

## 2. The Entity Hierarchy

The platform organizes operational execution into a four-tier entity hierarchy:

```
+-------------------------------------------------------------------------+
|                                  JOB                                    |
|   (Root entity: shopName, email, proxyRef, priority, tags, status)      |
+-------------------------------------------------------------------------+
                                     |
                                     | 1..*
                                     v
+-------------------------------------------------------------------------+
|                          APPLICATION ATTEMPT                            |
|   (Attempt #1, Attempt #2...: submittedAt, finalStatus, rejectionReason)|
+-------------------------------------------------------------------------+
                                     |
                                     | 1..1
                                     v
+-------------------------------------------------------------------------+
|                              WORKFLOW RUN                               |
|   (Execution instance: runNumber, status, currentStepId, startedAt)    |
+-------------------------------------------------------------------------+
                                     |
                                     | 1..*
                                     v
+-------------------------------------------------------------------------+
|                                STEP RUN                                 |
|   (Step execution: stepId, phase, type, status, actor, input/output)    |
+-------------------------------------------------------------------------+
                                     |
                          0..1 (if HUMAN_CHECKPOINT)
                                     v
+-------------------------------------------------------------------------+
|                               HUMAN TASK                                |
|   (Human checkpoint: taskType, assignedOperator, resolutionPayload)    |
+-------------------------------------------------------------------------+
```

### Entity Definitions & Responsibilities

1. **Job (`Job`)**:
   - The root business record representing a specific shop application.
   - Contains immutable configuration references (`jobId`, `shopName`, `email`, `passwordReference`, `proxyReference`).
   - Tracks current high-level status (`status`), sub-status (`subStatus`), human action alerts (`humanAction`), and retry counters (`retryCount`, `maxRetries`).
   - Maintains pointer to active attempt number (`currentAttemptNo`) and active workflow run (`currentWorkflowRunId`).

2. **Application Attempt (`ApplicationAttempt`)**:
   - Represents an official submission lifecycle to the target merchant platform.
   - Preserves sequential numbering (`attemptNo`: 1, 2, 3...) and submission timestamps.
   - When rejected by compliance or review systems, records the exact rejection reason and compliance timestamp.
   - **Immutability Guarantee**: Existing attempts are strictly read-only once closed. Reapplication spawns a new Attempt with incremented `attemptNo` and never overwrites prior attempt data.

3. **Workflow Run (`WorkflowRun`)**:
   - Encapsulates a distinct end-to-end execution of the pipeline associated with an Attempt.
   - Tracks runtime lifecycle states: `INITIALIZING`, `RUNNING`, `AWAITING_HUMAN`, `PAUSED`, `COMPLETED`, `FAILED`, `CANCELLED`.
   - Links directly to the `attemptId` and maintains start, pause, resume, and completion timestamps.

4. **Step Run (`StepRun`)**:
   - Records the discrete execution of a single workflow step defined in the `WorkflowStepRegistry`.
   - Attributes:
     - `stepId`: Unique identifier matching a registered `WorkflowStepDefinition`.
     - `phase`: Pipeline phase (`PREPARATION`, `SESSION_SETUP`, `REGISTRATION`, `HUMAN_VERIFICATION`, `SUBMISSION`, `REVIEW`, `POST_APPROVAL`).
     - `stepType`: `AUTOMATED` | `HUMAN_CHECKPOINT` | `EXTERNAL_POLL` | `MANUAL_TASK`.
     - `status`: `PENDING` | `RUNNING` | `AWAITING_HUMAN` | `COMPLETED` | `FAILED` | `SKIPPED` | `PAUSED`.
     - `actor`: Identification of the executing entity (e.g. `GOLOGIN_WORKER`, `AUTOMATION_RUNNER`, `OP-003`).
     - `startedAt`, `completedAt`: Precise ISO timestamps measuring step latency.
     - `inputPayload` & `outputPayload`: Structured metadata (e.g., OTP validation confirmation, session IDs, verification outcome).
     - `logs`: Append-only chronological trace of log statements generated during step execution.

5. **Human Task (`HumanTask`)**:
   - Created whenever a `StepRun` of type `HUMAN_CHECKPOINT` is triggered.
   - Assigned to an operator with defined task timeouts, automated escalation timers, and Telegram notification alerts.
   - Resolving the task populates the `StepRun.outputPayload` and advances the workflow run.

---

## 3. Workflow Phases & Progression Lifecycle

The platform structures operations into logical, sequential phases:

```
[ PHASE 1: PREPARATION ]
   ├── Step: step_account_prep (Credential allocation, security checks)
   └── Status: PREPARING

[ PHASE 2: SESSION_SETUP ]
   ├── Step: step_profile_setup (GoLogin anti-detect fingerprint container)
   ├── Step: step_proxy_validation (Residential proxy latency & pool check)
   ├── Step: step_browser_startup (Container launch & remote debugging attach)
   └── Status: PROFILE_CREATED -> PROXY_CHECKING -> PROXY_READY -> BROWSER_STARTING -> BROWSER_READY

[ PHASE 3: REGISTRATION ]
   ├── Step: step_registration_start (Portal navigation & field population)
   ├── Step: step_password_credentials (Vault secret application)
   └── Status: SIGNUP_STARTED -> PASSWORD_STAGE -> REGISTRATION_CONTINUING

[ PHASE 4: HUMAN_VERIFICATION ]
   ├── Step: step_email_otp_checkpoint (Email 2FA OTP verification)
   ├── Step: step_phone_otp_checkpoint (SMS verification)
   ├── Step: step_identity_verification (Government ID & biometric selfie)
   └── Status: WAITING_FOR_EMAIL_OTP / WAITING_FOR_PHONE_OTP / HUMAN_IDENTITY_VERIFICATION

[ PHASE 5: SUBMISSION ]
   ├── Step: step_final_submission (Final review & packet dispatch)
   └── Status: READY_FOR_SUBMISSION -> SUBMITTED

[ PHASE 6: REVIEW ]
   ├── Step: step_review_monitoring (Automated approval/rejection polling)
   └── Status: WAITING_FOR_REVIEW -> APPROVED / REJECTED

[ PHASE 7: POST_APPROVAL (Extensible) ]
   ├── Step: step_store_onboarding (Catalog setup, payout routing)
   └── Status: APPROVED -> STORE_CONFIGURED
```

---

## 4. The Human Checkpoint Model

### Security Guarantees & Verification Integrity
1. **Zero Automated Extraction of OTPs or Identity Documents**:
   - The platform strictly forbids automatic extraction, scraping, or programmatic cycling of OTP codes, SMS messages, government IDs, or selfies.
   - All security gates require an authorized operator to inspect authorized communication channels (such as authorized Microsoft Graph/Outlook mailboxes) and manually confirm the verification token.
2. **Credential Sanitization**:
   - Real passwords, proxy credentials, OTP codes, and biometric photos are never logged in plain text or transmitted across external webhook or notification channels (Telegram, Sheets).
   - Secret references (`sec://vault/...`) and masked credentials protect operational security.
3. **Execution Pause & Task Linkage**:
   - Upon entering a human checkpoint (e.g. `WAITING_FOR_EMAIL_OTP`), the `WorkflowEngine`:
     1. Transitions Job status to the checkpoint state and sets `subStatus = 'AWAITING_HUMAN'`.
     2. Sets `WorkflowRun.status = 'AWAITING_HUMAN'`.
     3. Creates a `StepRun` with `stepType = 'HUMAN_CHECKPOINT'` and `status = 'AWAITING_HUMAN'`.
     4. Generates an open `HumanTask` assigned to an operator or pool.
     5. Halts browser automation loops and notifies operators via Telegram.
4. **Flexible, Configurable Resumption Routing**:
   - **Crucial Rule**: The destination status after completing a human task is **never hardcoded** to `READY_FOR_SUBMISSION`.
   - Operators can supply a custom target status via `payload.nextStatus` (e.g., returning to `PASSWORD_STAGE` or continuing to `REGISTRATION_CONTINUING`).
   - If omitted, the workflow advances to the registered `defaultNextStepId` configured in the step definition.

---

## 5. Transition State Machine & Error Classification

### Deterministic State Transitions
Transitions are validated against `VALID_TRANSITIONS` inside `server/services/workflowEngine.service.ts`:

```typescript
export const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  NEW: ['QUEUED', 'PREPARING', 'ERROR', 'CANCELLED'],
  QUEUED: ['PREPARING', 'PAUSED', 'CANCELLED'],
  PREPARING: ['PROFILE_CREATED', 'ERROR', 'RETRY_PENDING', 'MANUAL_REVIEW', 'PAUSED'],
  PROFILE_CREATED: ['PROXY_CHECKING', 'PROXY_READY', 'ERROR', 'RETRY_PENDING', 'MANUAL_REVIEW', 'PAUSED'],
  PROXY_CHECKING: ['PROXY_READY', 'ERROR', 'RETRY_PENDING', 'MANUAL_REVIEW', 'PAUSED'],
  PROXY_READY: ['BROWSER_STARTING', 'ERROR', 'RETRY_PENDING', 'MANUAL_REVIEW', 'PAUSED'],
  BROWSER_STARTING: ['BROWSER_READY', 'ERROR', 'RETRY_PENDING', 'MANUAL_REVIEW', 'PAUSED'],
  BROWSER_READY: ['SIGNUP_STARTED', 'ERROR', 'RETRY_PENDING', 'MANUAL_REVIEW', 'PAUSED'],
  SIGNUP_STARTED: [
    'WAITING_FOR_EMAIL_OTP',
    'WAITING_FOR_PHONE_OTP',
    'HUMAN_IDENTITY_VERIFICATION',
    'PASSWORD_STAGE',
    'REGISTRATION_CONTINUING',
    'READY_FOR_SUBMISSION',
    'ERROR',
    'RETRY_PENDING',
    'MANUAL_REVIEW',
    'PAUSED',
  ],
  WAITING_FOR_EMAIL_OTP: ['HUMAN_ACTION_COMPLETED', 'READY_FOR_SUBMISSION', 'PASSWORD_STAGE', 'ERROR', 'PAUSED', 'MANUAL_REVIEW'],
  WAITING_FOR_PHONE_OTP: ['HUMAN_ACTION_COMPLETED', 'READY_FOR_SUBMISSION', 'ERROR', 'PAUSED', 'MANUAL_REVIEW'],
  HUMAN_IDENTITY_VERIFICATION: ['HUMAN_ACTION_COMPLETED', 'READY_FOR_SUBMISSION', 'ERROR', 'PAUSED', 'MANUAL_REVIEW'],
  HUMAN_ACTION_COMPLETED: ['SIGNUP_STARTED', 'PASSWORD_STAGE', 'REGISTRATION_CONTINUING', 'READY_FOR_SUBMISSION', 'ERROR', 'PAUSED'],
  PASSWORD_STAGE: ['REGISTRATION_CONTINUING', 'WAITING_FOR_EMAIL_OTP', 'READY_FOR_SUBMISSION', 'ERROR', 'RETRY_PENDING', 'PAUSED'],
  REGISTRATION_CONTINUING: ['READY_FOR_SUBMISSION', 'WAITING_FOR_EMAIL_OTP', 'HUMAN_IDENTITY_VERIFICATION', 'ERROR', 'RETRY_PENDING', 'PAUSED'],
  READY_FOR_SUBMISSION: ['SUBMITTED', 'PAUSED', 'CANCELLED', 'ERROR'],
  SUBMITTED: ['WAITING_FOR_REVIEW', 'UNDER_MANUAL_REVIEW', 'APPROVED', 'REJECTED', 'ERROR'],
  WAITING_FOR_REVIEW: ['APPROVED', 'REJECTED', 'UNDER_MANUAL_REVIEW', 'ERROR'],
  UNDER_MANUAL_REVIEW: ['APPROVED', 'REJECTED', 'ERROR'],
  APPROVED: ['STORE_CONFIGURED'],
  REJECTED: ['QUEUED', 'MANUAL_REVIEW'],
  RETRY_PENDING: ['QUEUED', 'PREPARING', 'ERROR', 'MANUAL_REVIEW', 'PAUSED'],
  ERROR: ['QUEUED', 'PREPARING', 'MANUAL_REVIEW', 'CANCELLED'],
  MANUAL_REVIEW: ['QUEUED', 'PREPARING', 'READY_FOR_SUBMISSION', 'CANCELLED'],
  PAUSED: ['QUEUED', 'PREPARING', 'PROFILE_CREATED', 'PROXY_READY', 'BROWSER_READY', 'SIGNUP_STARTED', 'WAITING_FOR_EMAIL_OTP', 'READY_FOR_SUBMISSION', 'CANCELLED'],
  CANCELLED: ['QUEUED'],
  STORE_CONFIGURED: [],
};
```

### Technical vs Business Error Classification

The system utilizes strict, policy-driven error classification:

| Error Category | Examples | Retryable? | Behavior |
| :--- | :--- | :--- | :--- |
| **Technical Errors** | `PROXY_ERROR`, `ERR_PROXY_TIMEOUT`, `BROWSER_START_TIMEOUT`, `ERR_GOLOGIN_STARTUP`, `NETWORK_TIMEOUT` | **YES** | Increments `retryCount`. Calculates exponential backoff with jitter (`delay = min(maxDelay, initialDelay * (multiplier ^ retryCount))`). Transitions to `RETRY_PENDING`. Auto-resumes when backoff window elapses. |
| **Exhausted Retries** | When `retryCount >= policy.maxRetries` | **NO** | Halts automated retries. Transitions Job to `MANUAL_REVIEW`. Preserves full error context for supervisor audit. |
| **Business / Identity Errors** | `IDENTITY_DOCUMENT_REJECTED`, `TAX_ID_INVALID`, `DUPLICATE_BUSINESS_NAME`, `PHONE_BLACKLISTED` | **STRICTLY NO** | Immediate transition to `MANUAL_REVIEW` or `REJECTED`. Automation never cycles credentials automatically. |

---

## 6. Reapplication Model & History Preservation

When an application is rejected by platform compliance:
1. **Immutable Attempt #1**:
   - Status marked `REJECTED` with timestamp and compliance reason (e.g., *"Tax ID document missing proof of incorporation"*).
   - The associated `WorkflowRun` and all `StepRun`s are closed and permanently preserved.
2. **Reapplication Initialization**:
   - An authorized supervisor or operator calls `workflowEngine.createReapplicationAttempt(jobId, actor)`.
   - The Job counter increments: `currentAttemptNo = 2`.
   - A new `ApplicationAttempt` (Attempt #2) is persisted with status `PENDING`.
   - A new `WorkflowRun` (Run #2) is initialized with `status = 'RUNNING'` and `runNumber = 2`.
   - The Job transitions to `QUEUED`, ready for worker pickup.
3. **Audit Compliance**:
   - Querying `GET /jobs/:jobId/workflow-runs` or viewing the Job Details modal presents both Attempt #1 and Attempt #2 side by side.
   - Operational logs, durations, and operator notes from previous attempts remain 100% accessible.

---

## 7. Dynamic Future-Step Extensibility

To prevent codebase bloat and avoid schema migrations as merchant onboarding requirements evolve, steps are decoupled into the **WorkflowStepRegistry**.

### Registering a New Step

Operators can register new custom automated steps or human checkpoints via API (`POST /workflow/steps`) or programmatic service call:

```typescript
import { workflowEngine } from './workflowEngine.service.js';

workflowEngine.registerWorkflowStep({
  stepId: 'step_tax_id_verification',
  name: 'Tax ID & EIN Document Review',
  phase: 'HUMAN_VERIFICATION',
  type: 'HUMAN_CHECKPOINT',
  requiredPermission: 'OPERATOR',
  timeoutMinutes: 90,
  allowedNextStepIds: ['step_bank_payout_linking', 'step_final_submission'],
  defaultNextStepId: 'step_bank_payout_linking',
  description: 'Operator manually validates State LLC articles and IRS EIN confirmation letter.',
  humanInstructions: 'Inspect PDF attachments in secure vault and verify registered legal entity name matches IRS filing.',
  isSystemStep: false,
});
```

### Extensibility Guarantees:
- **No Schema Migrations**: `StepRun` stores polymorphic `inputPayload` and `outputPayload` objects as JSON/document fields.
- **No Engine Rewrites**: Step transition logic dynamically evaluates the registered step catalog. If a step is unmapped, the engine logs execution without throwing unhandled exceptions.
- **Dynamic UI Rendering**: The dashboard Job Details modal introspects `stepRuns` dynamically, displaying custom step names, badges, payloads, and logs automatically.

---

## 8. Google Sheets Integration Architecture

### Strategic Role & Boundary
- **Canonical Source of Truth**: The internal database (`server/db/repository.ts` / Firestore) is the **sole source of truth** for real-time runtime state, session locks, secrets, and task dispatching.
- **Operator Surface**: Google Sheets operates as a **read-mostly / reporting and batch ingestion interface** for external stakeholders and data entry operators.

```
+---------------------------+                +---------------------------+
|    PRODUCTION DATABASE    | <============> |       GOOGLE SHEETS       |
|  (Canonical State & Runs) |  Sync Service  | (Reporting & Batch Intake)|
+---------------------------+                +---------------------------+
  - Job State Machine                          - Master Queue Sheet
  - WorkflowRuns & StepRuns                    - Application Logs Sheet
  - Anti-detect Session Locks                  - Operators & Session Log
  - Vault Secret URIs                          - System Health & KPIs
```

### Multi-Tab Sheet Schema Design

1. **`MasterQueue`**:
   - Columns: `Job ID`, `Shop Name`, `Email`, `Password Reference`, `Proxy Reference`, `Status`, `Sub-Status`, `Human Action`, `Priority`, `Run Mode`, `Operator`, `Created At`, `Updated At`, `Retry Count`, `Current Attempt No`.
   - **Ingestion Policy**: Only rows with `Status = 'QUEUED'` or `NEW` and without existing `Job ID` are ingested as new jobs. Existing jobs are synchronized based on last-updated timestamps (DB authoritative).
2. **`ApplicationLogs`**:
   - Append-only submission and rejection event logs for compliance reporting.
   - Columns: `Timestamp`, `Job ID`, `Attempt No`, `Final Status`, `Rejection Reason`, `Actor`.
3. **`SessionRegistry`**:
   - Real-time snapshot of cloud anti-detect browser container sessions.
   - Columns: `Session ID`, `Job ID`, `Operator ID`, `Browser PID`, `Started At`, `Status`, `Port`.
4. **`WorkflowStepRuns` (Audit Stream)**:
   - Chronological stream of executed step runs, recording durations and actors for operational KPI analysis.

### Idempotency & Conflict Resolution Principles
1. **Idempotency Keys**:
   - Sync operations generate deterministic idempotency keys (`SYNC-${timestamp}-${sheetName}`). Duplicate rows with identical `Job ID` or attempt numbers are merged or rejected.
2. **Database Supremacy in Conflicts**:
   - If an operator manually edits a job's status cell in Google Sheets while the automation worker is actively running in the database, the **Database state wins** to prevent state machine corruption.
3. **Credential & Secret Protection**:
   - Passwords and proxy credentials in Google Sheets are **strictly stored as vault URIs** (`sec://vault/...`). Raw plaintext passwords, OTP verification codes, and identity document images are **NEVER written to Google Sheets**.
4. **Sync Audit Logs**:
   - Every sync cycle records rows processed, inserted, updated, and errors in the `SheetSyncLog` table for complete operational transparency.
