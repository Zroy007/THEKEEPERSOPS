# Application Route Inventory

This document provides a comprehensive inventory of all client-side navigation routes/views and backend API routes currently implemented in the **Browser Workflow Operations Platform**.

---

## 1. Frontend Client-Side Application Routes

The frontend is a tab-driven single-page architecture with stateful modals. Navigation is managed in `src/App.tsx` via `activeTab` state, synchronized with role permissions.

| Route / Tab Identifier | Page / Component | Auth Required | Required Role / Permission | Purpose | Implementation Status | Data Source |
|---|---|---|---|---|---|---|
| `dashboard` | `DashboardPage.tsx` | Optional (Demo) / Bearer token | `VIEWER`, `OPERATOR`, `SUPERVISOR`, `ADMIN`, `SUPERADMIN` | High-density operations dashboard with KPIs, human task alert banner, active sessions, and workflow distribution | **IMPLEMENTED** | Real backend API (`/api/dashboard/metrics`, `/api/sessions`, etc.) |
| `jobs` | `JobsPage.tsx` | Optional (Demo) / Bearer token | `VIEWER`, `OPERATOR`, `SUPERVISOR`, `ADMIN`, `SUPERADMIN` | Workflow job orchestration grid with filtering, status tabs, search, and job action buttons | **IMPLEMENTED** | Real backend API (`/api/jobs`) |
| `jobs/:id` (Modal) | `JobDetailsModal.tsx` | Optional (Demo) / Bearer token | `VIEWER`, `OPERATOR`, `SUPERVISOR`, `ADMIN`, `SUPERADMIN` | Deep inspection of job parameters, timeline progression, application attempt history, and audit log | **IMPLEMENTED** | Real backend API (`/api/jobs/:id`, `/api/applications/:id/attempts`) |
| `sessions` | `SessionsPage.tsx` | Optional (Demo) / Bearer token | `OPERATOR`, `SUPERVISOR`, `ADMIN`, `SUPERADMIN` | Cloud browser session monitor, remote debugger port display, live runtime counters, and pause/stop controls | **IMPLEMENTED** | Real backend API (`/api/sessions`) |
| `sessions/:id` (Modal) | `BrowserSessionModal.tsx` | Optional (Demo) / Bearer token | `OPERATOR`, `SUPERVISOR`, `ADMIN`, `SUPERADMIN` | Live cloud browser screen stream simulation, CDP protocol debugger stream, and profile parameter inspector | **IMPLEMENTED** | Real backend API (`/api/sessions/:id`) |
| `human-tasks` | `HumanTasksPage.tsx` | Optional (Demo) / Bearer token | `OPERATOR`, `SUPERVISOR`, `ADMIN`, `SUPERADMIN` | Queue of blocking verification checkpoints (Email OTP, ID documents, selfie, phone code) requiring manual intervention | **IMPLEMENTED** | Real backend API (`/api/human-tasks`) |
| `human-tasks/:id` (Modal) | `HumanTaskModal.tsx` | Optional (Demo) / Bearer token | `OPERATOR`, `SUPERVISOR`, `ADMIN`, `SUPERADMIN` | Verification modal for entering OTP codes, uploading document confirmations, and resolving checkpoints | **IMPLEMENTED** | Real backend API (`/api/human-tasks/:id/complete`) |
| `applications` | `ApplicationsPage.tsx` | Optional (Demo) / Bearer token | `VIEWER`, `OPERATOR`, `SUPERVISOR`, `ADMIN`, `SUPERADMIN` | Historical ledger of merchant application attempts, review statuses, rejection reasons, and reapplication triggers | **IMPLEMENTED** | Real backend API (`/api/applications/attempts`) |
| `notifications` | `NotificationsPage.tsx` | Optional (Demo) / Bearer token | `SUPERVISOR`, `ADMIN`, `SUPERADMIN` | Operational notification event log, channel delivery statuses, and manual Telegram test trigger | **IMPLEMENTED** | Real backend API (`/api/notifications`) |
| `reports` | `ReportsPage.tsx` | Optional (Demo) / Bearer token | `VIEWER`, `SUPERVISOR`, `ADMIN`, `SUPERADMIN` | Operational performance metrics, throughput trends, approval rates, and failure distributions | **IMPLEMENTED** | Real backend API (`/api/reports`, `/api/dashboard/metrics`) |
| `accounts` | `AccountsPage.tsx` | Mandatory | `ADMIN`, `SUPERADMIN` (`users.view`) | User management table, account creation, password reset, unlock locked accounts, and role assignment | **IMPLEMENTED** | Real backend API (`/api/admin/users`) |
| `roles` | `RolesPage.tsx` | Mandatory | `ADMIN`, `SUPERADMIN` (`roles.view`) | System role dictionary and granular permission matrix inspection | **IMPLEMENTED** | Real backend API (`/api/admin/roles`) |
| `system-settings` | `SystemSettingsPage.tsx` | Mandatory | `ADMIN`, `SUPERADMIN` (`settings.view`) | Central configuration management, concurrency sliders, queue limits, secret metadata, and version rollback | **IMPLEMENTED** | Real backend API (`/api/admin/settings`, `/api/admin/secrets`) |
| `audit-logs` | `AuditLogsPage.tsx` | Optional (Demo) / Bearer token | `ADMIN`, `SUPERADMIN` | Append-only security audit trail tracking user logins, setting changes, job dispatches, and overrides | **IMPLEMENTED** | Real backend API (`/api/audit-logs`) |
| `health` | `SystemHealthPage.tsx` | Optional (Demo) / Bearer token | `SUPERVISOR`, `ADMIN`, `SUPERADMIN` | Real-time diagnostic monitor, uptime, memory stats, integration statuses, and manual worker execution | **IMPLEMENTED** | Real backend API (`/api/ready`, `/api/health`, `/api/scheduler/*`) |
| `admin` | `AdminPage.tsx` | Mandatory | `ADMIN`, `SUPERADMIN` | Quick executive administration hub linking to accounts, roles, and settings | **IMPLEMENTED** | Static navigation component |
| `sheets` | `SheetsSyncPage.tsx` | Optional (Demo) / Bearer token | `SUPERVISOR`, `ADMIN`, `SUPERADMIN` | Google Sheets synchronization history, row counts, sync triggers, and CSV export | **IMPLEMENTED** | Real backend API (`/api/sheets/sync`, `/api/sheets/sync/status`) |
| `settings` (Legacy/Alias) | `SettingsPage.tsx` | Optional (Demo) / Bearer token | `ADMIN`, `SUPERADMIN` | Simplified system settings editor for legacy operator views | **IMPLEMENTED** | Real backend API (`/api/settings`) |
| `retry-policies` | `RetryPoliciesPage.tsx` | Optional (Demo) / Bearer token | `ADMIN`, `SUPERADMIN` | Technical error retry policy editor with exponential backoff multipliers | **IMPLEMENTED** | Real backend API (`/api/retry-policies`) |
| `operators` | `OperatorsPage.tsx` | Optional (Demo) / Bearer token | `ADMIN`, `SUPERADMIN` | Human operator directory, active workload, and operator registration form | **IMPLEMENTED** | Real backend API (`/api/operators`) |
| Auth Modal: Login | `LoginModal.tsx` | None | Public | Email and password sign-in form with bootstrap user notice | **IMPLEMENTED** | Real backend API (`/api/auth/login`) |
| Auth Modal: Password Change | `PasswordChangeModal.tsx` | Mandatory | Authenticated with `mustChangePassword` | Password change form with real-time complexity enforcement | **IMPLEMENTED** | Real backend API (`/api/auth/change-password`) |

