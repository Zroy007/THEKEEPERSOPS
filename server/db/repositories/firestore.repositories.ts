import { getFirestoreDb, FieldValue } from '../firestore.js';
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
  DuplicateEntityError,
  EntityNotFoundError,
} from '../errors.js';
import { sanitizeAuditLog } from '../utils/auditSanitizer.js';

// ==========================================
// 1. FIRESTORE JOB REPOSITORY
// ==========================================
export class FirestoreJobRepository implements IJobRepository {
  private col = 'jobs';

  async getJobs(filter?: {
    status?: string;
    operatorId?: string;
    search?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Job[]; total: number }> {
    const db = getFirestoreDb();
    let query: FirebaseFirestore.Query = db.collection(this.col);

    if (filter?.status && filter.status !== 'ALL') {
      query = query.where('status', '==', filter.status);
    }
    if (filter?.operatorId && filter.operatorId !== 'ALL') {
      query = query.where('operatorId', '==', filter.operatorId);
    }
    if (filter?.priority && filter.priority !== 'ALL') {
      query = query.where('priority', '==', filter.priority);
    }

    const snapshot = await query.get();
    let items: Job[] = snapshot.docs.map((doc) => doc.data() as Job);

    // Client-side search filtering if requested
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      items = items.filter(
        (j) =>
          j.jobId.toLowerCase().includes(q) ||
          j.shopName.toLowerCase().includes(q) ||
          j.email.toLowerCase().includes(q) ||
          (j.tags && j.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    // Sort by updatedAt descending
    items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const total = items.length;
    const offset = filter?.offset || 0;
    const limit = filter?.limit || 50;
    const paginatedItems = items.slice(offset, offset + limit);

    return { items: paginatedItems, total };
  }

  async getJobById(jobId: string): Promise<Job | null> {
    const db = getFirestoreDb();
    const doc = await db.collection(this.col).doc(jobId).get();
    if (!doc.exists) return null;
    return doc.data() as Job;
  }

  async saveJob(job: Job): Promise<Job> {
    validateDomainRecord(JobDomainSchema, job, 'Job');
    const db = getFirestoreDb();
    job.updatedAt = new Date().toISOString();
    await db.collection(this.col).doc(job.jobId).set(job, { merge: true });
    return job;
  }

  async deleteJob(jobId: string): Promise<boolean> {
    const db = getFirestoreDb();
    const ref = db.collection(this.col).doc(jobId);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.delete();
    return true;
  }

  async checkDuplicate(shopName: string, email: string): Promise<{ isDuplicate: boolean; existingJob?: Job }> {
    const db = getFirestoreDb();
    const nonTerminalStatuses = [
      'NEW', 'QUEUED', 'PREPARING', 'PROFILE_CREATED', 'PROXY_CHECKING',
      'PROXY_READY', 'BROWSER_STARTING', 'BROWSER_READY', 'SIGNUP_STARTED',
      'WAITING_FOR_EMAIL_OTP', 'PASSWORD_STAGE', 'REGISTRATION_CONTINUING',
      'HUMAN_IDENTITY_VERIFICATION', 'HUMAN_SELFIE_REQUIRED', 'HUMAN_BIOMETRIC_REQUIRED',
      'HUMAN_ACTION_COMPLETED', 'SHOP_INFORMATION', 'PHONE_VERIFICATION',
      'READY_FOR_SUBMISSION', 'SUBMITTED', 'WAITING_FOR_REVIEW', 'PAUSED', 'RETRY_PENDING', 'MANUAL_REVIEW',
    ];

    const snapshot = await db.collection(this.col).where('email', '==', email).get();
    for (const doc of snapshot.docs) {
      const j = doc.data() as Job;
      if (nonTerminalStatuses.includes(j.status)) {
        return { isDuplicate: true, existingJob: j };
      }
    }

    const shopSnapshot = await db.collection(this.col).where('shopName', '==', shopName).get();
    for (const doc of shopSnapshot.docs) {
      const j = doc.data() as Job;
      if (nonTerminalStatuses.includes(j.status)) {
        return { isDuplicate: true, existingJob: j };
      }
    }

    return { isDuplicate: false };
  }

  async incrementRetryCount(jobId: string): Promise<number> {
    const db = getFirestoreDb();
    const ref = db.collection(this.col).doc(jobId);

    return await db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      if (!doc.exists) {
        throw new EntityNotFoundError('Job', jobId);
      }
      const data = doc.data() as Job;
      const newCount = (data.retryCount || 0) + 1;
      t.update(ref, {
        retryCount: newCount,
        updatedAt: new Date().toISOString(),
      });
      return newCount;
    });
  }
}

// ==========================================
// 2. FIRESTORE APPLICATION ATTEMPT REPOSITORY
// ==========================================
export class FirestoreApplicationAttemptRepository implements IApplicationAttemptRepository {
  private col = 'application_attempts';

