export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | 'VIEWER';

export type AccountStatus = 'ACTIVE' | 'DISABLED' | 'PENDING' | 'LOCKED';

export type Permission =
  | 'users.view'
  | 'users.create'
  | 'users.update'
  | 'users.disable'
  | 'users.delete'
  | 'roles.view'
  | 'roles.create'
  | 'roles.update'
  | 'roles.delete'
  | 'settings.view'
  | 'settings.update'
  | 'secrets.view_metadata'
  | 'secrets.update'
  | 'integrations.view'
  | 'integrations.configure'
  | 'jobs.view'
  | 'jobs.create'
  | 'jobs.update'
  | 'jobs.pause'
  | 'jobs.resume'
  | 'jobs.retry'
  | 'sessions.view'
  | 'sessions.control'
  | 'human_tasks.view'
  | 'human_tasks.assign'
  | 'human_tasks.complete'
  | 'applications.view'
  | 'applications.update'
  | 'reports.view'
  | 'audit_logs.view'
  | 'system_health.view';

export interface UserAccount {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  status: AccountStatus;
  passwordHash?: string;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: string;
  mustChangePassword?: boolean;
  failedLoginAttempts: number;
  lastLoginAt?: string;
  lastLoginIp?: string;
  telegramChatId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleDefinition {
  roleId: string;
  name: string;
  role: UserRole;
  description: string;
  isSystem: boolean;
  permissions: Permission[];
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
}

export interface SecretMetadata {
  key: string;
  description: string;
  category: string;
  configured: boolean;
  lastUpdated?: string;
  updatedBy?: string;
  maskedValue: string;
  status: 'CONFIGURED' | 'NOT_CONFIGURED';
}

export interface SettingVersion {
  versionId: string;
  version: number;
  settingKey: string;
  oldValue: any;
  newValue: any;
  changedBy: string;
  changedAt: string;
  changeType: 'UPDATE' | 'ROLLBACK';
}

export interface Operator {
  operatorId: string;
  name: string;
  email: string;
  telegramChatId?: string;
  role: UserRole;
  active: boolean;
  maxConcurrentHumanTasks: number;
  currentTasksCount: number;
  createdAt: string;
  updatedAt: string;
}

export type JobStatus =
  | 'NEW'
  | 'QUEUED'
  | 'PREPARING'
  | 'PROFILE_CREATED'
  | 'PROXY_CHECKING'
  | 'PROXY_READY'
  | 'BROWSER_STARTING'
  | 'BROWSER_READY'
  | 'SIGNUP_STARTED'
  | 'WAITING_FOR_EMAIL_OTP'
  | 'PASSWORD_STAGE'
  | 'REGISTRATION_CONTINUING'
  | 'HUMAN_IDENTITY_VERIFICATION'
  | 'HUMAN_SELFIE_REQUIRED'
  | 'HUMAN_BIOMETRIC_REQUIRED'
  | 'HUMAN_ACTION_COMPLETED'
  | 'SHOP_INFORMATION'
  | 'PHONE_VERIFICATION'
  | 'READY_FOR_SUBMISSION'
  | 'SUBMITTED'
  | 'WAITING_FOR_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'PAUSED'
  | 'ERROR'
  | 'RETRY_PENDING'
  | 'MANUAL_REVIEW'
  | 'COMPLETED';

export type JobSubStatus =
  | 'INITIALIZING'
  | 'WAITING_FOR_WORKER'
  | 'AWAITING_HUMAN'
  | 'IN_PROGRESS'
  | 'REVIEW_POLLING'
  | 'FAILED_TRANSIENT'
  | 'MANUAL_ATTENTION'
  | 'SUCCESS';

export type JobPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type JobRunMode = 'AUTO' | 'SEMI_AUTO' | 'MANUAL';

export interface Job {
  jobId: string;
  shopName: string;
  email: string;
  passwordReference: string;
  proxyReference: string;
  gologinProfileId?: string;
  gologinProfileName?: string;
  status: JobStatus;
  subStatus: JobSubStatus;
  humanAction?: string;
  priority: JobPriority;
  runMode: JobRunMode;
  autoStart: boolean;
  operatorId?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  submittedAt?: string;
  completedAt?: string;
  nextCheckAt?: string;
  retryCount: number;
  maxRetries: number;
  currentAttemptNo: number;
  currentWorkflowRunId?: string;
  currentSessionId?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  notes?: string;
  tags: string[];
}

export type SessionStatus = 'STARTING' | 'RUNNING' | 'PAUSED' | 'IDLE' | 'STOPPED' | 'ERROR';

export interface Session {
  sessionId: string;
  jobId: string;
  shopName?: string;
  gologinProfileId: string;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  currentUrl?: string;
  currentWorkflowState: JobStatus;
  lastHeartbeat: string;
  operatorId?: string;
  errorState?: string;
  remoteDebuggerUrl?: string;
  cloudBrowserUrl?: string;
  notes?: string;
}

export type HumanTaskType =
  | 'EMAIL_OTP'
  | 'IDENTITY_VERIFICATION'
  | 'SELFIE'
  | 'BIOMETRIC'
  | 'PHONE_VERIFICATION'
  | 'MANUAL_REVIEW'
  | 'FINAL_SUBMISSION_CONFIRMATION';

export type HumanTaskStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

export interface HumanTask {
  humanTaskId: string;
  jobId: string;
  sessionId?: string;
  taskType: HumanTaskType;
  title: string;
  description: string;
  priority: JobPriority;
  status: HumanTaskStatus;
  assignedOperatorId?: string;
  createdAt: string;
  dueAt: string;
  completedAt?: string;
  completedBy?: string;
  lastReminderSentAt?: string;
  reminderCount: number;
  notes?: string;
  resolutionPayload?: Record<string, any>;
}

export interface ApplicationAttempt {
  attemptId: string;
  attemptNo: number;
  jobId: string;
  shopName: string;
  email: string;
  gologinProfileId?: string;
  submittedAt?: string;
  reviewStartedAt?: string;
  finalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ABANDONED';
  rejectionReason?: string;
  completedAt?: string;
  nextAttemptAllowed: boolean;
  operatorId?: string;
  notes?: string;
  createdAt: string;
}

export type WorkflowPhase =
  | 'PREPARATION'
  | 'SESSION_SETUP'
  | 'REGISTRATION'
  | 'HUMAN_VERIFICATION'
  | 'SUBMISSION'
  | 'REVIEW'
  | 'POST_APPROVAL';

export type WorkflowStepType =
  | 'AUTOMATED'
  | 'HUMAN_CHECKPOINT'
  | 'REVIEW_WAIT'
  | 'POST_APPROVAL'
  | 'MANUAL_TASK';

export type StepRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'AWAITING_HUMAN'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED'
  | 'PAUSED';

export interface WorkflowStepDefinition {
  stepId: string;
  name: string;
  description: string;
  phase: WorkflowPhase;
  type: WorkflowStepType;
  order?: number;
  associatedJobStatus?: JobStatus;
  humanTaskType?: HumanTaskType;
  retryPolicy?: {
    maxRetries: number;
    retryableErrorCodes: string[];
    isTechnicalOnly: boolean;
  };
  timeoutMinutes?: number;
  isTerminal?: boolean;
  requiresHumanCompletion?: boolean;
  nextDefaultStepId?: string;
  allowedNextStepIds?: string[];
  defaultNextStepId?: string;
  requiredPermission?: string;
  humanInstructions?: string;
  automatedAction?: string;
  isSystemStep?: boolean;
  metadata?: Record<string, any>;
}

export interface StepRun {
  stepRunId: string;
  workflowRunId: string;
  jobId: string;
  stepId: string;
  stepName: string;
  stepType: WorkflowStepType;
  phase: WorkflowPhase;
  status: StepRunStatus;
  startedAt: string;
  completedAt?: string;
  actor: string;
  actorRole?: string;
  humanTaskId?: string;
  retryCount?: number;
  errorCode?: string;
  errorMessage?: string;
  outputPayload?: Record<string, any>;
  inputPayload?: Record<string, any>;
  executionLogs?: Array<{
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR';
    message: string;
  }>;
  logs?: Array<{
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    message: string;
    context?: any;
  }>;
}

export interface WorkflowRun {
  workflowRunId: string;
  jobId: string;
  runNumber: number;
  attemptId?: string;
  startedAt: string;
  endedAt?: string;
  completedAt?: string;
  pausedAt?: string;
  resumedAt?: string;
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'TERMINATED' | 'AWAITING_HUMAN' | 'INITIALIZING' | 'CANCELLED';
  currentStepId?: string;
  currentStepName?: string;
  currentStatus?: JobStatus;
  currentStep?: JobStatus;
  failureReason?: string;
  stepRuns?: StepRun[];
  executionLogs?: Array<{
    timestamp: string;
    fromStatus: JobStatus;
    toStatus: JobStatus;
    actor: string;
    message: string;
  }>;
  metadata?: Record<string, any>;
}

export interface AuditLog {
  auditId: string;
  timestamp: string;
  actor: string;
  actorRole: UserRole;
  action: string;
  jobId?: string;
  sessionId?: string;
  humanTaskId?: string;
  previousState?: string;
  newState?: string;
  result: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  reason?: string;
  metadata?: Record<string, any>;
}

export interface SystemSettings {
  systemName: string;
  systemDescription: string;
  timezone: string;
  concurrencyMode: 'CONFIGURED' | 'UNLIMITED' | 'AUTO';
  concurrencyLimit: number | null;
  dailyJobLimit: number | null;
  queueLimit: number | null;
  autoStartJobs: boolean;
  defaultPriority: JobPriority;
  defaultRunMode: JobRunMode;
  defaultMaxRetries: number;
  otpTimeoutMinutes: number;
  humanTaskReminderMinutes: number;
  humanTaskEscalationMinutes: number;
  reviewCheckIntervalMinutes: number;
  maxStatusCheckRetries: number;
  sessionIdleTimeoutMinutes: number;
  humanTaskTimeoutMinutes: number;
  autoRetryTechnicalErrors: boolean;
  telegramNotificationsEnabled: boolean;
  telegramRemindersEnabled: boolean;
  telegramDefaultChatId?: string;
  telegramReminderIntervalMinutes: number;
  telegramEscalationIntervalMinutes: number;
  emailNotificationsEnabled: boolean;
  gologinEnabled: boolean;
  gologinApiUrl: string;
  gologinCloudUrl: string;
  gologinConnectionTimeout: number;
  gologinRequestTimeout: number;
  gologinMaxRetries: number;
  gologinRetryBackoff: number;
  authorizedOutlookMailbox: string;
  azureTenantId?: string;
  azureClientId?: string;
  googleSheetsSpreadsheetId?: string;
  googleServiceAccount?: string;
  firebaseProjectId?: string;
  firestoreDatabaseId?: string;
  firebaseClientEmail?: string;
  schedulerPollInterval?: number;
  sessionHealthInterval?: number;
  sheetsSyncEnabled: boolean;
  masterQueueSheet: string;
  applicationLogSheet: string;
  systemSettingsSheet: string;
  operatorsSheet: string;
  notificationLogSheet: string;
  sessionRegistrySheet: string;
  outlookIntegrationEnabled: boolean;
  maintenanceMode: boolean;
  mockMode: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface RetryPolicy {
  policyId: string;
  errorCode: string;
  description: string;
  maxRetries: number;
  initialDelaySeconds: number;
  maxDelaySeconds: number;
  backoffMultiplier: number;
  enabled: boolean;
  isTechnicalOnly: boolean;
}

export interface IntegrationStatusItem {
  id: string;
  name: string;
  status: 'CONNECTED' | 'DEGRADED' | 'ERROR' | 'DISABLED' | 'MOCK';
  latencyMs?: number;
  lastSuccessfulCall?: string;
  lastError?: string;
  lastChecked: string;
  details?: Record<string, any>;
}

export interface DashboardMetrics {
  totalJobs: number;
  queued: number;
  running: number;
  humanActionRequired: number;
  waitingForReview: number;
  approved: number;
  rejected: number;
  errors: number;
  activeSessions: number;
  availableCapacity: number | string;
  concurrencyLimit: number | string;
  dailyJobLimit: number | string;
}

export interface SheetSyncLog {
  syncId: string;
  timestamp: string;
  sheetName: string;
  direction: 'PULL' | 'PUSH' | 'BIDIRECTIONAL';
  rowsProcessed: number;
  rowsInserted: number;
  rowsUpdated: number;
  errorsCount: number;
  status: 'SUCCESS' | 'PARTIAL' | 'ERROR';
  details?: string;
}

export interface SchedulerTask {
  taskId: string;
  name: string;
  type: 'QUEUE_PROCESSOR' | 'HEALTH_CHECK' | 'SHEET_SYNC' | 'SESSION_CLEANUP' | 'REVIEW_POLL';
  intervalSeconds: number;
  status: 'IDLE' | 'RUNNING' | 'DISABLED';
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastDurationMs?: number;
  lastError?: string;
  lockedBy?: string;
  lockExpiresAt?: string;
  runCount: number;
  failCount: number;
  enabled: boolean;
  metadata?: Record<string, any>;
}

export interface NotificationDelivery {
  deliveryId: string;
  notificationId: string;
  channel: 'TELEGRAM' | 'EMAIL' | 'IN_APP';
  recipient: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  attemptCount: number;
  sentAt: string;
  deliveredAt?: string;
  errorMessage?: string;
  idempotencyKey?: string;
}

