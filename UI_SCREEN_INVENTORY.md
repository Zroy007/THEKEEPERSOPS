# UI Screen & View Inventory

This document provides a detailed inventory of every user interface screen, page, and modal dialog currently implemented in the **Browser Workflow Operations Platform**.

---

## 1. Primary Operational Screens

### 1.1 Operations Dashboard
- **Route / Tab Identifier**: `dashboard`
- **Page Component**: `src/pages/DashboardPage.tsx`
- **Main Purpose**: Executive operational overview displaying active jobs, running antidetect sessions, pending human verification checkpoints, aggregate success rates, and quick action shortcuts.
- **Major Components**:
  - `MetricTile` grid: Active Jobs, Running Sessions, Pending Human Checkpoints, Success Rate, Daily Approvals.
  - High-priority **Human Action Required** amber alert banner.
  - Workflow Status Distribution Bar: Proportional visual breakdown across status types.
  - Active Cloud Browser Sessions Grid: Mini cards with remote CDP ports and memory usage.
  - Urgent Intervention Checkpoint Table.
  - Recent Job Activity Timeline Stream.
- **Tables**:
  - Urgent Human Interventions Table (Columns: Priority, Shop Name, Checkpoint Type, Job ID, Created, Operator, Action).
- **Forms**: Quick action buttons for worker triggers.
- **Modals Triggered**: `JobDetailsModal`, `BrowserSessionModal`, `HumanTaskModal`, `NewJobModal`.
- **Buttons / Actions**: "Process Queue Now", "Inspect", "Take Task", "Pause Job", "Resume Job", "Retry Job", "Stop Session".
- **Filters**: Tab navigation links to filtered sub-views.
- **Search**: Global search bar in navigation header.
- **Pagination**: Scrollable lists capped at top 10 items for dashboard overview.
- **Empty States**: Rendered when no human checkpoints or active sessions exist.
- **Loading States**: Shimmer skeleton cards and spinner while fetching metrics.
- **Error States**: Non-blocking toast notification if metric polling fails.
- **Responsive Behavior**: Mobile-first flex-col stacking to 5-column grid on `xl` viewports.
- **Data Source**: Real backend API (`/api/dashboard/metrics`, `/api/sessions`, `/api/human-tasks`, `/api/jobs`).

---

### 1.2 Workflow Job Orchestrator
- **Route / Tab Identifier**: `jobs`
- **Page Component**: `src/pages/JobsPage.tsx`
- **Main Purpose**: Central workflow orchestration console for monitoring, filtering, dispatching, pausing, and retrying browser workflow jobs.
- **Major Components**:
  - Status Filter Chip Bar: `ALL`, `ACTIVE`, `AWAITING_HUMAN`, `SUBMITTED`, `COMPLETED`, `PAUSED`, `ERRORS` with real-time record count badges.
  - Advanced Filter Panel: Priority filter, Run Mode filter (`AUTO` vs `SEMI_AUTO`), and Operator assignment filter.
  - Primary Jobs Data Grid: Detailed tabular view with monospace IDs, status pills, attempt counters, and inline actions.
- **Tables**:
  - Primary Jobs Grid (Columns: Job ID, Priority, Shop Name & Target, Status, Active Step, Browser Session ID, Attempts, Operator, Actions).
- **Forms**: Search input with debounce, dropdown filter controls.
- **Modals Triggered**: `JobDetailsModal`, `NewJobModal`.
- **Buttons / Actions**: "New Job Ingestion", "Refresh", "Pause", "Resume", "Technical Retry", "Submit to Merchant", "Inspect".
- **Filters**: Status tabs, Priority dropdown (`CRITICAL`, `HIGH`, `NORMAL`, `LOW`), Run Mode dropdown, Operator dropdown.
- **Search**: Text search across Job ID, Shop Name, Target Portal, and Assigned Operator.
- **Pagination**: Paginated data grid with page navigation controls.
- **Empty States**: `EmptyState` component displaying contextual prompt when filters yield no matches.
- **Loading States**: Skeleton row placeholders during data loading.
- **Error States**: Banner display if job query fails.
- **Responsive Behavior**: Horizontal scroll table wrapper with sticky action column.
- **Data Source**: Real backend API (`/api/jobs`).