  async getAttemptsByJobId(jobId: string): Promise<ApplicationAttempt[]> {
    const db = getFirestoreDb();
    const snapshot = await db.collection(this.col).where('jobId', '==', jobId).get();
    const attempts = snapshot.docs.map((d) => d.data() as ApplicationAttempt);
    // Sort by attemptNo ascending
    attempts.sort((a, b) => a.attemptNo - b.attemptNo);
    return attempts;
  }

  async getAttemptById(attemptId: string): Promise<ApplicationAttempt | null> {
    const db = getFirestoreDb();
    const doc = await db.collection(this.col).doc(attemptId).get();
    if (!doc.exists) return null;
    return doc.data() as ApplicationAttempt;
  }

  async saveAttempt(attempt: ApplicationAttempt): Promise<ApplicationAttempt> {
    validateDomainRecord(ApplicationAttemptDomainSchema, attempt, 'ApplicationAttempt');
    const db = getFirestoreDb();
    await db.collection(this.col).doc(attempt.attemptId).set(attempt, { merge: true });
    return attempt;
  }

  async getNextAttemptNumber(jobId: string): Promise<number> {
    const attempts = await this.getAttemptsByJobId(jobId);
    if (attempts.length === 0) return 1;
    const maxNo = Math.max(...attempts.map((a) => a.attemptNo));
    return maxNo + 1;
  }
}

// ==========================================
// 3. FIRESTORE WORKFLOW RUN REPOSITORY
// ==========================================
export class FirestoreWorkflowRunRepository implements IWorkflowRunRepository {
  private col = 'workflow_runs';

  async getRunsByJobId(jobId: string): Promise<WorkflowRun[]> {
    const db = getFirestoreDb();
    const snapshot = await db.collection(this.col).where('jobId', '==', jobId).get();
    const runs = snapshot.docs.map((d) => d.data() as WorkflowRun);
    runs.sort((a, b) => a.runNumber - b.runNumber);
    return runs;
  }

  async getRunById(workflowRunId: string): Promise<WorkflowRun | null> {
    const db = getFirestoreDb();
    const doc = await db.collection(this.col).doc(workflowRunId).get();
    if (!doc.exists) return null;
    return doc.data() as WorkflowRun;
  }

  async saveRun(run: WorkflowRun): Promise<WorkflowRun> {
    validateDomainRecord(WorkflowRunDomainSchema, run, 'WorkflowRun');
    const db = getFirestoreDb();
    await db.collection(this.col).doc(run.workflowRunId).set(run, { merge: true });
    return run;
  }
}

// ==========================================
// 4. FIRESTORE STEP RUN REPOSITORY
// ==========================================
export class FirestoreStepRunRepository implements IStepRunRepository {
  private col = 'step_runs';

  async getStepRuns(filter?: { workflowRunId?: string; jobId?: string; status?: string }): Promise<StepRun[]> {
    const db = getFirestoreDb();
    let query: FirebaseFirestore.Query = db.collection(this.col);

    if (filter?.workflowRunId) {
      query = query.where('workflowRunId', '==', filter.workflowRunId);
    }
    if (filter?.jobId) {
      query = query.where('jobId', '==', filter.jobId);
    }
    if (filter?.status) {
      query = query.where('status', '==', filter.status);
    }

    const snapshot = await query.get();
    const steps = snapshot.docs.map((d) => d.data() as StepRun);
    steps.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    return steps;
  }

