/**
 * ISOLATED IN-MEMORY TEST REPOSITORIES
 * Strictly used for automated test suites and isolated offline testing.
 * NEVER used in production runtime.
 */
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
import {
  IJobRepository,
  IApplicationAttemptRepository,
  IWorkflowRunRepository,
  IStepRunRepository,
  IHumanTaskRepository,
  ISessionRepository,
  INotificationRepository,
  IAuditLogRepository,
  ISystemSettingsRepository,
  ISchedulerTaskRepository,
  IUserAccountRepository,
  IRoleRepository,
  IOperatorRepository,
  IRetryPolicyRepository,
  IIntegrationStatusRepository,
  ISheetSyncLogRepository,
} from './interfaces.js';
import {
  validateDomainRecord,
  JobDomainSchema,
  ApplicationAttemptDomainSchema,
  WorkflowRunDomainSchema,
  StepRunDomainSchema,
  HumanTaskDomainSchema,
  SessionDomainSchema,
  NotificationDomainSchema,
  AuditLogDomainSchema,
} from '../validation.js';
import {
  ConcurrencyConflictError,
  EntityNotFoundError,
} from '../errors.js';
import { sanitizeAuditLog } from '../utils/auditSanitizer.js';

export class InMemoryJobRepository implements IJobRepository {
  public jobs: Map<string, Job> = new Map();