---

## 2. Backend REST API Endpoints

All backend endpoints are mounted under `/api` in `server.ts`.

### 2.1 Authentication & Profile (`/api/auth`)
| HTTP Method | Route | Auth Required | Required Role / Permission | Purpose | Implementation Status | Data Source |
|---|---|---|---|---|---|---|
| `POST` | `/api/auth/login` | None | Public | Authenticates credentials, verifies password hash, issues JWT token | **IMPLEMENTED** | `authService.login()` |
| `POST` | `/api/auth/change-password` | Bearer Token | Authenticated User | Updates user password, clears `mustChangePassword` flag, validates complexity | **IMPLEMENTED** | `authService.changePassword()` |
| `GET` | `/api/auth/me` | Bearer Token | Authenticated User | Returns profile of currently authenticated user | **IMPLEMENTED** | `authService.getUserById()` |
| `POST` | `/api/auth/logout` | Optional | Authenticated User | Logs audit event for user sign-out | **IMPLEMENTED** | `repository.addAuditLog()` |

### 2.2 User, Role & Secret Administration (`/api/admin`)
| HTTP Method | Route | Auth Required | Required Role / Permission | Purpose | Implementation Status | Data Source |
|---|---|---|---|---|---|---|
| `GET` | `/api/admin/users` | Bearer Token | `users.view` | Retrieves sanitized list of all user accounts | **IMPLEMENTED** | `repository.getUserAccounts()` |
| `POST` | `/api/admin/users` | Bearer Token | `users.create` | Creates new user account with role and temporary password | **IMPLEMENTED** | `authService.createUser()` |
| `GET` | `/api/admin/users/:id` | Bearer Token | `users.view` | Retrieves single user account details | **IMPLEMENTED** | `repository.getUserAccountById()` |
| `PATCH` | `/api/admin/users/:id` | Bearer Token | `users.update` | Updates user attributes, status, or assigned role | **IMPLEMENTED** | `authService.updateUser()` |
| `DELETE` | `/api/admin/users/:id` | Bearer Token | `users.delete` | Soft deletes/deactivates user (prevents deleting last superadmin) | **IMPLEMENTED** | `authService.deleteUser()` |
| `POST` | `/api/admin/users/:id/unlock` | Bearer Token | `users.update` | Clears failed login counter and unlocks user | **IMPLEMENTED** | `authService.unlockUser()` |
| `GET` | `/api/admin/roles` | Bearer Token | `roles.view` | Retrieves list of all system roles and permissions | **IMPLEMENTED** | `repository.getRoles()` |
| `POST` | `/api/admin/roles` | Bearer Token | `roles.create` | Creates a custom role definition | **IMPLEMENTED** | `repository.createRole()` |
| `GET` | `/api/admin/roles/:id` | Bearer Token | `roles.view` | Retrieves single role definition | **IMPLEMENTED** | `repository.getRoleById()` |
| `PATCH` | `/api/admin/roles/:id` | Bearer Token | `roles.update` | Modifies role name, description, or assigned permissions | **IMPLEMENTED** | `repository.updateRole()` |
| `DELETE` | `/api/admin/roles/:id` | Bearer Token | `roles.delete` | Deletes a custom role (prevents deleting system roles) | **IMPLEMENTED** | `repository.deleteRole()` |
| `GET` | `/api/admin/settings` | Bearer Token | `settings.view` | Returns complete system settings object | **IMPLEMENTED** | `repository.getSettings()` |
| `PATCH` | `/api/admin/settings` | Bearer Token | `settings.update` | Updates system configuration and records version history | **IMPLEMENTED** | `repository.updateSettingsWithHistory()` |
| `GET` | `/api/admin/settings/history` | Bearer Token | `settings.view` | Retrieves historical configuration changes | **IMPLEMENTED** | `repository.getSettingsVersions()` |
| `POST` | `/api/admin/settings/rollback/:versionId` | Bearer Token | `settings.update` | Reverts system settings to a prior version | **IMPLEMENTED** | `repository.rollbackSettings()` |
| `GET` | `/api/admin/secrets` | Bearer Token | `secrets.view_metadata` | Returns masked metadata for all system secrets | **IMPLEMENTED** | `SecretProvider.getMetadata()` |
| `POST` | `/api/admin/secrets/:key` | Bearer Token | `secrets.update` | Securely sets or rotates an environment/runtime secret | **IMPLEMENTED** | `SecretProvider.set()` |
| `DELETE` | `/api/admin/secrets/:key` | Bearer Token | `secrets.update` | Clears a secret value | **IMPLEMENTED** | `SecretProvider.clear()` |
| `POST` | `/api/admin/settings/test-gologin` | Bearer Token | `integrations.view` | Probes GoLogin API connectivity | **IMPLEMENTED** | `goLoginService.getProfile()` |
| `POST` | `/api/admin/settings/test-telegram` | Bearer Token | `integrations.view` | Probes Telegram Bot API connectivity | **IMPLEMENTED** | `telegramNotificationService.sendNotification()` |
| `POST` | `/api/admin/settings/test-outlook` | Bearer Token | `integrations.view` | Probes Microsoft Graph token connectivity | **IMPLEMENTED** | `microsoftGraphService.getMailboxStatus()` |
| `POST` | `/api/admin/settings/test-sheets` | Bearer Token | `integrations.view` | Probes Google Sheets API connectivity | **IMPLEMENTED** | `googleSheetsService.syncAllSheets()` |
| `POST` | `/api/admin/reset-demo-data` | Bearer Token / Role | `ADMIN`, `SUPERADMIN` | Re-seeds database with baseline initial data | **IMPLEMENTED** | `repository.resetToSeedData()` |