  async getStepRunById(stepRunId: string): Promise<StepRun | null> {
    const db = getFirestoreDb();
    const doc = await db.collection(this.col).doc(stepRunId).get();
    if (!doc.exists) return null;
    return doc.data() as StepRun;
  }

  async saveStepRun(stepRun: StepRun): Promise<StepRun> {
    validateDomainRecord(StepRunDomainSchema, stepRun, 'StepRun');
    const db = getFirestoreDb();
    await db.collection(this.col).doc(stepRun.stepRunId).set(stepRun, { merge: true });
    return stepRun;
  }
}

// ==========================================
// 5. FIRESTORE HUMAN TASK REPOSITORY
// ==========================================
export class FirestoreHumanTaskRepository implements IHumanTaskRepository {
  private col = 'human_tasks';

  async getTasks(filter?: { status?: string; operatorId?: string; priority?: string; jobId?: string }): Promise<HumanTask[]> {
    const db = getFirestoreDb();
    let query: FirebaseFirestore.Query = db.collection(this.col);

    if (filter?.status && filter.status !== 'ALL') {
      query = query.where('status', '==', filter.status);
    }
    if (filter?.operatorId && filter.operatorId !== 'ALL') {
      query = query.where('assignedOperatorId', '==', filter.operatorId);
    }
    if (filter?.priority && filter.priority !== 'ALL') {
      query = query.where('priority', '==', filter.priority);
    }
    if (filter?.jobId) {
      query = query.where('jobId', '==', filter.jobId);
    }

    const snapshot = await query.get();
    const items = snapshot.docs.map((d) => d.data() as HumanTask);
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  }

  async getTaskById(taskId: string): Promise<HumanTask | null> {
    const db = getFirestoreDb();
    const doc = await db.collection(this.col).doc(taskId).get();
    if (!doc.exists) return null;
    return doc.data() as HumanTask;
  }

  async saveTask(task: HumanTask): Promise<HumanTask> {
    validateDomainRecord(HumanTaskDomainSchema, task, 'HumanTask');
    const db = getFirestoreDb();
    await db.collection(this.col).doc(task.humanTaskId).set(task, { merge: true });
    return task;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    const db = getFirestoreDb();
    const ref = db.collection(this.col).doc(taskId);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.delete();
    return true;
  }

  async claimTask(taskId: string, operatorId: string): Promise<HumanTask> {
    const db = getFirestoreDb();
    const ref = db.collection(this.col).doc(taskId);

    return await db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      if (!doc.exists) {
        throw new EntityNotFoundError('HumanTask', taskId);
      }
      const current = doc.data() as HumanTask;
      if (current.status === 'COMPLETED' || current.status === 'CANCELLED') {
        throw new ConcurrencyConflictError(`Cannot claim task ${taskId}: task is already ${current.status}`);
      }
      if (current.assignedOperatorId && current.assignedOperatorId !== operatorId && current.status === 'IN_PROGRESS') {
        throw new ConcurrencyConflictError(`Task ${taskId} is already claimed by operator ${current.assignedOperatorId}`);
      }

      const updated: HumanTask = {
        ...current,
        status: 'IN_PROGRESS',
        assignedOperatorId: operatorId,
      };
      t.set(ref, updated, { merge: true });
      return updated;
    });
  }

  async completeTask(
    taskId: string,
    completedBy: string,
    notes?: string,
    resolutionPayload?: Record<string, any>
  ): Promise<HumanTask> {
    const db = getFirestoreDb();
    const ref = db.collection(this.col).doc(taskId);

    return await db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      if (!doc.exists) {
        throw new EntityNotFoundError('HumanTask', taskId);
      }
      const current = doc.data() as HumanTask;
      if (current.status === 'COMPLETED') {
        throw new ConcurrencyConflictError(`Task ${taskId} is already completed by ${current.completedBy}`);
      }

      const updated: HumanTask = {
        ...current,
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        completedBy,
        notes: notes || current.notes,
        resolutionPayload: resolutionPayload || current.resolutionPayload,
      };
      t.set(ref, updated, { merge: true });
      return updated;
    });
  }
}