  async getJobs(filter?: {
    status?: string;
    operatorId?: string;
    search?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Job[]; total: number }> {
    let list = Array.from(this.jobs.values());

    if (filter?.status && filter.status !== 'ALL') {
      list = list.filter((j) => j.status === filter.status);
    }
    if (filter?.operatorId && filter.operatorId !== 'ALL') {
      list = list.filter((j) => j.operatorId === filter.operatorId);
    }
    if (filter?.priority && filter.priority !== 'ALL') {
      list = list.filter((j) => j.priority === filter.priority);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (j) =>
          j.jobId.toLowerCase().includes(q) ||
          j.shopName.toLowerCase().includes(q) ||
          j.email.toLowerCase().includes(q) ||
          (j.tags && j.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const total = list.length;
    const offset = filter?.offset || 0;
    const limit = filter?.limit || 50;
    return { items: list.slice(offset, offset + limit), total };
  }

  async getJobById(jobId: string): Promise<Job | null> {
    return this.jobs.get(jobId) || null;
  }

  async saveJob(job: Job): Promise<Job> {
    validateDomainRecord(JobDomainSchema, job, 'Job');
    job.updatedAt = new Date().toISOString();
    this.jobs.set(job.jobId, { ...job });
    return job;
  }

  async deleteJob(jobId: string): Promise<boolean> {
    return this.jobs.delete(jobId);
  }

  async checkDuplicate(shopName: string, email: string): Promise<{ isDuplicate: boolean; existingJob?: Job }> {
    const nonTerminal = [
      'NEW', 'QUEUED', 'PREPARING', 'PROFILE_CREATED', 'PROXY_CHECKING',
      'PROXY_READY', 'BROWSER_STARTING', 'BROWSER_READY', 'SIGNUP_STARTED',
      'WAITING_FOR_EMAIL_OTP', 'PASSWORD_STAGE', 'REGISTRATION_CONTINUING',
      'HUMAN_IDENTITY_VERIFICATION', 'HUMAN_SELFIE_REQUIRED', 'HUMAN_BIOMETRIC_REQUIRED',
      'HUMAN_ACTION_COMPLETED', 'SHOP_INFORMATION', 'PHONE_VERIFICATION',
      'READY_FOR_SUBMISSION', 'SUBMITTED', 'WAITING_FOR_REVIEW', 'PAUSED', 'RETRY_PENDING', 'MANUAL_REVIEW',
    ];

    for (const job of this.jobs.values()) {
      if ((job.email === email || job.shopName === shopName) && nonTerminal.includes(job.status)) {
        return { isDuplicate: true, existingJob: job };
      }
    }
    return { isDuplicate: false };
  }

  async incrementRetryCount(jobId: string): Promise<number> {
    const job = this.jobs.get(jobId);
    if (!job) throw new EntityNotFoundError('Job', jobId);
    job.retryCount = (job.retryCount || 0) + 1;
    job.updatedAt = new Date().toISOString();
    this.jobs.set(jobId, job);
    return job.retryCount;
  }
}

export class InMemoryApplicationAttemptRepository implements IApplicationAttemptRepository {
  public attempts: Map<string, ApplicationAttempt> = new Map();

  async getAttemptsByJobId(jobId: string): Promise<ApplicationAttempt[]> {
    const list = Array.from(this.attempts.values()).filter((a) => a.jobId === jobId);
    list.sort((a, b) => a.attemptNo - b.attemptNo);
    return list;
  }

  async getAttemptById(attemptId: string): Promise<ApplicationAttempt | null> {
    return this.attempts.get(attemptId) || null;
  }

  async saveAttempt(attempt: ApplicationAttempt): Promise<ApplicationAttempt> {
    validateDomainRecord(ApplicationAttemptDomainSchema, attempt, 'ApplicationAttempt');
    this.attempts.set(attempt.attemptId, { ...attempt });
    return attempt;
  }

  async getNextAttemptNumber(jobId: string): Promise<number> {
    const list = await this.getAttemptsByJobId(jobId);
    if (list.length === 0) return 1;
    return Math.max(...list.map((a) => a.attemptNo)) + 1;
  }
}

export class InMemoryWorkflowRunRepository implements IWorkflowRunRepository {
  public runs: Map<string, WorkflowRun> = new Map();

  async getRunsByJobId(jobId: string): Promise<WorkflowRun[]> {
    const list = Array.from(this.runs.values()).filter((r) => r.jobId === jobId);
    list.sort((a, b) => a.runNumber - b.runNumber);
    return list;
  }

  async getRunById(workflowRunId: string): Promise<WorkflowRun | null> {
    return this.runs.get(workflowRunId) || null;
  }

  async saveRun(run: WorkflowRun): Promise<WorkflowRun> {
    validateDomainRecord(WorkflowRunDomainSchema, run, 'WorkflowRun');
    this.runs.set(run.workflowRunId, { ...run });
    return run;
  }
}

export class InMemoryStepRunRepository implements IStepRunRepository {
  public stepRuns: Map<string, StepRun> = new Map();

  async getStepRuns(filter?: { workflowRunId?: string; jobId?: string; status?: string }): Promise<StepRun[]> {
    let list = Array.from(this.stepRuns.values());
    if (filter?.workflowRunId) list = list.filter((s) => s.workflowRunId === filter.workflowRunId);
    if (filter?.jobId) list = list.filter((s) => s.jobId === filter.jobId);
    if (filter?.status) list = list.filter((s) => s.status === filter.status);
    list.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    return list;
  }

  async getStepRunById(stepRunId: string): Promise<StepRun | null> {
    return this.stepRuns.get(stepRunId) || null;
  }

  async saveStepRun(stepRun: StepRun): Promise<StepRun> {
    validateDomainRecord(StepRunDomainSchema, stepRun, 'StepRun');
    this.stepRuns.set(stepRun.stepRunId, { ...stepRun });
    return stepRun;
  }
}

export class InMemoryHumanTaskRepository implements IHumanTaskRepository {
  public tasks: Map<string, HumanTask> = new Map();

  async getTasks(filter?: { status?: string; operatorId?: string; priority?: string; jobId?: string }): Promise<HumanTask[]> {
    let list = Array.from(this.tasks.values());
    if (filter?.status && filter.status !== 'ALL') list = list.filter((t) => t.status === filter.status);
    if (filter?.operatorId && filter.operatorId !== 'ALL') list = list.filter((t) => t.assignedOperatorId === filter.operatorId);
    if (filter?.priority && filter.priority !== 'ALL') list = list.filter((t) => t.priority === filter.priority);
    if (filter?.jobId) list = list.filter((t) => t.jobId === filter.jobId);
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }

  async getTaskById(taskId: string): Promise<HumanTask | null> {
    return this.tasks.get(taskId) || null;
  }

  async saveTask(task: HumanTask): Promise<HumanTask> {
    validateDomainRecord(HumanTaskDomainSchema, task, 'HumanTask');
    this.tasks.set(task.humanTaskId, { ...task });
    return task;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    return this.tasks.delete(taskId);
  }

  async claimTask(taskId: string, operatorId: string): Promise<HumanTask> {
    const task = this.tasks.get(taskId);
    if (!task) throw new EntityNotFoundError('HumanTask', taskId);
    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
      throw new ConcurrencyConflictError(`Cannot claim task ${taskId}: task is already ${task.status}`);
    }
    if (task.assignedOperatorId && task.assignedOperatorId !== operatorId && task.status === 'IN_PROGRESS') {
      throw new ConcurrencyConflictError(`Task ${taskId} is already claimed by operator ${task.assignedOperatorId}`);
    }
    task.status = 'IN_PROGRESS';
    task.assignedOperatorId = operatorId;
    this.tasks.set(taskId, task);
    return task;
  }

  async completeTask(
    taskId: string,
    completedBy: string,
    notes?: string,
    resolutionPayload?: Record<string, any>
  ): Promise<HumanTask> {
    const task = this.tasks.get(taskId);
    if (!task) throw new EntityNotFoundError('HumanTask', taskId);
    if (task.status === 'COMPLETED') {
      throw new ConcurrencyConflictError(`Task ${taskId} is already completed by ${task.completedBy}`);
    }
    task.status = 'COMPLETED';
    task.completedAt = new Date().toISOString();
    task.completedBy = completedBy;
    if (notes) task.notes = notes;
    if (resolutionPayload) task.resolutionPayload = resolutionPayload;
    this.tasks.set(taskId, task);
    return task;
  }
}

export class InMemorySessionRepository implements ISessionRepository {
  public sessions: Map<string, Session> = new Map();

  async getSessions(filter?: { status?: string; operatorId?: string }): Promise<Session[]> {
    let list = Array.from(this.sessions.values());
    if (filter?.status && filter.status !== 'ALL') list = list.filter((s) => s.status === filter.status);
    if (filter?.operatorId && filter.operatorId !== 'ALL') list = list.filter((s) => s.operatorId === filter.operatorId);
    list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    return list;
  }

  async getSessionById(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) || null;
  }

  async saveSession(session: Session): Promise<Session> {
    validateDomainRecord(SessionDomainSchema, session, 'Session');
    this.sessions.set(session.sessionId, { ...session });
    return session;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }
}

export class InMemoryNotificationRepository implements INotificationRepository {
  public notifications: Map<string, Notification> = new Map();
  public deliveries: Map<string, NotificationDelivery> = new Map();