---

### 1.3 Cloud Browser Session Manager
- **Route / Tab Identifier**: `sessions`
- **Page Component**: `src/pages/SessionsPage.tsx`
- **Main Purpose**: Real-time supervision of active GoLogin antidetect browser containers, resource utilization, remote CDP ports, and lease timers.
- **Major Components**:
  - Concurrency Capacity Header: Dynamic visualization of utilized slots vs. `settings.concurrencyLimit`.
  - View Switcher: Toggle between Grid View and Compact Table View.
  - Grid View: Detailed cards with operating system icon, GoLogin profile ID, proxy IP, memory/CPU meters, and remote debugging port.
  - Table View: High-density data grid for operations at scale.
- **Tables**:
  - Sessions Data Table (Columns: Session ID, Status, GoLogin Profile, Proxy Reference, Debug Port, Runtime Duration, CPU / Memory, Actions).
- **Forms**: Search input and status filter chips (`ALL`, `RUNNING`, `PAUSED`, `STOPPED`).
- **Modals Triggered**: `BrowserSessionModal`, `JobDetailsModal`.
- **Buttons / Actions**: "Inspect CDP / Live Screen", "Pause Session", "Resume Session", "Terminate Session".
- **Filters**: Status filter chips (`RUNNING`, `PAUSED`, `STOPPED`, `ERROR`).
- **Search**: Filter by Session ID, Profile Name, or Proxy Reference.
- **Pagination**: Infinite scroll / scrollable grid.
- **Empty States**: `EmptyState` with illustration when no browser sessions are running.
- **Loading States**: Shimmer card placeholders.
- **Error States**: Red pulse indicator if a session experiences heartbeat timeout.
- **Responsive Behavior**: Responsive grid shifting from 1 column on mobile to 3 columns on large screens.
- **Data Source**: Real backend API (`/api/sessions`).

---

### 1.4 Human Checkpoint Queue
- **Route / Tab Identifier**: `human-tasks`
- **Page Component**: `src/pages/HumanTasksPage.tsx`
- **Main Purpose**: Urgent intervention queue isolating blocking verification states (2FA Email OTP, Identity Document Upload, Live Selfie Verification, Phone SMS Code) requiring human execution.
- **Major Components**:
  - Urgent Task Alert Callout with elapsed wait timers.
  - Category Filter Tabs: `ALL`, `EMAIL_OTP`, `IDENTITY_DOCUMENT`, `SELFIE_VERIFICATION`, `PHONE_OTP`.
  - Task Worklist Data Grid.
- **Tables**:
  - Human Tasks Grid (Columns: Task ID, Priority, Target / Shop, Checkpoint Type, Waiting Time, Assigned Operator, Reminders Sent, Action).
- **Forms**: Operator re-assignment selector.
- **Modals Triggered**: `HumanTaskModal`, `JobDetailsModal`.
- **Buttons / Actions**: "Take Task / Resolve", "Send Telegram Reminder", "Assign to Me", "Open Job Details".
- **Filters**: Task Type filter, Status filter (`OPEN`, `IN_PROGRESS`, `RESOLVED`).
- **Search**: Text search by Task ID, Shop Name, or Job ID.
- **Pagination**: Paginated task queue.
- **Empty States**: Celebratory empty state: "All verification checkpoints cleared! Automation running smoothly."
- **Loading States**: Skeleton card placeholders.
- **Error States**: Banner display on network error.
- **Responsive Behavior**: Adaptive table with full-width action drawers on mobile.
- **Data Source**: Real backend API (`/api/human-tasks`).

---