// ==========================================
// 6. FIRESTORE SESSION REPOSITORY
// ==========================================
export class FirestoreSessionRepository implements ISessionRepository {
  private col = 'sessions';

  async getSessions(filter?: { status?: string; operatorId?: string }): Promise<Session[]> {
    const db = getFirestoreDb();
    let query: FirebaseFirestore.Query = db.collection(this.col);

    if (filter?.status && filter.status !== 'ALL') {
      query = query.where('status', '==', filter.status);
    }
    if (filter?.operatorId && filter.operatorId !== 'ALL') {
      query = query.where('operatorId', '==', filter.operatorId);
    }

    const snapshot = await query.get();
    const items = snapshot.docs.map((d) => d.data() as Session);
    items.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    return items;
  }

  async getSessionById(sessionId: string): Promise<Session | null> {
    const db = getFirestoreDb();
    const doc = await db.collection(this.col).doc(sessionId).get();
    if (!doc.exists) return null;
    return doc.data() as Session;
  }

  async saveSession(session: Session): Promise<Session> {
    validateDomainRecord(SessionDomainSchema, session, 'Session');
    const db = getFirestoreDb();
    await db.collection(this.col).doc(session.sessionId).set(session, { merge: true });
    return session;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const db = getFirestoreDb();
    const ref = db.collection(this.col).doc(sessionId);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.delete();
    return true;
  }
}

// ==========================================
// 7. FIRESTORE NOTIFICATION REPOSITORY
// ==========================================
export class FirestoreNotificationRepository implements INotificationRepository {
  private col = 'notifications';
  private deliveriesCol = 'notification_deliveries';

  async getNotifications(filter?: { unreadOnly?: boolean; channel?: string; limit?: number }): Promise<Notification[]> {
    const db = getFirestoreDb();
    let query: FirebaseFirestore.Query = db.collection(this.col);

    if (filter?.channel) {
      query = query.where('channel', '==', filter.channel);
    }

    const snapshot = await query.get();
    let items = snapshot.docs.map((d) => d.data() as Notification);

    if (filter?.unreadOnly) {
      items = items.filter((n) => !n.resolvedAt);
    }

    items.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
    const limit = filter?.limit || 50;
    return items.slice(0, limit);
  }

  async addNotification(notification: Notification, idempotencyKey?: string): Promise<Notification> {
    validateDomainRecord(NotificationDomainSchema, notification, 'Notification');
    const db = getFirestoreDb();

    // Enforce idempotency if key is specified
    if (idempotencyKey) {
      const existing = await db.collection(this.col).doc(idempotencyKey).get();
      if (existing.exists) {
        return existing.data() as Notification;
      }
      notification.notificationId = idempotencyKey;
    }

    await db.collection(this.col).doc(notification.notificationId).set(notification, { merge: true });
    return notification;
  }

  async updateNotification(notificationId: string, updates: Partial<Notification>): Promise<Notification | null> {
    const db = getFirestoreDb();
    const ref = db.collection(this.col).doc(notificationId);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const current = doc.data() as Notification;
    const updated = { ...current, ...updates };
    await ref.set(updated, { merge: true });
    return updated;
  }

  async recordDelivery(delivery: NotificationDelivery): Promise<NotificationDelivery> {
    const db = getFirestoreDb();
    await db.collection(this.deliveriesCol).doc(delivery.deliveryId).set(delivery, { merge: true });
    return delivery;
  }
}

// ==========================================
// 8. FIRESTORE AUDIT LOG REPOSITORY (APPEND-ONLY)
// ==========================================
export class FirestoreAuditLogRepository implements IAuditLogRepository {
  private col = 'audit_logs';

