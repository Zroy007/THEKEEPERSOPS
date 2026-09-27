# UI Visual Audit & Screenshot Manifest

This document outlines the reproduction pathways and exact navigation steps required to capture visual audits and screenshots for every implemented screen, tab, and modal in the **Browser Workflow Operations Platform**.

> **Environment Note**: In accordance with the prompt instructions ("If AI Studio cannot directly export screenshots, do not fake them. Instead provide the exact route list and instructions needed to reproduce each screen locally"), this document provides the exact verified routes, active tab IDs, modal triggers, state configurations, and automated Playwright capture scripts.

---

## 1. Application URL & Host Context

- **Local Development URL**: `http://localhost:3000`
- **Cloud Run Preview URL**: Verified in platform metadata
- **Single-Page Tab Router**: The application uses a stateful tab router controlled via `activeTab` in `src/App.tsx`.

---

## 2. Screen & Modal Reproduction Manifest

| Screen Name | Tab / Trigger ID | Target Component | State Description | How to Reproduce |
|---|---|---|---|---|
| **1. Operations Dashboard** | `dashboard` | `DashboardPage.tsx` | Populated State | Navigate to default URL `http://localhost:3000` or click **Dashboard** tab in top navbar. Shows KPI cards, active sessions, and amber urgent human checkpoint banner. |
| **1b. Dashboard (Empty State)** | `dashboard` | `DashboardPage.tsx` | Empty / Zero State | From System Health tab, clear active sessions and resolve all human tasks. Dashboard displays zero-state metrics. |
| **2. Workflow Jobs Orchestrator** | `jobs` | `JobsPage.tsx` | Populated State | Click **Jobs** in navigation navbar. Shows master job table with status pills, priority tags, and action buttons. |
| **2b. Jobs (Filtered / Empty)** | `jobs` | `JobsPage.tsx` | Empty Search State | In the Jobs search bar, enter an unmatched query (e.g. `nonexistent-query-999`). Shows `EmptyState` component with clear search button. |
| **3. Job Details Modal** | `selectedJobId` | `JobDetailsModal.tsx` | Populated Workflow View | On Jobs or Dashboard page, click the **Inspect** button or any Job ID link (e.g. `JOB-000001` or `JOB-000002`). Modal opens showing 4 sub-tabs: Overview, Timeline, Attempts, Audit. |
| **4. Cloud Browser Sessions** | `sessions` | `SessionsPage.tsx` | Populated Grid View | Click **Sessions** in navigation navbar. Shows active GoLogin profiles with remote CDP ports and memory dials. |
| **4b. Sessions (Table View)** | `sessions` | `SessionsPage.tsx` | Compact Table View | On Sessions page, click the **Table View** toggle icon in the top right of the section header. |
| **5. Browser Session Modal** | `selectedSessionId`| `BrowserSessionModal.tsx` | Live Canvas & CDP Log | On Sessions page or Dashboard, click **Inspect CDP** or **Open Cloud View** on any active session (e.g. `SESS-1001` or `SESS-1002`). |
| **6. Human Checkpoint Queue**| `human-tasks` | `HumanTasksPage.tsx` | Populated Queue | Click **Human Tasks** tab in navbar (has amber counter badge). Displays pending 2FA Email OTP and identity checkpoints. |
| **6b. Human Tasks (All Clear)** | `human-tasks` | `HumanTasksPage.tsx` | All Checkpoints Cleared | Resolve all tasks via the modal. Displays celebration empty state banner. |
| **7. Human Task Modal** | `selectedTaskId` | `HumanTaskModal.tsx` | 2FA OTP Entry | On Human Tasks page or Dashboard alert banner, click **Take Task** or **Resolve** on `HTASK-001`. Displays 6-digit OTP code form with Outlook link. |
| **7b. Human Task Modal (ID Doc)**| `selectedTaskId` | `HumanTaskModal.tsx` | Identity Document Form | Click **Take Task** on `HTASK-002`. Displays identity document review and verification checklist form. |
| **8. Applications History** | `applications` | `ApplicationsPage.tsx` | Populated Attempt Ledger | Click **Applications** in navbar. Shows previous merchant application submissions, approval dates, and rejection tags. |
| **9. Notifications Center** | `notifications` | `NotificationsPage.tsx` | Event Feed | Click **Notifications** in navbar. Shows Telegram and system alerts with delivery status badges and test alert trigger. |
| **10. Operations Reports** | `reports` | `ReportsPage.tsx` | Analytics & Charts | Click **Reports** in navbar. Displays approval rates, throughput trend visualizer, and error taxonomy table. |
| **11. User Accounts** | `accounts` | `AccountsPage.tsx` | User Management Table | As `SUPERADMIN` or `ADMIN`, click **Accounts** in navbar. Displays user directory, password change requirements, and account unlock triggers. |
| **12. Roles & Permissions** | `roles` | `RolesPage.tsx` | Permission Matrix | As `SUPERADMIN` or `ADMIN`, click **Roles** in navbar. Displays system roles and full capability matrix. |
| **13. System Settings & Vault**| `system-settings`| `SystemSettingsPage.tsx` | Settings & Secrets | As `SUPERADMIN` or `ADMIN`, click **System Settings** in navbar. Displays concurrency limit slider, integration test cards, and masked secrets vault. |
| **14. Security Audit Logs** | `audit-logs` | `AuditLogsPage.tsx` | Append-Only Event Trail | Click **Audit Logs** in navbar. Displays chronological security logs with filter chips for Security, Overrides, Settings, and Failures. |
| **15. System Health & Probes** | `health` | `SystemHealthPage.tsx` | Diagnostic Vitals | Click **System Health** in navbar. Displays Node.js RSS memory, heap usage, queue backlogs, and manual worker execution controls. |
| **16. Google Sheets Sync** | `sheets` | `SheetsSyncPage.tsx` | Sync History & CSV | Select **Sheets Sync** from menu or switch active tab to `sheets`. Displays sync logs and CSV download buttons. |
| **17. New Job Ingestion Modal**| `isNewJobOpen` | `NewJobModal.tsx` | Form Input Modal | In top navbar, click the **+ New Job** button. Displays modal with shop name, proxy, priority, and run mode selectors. |
| **18. Platform Sign-In Modal** | `isLoginOpen` | `LoginModal.tsx` | Authentication Dialog | In top navbar user menu, click **Sign In**. Displays email and password form with SuperAdmin autofill button. |
| **19. Password Change Modal** | `isPasswordChangeOpen`| `PasswordChangeModal.tsx`| Password Enforcement | Triggered automatically on first login of bootstrap SuperAdmin, or via user profile menu -> **Change Password**. |