### 2.3 Workflow Operations & Lifecycle (`/api`)
| HTTP Method | Route | Auth Required | Required Role / Permission | Purpose | Implementation Status | Data Source |
|---|---|---|---|---|---|---|
| `GET` | `/api/dashboard/metrics` | None (Public/Internal) | Any | Returns aggregate platform metrics and status counts | **IMPLEMENTED** | `repository.getDashboardMetrics()` |
| `GET` | `/api/health` | None (Liveness) | Any | Basic liveness probe returning system status | **IMPLEMENTED** | `repository.getIntegrations()` |
| `GET` | `/api/ready` | None (Readiness) | Any | Deep readiness probe checking memory, queue, and limits | **IMPLEMENTED** | System memory & repository stats |
| `GET` | `/api/integrations/status` | None (Internal) | Any | Returns list of external integration health states | **IMPLEMENTED** | `repository.getIntegrations()` |
| `GET` | `/api/jobs` | None / Header | Any | Returns paginated, filtered list of jobs | **IMPLEMENTED** | `repository.getJobs()` |
| `POST` | `/api/jobs` | Role Check | `OPERATOR`, `SUPERVISOR`, `ADMIN` | Ingests a new workflow job into queue | **IMPLEMENTED** | `workflowEngine.createJob()` |
| `GET` | `/api/jobs/:jobId` | None / Header | Any | Retrieves full details for a single job | **IMPLEMENTED** | `repository.getJobById()` |
| `PATCH` | `/api/jobs/:jobId` | Role Check | `OPERATOR`, `SUPERVISOR`, `ADMIN` | Updates job attributes (priority, notes, operator) | **IMPLEMENTED** | `repository.updateJob()` |
| `POST` | `/api/jobs/:jobId/pause` | Role Check | `OPERATOR`, `SUPERVISOR`, `ADMIN` | Pauses execution of an active job and its browser session | **IMPLEMENTED** | `workflowEngine.pauseJob()` |
| `POST` | `/api/jobs/:jobId/resume` | Role Check | `OPERATOR`, `SUPERVISOR`, `ADMIN` | Resumes execution of a paused job | **IMPLEMENTED** | `workflowEngine.resumeJob()` |
| `POST` | `/api/jobs/:jobId/retry` | Role Check | `OPERATOR`, `SUPERVISOR`, `ADMIN` | Schedules a technical error retry with backoff | **IMPLEMENTED** | `retryEngine.scheduleRetry()` |
| `POST` | `/api/jobs/:jobId/manual-review`| Role Check | `OPERATOR`, `SUPERVISOR`, `ADMIN` | Escalate a job to manual human review status | **IMPLEMENTED** | `workflowEngine.transition()` |
| `POST` | `/api/jobs/:jobId/submit` | Role Check | `OPERATOR`, `SUPERVISOR`, `ADMIN` | Finalizes application form and submits to merchant portal | **IMPLEMENTED** | `workflowEngine.transition()` |
| `POST` | `/api/jobs/:jobId/reapply` | Role Check | `SUPERVISOR`, `ADMIN` | Creates new application attempt for a rejected job | **IMPLEMENTED** | `workflowEngine.reapplyJob()` |
| `POST` | `/api/jobs/:jobId/reject` | Role Check | `SUPERVISOR`, `ADMIN` | Records rejection outcome and rejection reason | **IMPLEMENTED** | `workflowEngine.rejectJob()` |
| `GET` | `/api/sessions` | None / Header | Any | Returns list of active and recent browser sessions | **IMPLEMENTED** | `repository.getSessions()` |
| `GET` | `/api/sessions/:sessionId`| None / Header | Any | Returns details for a single browser session | **IMPLEMENTED** | `repository.getSessionById()` |
| `POST` | `/api/sessions/:sessionId/stop` | Role Check | `OPERATOR`, `SUPERVISOR`, `ADMIN` | Terminates a running cloud browser session | **IMPLEMENTED** | `goLoginService.stopSession()` |
| `POST` | `/api/sessions/:sessionId/heartbeat` | None | Internal / Worker | Extends session lease and records active time | **IMPLEMENTED** | `repository.updateSessionHeartbeat()` |
| `GET` | `/api/human-tasks` | None / Header | Any | Returns list of pending and resolved human tasks | **IMPLEMENTED** | `repository.getHumanTasks()` |
| `POST` | `/api/human-tasks/:taskId/assign` | Role Check | `SUPERVISOR`, `ADMIN` | Assigns human task to a designated operator | **IMPLEMENTED** | `repository.assignHumanTask()` |
| `POST` | `/api/human-tasks/:taskId/complete` | Role Check | `OPERATOR`, `SUPERVISOR`, `ADMIN` | Resolves checkpoint with OTP/data and resumes workflow | **IMPLEMENTED** | `workflowEngine.completeHumanTask()` |
| `POST` | `/api/human-tasks/:taskId/remind` | Role Check | `SUPERVISOR`, `ADMIN` | Dispatches manual Telegram reminder alert | **IMPLEMENTED** | `telegramNotificationService.sendNotification()` |
| `GET` | `/api/applications/:jobId/attempts` | None / Header | Any | Returns attempts for a specific job | **IMPLEMENTED** | `repository.getApplicationAttemptsByJobId()` |
| `GET` | `/api/applications/attempts` | None / Header | Any | Returns all application attempts across all jobs | **IMPLEMENTED** | `repository.getApplicationAttempts()` |
| `GET` | `/api/settings` | None / Header | Any | Returns system settings object | **IMPLEMENTED** | `repository.getSettings()` |
| `PATCH` | `/api/settings` | Role Check | `ADMIN`, `SUPERADMIN` | Updates system configuration | **IMPLEMENTED** | `repository.updateSettings()` |
| `GET` | `/api/retry-policies` | None / Header | Any | Returns list of error retry policies | **IMPLEMENTED** | `repository.getRetryPolicies()` |
| `PATCH` | `/api/retry-policies/:id`| Role Check | `ADMIN`, `SUPERADMIN` | Updates max retries and backoff for an error policy | **IMPLEMENTED** | `repository.updateRetryPolicy()` |
| `GET` | `/api/operators` | None / Header | Any | Returns list of registered operators | **IMPLEMENTED** | `repository.getOperators()` |
| `POST` | `/api/operators` | Role Check | `ADMIN`, `SUPERADMIN` | Registers a new human operator | **IMPLEMENTED** | `repository.createOperator()` |
| `POST` | `/api/sheets/sync` | Role Check | `SUPERVISOR`, `ADMIN` | Triggers bidirectional Google Sheets sync | **IMPLEMENTED** | `googleSheetsService.syncAllSheets()` |
| `GET` | `/api/sheets/sync/status` | None / Header | Any | Returns historical Google Sheets sync logs | **IMPLEMENTED** | `repository.getSheetSyncLogs()` |
| `GET` | `/api/sheets/export/csv` | None / Header | Any | Exports current queue and attempts as downloadable CSV | **IMPLEMENTED** | CSV serialization helper |
| `GET` | `/api/notifications` | None / Header | Any | Returns history of dispatched notifications | **IMPLEMENTED** | `repository.getNotifications()` |
| `POST` | `/api/notifications/test` | Role Check | `SUPERVISOR`, `ADMIN` | Sends test alert to configured Telegram chat | **IMPLEMENTED** | `telegramNotificationService.sendNotification()` |
| `GET` | `/api/integrations/outlook/status` | None | Any | Returns connection status of operator Outlook mailbox | **IMPLEMENTED** | `microsoftGraphService.getMailboxStatus()` |
| `GET` | `/api/audit-logs` | None / Header | Any | Returns paginated platform audit logs | **IMPLEMENTED** | `repository.getAuditLogs()` |
| `POST` | `/api/scheduler/process-queue` | None / Header | Any | Background trigger: allocates slots and starts queued jobs | **IMPLEMENTED** | Dynamic queue worker |
| `POST` | `/api/scheduler/process-human-tasks` | None / Header | Any | Background trigger: sends escalating OTP reminders | **IMPLEMENTED** | Human task escalation worker |
| `POST` | `/api/scheduler/check-reviews` | None / Header | Any | Background trigger: polls pending application reviews | **IMPLEMENTED** | Application review worker |
| `GET` | `/api/reports` | None / Header | Any | Returns aggregate operations analytics and breakdowns | **IMPLEMENTED** | `repository.getReports()` |