  async getAuditLogs(filter?: { jobId?: string; actor?: string; limit?: number }): Promise<AuditLog[]> {
    const db = getFirestoreDb();
    let query: FirebaseFirestore.Query = db.collection(this.col);

    if (filter?.jobId) {
      query = query.where('jobId', '==', filter.jobId);
    }
    if (filter?.actor) {
      query = query.where('actor', '==', filter.actor);
    }

    const snapshot = await query.get();
    const items = snapshot.docs.map((d) => d.data() as AuditLog);
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const limit = filter?.limit || 100;
    return items.slice(0, limit);
  }

  async addAuditLog(entry: Omit<AuditLog, 'auditId' | 'timestamp'> & { auditId?: string; timestamp?: string }): Promise<AuditLog> {
    const db = getFirestoreDb();
    const auditId = entry.auditId || `AUDIT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const timestamp = entry.timestamp || new Date().toISOString();

    const completeLog: AuditLog = {
      ...entry,
      auditId,
      timestamp,
      metadata: entry.metadata || {},
    };

    // Sanitize to guarantee zero plaintext secrets/tokens/OTPs
    const sanitized = sanitizeAuditLog(completeLog);
    validateDomainRecord(AuditLogDomainSchema, sanitized, 'AuditLog');

    await db.collection(this.col).doc(auditId).set(sanitized);
    return sanitized;
  }
}

// ==========================================
// 9. FIRESTORE SYSTEM SETTINGS REPOSITORY
// ==========================================
export class FirestoreSystemSettingsRepository implements ISystemSettingsRepository {
  private settingsCol = 'system_settings';
  private historyCol = 'settings_history';
  private docId = 'current';

  async getSettings(): Promise<SystemSettings> {
    const db = getFirestoreDb();
    const doc = await db.collection(this.settingsCol).doc(this.docId).get();
    if (!doc.exists) {
      throw new EntityNotFoundError('SystemSettings', this.docId);
    }
    return doc.data() as SystemSettings;
  }

  async updateSettings(updates: Partial<SystemSettings>, changedBy: string): Promise<SystemSettings> {
    const db = getFirestoreDb();
    const ref = db.collection(this.settingsCol).doc(this.docId);

    return await db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      if (!doc.exists) {
        throw new EntityNotFoundError('SystemSettings', this.docId);
      }
      const current = doc.data() as SystemSettings;
      const updated: SystemSettings = {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedBy: changedBy,
      };

      t.set(ref, updated, { merge: true });

      // Record setting versions for each changed key
      const historyColRef = db.collection(this.historyCol);
      for (const key of Object.keys(updates) as (keyof SystemSettings)[]) {
        if (updates[key] !== undefined && (current as any)[key] !== updates[key]) {
          const versionId = `VER-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const historyEntry: SettingVersion = {
            versionId,
            version: Date.now(),
            settingKey: key,
            oldValue: (current as any)[key] ?? null,
            newValue: updates[key],
            changedBy,
            changedAt: new Date().toISOString(),
            changeType: 'UPDATE',
          };
          t.set(historyColRef.doc(versionId), historyEntry);
        }
      }

      return updated;
    });
  }

  async getSettingsVersions(): Promise<SettingVersion[]> {
    const db = getFirestoreDb();
    const snapshot = await db.collection(this.historyCol).get();
    const items = snapshot.docs.map((d) => d.data() as SettingVersion);
    items.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
    return items;
  }

  async rollbackSettings(versionId: string, actor: string): Promise<SystemSettings> {
    const db = getFirestoreDb();
    const versionDoc = await db.collection(this.historyCol).doc(versionId).get();
    if (!versionDoc.exists) {
      throw new EntityNotFoundError('SettingVersion', versionId);
    }
    const versionData = versionDoc.data() as SettingVersion;
    return await this.updateSettings({ [versionData.settingKey]: versionData.oldValue }, actor);
  }
}