### 1.5 Merchant Application History
- **Route / Tab Identifier**: `applications`
- **Page Component**: `src/pages/ApplicationsPage.tsx`
- **Main Purpose**: Ledger of formal merchant application submission outcomes, reapplication attempts, approval dates, rejection reason analysis, and reapplication triggers.
- **Major Components**:
  - Outcome Summary KPI Tiles: Total Submissions, Approvals, Rejections, Pending Review.
  - Application Attempts History Table.
  - Rejection Reason Taxonomy Tag Cloud.
- **Tables**:
  - Application Submissions Table (Columns: Attempt ID, Job ID, Shop Name, Attempt #, Submitted At, Outcome Status, Review Decision Date, Rejection Reason, Actions).
- **Forms**: Reapplication confirmation form.
- **Modals Triggered**: `JobDetailsModal`.
- **Buttons / Actions**: "Generate Reapplication Attempt", "View Full Attempt History", "Inspect Submission Payload".
- **Filters**: Outcome filter (`ALL`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`).
- **Search**: Filter by Shop Name, Attempt ID, or Job ID.
- **Pagination**: Standard pagination with page size controls.
- **Empty States**: Empty state when no applications have been submitted.
- **Loading States**: Table loading spinner.
- **Error States**: Inline alert badge if an attempt was rejected.
- **Responsive Behavior**: Scrollable table with sticky action buttons.
- **Data Source**: Real backend API (`/api/applications/attempts`).

---

### 1.6 User Accounts Management
- **Route / Tab Identifier**: `accounts`
- **Page Component**: `src/pages/AccountsPage.tsx`
- **Main Purpose**: Super Admin & Admin management of platform operator accounts, role assignments, password resets, account locking, and access deactivation.
- **Major Components**:
  - Security Notice: Highlights PBKDF2 salt-hashed credentials and mandatory password change policy.
  - User Directory Table.
  - Create New User Modal / Drawer.
- **Tables**:
  - User Directory Table (Columns: Name & Email, Role Badge, Status, Failed Logins, Must Change Password, Last Login, Created, Actions).
- **Forms**:
  - Create User Form: Name, Email, Role selector, Temporary Password generator.
  - Edit User Form: Status toggle (`ACTIVE`, `DISABLED`), Role selector.
- **Modals Triggered**: Create User Modal, Confirm Deactivation Dialog.
- **Buttons / Actions**: "Add User", "Unlock Account", "Reset Password", "Disable User", "Change Role".
- **Filters**: Role filter (`SUPERADMIN`, `ADMIN`, `SUPERVISOR`, `OPERATOR`, `VIEWER`), Status filter (`ACTIVE`, `DISABLED`, `LOCKED`).
- **Search**: Search by user name or email.
- **Pagination**: Paginated user list.
- **Empty States**: Empty state if no users match filter.
- **Loading States**: Skeleton table loader.
- **Error States**: Modal alert displaying validation errors (e.g. password complexity requirements).
- **Responsive Behavior**: Responsive table with stacked cards on mobile screens.
- **Data Source**: Real backend API (`/api/admin/users`).

---

### 1.7 Roles & Permission Matrix
- **Route / Tab Identifier**: `roles`
- **Page Component**: `src/pages/RolesPage.tsx`
- **Main Purpose**: Role directory and granular permission matrix inspection showing security capabilities across each tier.
- **Major Components**:
  - System Roles Directory Cards: `SUPERADMIN`, `ADMIN`, `SUPERVISOR`, `OPERATOR`, `VIEWER`.
  - Permission Matrix Table: Cross-referencing 20+ granular permissions against system roles.
- **Tables**:
  - Permission Capability Matrix (Columns: Permission Key, Description, Category, SuperAdmin, Admin, Supervisor, Operator, Viewer).
- **Forms**: Create Role Form (for custom roles).
- **Modals Triggered**: Create Custom Role Modal.
- **Buttons / Actions**: "Create Custom Role", "Inspect Role Users".
- **Filters**: Permission category filter (`USERS`, `ROLES`, `SETTINGS`, `SECRETS`, `JOBS`, `SESSIONS`, `TASKS`).
- **Search**: Search permissions by name or description.
- **Pagination**: Single scrollable matrix.
- **Empty States**: Not applicable (system roles are persistent).
- **Loading States**: Loading spinner while fetching role definitions.
- **Error States**: Banner display if role query fails.
- **Responsive Behavior**: Horizontal scroll table for wide matrix comparisons.
- **Data Source**: Real backend API (`/api/admin/roles`).

---

### 1.8 System Settings & Secrets Vault
- **Route / Tab Identifier**: `system-settings`
- **Page Component**: `src/pages/SystemSettingsPage.tsx`
- **Main Purpose**: Centralized operations configuration, dynamic concurrency slider, queue bounds, external integration connection testing, secret rotation, and settings version rollback.
- **Major Components**:
  - Configuration Category Navigation: `General`, `Concurrency & Limits`, `Integrations & APIs`, `Secrets Vault`, `Version History`.
  - Concurrency Limit Slider (1 to 50 active sessions).
  - Daily Job Limit & Queue Backlog Limit numeric inputs.
  - Auto-start dispatch toggle.
  - Integration Connection Test Cards: Real-time latency probes for GoLogin, Telegram, Microsoft Graph, and Google Sheets.
  - Masked Secrets Vault Table: Safe display of secret key metadata with rotation triggers.
  - Settings Version History & Rollback Ledger.
- **Tables**:
  - Secrets Metadata Table (Columns: Key, Description, Category, Status, Last Updated, Updated By, Actions).
  - Version History Ledger (Columns: Version #, Changed Setting, Old Value, New Value, Changed By, Timestamp, Action).
- **Forms**:
  - Concurrency & Limits Form.
  - Rotate Secret Modal Form (Enforces secure input without leaking plaintext).
- **Modals Triggered**: Rotate Secret Modal, Rollback Confirmation Dialog.
- **Buttons / Actions**: "Save Settings", "Test Connection", "Rotate Secret", "Rollback to Version", "Reset to Defaults".
- **Filters**: Secrets category filter.
- **Search**: Filter secrets by key name.
- **Pagination**: Paginated version history.
- **Empty States**: Not applicable.
- **Loading States**: Button spinners during connection testing and saving.
- **Error States**: Inline error message if connection test fails with diagnostic output.
- **Responsive Behavior**: Two-column layout on desktop, single column on mobile.
- **Data Source**: Real backend API (`/api/admin/settings`, `/api/admin/secrets`, `/api/admin/settings/history`).

---

### 1.9 Security Audit Logs
- **Route / Tab Identifier**: `audit-logs`
- **Page Component**: `src/pages/AuditLogsPage.tsx`
- **Main Purpose**: Immutable, append-only security and operational audit trail tracking user authentication, credential modifications, job status transitions, setting changes, and emergency overrides.
- **Major Components**:
  - Quick Category Filter Chips: `ALL`, `SECURITY`, `SETTINGS`, `OVERRIDES`, `FAILURES`.
  - Event Stream Table with color-coded severity badges.
  - JSON Event Inspector Drawer.
- **Tables**:
  - Audit Trail Table (Columns: Timestamp, User / Actor, Role, Event Type, Target Resource, Details, Client IP, JSON Payload).
- **Forms**: Search input and date range pickers.
- **Modals Triggered**: Audit Log JSON Inspection Modal.
- **Buttons / Actions**: "Export Audit Log (JSON)", "Filter by Actor", "Inspect Raw Event".
- **Filters**: Category chips, severity dropdown (`INFO`, `WARN`, `CRITICAL`).
- **Search**: Search across Actor ID, Action, Resource ID, or detail text.
- **Pagination**: Paginated event feed.
- **Empty States**: Empty state if no logs match current filter.
- **Loading States**: Shimmer table rows during load.
- **Error States**: Banner display on query error.
- **Responsive Behavior**: Responsive table with collapsible metadata drawer on mobile.
- **Data Source**: Real backend API (`/api/audit-logs`).

---

### 1.10 System Health & Diagnostics
- **Route / Tab Identifier**: `health`
- **Page Component**: `src/pages/SystemHealthPage.tsx`
- **Main Purpose**: Deep diagnostic telemetry inspecting Node.js process uptime, memory consumption (RSS and heap), queue sizes, integration states, and manual worker execution controls.
- **Major Components**:
  - System Vitals Grid: Uptime, Memory RSS, Heap Used, Active Queue Backlog, Active Locks.
  - Integration Health Cards: Detailed status badges for GoLogin, Telegram, Microsoft Graph, Google Sheets, and Datastore.
  - Manual Worker Execution Control Panel: One-click triggers for Queue Worker, Human Task Escalation Worker, and Review Outcome Poller.
  - Demo Data Reset Action.
- **Tables**:
  - Integration Status List.
- **Forms**: Worker execution parameter inputs.
- **Modals Triggered**: Reset Demo Data Confirmation Dialog.
- **Buttons / Actions**: "Run Queue Worker Now", "Trigger Human Checkpoint Check", "Poll Merchant Reviews", "Reset Demo Database", "Refresh Telemetry".
- **Filters**: None.
- **Search**: None.
- **Pagination**: None (live dashboard).
- **Empty States**: None.
- **Loading States**: Refresh animation on telemetry reload.
- **Error States**: Red diagnostic alert if memory usage exceeds threshold or an integration reports `DEGRADED`.
- **Responsive Behavior**: 4-column telemetry grid on desktop, single column on mobile.
- **Data Source**: Real backend API (`/api/ready`, `/api/health`, `/api/scheduler/*`).

---

### 1.11 Operations Reports & Analytics
- **Route / Tab Identifier**: `reports`
- **Page Component**: `src/pages/ReportsPage.tsx`
- **Main Purpose**: Operational throughput metrics, workflow velocity, approval rate trends, and failure root-cause analysis.
- **Major Components**:
  - Summary KPI Cards: Total Applications, Approval Rate %, Mean Cycle Time, Error Rate %.
  - Throughput Trend Visualizer (Daily / Weekly).
  - Status Breakdown Chart.
  - Failure Reason Breakdown Table.
- **Tables**:
  - Top Failure Reasons Breakdown (Columns: Error Code, Category, Frequency, Impact %, Suggested Mitigation).
- **Forms**: Date range selector.
- **Modals Triggered**: None.
- **Buttons / Actions**: "Export Report (PDF/CSV)", "Change Time Window (7D, 30D, 90D)".
- **Filters**: Timeframe selector.
- **Search**: None.
- **Pagination**: Paginated failure table.
- **Empty States**: Empty state when no data exists for selected period.
- **Loading States**: Shimmer charts.
- **Error States**: Error alert if metric aggregation fails.
- **Responsive Behavior**: Responsive bento grid adapting to viewport width.
- **Data Source**: Real backend API (`/api/reports`, `/api/dashboard/metrics`).

---

### 1.12 Google Sheets Sync Console
- **Route / Tab Identifier**: `sheets`
- **Page Component**: `src/pages/SheetsSyncPage.tsx`
- **Main Purpose**: Monitor bidirectional synchronization between the platform and Google Sheets, inspect row counts, and trigger manual syncs or CSV exports.
- **Major Components**:
  - Synchronization Status Banner: Last sync timestamp, rows processed, and active direction.
  - Sync History Table.
  - CSV Export Action Card.
- **Tables**:
  - Synchronization History Table (Columns: Sync ID, Timestamp, Sheet Name, Direction, Processed, Inserted, Updated, Errors, Status).
- **Forms**: Sync trigger buttons.
- **Modals Triggered**: None.
- **Buttons / Actions**: "Trigger Sync Now", "Download Queue as CSV", "Download Attempts as CSV".
- **Filters**: Status filter (`SUCCESS`, `ERROR`).
- **Search**: Search sync logs.
- **Pagination**: Paginated sync log list.
- **Empty States**: Empty state when no sync logs have been recorded.
- **Loading States**: Spinner while sync is running.
- **Error States**: Detailed error message card on sync failure.
- **Responsive Behavior**: Full-width container with responsive table.
- **Data Source**: Real backend API (`/api/sheets/sync`, `/api/sheets/sync/status`, `/api/sheets/export/csv`).

---

## 2. Interactive Modal Workflows

### 2.1 Job Operational Details Modal (`JobDetailsModal.tsx`)
- **Main Purpose**: Comprehensive inspection workspace for an individual workflow job.
- **Sub-Tabs**:
  1. **Overview**: Shop name, target portal, credentials reference, proxy reference, GoLogin profile, and active step.
  2. **Workflow Timeline**: Step-by-step graphical timeline tracing milestones from ingestion through submission.
  3. **Application Attempts**: Detailed history of previous submission attempts, review decisions, and rejection reasons.
  4. **Audit Trail**: Filtered event log containing actions executed on this job.
- **Actions**: Pause Job, Resume Job, Technical Retry, Escalate to Manual Review, Submit Application, Reapply, Open Active Session.

### 2.2 Antidetect Browser Session Workspace (`BrowserSessionModal.tsx`)
- **Main Purpose**: Live monitoring and control of an active GoLogin cloud browser session.
- **Sub-Tabs**:
  1. **Live Screen**: Simulated remote browser display canvas showing current portal form inputs.
  2. **CDP Logs**: Real-time Chromium DevTools Protocol command and network event stream.
  3. **Profile Settings**: Detailed inspection of OS fingerprint, user-agent, proxy IP, and WebGL parameters.
- **Actions**: Pause Session, Resume Session, Terminate Session, View Remote Debugger URL.

### 2.3 Human Checkpoint Modal (`HumanTaskModal.tsx`)
- **Main Purpose**: Dedicated operator interface to resolve blocking verification checkpoints.
- **Dynamic Task Forms**:
  - **Email 2FA OTP**: 6-digit numeric input with auto-advance and Outlook mailbox quick link.
  - **Identity Document**: Document type selector and manual verification confirmation checkbox.
  - **Live Selfie**: Face match confirmation checkbox and identity notes.
  - **Phone SMS Code**: SMS code entry form.
- **Actions**: Complete & Resume Workflow, Send Reminder Alert, Assign Task.

### 2.4 New Job Ingestion Modal (`NewJobModal.tsx`)
- **Main Purpose**: Form for creating and enqueuing a new merchant application job.
- **Form Fields**: Shop Name, Target Portal URL, Login Email, Vault Password Reference, Residential Proxy Reference, Priority (`CRITICAL`, `HIGH`, `NORMAL`, `LOW`), Run Mode (`AUTO`, `SEMI_AUTO`), Auto-start toggle.
- **Actions**: Create & Enqueue, Cancel.

### 2.5 Platform Sign-In Modal (`LoginModal.tsx`)
- **Main Purpose**: Secure authentication dialog for platform users.
- **Form Fields**: Email Address, Password.
- **Actions**: Sign In, Cancel. Features one-click bootstrap SuperAdmin autofill for convenience in development.

### 2.6 Mandatory Password Change Modal (`PasswordChangeModal.tsx`)
- **Main Purpose**: Enforces mandatory password rotation on first login or after administrator reset.
- **Form Fields**: Current Password, New Password, Confirm New Password.
- **Real-Time Validation**: Evaluates length (minimum 8 characters), numbers, lowercase, uppercase, and special symbols.
- **Actions**: Update Password & Continue.
