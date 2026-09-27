# Browser Workflow Operations Platform

A production-ready, configurable, human-in-the-loop browser workflow automation and operations platform with dynamic capacity management, deterministic state machine, append-only audit trail, and zero-bypass human checkpoints.

---

## 🌟 Architecture & Core Principles

1. **Zero-Bypass Human Checkpoint Mandate**:
   - Automated workflows halt cleanly at critical human checkpoints (such as 6-digit Email OTP, Identity Document Verification, Biometric verification, and Live Selfie checks).
   - The platform never bypasses or auto-reads sensitive credentials or OTPs. Instead, it creates an explicit `HumanTask`, keeps the browser session alive, alerts operators via Telegram, and waits for manual verification in the dashboard before resuming.

2. **Deterministic State Machine & Concurrency Control**:
   - All workflow transitions obey a strictly enforced directed graph in `server/services/workflowEngine.service.ts`.
   - Concurrency locking (`lockManager`) prevents race conditions and ensures two workers never process the same job concurrently.
   - Every transition generates an append-only, immutable audit log with actor ID, timestamp, prior status, and new status.

3. **Dynamic Concurrency & Queue Capacity**:
   - `availableCapacity` is calculated in real-time as `concurrencyLimit - activeSessions`.
   - The queue manager dynamically dispatches queued jobs up to available capacity, pausing when limits are reached or when maintenance mode is engaged.