// ==========================================
// 10. FIRESTORE SCHEDULER TASK REPOSITORY
// ==========================================
export class FirestoreSchedulerTaskRepository implements ISchedulerTaskRepository {
  private col = 'scheduler_tasks';

  async getTasks(): Promise<SchedulerTask[]> {
    const db = getFirestoreDb();
    const snapshot = await db.collection(this.col).get();
    return snapshot.docs.map((d) => d.data() as SchedulerTask);
  }

  async getTaskById(taskId: string): Promise<SchedulerTask | null> {
    const db = getFirestoreDb();
    const doc = await db.collection(this.col).doc(taskId).get();
    if (!doc.exists) return null;
    return doc.data() as SchedulerTask;
  }

  async saveTask(task: SchedulerTask): Promise<SchedulerTask> {
    const db = getFirestoreDb();
    await db.collection(this.col).doc(task.taskId).set(task, { merge: true });
    return task;
  }

  async claimTask(taskId: string, workerId: string, lockDurationSeconds = 60): Promise<boolean> {
    const db = getFirestoreDb();
    const ref = db.collection(this.col).doc(taskId);

    return await db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      if (!doc.exists) return false;
      const current = doc.data() as SchedulerTask;

      const now = new Date();
      if (current.lockedBy && current.lockExpiresAt && new Date(current.lockExpiresAt) > now) {
        // Task locked by another worker
        return false;
      }

      const expiresAt = new Date(now.getTime() + lockDurationSeconds * 1000).toISOString();
      t.update(ref, {
        status: 'RUNNING',
        lockedBy: workerId,
        lockExpiresAt: expiresAt,
        lastRunAt: now.toISOString(),
      });
      return true;
    });
  }

  async releaseTask(taskId: string, workerId: string, outcome: { success: boolean; error?: string; durationMs?: number }): Promise<void> {
    const db = getFirestoreDb();
    const ref = db.collection(this.col).doc(taskId);

    await db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      if (!doc.exists) return;
      const current = doc.data() as SchedulerTask;

      if (current.lockedBy === workerId) {
        t.update(ref, {
          status: 'IDLE',
          lockedBy: null,
          lockExpiresAt: null,
          lastSuccessAt: outcome.success ? new Date().toISOString() : current.lastSuccessAt,
          lastDurationMs: outcome.durationMs,
          lastError: outcome.error || null,
          runCount: (current.runCount || 0) + 1,
          failCount: outcome.success ? current.failCount : (current.failCount || 0) + 1,
        });
      }
    });
  }
}

// ==========================================
// 11. FIRESTORE USER & ROLE REPOSITORIES
// ==========================================
export class FirestoreUserAccountRepository implements IUserAccountRepository {
  private col = 'user_accounts';

  async getUsers(): Promise<UserAccount[]> {
    const db = getFirestoreDb();
    const snapshot = await db.collection(this.col).get();
    return snapshot.docs.map((d) => d.data() as UserAccount);
  }

  async getUserById(uid: string): Promise<UserAccount | null> {
    const db = getFirestoreDb();
    const doc = await db.collection(this.col).doc(uid).get();
    if (!doc.exists) return null;
    return doc.data() as UserAccount;
  }

  async getUserByEmail(email: string): Promise<UserAccount | null> {
    const db = getFirestoreDb();
    const snapshot = await db.collection(this.col).where('email', '==', email.toLowerCase()).get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as UserAccount;
  }

  async saveUser(user: UserAccount): Promise<UserAccount> {
    const db = getFirestoreDb();
    user.updatedAt = new Date().toISOString();
    await db.collection(this.col).doc(user.uid).set(user, { merge: true });
    return user;
  }

  async deleteUser(uid: string): Promise<boolean> {
    const db = getFirestoreDb();
    const ref = db.collection(this.col).doc(uid);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.delete();
    return true;
  }
}

export class FirestoreRoleRepository implements IRoleRepository {
  private col = 'roles';

  async getRoles(): Promise<RoleDefinition[]> {
    const db = getFirestoreDb();
    const snapshot = await db.collection(this.col).get();
    return snapshot.docs.map((d) => d.data() as RoleDefinition);
  }