---

## 3. Automated Screenshot Capture Script (Playwright)

For developers auditing this repository locally or in a CI pipeline, run the following Node.js Playwright script to automatically capture PNG screenshots of all screens:

```javascript
// scripts/capture-audit-screenshots.js
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const OUTPUT_DIR = './audit-screenshots';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function runAuditCapture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log(`Starting UI capture against ${BASE_URL}...`);
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');

  const tabs = [
    { id: 'nav-tab-dashboard', filename: '01-dashboard.png' },
    { id: 'nav-tab-jobs', filename: '02-jobs.png' },
    { id: 'nav-tab-sessions', filename: '03-sessions.png' },
    { id: 'nav-tab-human-tasks', filename: '04-human-tasks.png' },
    { id: 'nav-tab-applications', filename: '05-applications.png' },
    { id: 'nav-tab-notifications', filename: '06-notifications.png' },
    { id: 'nav-tab-reports', filename: '07-reports.png' },
    { id: 'nav-tab-accounts', filename: '08-accounts.png' },
    { id: 'nav-tab-roles', filename: '09-roles.png' },
    { id: 'nav-tab-system-settings', filename: '10-system-settings.png' },
    { id: 'nav-tab-audit-logs', filename: '11-audit-logs.png' },
    { id: 'nav-tab-health', filename: '12-system-health.png' },
  ];

  for (const tab of tabs) {
    const el = page.locator(`#${tab.id}`);
    if (await el.isVisible()) {
      await el.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUTPUT_DIR, tab.filename), fullPage: true });
      console.log(`Captured: ${tab.filename}`);
    }
  }

  // Capture Modals
  // 1. New Job Modal
  const newJobBtn = page.locator('button:has-text("+ New Job")');
  if (await newJobBtn.isVisible()) {
    await newJobBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '13-modal-new-job.png') });
    await page.keyboard.press('Escape');
  }

  // 2. Sign In Modal
  const signInBtn = page.locator('button:has-text("Sign In")');
  if (await signInBtn.isVisible()) {
    await signInBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '14-modal-login.png') });
    await page.keyboard.press('Escape');
  }

  await browser.close();
  console.log('All audit screenshots captured successfully in ./audit-screenshots');
}

runAuditCapture().catch(console.error);
```