4. **Multi-Attempt Reapplication History**:
   - Prior application attempts and rejection causes are stored as immutable records (`/application_attempts/{attemptId}`).
   - Reapplications increment `currentAttemptNo` (e.g. Attempt #2, #3) without overwriting historical submission data.

5. **Configurable Technical Retry Engine**:
   - Technical errors (e.g. `PROXY_ERROR`, `BROWSER_START_TIMEOUT`, `NETWORK_TIMEOUT`) are retried automatically with exponential backoff and randomized full jitter.
   - Business and identity errors (`IDENTITY_VERIFICATION_FAILED`, `AUTHENTICATION_FAILED`, `APPLICATION_REJECTED`, `FRAUD_FLAG_SUSPENDED`) are strictly non-retryable and route directly to `MANUAL_REVIEW`.

6. **Role-Based Access Control (RBAC) & Data Sanitization**:
   - Granular roles: `SUPERADMIN`, `ADMIN`, `SUPERVISOR`, `OPERATOR`, `VIEWER`.
   - Dedicated Super Admin administration layer with account lifecycle management, custom role creation, system configuration versioning with one-click rollback, and masked secret inspection.
   - Bootstrap account: `zakwanrhmn@gmail.com` with mandatory first-login password rotation, permanent password hash storage via scrypt, and invalidation of initial credentials.
   - Sensitive credentials, proxy passwords, verification tokens, and OTPs are redacted and sanitized before reaching clients or log streams.

---

## 🛡️ Super Admin & Security Administration

The platform includes an enterprise-grade administration layer:
* **Bootstrap Account**: The initial deployment initializes `zakwanrhmn@gmail.com` with temporary bootstrap credentials.
* **Mandatory Password Rotation**: On first login, access to standard platform functionality is blocked until the Super Admin changes their password. The temporary credential is invalidated immediately upon successful change.
* **Password Security**: Passwords are saved as cryptographically salted scrypt hashes (`passwordSalt` + `passwordHash`) and are never stored in plaintext, never logged, and never returned in API payloads.
* **Account Management**: Full CRUD for operator accounts, password reset generation, role assignment, and account activation/deactivation. The last active `SUPERADMIN` cannot be deleted or demoted.
* **System Roles & Permissions**: Built-in system roles (`SUPERADMIN`, `ADMIN`, `SUPERVISOR`, `OPERATOR`, `VIEWER`) are protected against accidental deletion. Custom roles can be created with granular permission assignments.
* **Centralized Secret Provider**: Environment secrets are centralized in `SecretProvider`. Secret metadata (masked values, source, status) is visible to Super Admins, while actual plaintext secrets remain strictly server-side.
* **Settings Versioning & Rollback**: Every modification to platform configuration records a timestamped version snapshot with actor metadata, enabling instant one-click rollback to any previous version.

---

## 📋 Technology Stack

* **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion.
* **Backend**: Express on Node.js 22, TypeScript, tsx, esbuild.
* **Data Persistence**: Google Cloud Firestore with security rules (`firestore.rules`), composite indexes (`firestore.indexes.json`), and file-based JSON persistence fallback.
* **Integrations**: GoLogin Cloud Browser API, Telegram Bot API, Microsoft Graph (Outlook), Google Sheets API.
* **Containerization**: Multi-stage `Dockerfile` configured for Google Cloud Run (Port 3000).

---

## 🔐 External Integrations & Credentials Guide

All credentials are consumed **server-side only** and must never be exposed to the browser:

### 1. GoLogin API (`GOLOGIN_API_TOKEN`)
* Create an account at [gologin.com](https://gologin.com).
* Navigate to **Settings** -> **API Data**.
* Generate a new API token and assign it to `GOLOGIN_API_TOKEN`.
* The platform manages multi-accounting browser fingerprints via GoLogin REST API and launches cloud browser instances via `GOLOGIN_CLOUD_URL`.

### 2. Telegram Bot (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_DEFAULT_CHAT_ID`)
* Open Telegram and search for `@BotFather`.
* Send `/newbot`, follow the instructions, and copy the HTTP API token to `TELEGRAM_BOT_TOKEN`.
* Add your bot to an operations Telegram group or channel.
* Add `@userinfobot` or `@RawDataBot` to the group to obtain the group Chat ID (e.g. `-100xxxxxxxxxx`).
* Set `TELEGRAM_DEFAULT_CHAT_ID=-100xxxxxxxxxx`.

### 3. Microsoft Graph / Outlook (`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AUTHORIZED_OUTLOOK_MAILBOX`)
* Go to the [Microsoft Entra / Azure Portal](https://portal.azure.com/).
* Navigate to **App Registrations** -> **New registration**.
* Note the **Directory (tenant) ID** (`AZURE_TENANT_ID`) and **Application (client) ID** (`AZURE_CLIENT_ID`).
* Under **Certificates & secrets**, generate a new client secret (`AZURE_CLIENT_SECRET`).
* Under **API permissions**, add `Microsoft Graph` -> **Application permissions** -> `Mail.Read`. Click **Grant admin consent**.
* Set `AUTHORIZED_OUTLOOK_MAILBOX` to the email of the operational mailbox receiving review notices.

### 4. Google Sheets API (`GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_KEY`)
* Go to the [Google Cloud Console](https://console.cloud.google.com/).
* Enable **Google Sheets API**.
* Create a Service Account under **IAM & Admin** -> **Service Accounts**.
* Create a JSON key for this Service Account. Copy `client_email` to `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `private_key` to `GOOGLE_SERVICE_ACCOUNT_KEY`.
* Create a Google Sheet and share it with `GOOGLE_SERVICE_ACCOUNT_EMAIL` with **Editor** role.
* Copy the Spreadsheet ID from the URL (`https://docs.google.com/spreadsheets/d/<ID>/edit`) to `GOOGLE_SHEETS_SPREADSHEET_ID`.

### 5. Firebase & Firestore (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIRESTORE_DATABASE_ID`)
* In Firebase Console, go to **Project Settings** -> **Service accounts**.
* Click **Generate new private key** and download the credentials JSON.
* Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` accordingly.
* `FIRESTORE_DATABASE_ID` defaults to `(default)`.

### 6. Gemini AI (`GEMINI_API_KEY`)
* If AI-assisted extraction is enabled, obtain an API key from [Google AI Studio](https://aistudio.google.com/).
* Set `GEMINI_API_KEY` as a server-side environment variable.

---

## 🛠 Developer Step-by-Step Guide

Follow these 10 exact steps to set up, test, build, deploy, and configure the platform:

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-org/workflow-operations-platform.git
cd workflow-operations-platform
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
```bash
cp .env.example .env
```
Edit `.env` with your editor of choice. For initial local development, keep `MOCK_MODE=true` to test the state machine, queue engine, and operator dashboard without external API keys.

### Step 4: Configure Firebase
Install the Firebase CLI and deploy security rules and indexes:
```bash
npm install -g firebase-tools
firebase login
firebase use --add YOUR_FIREBASE_PROJECT_ID
firebase deploy --only firestore:rules,firestore:indexes
```

### Step 5: Run Locally
Start the local full-stack development server with hot reload:
```bash
npm run dev
```
Open your browser at `http://localhost:3000`.

### Step 6: Run Tests
Run the automated test suite verifying workflow state transitions, retry policies, and queue concurrency:
```bash
npm test
```

### Step 7: Build for Production
Compile the client-side SPA into `/dist` and bundle the backend server into `/dist/server.cjs`:
```bash
npm run build
```
Verify the production build locally:
```bash
npm start
```
Check health: `curl http://localhost:3000/health`

### Step 8: Deploy to Google Cloud Run
Authenticate with Google Cloud and submit the build:
```bash
export PROJECT_ID=$(gcloud config get-value project)
export REGION="asia-southeast1"

# Build container with Cloud Build
gcloud builds submit --config cloudbuild.yaml .

# Deploy container to Cloud Run
gcloud run deploy workflow-operations-platform \
  --image "gcr.io/${PROJECT_ID}/workflow-operations-platform:latest" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --min-instances 1 \
  --max-instances 10 \
  --cpu 2 \
  --memory 2Gi \
  --no-cpu-throttling \
  --set-env-vars "NODE_ENV=production,MOCK_MODE=false,FIRESTORE_DATABASE_ID=(default)"
```

### Step 9: Configure Cloud Scheduler
Set up recurring worker triggers for background processing:
```bash
SERVICE_URL=$(gcloud run services describe workflow-operations-platform --region ${REGION} --format 'value(status.url)')

# Queue Dispatcher (every 1 minute)
gcloud scheduler jobs create http process-queue-cron \
  --location "${REGION}" \
  --schedule "* * * * *" \
  --uri "${SERVICE_URL}/api/scheduler/process-queue" \
  --http-method POST

# Human Task Reminder Worker (every 5 minutes)
gcloud scheduler jobs create http human-tasks-cron \
  --location "${REGION}" \
  --schedule "*/5 * * * *" \
  --uri "${SERVICE_URL}/api/scheduler/process-human-tasks" \
  --http-method POST

# Review Outcome Poller (every 15 minutes)
gcloud scheduler jobs create http review-checker-cron \
  --location "${REGION}" \
  --schedule "*/15 * * * *" \
  --uri "${SERVICE_URL}/api/scheduler/check-reviews" \
  --http-method POST
```

### Step 10: Connect a Custom Domain
Map your custom domain and provision managed SSL/TLS:
```bash
gcloud beta run domain-mappings create \
  --service workflow-operations-platform \
  --domain ops.yourdomain.com \
  --region "${REGION}"
```
Update your DNS provider with the `CNAME` or `A` records returned by `gcloud`. Google Cloud will automatically provision and renew your SSL certificates.

---

## 🔍 Health & Observability Endpoints

* **`GET /health`**: High-frequency container liveness probe (200 OK).
* **`GET /ready`**: Deep readiness probe verifying persistence and settings.
* **`GET /api/dashboard/metrics`**: Platform real-time operations telemetry.
* **`GET /api/audit-logs`**: Immutable audit logs with pagination and actor filters.