  async getRoleById(roleId: string): Promise<RoleDefinition | null> {
    const db = getFirestoreDb();
    const doc = await db.collection(this.col).doc(roleId).get();
    if (!doc.exists) return null;
    return doc.data() as RoleDefinition;
  }

  async saveRole(role: RoleDefinition): Promise<RoleDefinition> {
    const db = getFirestoreDb();
    role.updatedAt = new Date().toISOString();
    await db.collection(this.col).doc(role.roleId).set(role, { merge: true });
    return role;
  }

  async deleteRole(roleId: string): Promise<boolean> {
    const db = getFirestoreDb();
    const ref = db.collection(this.col).doc(roleId);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.delete();
    return true;
  }
}

export class FirestoreOperatorRepository implements IOperatorRepository {
  private col = 'operators';

  async getOperators(): Promise<Operator[]> {
    const db = getFirestoreDb();
    const snapshot = await db.collection(this.col).get();
    return snapshot.docs.map((d) => d.data() as Operator);
  }

  async getOperatorById(operatorId: string): Promise<Operator | null> {
    const db = getFirestoreDb();
    const doc = await db.collection(this.col).doc(operatorId).get();
    if (!doc.exists) return null;
    return doc.data() as Operator;
  }

  async saveOperator(operator: Operator): Promise<Operator> {
    const db = getFirestoreDb();
    await db.collection(this.col).doc(operator.operatorId).set(operator, { merge: true });
    return operator;
  }

  async deleteOperator(operatorId: string): Promise<boolean> {
    const db = getFirestoreDb();
    const ref = db.collection(this.col).doc(operatorId);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.delete();
    return true;
  }
}

// ==========================================
// 12. FIRESTORE RETRY, INTEGRATION & SYNC LOG REPOSITORIES
// ==========================================
export class FirestoreRetryPolicyRepository implements IRetryPolicyRepository {
  private col = 'retry_policies';

  async getRetryPolicies(): Promise<RetryPolicy[]> {
    const db = getFirestoreDb();
    const snapshot = await db.collection(this.col).get();
    return snapshot.docs.map((d) => d.data() as RetryPolicy);
  }

  async getRetryPolicyById(policyId: string): Promise<RetryPolicy | null> {
    const db = getFirestoreDb();
    const doc = await db.collection(this.col).doc(policyId).get();
    if (!doc.exists) return null;
    return doc.data() as RetryPolicy;
  }

  async saveRetryPolicy(policy: RetryPolicy): Promise<RetryPolicy> {
    const db = getFirestoreDb();
    await db.collection(this.col).doc(policy.policyId).set(policy, { merge: true });
    return policy;
  }
}

export class FirestoreIntegrationStatusRepository implements IIntegrationStatusRepository {
  private col = 'integration_status';

  async getIntegrations(): Promise<IntegrationStatusItem[]> {
    const db = getFirestoreDb();
    const snapshot = await db.collection(this.col).get();
    return snapshot.docs.map((d) => d.data() as IntegrationStatusItem);
  }

  async updateIntegration(item: IntegrationStatusItem): Promise<IntegrationStatusItem> {
    const db = getFirestoreDb();
    item.lastChecked = new Date().toISOString();
    await db.collection(this.col).doc(item.id).set(item, { merge: true });
    return item;
  }
}

export class FirestoreSheetSyncLogRepository implements ISheetSyncLogRepository {
  private col = 'sheet_sync_logs';

  async getSyncLogs(limit = 50): Promise<SheetSyncLog[]> {
    const db = getFirestoreDb();
    const snapshot = await db.collection(this.col).get();
    const items = snapshot.docs.map((d) => d.data() as SheetSyncLog);
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items.slice(0, limit);
  }

  async addSyncLog(log: SheetSyncLog): Promise<SheetSyncLog> {
    const db = getFirestoreDb();
    await db.collection(this.col).doc(log.syncId).set(log, { merge: true });
    return log;
  }
}