  async getNotifications(filter?: { unreadOnly?: boolean; channel?: string; limit?: number }): Promise<Notification[]> {
    let list = Array.from(this.notifications.values());
    if (filter?.channel) list = list.filter((n) => n.channel === filter.channel);
    if (filter?.unreadOnly) list = list.filter((n) => !n.resolvedAt);
    list.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
    return list.slice(0, filter?.limit || 50);
  }

  async addNotification(notification: Notification, idempotencyKey?: string): Promise<Notification> {
    validateDomainRecord(NotificationDomainSchema, notification, 'Notification');
    if (idempotencyKey && this.notifications.has(idempotencyKey)) {
      return this.notifications.get(idempotencyKey)!;
    }
    const id = idempotencyKey || notification.notificationId;
    notification.notificationId = id;
    this.notifications.set(id, { ...notification });
    return notification;
  }

  async updateNotification(notificationId: string, updates: Partial<Notification>): Promise<Notification | null> {
    const current = this.notifications.get(notificationId);
    if (!current) return null;
    const updated = { ...current, ...updates };
    this.notifications.set(notificationId, updated);
    return updated;
  }

  async recordDelivery(delivery: NotificationDelivery): Promise<NotificationDelivery> {
    this.deliveries.set(delivery.deliveryId, { ...delivery });
    return delivery;
  }
}

export class InMemoryAuditLogRepository implements IAuditLogRepository {
  public logs: AuditLog[] = [];

