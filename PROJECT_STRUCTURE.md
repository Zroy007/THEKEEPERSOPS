# Project Architecture & Structural Specification

This document provides a grounded, factual architectural audit of the **Browser Workflow Operations Platform** as implemented in the codebase.

---

## 1. High-Level Architecture Overview

The system is a full-stack Node.js + React application engineered as an operations control center for antidetect browser orchestration, automated workflow management, and human-in-the-loop checkpoint verification.

- **Frontend**: Single-Page Application (SPA) built with React 19, TypeScript 5.8, Tailwind CSS v4, Lucide React icons, and Motion animation primitives.
- **Backend / API**: Express 4.21 server bundled into CommonJS via esbuild (`dist/server.cjs`) in production and run natively via `tsx server.ts` in development.
- **Database & Storage**: Dual-mode data persistence architecture featuring an in-process JSON repository (`data/platform_db.json`) for local/container operation alongside Firestore configuration assets (`firestore.rules`, `firestore.indexes.json`, `firebase-blueprint.json`) for Cloud deployment.
- **Security & RBAC**: Granular Role-Based Access Control (RBAC) with 5 roles (`SUPERADMIN`, `ADMIN`, `SUPERVISOR`, `OPERATOR`, `VIEWER`), salt-hashed passwords, JWT authorization tokens, and mandatory password change flags on initial bootstrap.

---

## 2. Directory Structure

