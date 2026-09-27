# Important Architectural Notes, Known Gaps & Security Considerations

This document provides a transparent, technical disclosure of the platform's current architectural state, known implementation gaps, security practices, and recommended audit inspection points.

---

## 1. Known Architectural Gaps & Implementation Status

### 1.1 Dual-Datastore Strategy (Firestore vs. Local JSON)
- **Current Reality**: The live runtime database (`server/db/repository.ts`) stores and persists state into a local JSON file at `data/platform_db.json` using synchronous, atomic filesystem writes (`fs.writeFileSync`).
- **Cloud Firestore State**: Security rules (`firestore.rules`), composite index schemas (`firestore.indexes.json`), and schema blueprints (`firebase-blueprint.json`) are fully authored and tested. However, the Express backend has not yet replaced the file repository with the official `@google-cloud/firestore` SDK client.
- **Auditor Note**: If deploying to a multi-instance, horizontally scaled Google Cloud Run environment without sticky sessions or a shared volume, instances will have independent local datastores unless Firestore SDK synchronization or a Cloud SQL backend is mounted.

### 1.2 Google Sheets Live API Integration (Stubbed OAuth JWT vs. Mock)
- **Current Reality**: When `MOCK_MODE=true` or when Google Service Account credentials are missing, the Google Sheets service performs simulated bidirectional synchronization with strict queue limits and idempotency checks.
- **Production Branch**: In `server/services/googleSheets.service.ts` (lines 130–160), the production branch records a `SheetSyncLog` entry, but the raw RSA private key signing and REST requests to `sheets.googleapis.com/v4/spreadsheets` are not fully implemented.
- **CSV Fallback**: The platform provides a complete, production-ready CSV export endpoint (`/api/sheets/export/csv`) that streams current queue and attempt data directly to operators.

### 1.3 Deliberate Boundary on Microsoft Graph / Outlook Automation
- **Architectural Decision**: `MicrosoftGraphService` performs real OAuth 2.0 Client Credentials token acquisition against `login.microsoftonline.com` to verify mailbox health, but it **deliberately does not scrape or extract email bodies or OTP codes**.
- **Rationale**: Merchant fraud detection algorithms flag automated headless browser sessions that instantly inject verification codes without human delay. Requiring a human operator to view the email and input the OTP code ensures safe, authentic human-in-the-loop operation.

---

## 2. Security Considerations & Protections

### 2.1 Credential & Secret Management
- **Zero-Plaintext Exposure**: All secrets managed by `SecretProvider` (`GOLOGIN_API_TOKEN`, `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, etc.) are masked as `••••••••••••••••` when queried via the API (`/api/admin/secrets`). Only metadata (`key`, `description`, `category`, `isSet`, `lastUpdated`) is exposed to the frontend.
- **Environment Variables**: Never commit `.env` to version control. The template `.env.example` contains only redacted placeholders.

### 2.2 Password Cryptography & Account Security
- **PBKDF2 Hashing**: User passwords are encrypted using Node.js `crypto.pbkdf2Sync` with 100,000 iterations, 64-byte salts, and SHA-512.
- **Account Lockout Policy**: After 5 consecutive failed login attempts, user accounts are automatically locked. Only an administrator can unlock them via `POST /api/admin/users/:id/unlock`.
- **Mandatory Password Rotation**: The initial bootstrap Super Admin account is provisioned with `mustChangePassword: true`. The frontend immediately blocks navigation and forces the user into `PasswordChangeModal` until updated.

### 2.3 Role-Based Access Control (RBAC)
- **Server-Authoritative**: Permissions are enforced at the HTTP middleware layer (`server/middleware/auth.ts`) via `requireRole()` and `requirePermission()`. Client-side tab hiding is purely a visual affordance; direct API requests are strictly validated.

---

## 3. Deployment Assumptions & Container Constraints

- **Container Port**: The Dockerfile and Cloud Run service specification bind exclusively to port `3000` (`PORT=3000`).
- **Non-Privileged User**: The production image runs as user `node` (UID 1000) for security hardening.
- **Ephemeral Storage**: In Google Cloud Run, file writes to `data/platform_db.json` are held in memory-backed tmpfs. For production deployments requiring durable cross-instance persistence across container scaling, connect the app to Cloud Firestore or a Cloud SQL instance.

---

## 4. What an External Auditor Should Inspect First

1. **`server/services/workflowEngine.service.ts`**: Verify state machine transitions, human checkpoint decoupling, and attempt immutability.
2. **`server/middleware/auth.ts` and `server/services/auth.service.ts`**: Verify PBKDF2 salt hashing, JWT validation, and RBAC permission checks.
3. **`server/services/secretProvider.service.ts`**: Inspect secret masking and metadata exposure to confirm that credentials cannot be leaked to the client.
4. **`server/db/repository.ts`**: Review the data access layer, atomic file synchronization, and database locking.
5. **`firestore.rules`**: Review Firestore security rules for role-based authorization across all 10 document collections.
6. **`tests/`**: Run `npm test` to verify the 24 automated unit tests covering concurrency, retry logic, RBAC, and workflow states.
