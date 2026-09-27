# Production Deployment Guide: Workflow Operations Platform

This guide details how to build, configure, deploy, and operate the Workflow Operations Platform in high-availability, production environments (such as **Google Cloud Run**, **Docker**, and **Firebase Firestore**).

---

## Architecture Overview

The platform uses a unified, full-stack container architecture:
* **Frontend**: React 19 + Tailwind CSS + Lucide Icons (compiled to `/dist` via Vite).
* **Backend**: Node 22 + Express + TypeScript (bundled to `/dist/server.cjs` via esbuild).
* **Background Scheduler**: Autonomous worker loops for job queues (15s), human task reminders (60s), and review polling (120s).
* **Storage Layer**:
  * Persistent file database (`/app/data/platform_db.json`) fallback.
  * Direct Google Cloud Firestore mapping via `@google-cloud/firestore` with automated composite query indexing and role-based security rules.

---

## Prerequisites

1. **Google Cloud SDK (`gcloud`)** installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```
2. **Docker** installed locally (if building container images locally).
3. **Node.js 22 LTS** & **npm 10+**.
4. **Firebase CLI** (`npm install -g firebase-tools`).

---

## 1. Environment Secrets Setup

Store production secrets securely in **Google Cloud Secret Manager** rather than hardcoding them in `.env`:

```bash
# Enable required Google Cloud APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  cloudscheduler.googleapis.com

# Create and populate secrets
gcloud secrets create WORKFLOW_JWT_SECRET --replication-policy="automatic"
echo -n "a-secure-random-32-char-string" | gcloud secrets versions add WORKFLOW_JWT_SECRET --data-file=-

gcloud secrets create GOLOGIN_API_TOKEN --replication-policy="automatic"
echo -n "your_gologin_token" | gcloud secrets versions add GOLOGIN_API_TOKEN --data-file=-

gcloud secrets create TELEGRAM_BOT_TOKEN --replication-policy="automatic"
echo -n "123456789:ABCDEF..." | gcloud secrets versions add TELEGRAM_BOT_TOKEN --data-file=-

gcloud secrets create TELEGRAM_DEFAULT_CHAT_ID --replication-policy="automatic"
echo -n "-100123456789" | gcloud secrets versions add TELEGRAM_DEFAULT_CHAT_ID --data-file=-

gcloud secrets create AZURE_CLIENT_SECRET --replication-policy="automatic"
echo -n "your_azure_secret" | gcloud secrets versions add AZURE_CLIENT_SECRET --data-file=-
```

---

## 2. Firebase & Firestore Setup

1. Login to Firebase CLI:
   ```bash
   firebase login
   firebase use --add YOUR_PROJECT_ID
   ```
2. Deploy Firestore security rules and composite indexes:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```
   * Rules are read from `firestore.rules`.
   * Indexes are read from `firestore.indexes.json`.

---

## 3. Container Build & Push

Build the multi-stage Docker image and push to Artifact Registry:

```bash
# Set variables
export REGION="asia-southeast1"
export PROJECT_ID=$(gcloud config get-value project)
export IMAGE="gcr.io/${PROJECT_ID}/workflow-operations-platform:latest"

# Build and push using Cloud Build (recommended, no local Docker required)
gcloud builds submit --config cloudbuild.yaml .
```

---

## 4. Deploying to Google Cloud Run

Deploy with `--no-cpu-throttling` to ensure background workers (queue processing and reminder alerts) continue operating:

```bash
gcloud run deploy workflow-operations-platform \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --min-instances 1 \
  --max-instances 10 \
  --cpu 2 \
  --memory 2Gi \
  --no-cpu-throttling \
  --set-env-vars "NODE_ENV=production,MOCK_MODE=false,FIRESTORE_DATABASE_ID=(default)" \
  --set-secrets "JWT_SECRET=WORKFLOW_JWT_SECRET:latest,GOLOGIN_API_TOKEN=GOLOGIN_API_TOKEN:latest,TELEGRAM_BOT_TOKEN=TELEGRAM_BOT_TOKEN:latest,TELEGRAM_DEFAULT_CHAT_ID=TELEGRAM_DEFAULT_CHAT_ID:latest,AZURE_CLIENT_SECRET=AZURE_CLIENT_SECRET:latest"
```

---

## 5. Configuring Google Cloud Scheduler (Cron Jobs)

Set up external Cloud Scheduler triggers to invoke platform worker endpoints reliably:

```bash
SERVICE_URL=$(gcloud run services describe workflow-operations-platform --region ${REGION} --format 'value(status.url)')

# 1. Queue Processor (runs every 1 minute)
gcloud scheduler jobs create http process-queue-cron \
  --location "${REGION}" \
  --schedule "* * * * *" \
  --uri "${SERVICE_URL}/api/scheduler/process-queue" \
  --http-method POST \
  --headers "Content-Type=application/json"

# 2. Human Task Reminder Check (runs every 5 minutes)
gcloud scheduler jobs create http human-tasks-cron \
  --location "${REGION}" \
  --schedule "*/5 * * * *" \
  --uri "${SERVICE_URL}/api/scheduler/process-human-tasks" \
  --http-method POST \
  --headers "Content-Type=application/json"

# 3. Review Outcome Poller (runs every 15 minutes)
gcloud scheduler jobs create http review-checker-cron \
  --location "${REGION}" \
  --schedule "*/15 * * * *" \
  --uri "${SERVICE_URL}/api/scheduler/check-reviews" \
  --http-method POST \
  --headers "Content-Type=application/json"
```

---

## 6. Custom Domain Mapping & Managed SSL

Map your custom domain to Cloud Run:

```bash
# Map custom domain
gcloud beta run domain-mappings create \
  --service workflow-operations-platform \
  --domain ops.yourdomain.com \
  --region "${REGION}"
```

Follow the CLI output to create the corresponding `CNAME` or `A` records in your DNS provider (Cloudflare, Google Domains, Route 53, etc.). Google Cloud automatically provisions and renews managed SSL/TLS certificates.

---

## 7. Health & Readiness Probes

The application provides dedicated probes:
* **Liveness**: `GET /health` (returns `{"status":"UP","uptime":...}`)
* **Readiness**: `GET /ready` (returns `{"status":"READY","mockMode":...}`)
* **Metrics**: `GET /api/dashboard/metrics`