```
├── .env.example                     # Environment template with redacted placeholders
├── .github/workflows/ci.yml         # CI pipeline (lint, test, build)
├── cloudbuild.yaml                  # GCP Cloud Build container build config
├── cloudrun.service.yaml            # Cloud Run service deployment specification
├── data/
│   └── platform_db.json             # Persistent JSON datastore (atomic disk persistence)
├── DEPLOYMENT.md                    # Production deployment runbook
├── Dockerfile                       # Multi-stage production container build
├── firebase-blueprint.json          # Firestore schema definition blueprint
├── firebase.json                    # Firebase CLI configuration
├── firestore.indexes.json           # Composite index definitions for Firestore queries
├── firestore.rules                  # Security rules enforcing RBAC on document collections
├── index.html                       # Single-page application entrypoint
├── metadata.json                    # Application metadata and runtime permissions
├── package.json                     # NPM dependency manifest and execution scripts
├── server.ts                        # Main Express backend entrypoint & Vite middleware
├── server/
│   ├── adminRoutes.ts               # Authentication, user accounts, roles, and secret routes
│   ├── config.ts                    # Central configuration wrapper with getters
│   ├── routes.ts                    # Core operational API endpoints (jobs, sessions, tasks)
│   ├── types.ts                     # Backend data contracts, interfaces, and enums
│   ├── db/
│   │   ├── repository.ts            # Data access layer with atomic disk serialization
│   │   └── seed.ts                  # Deterministic baseline data (jobs, sessions, accounts)
│   ├── middleware/
│   │   ├── auth.ts                  # JWT verification and RBAC permission enforcement
│   │   ├── errorHandler.ts          # Centralized error formatting and status translation
│   │   ├── idempotency.ts           # Request deduplication and replay prevention
│   │   └── rateLimiter.ts           # Sliding-window rate limiters for mutations and queries
│   ├── services/
│   │   ├── auth.service.ts          # PBKDF2 hashing, JWT minting/verification, role matrix
│   │   ├── gologin.service.ts       # GoLogin cloud browser REST API integration
│   │   ├── googleSheets.service.ts  # Google Sheets queue synchronization service
│   │   ├── microsoftGraph.service.ts# Azure AD / Microsoft Graph mailbox probe
│   │   ├── retryEngine.service.ts   # Error classification and exponential backoff
│   │   ├── secretProvider.service.ts# Centralized credentials and secrets manager
│   │   ├── telegram.service.ts      # Telegram Bot API notification and alert dispatcher
│   │   └── workflowEngine.service.ts# State machine, job transitions, and lifecycle dispatcher
│   ├── utils/
│   │   ├── concurrencyLock.ts       # Mutex and concurrency lock manager for job execution
│   │   ├── fetchWithTimeout.ts      # Resilient HTTP client with retry and timeout wrappers
│   │   ├── logger.ts                # Structured JSON console logger with log levels
│   │   └── sanitizer.ts             # Data sanitizer removing password/credential plaintext
│   └── validators/
│       └── schemas.ts               # Zod validation schemas for API request payloads
├── src/
│   ├── main.tsx                     # React client mounting entrypoint
│   ├── App.tsx                      # Root orchestration component, data polling, and tab router
│   ├── index.css                    # Tailwind CSS v4 entrypoint
│   ├── types/
│   │   └── index.ts                 # Frontend TypeScript interfaces, types, and enums
│   ├── styles/
│   │   └── designSystem.ts          # Centralized tokens, color palettes, and component styles
│   ├── services/
│   │   └── api.ts                   # Client-side API client wrapper with auth header injection
│   ├── components/
│   │   ├── BrowserSessionModal.tsx  # Cloud browser live stream & CDP protocol inspector
│   │   ├── DynamicSessionCard.tsx   # Visual card displaying session hardware and port
│   │   ├── ErrorBoundary.tsx        # React component tree crash boundary
│   │   ├── HumanTaskModal.tsx       # Operator modal for resolving 2FA OTP & document tasks
│   │   ├── JobDetailsModal.tsx      # Comprehensive workflow inspector, attempts & audit timeline
│   │   ├── LoginModal.tsx           # Platform sign-in dialog with credential validation
│   │   ├── Navbar.tsx               # Top navigation header with metrics, operator switch & actions
│   │   ├── Navigation.tsx           # Primary tab navigation bar with role-gated tabs
│   │   ├── NewJobModal.tsx          # Job creation modal with proxy and profile inputs
│   │   ├── PasswordChangeModal.tsx  # Mandatory password change dialog with policy checks
│   │   ├── StatusBadge.tsx          # Status tag primitive with semantic color mappings
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx        # Desktop-first operations layout shell
│   │   │   ├── Header.tsx           # Executive top search and status header
│   │   │   └── Sidebar.tsx          # Collapsible left navigation sidebar with counters
│   │   └── ui/
│   │       ├── Badge.tsx            # Semantic badge UI primitive
│   │       ├── Button.tsx           # Button UI primitive with variants and loading states
│   │       ├── ConfirmDialog.tsx    # Destructive action confirmation modal
│   │       ├── EmptyState.tsx       # Empty collection placeholder UI primitive
│   │       ├── MetricTile.tsx       # KPI summary statistic card UI primitive
│   │       ├── Modal.tsx            # Accessible modal container with ESC listener
│   │       └── Skeleton.tsx         # Content loading placeholder shimmer primitive
│   └── pages/
│       ├── AccountsPage.tsx         # User management, unlock, disable, and reset operations
│       ├── AdminPage.tsx            # Administration hub with quick management links
│       ├── ApplicationsPage.tsx     # Merchant application attempt history and reapplication
│       ├── AuditLogsPage.tsx        # Immutable chronological platform audit log viewer
│       ├── DashboardPage.tsx        # Core KPI metrics, active sessions grid, and alert banner
│       ├── HumanTasksPage.tsx       # 2FA OTP and identity verification checkpoint queue
│       ├── JobsPage.tsx             # Main job table with search, status filters, and actions
│       ├── NotificationsPage.tsx    # Dispatched alert log and Telegram test message trigger
│       ├── OperatorsPage.tsx        # Registered human operator directory and capacity
│       ├── ReportsPage.tsx          # Operations throughput charts and outcome analytics
│       ├── RetryPoliciesPage.tsx    # Technical error retry policy and backoff configuration
│       ├── RolesPage.tsx            # Role definition viewer and permission matrix
│       ├── SessionsPage.tsx         # Active cloud browser session manager and remote CDP ports
│       ├── SheetsSyncPage.tsx       # Google Sheets bi-directional synchronization monitor
│       ├── SystemHealthPage.tsx     # Deep diagnostic probes, memory, uptime, and worker triggers
│       └── SystemSettingsPage.tsx   # Comprehensive platform configuration, limits, and secrets
├── tests/
│   ├── auth.test.ts                 # Tests for password hashing, complexity, and RBAC
│   ├── queueEngine.test.ts          # Tests for dynamic concurrency and maintenance mode
│   ├── retryEngine.test.ts          # Tests for technical error classification and backoff
│   ├── superadmin.test.ts           # Tests for bootstrap account, immutability, and secrets
│   └── workflowEngine.test.ts       # Tests for state machine transitions and human checkpoints
├── tsconfig.json                    # TypeScript compiler options
└── vite.config.ts                   # Vite bundler configuration with Tailwind CSS plugin
```

---

## 3. Frontend Architecture

- **State Management**: Root state in `src/App.tsx` polling backend API at 10-second intervals (`setInterval(loadData, 10000)`), accompanied by instantaneous optimistic updates on user actions.
- **Tab-Based Navigation**: Rendered conditionally based on `activeTab` state in `src/App.tsx` and filtered dynamically by the logged-in user's `UserRole`.
- **API Communication**: Centralized HTTP client in `src/services/api.ts` wrapping `fetch` with JWT bearer authorization (`Authorization: Bearer <token>`) and operator context headers (`x-operator-id`, `x-operator-role`).
- **UI Components**: Structured into `components/ui` (primitives), `components/layout` (shells), and top-level domain modals (`JobDetailsModal`, `BrowserSessionModal`, `HumanTaskModal`).

---

## 4. Backend Architecture