  async getAuditLogs(filter?: { jobId?: string; actor?: string; limit?: number }): Promise<AuditLog[]> {
    let list = [...this.logs];
    if (filter?.jobId) list = list.filter((l) => l.jobId === filter.jobId);
    if (filter?.actor) list = list.filter((l) => l.actor === filter.actor);
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return list.slice(0, filter?.limit || 100);
  }

  async addAuditLog(entry: Omit<AuditLog, 'auditId' | 'timestamp'> & { auditId?: string; timestamp?: string }): Promise<AuditLog> {
    const auditId = entry.auditId || `AUDIT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const timestamp = entry.timestamp || new Date().toISOString();
    const completeLog: AuditLog = {
      ...entry,
      auditId,
      timestamp,
      metadata: entry.metadata || {},
    };
    const sanitized = sanitizeAuditLog(completeLog);
    validateDomainRecord(AuditLogDomainSchema, sanitized, 'AuditLog');
    this.logs.unshift(sanitized);
    return sanitized;
  }
}

export class InMemorySystemSettingsRepository implements ISystemSettingsRepository {
  public settings: SystemSettings;
  public versions: SettingVersion[] = [];

  constructor(initialSettings: SystemSettings) {
    this.settings = { ...initialSettings };
  }

  async getSettings(): Promise<SystemSettings> {
    return { ...this.settings };
  }

  async updateSettings(updates: Partial<SystemSettings>, changedBy: string): Promise<SystemSettings> {
    const current = { ...this.settings };
    for (const key of Object.keys(updates) as (keyof SystemSettings)[]) {
      if (updates[key] !== undefined && (current as any)[key] !== updates[key]) {
        const versionId = `VER-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        this.versions.unshift({
          versionId,
          version: Date.now(),
          settingKey: key,
          oldValue: (current as any)[key] ?? null,
          newValue: updates[key],
          changedBy,
          changedAt: new Date().toISOString(),
          changeType: 'UPDATE',
        });
      }
    }
    this.settings = {
      ...this.settings,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: changedBy,
    };
    return { ...this.settings };
  }

  async getSettingsVersions(): Promise<SettingVersion[]> {
    return [...this.versions];
  }

  async rollbackSettings(versionId: string, actor: string): Promise<SystemSettings> {
    const ver = this.versions.find((v) => v.versionId === versionId);
    if (!ver) throw new EntityNotFoundError('SettingVersion', versionId);
    return await this.updateSettings({ [ver.settingKey]: ver.oldValue }, actor);
  }
}

export class InMemorySchedulerTaskRepository implements ISchedulerTaskRepository {
  public tasks: Map<string, SchedulerTask> = new Map();

  async getTasks(): Promise<SchedulerTask[]> {
    return Array.from(this.tasks.values());
  }

  async getTaskById(taskId: string): Promise<SchedulerTask | null> {
    return this.tasks.get(taskId) || null;
  }

  async saveTask(task: SchedulerTask): Promise<SchedulerTask> {
    this.tasks.set(task.taskId, { ...task });
    return task;
  }

  async claimTask(taskId: string, workerId: string, lockDurationSeconds = 60): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    const now = new Date();
    if (task.lockedBy && task.lockExpiresAt && new Date(task.lockExpiresAt) > now) {
      return false;
    }
    task.status = 'RUNNING';
    task.lockedBy = workerId;
    task.lockExpiresAt = new Date(now.getTime() + lockDurationSeconds * 1000).toISOString();
    task.lastRunAt = now.toISOString();
    this.tasks.set(taskId, task);
    return true;
  }

  async releaseTask(taskId: string, workerId: string, outcome: { success: boolean; error?: string; durationMs?: number }): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.lockedBy !== workerId) return;
    task.status = 'IDLE';
    task.lockedBy = undefined;
    task.lockExpiresAt = undefined;
    if (outcome.success) task.lastSuccessAt = new Date().toISOString();
    task.lastDurationMs = outcome.durationMs;
    task.lastError = outcome.error;
    task.runCount = (task.runCount || 0) + 1;
    if (!outcome.success) task.failCount = (task.failCount || 0) + 1;
    this.tasks.set(taskId, task);
  }
}

