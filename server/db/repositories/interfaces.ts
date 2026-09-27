import {
  Job,
  Session,
  HumanTask,
  Operator,
  SystemSettings,
  RetryPolicy,
  ApplicationAttempt,
  AuditLog,
  IntegrationStatusItem,
  Notification,
  NotificationDelivery,
  SheetSyncLog,
  WorkflowRun,
  StepRun,
  UserAccount,
  RoleDefinition,
  SettingVersion,
  SchedulerTask,
} from '../../types.js';

export interface IJobRepository {
  getJobs(filter?: {
    status?: string;
    operatorId?: string;
    search?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Job[]; total: number }>;
  getJobById(jobId: string): Promise<Job | null>;
  saveJob(job: Job): Promise<Job>;
  deleteJob(jobId: string): Promise<boolean>;
  checkDuplicate(shopName: string, email: string): Promise<{ isDuplicate: boolean; existingJob?: Job }>;
  incrementRetryCount(jobId: string): Promise<number>;
}

export interface IApplicationAttemptRepository {
  getAttemptsByJobId(jobId: string): Promise<ApplicationAttempt[]>;
  getAttemptById(attemptId: string): Promise<ApplicationAttempt | null>;
  saveAttempt(attempt: ApplicationAttempt): Promise<ApplicationAttempt>;
  getNextAttemptNumber(jobId: string): Promise<number>;
}

export interface IWorkflowRunRepository {
  getRunsByJobId(jobId: string): Promise<WorkflowRun[]>;
  getRunById(workflowRunId: string): Promise<WorkflowRun | null>;
  saveRun(run: WorkflowRun): Promise<WorkflowRun>;
}

export interface IStepRunRepository {
  getStepRuns(filter?: { workflowRunId?: string; jobId?: string; status?: string }): Promise<StepRun[]>;
  getStepRunById(stepRunId: string): Promise<StepRun | null>;
  saveStepRun(stepRun: StepRun): Promise<StepRun>;
}

export interface IHumanTaskRepository {
  getTasks(filter?: { status?: string; operatorId?: string; priority?: string; jobId?: string }): Promise<HumanTask[]>;
  getTaskById(taskId: string): Promise<HumanTask | null>;
  saveTask(task: HumanTask): Promise<HumanTask>;
  deleteTask(taskId: string): Promise<boolean>;
  claimTask(taskId: string, operatorId: string): Promise<HumanTask>;
  completeTask(taskId: string, completedBy: string, notes?: string, resolutionPayload?: Record<string, any>): Promise<HumanTask>;
}

export interface ISessionRepository {
  getSessions(filter?: { status?: string; operatorId?: string }): Promise<Session[]>;
  getSessionById(sessionId: string): Promise<Session | null>;
  saveSession(session: Session): Promise<Session>;
  deleteSession(sessionId: string): Promise<boolean>;
}

export interface INotificationRepository {
  getNotifications(filter?: { unreadOnly?: boolean; channel?: string; limit?: number }): Promise<Notification[]>;
  addNotification(notification: Notification, idempotencyKey?: string): Promise<Notification>;
  updateNotification(notificationId: string, updates: Partial<Notification>): Promise<Notification | null>;
  recordDelivery(delivery: NotificationDelivery): Promise<NotificationDelivery>;
}

export interface IAuditLogRepository {
  getAuditLogs(filter?: { jobId?: string; actor?: string; limit?: number }): Promise<AuditLog[]>;
  addAuditLog(entry: Omit<AuditLog, 'auditId' | 'timestamp'> & { auditId?: string; timestamp?: string }): Promise<AuditLog>;
}

export interface ISystemSettingsRepository {
  getSettings(): Promise<SystemSettings>;
  updateSettings(updates: Partial<SystemSettings>, changedBy: string): Promise<SystemSettings>;
  getSettingsVersions(): Promise<SettingVersion[]>;
  rollbackSettings(versionId: string, actor: string): Promise<SystemSettings>;
}

export interface ISchedulerTaskRepository {
  getTasks(): Promise<SchedulerTask[]>;
  getTaskById(taskId: string): Promise<SchedulerTask | null>;
  saveTask(task: SchedulerTask): Promise<SchedulerTask>;
  claimTask(taskId: string, workerId: string, lockDurationSeconds?: number): Promise<boolean>;
  releaseTask(taskId: string, workerId: string, outcome: { success: boolean; error?: string; durationMs?: number }): Promise<void>;
}

export interface IUserAccountRepository {
  getUsers(): Promise<UserAccount[]>;
  getUserById(uid: string): Promise<UserAccount | null>;
  getUserByEmail(email: string): Promise<UserAccount | null>;
  saveUser(user: UserAccount): Promise<UserAccount>;
  deleteUser(uid: string): Promise<boolean>;
}

export interface IRoleRepository {
  getRoles(): Promise<RoleDefinition[]>;
  getRoleById(roleId: string): Promise<RoleDefinition | null>;
  saveRole(role: RoleDefinition): Promise<RoleDefinition>;
  deleteRole(roleId: string): Promise<boolean>;
}

export interface IOperatorRepository {
  getOperators(): Promise<Operator[]>;
  getOperatorById(operatorId: string): Promise<Operator | null>;
  saveOperator(operator: Operator): Promise<Operator>;
  deleteOperator(operatorId: string): Promise<boolean>;
}

export interface IRetryPolicyRepository {
  getRetryPolicies(): Promise<RetryPolicy[]>;
  getRetryPolicyById(policyId: string): Promise<RetryPolicy | null>;
  saveRetryPolicy(policy: RetryPolicy): Promise<RetryPolicy>;
}

export interface IIntegrationStatusRepository {
  getIntegrations(): Promise<IntegrationStatusItem[]>;
  updateIntegration(item: IntegrationStatusItem): Promise<IntegrationStatusItem>;
}

export interface ISheetSyncLogRepository {
  getSyncLogs(limit?: number): Promise<SheetSyncLog[]>;
  addSyncLog(log: SheetSyncLog): Promise<SheetSyncLog>;
}