- **Server Entrypoint**: `server.ts` configures JSON parsing, CORS, and mounts the unified `/api` router before serving Vite middlewares (in development) or static `dist/` bundles (in production).
- **Sub-Routers**:
  - `server/routes.ts`: Main operations router exposing jobs, sessions, tasks, attempts, metrics, and background triggers.
  - `server/adminRoutes.ts`: Auth router (`/api/auth/*`) and administrative router (`/api/admin/*`) handling users, roles, settings versions, and secret metadata.
- **Middlewares**:
  - `auth.ts`: Validates JWT tokens and validates user permissions against the permission matrix.
  - `idempotency.ts`: Detects duplicate mutating requests using cached request hashes.
  - `rateLimiter.ts`: In-memory token-bucket limiter throttling burst requests.
  - `errorHandler.ts`: Catches unhandled errors and maps domain errors to consistent JSON payloads.

---

## 5. Database Architecture

- **Runtime Datastore**: `server/db/repository.ts` operates an in-memory datastore backed by atomic file-based persistence at `data/platform_db.json`. Any write invokes an atomic write with file backup to guarantee persistence across container reboots.
- **Firestore Readiness**:
  - `firestore.rules`: Defines role-based security rules for all 10 platform collections.
  - `firestore.indexes.json`: Configures composite indexes for sorting and compound filtering.
  - `firebase-blueprint.json`: Documents the target collection schema models.

---

## 6. Authentication & RBAC

- **Password Cryptography**: Salted PBKDF2 hashing (`crypto.pbkdf2Sync` with 100,000 iterations, 64-byte key length, and SHA-512).
- **Session Tokens**: HMAC-SHA256 JWT tokens containing `uid`, `email`, `role`, and `mustChangePassword` claims.
- **Bootstrap Super Admin**: Provisioned with email `SUPERADMIN_EMAIL` and `mustChangePassword: true`. Initial login forces redirection to `PasswordChangeModal`.
- **RBAC Matrix**: 5 hierarchical roles mapped to granular permissions:
  - `SUPERADMIN`: Full administrative control, role assignment, secret management.
  - `ADMIN`: User management, settings updates, policy modifications.
  - `SUPERVISOR`: Job prioritization, human task assignment, review overrides.
  - `OPERATOR`: Job creation, session control, human task resolution.
  - `VIEWER`: Read-only access to dashboards, jobs, and reports.

---

## 7. Workflow Engine & State Machine

- **Implementation**: `server/services/workflowEngine.service.ts`.
- **Deterministic State Graph**:
  `QUEUED` → `INITIALIZING_BROWSER` → `NAVIGATING_PORTAL` → `FORM_FILLING` → `WAITING_FOR_EMAIL_OTP` | `WAITING_FOR_IDENTITY_DOC` | `WAITING_FOR_SELFIE` | `WAITING_FOR_PHONE_OTP` → `READY_FOR_SUBMISSION` → `SUBMITTED` → `UNDER_REVIEW` → `APPROVED` | `REJECTED` | `MANUAL_REVIEW` | `PAUSED` | `ERROR`.
- **Human Checkpoint Decoupling**: When entering any `WAITING_FOR_*` state, the engine creates a `HumanTask` entry, halts browser automation, sends a Telegram alert, and waits for explicit operator resolution via the UI.

---

## 8. Scheduler & Worker Architecture

- **Queue Worker** (`POST /api/scheduler/process-queue`): Computes dynamic concurrency capacity:
  `availableSlots = settings.concurrencyLimit - runningSessionsCount`.
  Selects highest priority queued jobs and dispatches cloud browser sessions.
- **Human Task Worker** (`POST /api/scheduler/process-human-tasks`): Scans pending human checkpoints, calculates elapsed time, and dispatches escalating Telegram reminders.
- **Review Check Worker** (`POST /api/scheduler/check-reviews`): Checks pending applications under review against merchant portal statuses and transitions approved/rejected jobs.

---

## 9. Integrations System

- **GoLogin Service** (`server/services/gologin.service.ts`): Creates anti-detect browser profiles, launches remote cloud containers, and controls sessions via REST API.
- **Telegram Service** (`server/services/telegram.service.ts`): Delivers alerts and OTP reminders with deduplication to prevent notification spam.
- **Microsoft Graph Service** (`server/services/microsoftGraph.service.ts`): Verifies Azure AD OAuth connectivity and monitors authorized mailboxes without scraping private OTP codes.
- **Google Sheets Service** (`server/services/googleSheets.service.ts`): Provides bidirectional queue sync and reporting exports.
- **Mock Mode Fallback**: Controlled by `MOCK_MODE=true` in `.env.example` or the `mockMode` system setting. When enabled, all third-party integrations execute deterministic local simulations without contacting external networks.

---

## 10. Deployment Architecture

- **Docker**: Multi-stage `Dockerfile` creating an Alpine Node.js 22 runtime image running as a non-privileged `node` user.
- **Cloud Run**: Configured via `cloudrun.service.yaml` with port 3000, 2GiB memory, 2 vCPUs, and auto-scaling from 0 to 10 instances.
- **Cloud Build**: Automated container builds specified in `cloudbuild.yaml`.