export class InMemoryUserAccountRepository implements IUserAccountRepository {
  public users: Map<string, UserAccount> = new Map();

  async getUsers(): Promise<UserAccount[]> {
    return Array.from(this.users.values());
  }

  async getUserById(uid: string): Promise<UserAccount | null> {
    return this.users.get(uid) || null;
  }

  async getUserByEmail(email: string): Promise<UserAccount | null> {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return null;
  }

  async saveUser(user: UserAccount): Promise<UserAccount> {
    this.users.set(user.uid, { ...user, updatedAt: new Date().toISOString() });
    return user;
  }

  async deleteUser(uid: string): Promise<boolean> {
    return this.users.delete(uid);
  }
}

export class InMemoryRoleRepository implements IRoleRepository {
  public roles: Map<string, RoleDefinition> = new Map();

  async getRoles(): Promise<RoleDefinition[]> {
    return Array.from(this.roles.values());
  }

  async getRoleById(roleId: string): Promise<RoleDefinition | null> {
    return this.roles.get(roleId) || null;
  }

  async saveRole(role: RoleDefinition): Promise<RoleDefinition> {
    this.roles.set(role.roleId, { ...role, updatedAt: new Date().toISOString() });
    return role;
  }

  async deleteRole(roleId: string): Promise<boolean> {
    return this.roles.delete(roleId);
  }
}

export class InMemoryOperatorRepository implements IOperatorRepository {
  public operators: Map<string, Operator> = new Map();

  async getOperators(): Promise<Operator[]> {
    return Array.from(this.operators.values());
  }

  async getOperatorById(operatorId: string): Promise<Operator | null> {
    return this.operators.get(operatorId) || null;
  }

  async saveOperator(operator: Operator): Promise<Operator> {
    this.operators.set(operator.operatorId, { ...operator, updatedAt: new Date().toISOString() });
    return operator;
  }

  async deleteOperator(operatorId: string): Promise<boolean> {
    return this.operators.delete(operatorId);
  }
}

export class InMemoryRetryPolicyRepository implements IRetryPolicyRepository {
  public policies: Map<string, RetryPolicy> = new Map();

  async getRetryPolicies(): Promise<RetryPolicy[]> {
    return Array.from(this.policies.values());
  }

  async getRetryPolicyById(policyId: string): Promise<RetryPolicy | null> {
    return this.policies.get(policyId) || null;
  }

  async saveRetryPolicy(policy: RetryPolicy): Promise<RetryPolicy> {
    this.policies.set(policy.policyId, { ...policy });
    return policy;
  }
}

export class InMemoryIntegrationStatusRepository implements IIntegrationStatusRepository {
  public integrations: Map<string, IntegrationStatusItem> = new Map();

  async getIntegrations(): Promise<IntegrationStatusItem[]> {
    return Array.from(this.integrations.values());
  }

  async updateIntegration(item: IntegrationStatusItem): Promise<IntegrationStatusItem> {
    this.integrations.set(item.id, { ...item, lastChecked: new Date().toISOString() });
    return item;
  }
}

export class InMemorySheetSyncLogRepository implements ISheetSyncLogRepository {
  public logs: SheetSyncLog[] = [];

  async getSyncLogs(limit = 100): Promise<SheetSyncLog[]> {
    return this.logs.slice(0, limit);
  }

  async addSyncLog(log: SheetSyncLog): Promise<SheetSyncLog> {
    this.logs.unshift({ ...log });
    return log;
  }
}

