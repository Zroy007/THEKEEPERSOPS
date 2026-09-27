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
} from '../types.js';
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
} from './repositories/interfaces.js';
import {
  FirestoreJobRepository,
  FirestoreApplicationAttemptRepository,
  FirestoreWorkflowRunRepository,
  FirestoreStepRunRepository,
  FirestoreHumanTaskRepository,
  FirestoreSessionRepository,
  FirestoreNotificationRepository,
  FirestoreAuditLogRepository,
  FirestoreSystemSettingsRepository,
  FirestoreSchedulerTaskRepository,
  FirestoreUserAccountRepository,
  FirestoreRoleRepository,
  FirestoreOperatorRepository,
  FirestoreRetryPolicyRepository,
  FirestoreIntegrationStatusRepository,
  FirestoreSheetSyncLogRepository,
} from './repositories/firestore.repositories.js';
import {
  InMemoryJobRepository,
  InMemoryApplicationAttemptRepository,
  InMemoryWorkflowRunRepository,
  InMemoryStepRunRepository,
  InMemoryHumanTaskRepository,
  InMemorySessionRepository,
  InMemoryNotificationRepository,
  InMemoryAuditLogRepository,
  InMemorySystemSettingsRepository,
  InMemorySchedulerTaskRepository,
  InMemoryUserAccountRepository,
  InMemoryRoleRepository,
  InMemoryOperatorRepository,
  InMemoryRetryPolicyRepository,
  InMemoryIntegrationStatusRepository,
  InMemorySheetSyncLogRepository,
} from './repositories/inMemory.repositories.js';
import {
  initialJobs,
  initialSessions,
  initialHumanTasks,
  initialOperators,
  initialSettings,
  initialRetryPolicies,
  initialApplicationAttempts,
  initialAuditLogs,
  initialIntegrations,
  initialUserAccounts,
} from './seed.js';
import { INITIAL_ROLE_DEFINITIONS, authService } from '../services/auth.service.js';
import { reconcileFirestoreSeed } from './seedReconciliation.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';
import { config } from '../config.js';
import { FirestoreUnavailableError, PersistenceConfigurationError } from './errors.js';

export type PersistenceMode = 'FIRESTORE' | 'FIRESTORE_EMULATOR' | 'IN_MEMORY';

export class Repository {
  public jobRepo: IJobRepository;
  public attemptRepo: IApplicationAttemptRepository;
  public workflowRunRepo: IWorkflowRunRepository;
  public stepRunRepo: IStepRunRepository;
  public humanTaskRepo: IHumanTaskRepository;
  public sessionRepo: ISessionRepository;
  public notificationRepo: INotificationRepository;
  public auditLogRepo: IAuditLogRepository;
  public settingsRepo: ISystemSettingsRepository;
  public schedulerTaskRepo: ISchedulerTaskRepository;
  public userRepo: IUserAccountRepository;
  public roleRepo: IRoleRepository;
  public operatorRepo: IOperatorRepository;
  public retryPolicyRepo: IRetryPolicyRepository;
  public integrationRepo: IIntegrationStatusRepository;
  public sheetSyncLogRepo: ISheetSyncLogRepository;

  private persistenceMode: PersistenceMode;
  private isTestMode: boolean;
  private initialized = false;

  constructor() {
    const configuredMode = config.persistence.mode;

    // 1. Enforce strict production constraint: in-memory is never permitted in production
    if (config.nodeEnv === 'production') {
      if (configuredMode === 'in-memory') {
        throw new PersistenceConfigurationError(
          'PERSISTENCE_MODE=in-memory is strictly forbidden in production. Production must use canonical Cloud Firestore.'
        );
      }
      this.persistenceMode = 'FIRESTORE';
      this.isTestMode = false;
      logger.info('Persistence', '[Persistence Mode: FIRESTORE] Canonical production datastore configured.');
      this.setupFirestore();
      return;
    }

    // 2. Development / Test mode resolution
    if (configuredMode === 'in-memory') {
      this.persistenceMode = 'IN_MEMORY';
      this.isTestMode = true;
      logger.info('Persistence', '[Persistence Mode: IN_MEMORY] Operating in explicit development in-memory mode. Ephemeral datastore.');
      this.setupInMemory();
    } else if (configuredMode === 'firestore-emulator') {
      if (!config.persistence.emulatorHost) {
        throw new PersistenceConfigurationError(
          'PERSISTENCE_MODE=firestore-emulator requires FIRESTORE_EMULATOR_HOST to be set (e.g. localhost:8080).'
        );
      }
      this.persistenceMode = 'FIRESTORE_EMULATOR';
      this.isTestMode = false;
      logger.info('Persistence', `[Persistence Mode: FIRESTORE_EMULATOR] Connecting to emulator at ${config.persistence.emulatorHost}`);
      this.setupFirestore();
    } else {
      // configuredMode === 'firestore'
      this.persistenceMode = 'FIRESTORE';
      this.isTestMode = false;
      logger.info('Persistence', '[Persistence Mode: FIRESTORE] Canonical Cloud Firestore configured.');
      this.setupFirestore();
    }
  }

  public getPersistenceMode(): PersistenceMode {
    return this.persistenceMode;
  }

  public getPersistenceInfo(): {
    mode: PersistenceMode;
    canonicalProduction: boolean;
    isReady: boolean;
    firestoreConfigured: boolean;
    emulatorHost?: string;
    details: string;
  } {
    const hasExplicitCredentials = Boolean(
      (config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey) ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
    );

    let details = '';
    if (this.persistenceMode === 'FIRESTORE') {
      details = 'Canonical Cloud Firestore connected.';
    } else if (this.persistenceMode === 'FIRESTORE_EMULATOR') {
      details = `Firestore Emulator connected at ${config.persistence.emulatorHost || 'unknown'}.`;
    } else {
      details = 'Explicit In-Memory datastore active. Ephemeral test/dev storage; not for production.';
    }

    return {
      mode: this.persistenceMode,
      canonicalProduction: this.persistenceMode === 'FIRESTORE',
      isReady: this.initialized,
      firestoreConfigured: hasExplicitCredentials,
      emulatorHost: config.persistence.emulatorHost,
      details,
    };
  }

  private setupFirestore() {
    this.jobRepo = new FirestoreJobRepository();
    this.attemptRepo = new FirestoreApplicationAttemptRepository();
    this.workflowRunRepo = new FirestoreWorkflowRunRepository();
    this.stepRunRepo = new FirestoreStepRunRepository();
    this.humanTaskRepo = new FirestoreHumanTaskRepository();
    this.sessionRepo = new FirestoreSessionRepository();
    this.notificationRepo = new FirestoreNotificationRepository();
    this.auditLogRepo = new FirestoreAuditLogRepository();
    this.settingsRepo = new FirestoreSystemSettingsRepository();
    this.schedulerTaskRepo = new FirestoreSchedulerTaskRepository();
    this.userRepo = new FirestoreUserAccountRepository();
    this.roleRepo = new FirestoreRoleRepository();
    this.operatorRepo = new FirestoreOperatorRepository();
    this.retryPolicyRepo = new FirestoreRetryPolicyRepository();
    this.integrationRepo = new FirestoreIntegrationStatusRepository();
    this.sheetSyncLogRepo = new FirestoreSheetSyncLogRepository();
  }

  private setupInMemory() {
    logger.info('Persistence', 'Operating in isolated IN-MEMORY mode.');
    const testJobRepo = new InMemoryJobRepository();
    const testAttemptRepo = new InMemoryApplicationAttemptRepository();
    const testWorkflowRunRepo = new InMemoryWorkflowRunRepository();
    const testStepRunRepo = new InMemoryStepRunRepository();
    const testTaskRepo = new InMemoryHumanTaskRepository();
    const testSessionRepo = new InMemorySessionRepository();
    const testNotificationRepo = new InMemoryNotificationRepository();
    const testAuditRepo = new InMemoryAuditLogRepository();
    const testSettingsRepo = new InMemorySystemSettingsRepository(initialSettings);
    const testSchedulerRepo = new InMemorySchedulerTaskRepository();

    // Seed in-memory repositories
    initialJobs.forEach((j) => testJobRepo.jobs.set(j.jobId, { ...j }));
    initialApplicationAttempts.forEach((a) => testAttemptRepo.attempts.set(a.attemptId, { ...a }));
    initialSessions.forEach((s) => testSessionRepo.sessions.set(s.sessionId, { ...s }));
    initialHumanTasks.forEach((t) => testTaskRepo.tasks.set(t.humanTaskId, { ...t }));
    initialAuditLogs.forEach((l) => testAuditRepo.logs.push({ ...l }));

    this.jobRepo = testJobRepo;
    this.attemptRepo = testAttemptRepo;
    this.workflowRunRepo = testWorkflowRunRepo;
    this.stepRunRepo = testStepRunRepo;
    this.humanTaskRepo = testTaskRepo;
    this.sessionRepo = testSessionRepo;
    this.notificationRepo = testNotificationRepo;
    this.auditLogRepo = testAuditRepo;
    this.settingsRepo = testSettingsRepo;
    this.schedulerTaskRepo = testSchedulerRepo;

    const testUserRepo = new InMemoryUserAccountRepository();
    const testRoleRepo = new InMemoryRoleRepository();
    const testOperatorRepo = new InMemoryOperatorRepository();
    const testRetryPolicyRepo = new InMemoryRetryPolicyRepository();
    const testIntegrationRepo = new InMemoryIntegrationStatusRepository();
    const testSheetSyncRepo = new InMemorySheetSyncLogRepository();

    initialRetryPolicies.forEach((p) => testRetryPolicyRepo.policies.set(p.policyId, { ...p }));
    initialOperators.forEach((o) => testOperatorRepo.operators.set(o.operatorId, { ...o }));
    initialIntegrations.forEach((i) => testIntegrationRepo.integrations.set(i.id, { ...i }));
    INITIAL_ROLE_DEFINITIONS.forEach((r) => testRoleRepo.roles.set(r.roleId, { ...r }));

    // Use environment secret or generate a cryptographically secure one-time bootstrap credential
    const bootstrapPassword =
      process.env.BOOTSTRAP_SUPERADMIN_PASSWORD ||
      process.env.SUPERADMIN_INITIAL_PASSWORD ||
      (crypto.randomBytes(16).toString('hex') + '!Aa1');
    const { hash, salt } = authService.hashPassword(bootstrapPassword);
    initialUserAccounts.forEach((u) => {
      testUserRepo.users.set(u.uid, {
        ...u,
        passwordHash: hash,
        passwordSalt: salt,
      });
    });

    this.userRepo = testUserRepo;
    this.roleRepo = testRoleRepo;
    this.operatorRepo = testOperatorRepo;
    this.retryPolicyRepo = testRetryPolicyRepo;
    this.integrationRepo = testIntegrationRepo;
    this.sheetSyncLogRepo = testSheetSyncRepo;
  }

  /**
   * Initializes persistent connections and reconciles seeds
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.persistenceMode === 'FIRESTORE' || this.persistenceMode === 'FIRESTORE_EMULATOR') {
      try {
        await reconcileFirestoreSeed();
        logger.info('Persistence', `Successfully initialized and reconciled ${this.persistenceMode} seed state.`);
      } catch (err: any) {
        logger.error('Persistence', `${this.persistenceMode} initialization failed: ${err.message}`, err);
        // Under NO circumstances do we fall back to in-memory!
        throw new FirestoreUnavailableError(
          `Failed to initialize configured ${this.persistenceMode} datastore: ${err.message}`
        );
      }
    } else {
      logger.info('Persistence', 'Explicit IN_MEMORY datastore initialized with default baseline fixtures.');
    }

    this.initialized = true;
  }

  // ==========================================
  // JOBS
  // ==========================================
  public async getJobs(filter?: {
    status?: string;
    operatorId?: string;
    search?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Job[]; total: number }> {
    return await this.jobRepo.getJobs(filter);
  }

  public async getJobById(jobId: string): Promise<Job | null> {
    return await this.jobRepo.getJobById(jobId);
  }

  public async saveJob(job: Job): Promise<Job> {
    return await this.jobRepo.saveJob(job);
  }

  public async deleteJob(jobId: string): Promise<boolean> {
    return await this.jobRepo.deleteJob(jobId);
  }

  public async checkDuplicate(shopName: string, email: string): Promise<{ isDuplicate: boolean; existingJob?: Job }> {
    return await this.jobRepo.checkDuplicate(shopName, email);
  }

  public async incrementRetryCount(jobId: string): Promise<number> {
    return await this.jobRepo.incrementRetryCount(jobId);
  }

  // ==========================================
  // SESSIONS
  // ==========================================
  public async getSessions(filter?: { status?: string; operatorId?: string }): Promise<Session[]> {
    return await this.sessionRepo.getSessions(filter);
  }

  public async getSessionById(sessionId: string): Promise<Session | null> {
    return await this.sessionRepo.getSessionById(sessionId);
  }

  public async getSessionByJobId(jobId: string): Promise<Session | null> {
    const sessions = await this.sessionRepo.getSessions();
    return sessions.find((s) => s.jobId === jobId) || null;
  }

  public async saveSession(session: Session): Promise<Session> {
    return await this.sessionRepo.saveSession(session);
  }

  public async deleteSession(sessionId: string): Promise<boolean> {
    return await this.sessionRepo.deleteSession(sessionId);
  }

  // ==========================================
  // HUMAN TASKS
  // ==========================================
  public async getHumanTasks(filter?: { status?: string; operatorId?: string; priority?: string; jobId?: string }): Promise<HumanTask[]> {
    return await this.humanTaskRepo.getTasks(filter);
  }

  public async getHumanTaskById(taskId: string): Promise<HumanTask | null> {
    return await this.humanTaskRepo.getTaskById(taskId);
  }

  public async getHumanTasksByJobId(jobId: string): Promise<HumanTask[]> {
    return await this.humanTaskRepo.getTasks({ jobId });
  }

  public async saveHumanTask(task: HumanTask): Promise<HumanTask> {
    return await this.humanTaskRepo.saveTask(task);
  }

  public async deleteHumanTask(taskId: string): Promise<boolean> {
    return await this.humanTaskRepo.deleteTask(taskId);
  }

  public async claimHumanTask(taskId: string, operatorId: string): Promise<HumanTask> {
    return await this.humanTaskRepo.claimTask(taskId, operatorId);
  }

  public async completeHumanTask(
    taskId: string,
    completedBy: string,
    notes?: string,
    resolutionPayload?: Record<string, any>
  ): Promise<HumanTask> {
    return await this.humanTaskRepo.completeTask(taskId, completedBy, notes, resolutionPayload);
  }

  // ==========================================
  // OPERATORS
  // ==========================================
  public async getOperators(): Promise<Operator[]> {
    return await this.operatorRepo.getOperators();
  }

  public async getOperatorById(operatorId: string): Promise<Operator | null> {
    return await this.operatorRepo.getOperatorById(operatorId);
  }

  public async saveOperator(operator: Operator): Promise<Operator> {
    return await this.operatorRepo.saveOperator(operator);
  }

  public async deleteOperator(operatorId: string): Promise<boolean> {
    return await this.operatorRepo.deleteOperator(operatorId);
  }

  // ==========================================
  // USER ACCOUNTS
  // ==========================================
  public async getUserAccounts(filter?: { search?: string; role?: string; status?: string }): Promise<UserAccount[]> {
    let list = await this.userRepo.getUsers();
    if (filter?.role && filter.role !== 'ALL') {
      list = list.filter((u) => u.role === filter.role);
    }
    if (filter?.status && filter.status !== 'ALL') {
      list = list.filter((u) => u.status === filter.status);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.uid.toLowerCase().includes(q));
    }
    // Return sanitized accounts (strip passwordHash and salt)
    return list.map((u) => {
      const { passwordHash, passwordSalt, ...safe } = u;
      return safe as UserAccount;
    });
  }

  public async getUserAccountById(uid: string, includeSecrets = false): Promise<UserAccount | null> {
    const acc = await this.userRepo.getUserById(uid);
    if (!acc) return null;
    if (includeSecrets) return acc;
    const { passwordHash, passwordSalt, ...safe } = acc;
    return safe as UserAccount;
  }

  public async getUserAccountByEmail(email: string, includeSecrets = false): Promise<UserAccount | null> {
    const acc = await this.userRepo.getUserByEmail(email);
    if (!acc) return null;
    if (includeSecrets) return acc;
    const { passwordHash, passwordSalt, ...safe } = acc;
    return safe as UserAccount;
  }

  public async saveUserAccount(user: UserAccount, actor = 'SUPERADMIN'): Promise<UserAccount> {
    const existing = await this.userRepo.getUserById(user.uid);

    // Safety constraint: Protect the last active SUPERADMIN
    if (existing && existing.role === 'SUPERADMIN') {
      const isDemotingOrDisabling =
        (user.role && user.role !== 'SUPERADMIN') ||
        (user.status && user.status !== 'ACTIVE');

      if (isDemotingOrDisabling) {
        const allUsers = await this.userRepo.getUsers();
        const otherActive = allUsers.filter((u) => u.uid !== user.uid && u.role === 'SUPERADMIN' && u.status === 'ACTIVE');
        if (otherActive.length === 0) {
          await this.addAuditLog({
            actor,
            actorRole: 'SUPERADMIN',
            action: 'SECURITY_VIOLATION_SUPERADMIN_PROTECTION',
            result: 'BLOCKED',
            reason: 'Attempted prohibited demotion, disabling, or locking of the last active Super Admin account.',
            metadata: { targetUid: user.uid, attemptedRole: user.role, attemptedStatus: user.status },
          });
          throw new Error('Cannot demote, disable, or lock the last remaining active Super Admin account.');
        }
      }
    }

    if (existing) {
      if (!user.passwordHash && existing.passwordHash) user.passwordHash = existing.passwordHash;
      if (!user.passwordSalt && existing.passwordSalt) user.passwordSalt = existing.passwordSalt;
    }

    const saved = await this.userRepo.saveUser(user);

    await this.addAuditLog({
      actor,
      actorRole: 'SUPERADMIN',
      action: existing ? 'ACCOUNT_UPDATED' : 'ACCOUNT_CREATED',
      newState: user.status,
      result: 'SUCCESS',
      metadata: { targetUid: user.uid, targetEmail: user.email, targetRole: user.role },
    });

    const { passwordHash, passwordSalt, ...safe } = saved;
    return safe as UserAccount;
  }

  public async deleteUserAccount(uid: string, actor = 'SUPERADMIN'): Promise<boolean> {
    const existing = await this.userRepo.getUserById(uid);
    if (!existing) return false;

    if (existing.role === 'SUPERADMIN') {
      const allUsers = await this.userRepo.getUsers();
      const otherActive = allUsers.filter((u) => u.uid !== uid && u.role === 'SUPERADMIN' && u.status === 'ACTIVE');
      if (otherActive.length === 0) {
        await this.addAuditLog({
          actor,
          actorRole: 'SUPERADMIN',
          action: 'SECURITY_VIOLATION_SUPERADMIN_PROTECTION',
          result: 'BLOCKED',
          reason: 'Attempted prohibited deletion of the last active Super Admin account.',
          metadata: { targetUid: uid, targetEmail: existing.email },
        });
        throw new Error('Cannot delete the last remaining active Super Admin account.');
      }
    }

    const deleted = await this.userRepo.deleteUser(uid);
    if (deleted) {
      await this.addAuditLog({
        actor,
        actorRole: 'SUPERADMIN',
        action: 'ACCOUNT_DELETED',
        result: 'SUCCESS',
        metadata: { deletedUid: uid, deletedEmail: existing.email },
      });
    }
    return deleted;
  }

  public async unlockUserAccount(uid: string, actor = 'SUPERADMIN'): Promise<UserAccount> {
    const acc = await this.userRepo.getUserById(uid);
    if (!acc) throw new Error('Account not found');
    acc.status = 'ACTIVE';
    acc.failedLoginAttempts = 0;
    const saved = await this.userRepo.saveUser(acc);

    await this.addAuditLog({
      actor,
      actorRole: 'SUPERADMIN',
      action: 'ACCOUNT_UNLOCKED',
      newState: 'ACTIVE',
      result: 'SUCCESS',
      metadata: { targetUid: uid, targetEmail: acc.email },
    });

    const { passwordHash, passwordSalt, ...safe } = saved;
    return safe as UserAccount;
  }

  // ==========================================
  // ROLES
  // ==========================================
  public async getRoles(): Promise<RoleDefinition[]> {
    const roles = await this.roleRepo.getRoles();
    const users = await this.userRepo.getUsers();
    const userCounts: Record<string, number> = {};
    for (const u of users) {
      if (u.status === 'ACTIVE') {
        userCounts[u.role] = (userCounts[u.role] || 0) + 1;
      }
    }
    return roles.map((r) => ({
      ...r,
      userCount: userCounts[r.role] || 0,
    }));
  }

  public async getRoleById(roleId: string): Promise<RoleDefinition | null> {
    return await this.roleRepo.getRoleById(roleId);
  }

  public async saveRole(role: RoleDefinition, actor = 'SUPERADMIN'): Promise<RoleDefinition> {
    const existing = await this.roleRepo.getRoleById(role.roleId);
    if (existing?.isSystem && role.role === 'SUPERADMIN' && role.status === 'DISABLED') {
      throw new Error('The system SUPERADMIN role cannot be disabled.');
    }

    const saved = await this.roleRepo.saveRole(role);
    await this.addAuditLog({
      actor,
      actorRole: 'SUPERADMIN',
      action: existing ? 'ROLE_UPDATED' : 'ROLE_CREATED',
      result: 'SUCCESS',
      metadata: { roleId: role.roleId, roleName: role.name },
    });
    return saved;
  }

  public async deleteRole(roleId: string, actor = 'SUPERADMIN'): Promise<boolean> {
    const role = await this.roleRepo.getRoleById(roleId);
    if (!role) return false;

    if (role.isSystem) {
      throw new Error(`System role "${role.name}" is protected and cannot be deleted.`);
    }

    const users = await this.userRepo.getUsers();
    const assigned = users.filter((u) => u.role === role.role && u.status === 'ACTIVE');
    if (assigned.length > 0) {
      throw new Error(`Cannot delete role "${role.name}" because ${assigned.length} active user(s) are assigned.`);
    }

    const deleted = await this.roleRepo.deleteRole(roleId);
    if (deleted) {
      await this.addAuditLog({
        actor,
        actorRole: 'SUPERADMIN',
        action: 'ROLE_DELETED',
        result: 'SUCCESS',
        metadata: { roleId, roleName: role.name },
      });
    }
    return deleted;
  }

  // ==========================================
  // SETTINGS & VERSIONING
  // ==========================================
  public async getSettings(): Promise<SystemSettings> {
    try {
      return await this.settingsRepo.getSettings();
    } catch (err) {
      return { ...initialSettings };
    }
  }

  public async getSettingsVersions(): Promise<SettingVersion[]> {
    return await this.settingsRepo.getSettingsVersions();
  }

  public async updateSettings(updates: Partial<SystemSettings>, updatedBy = 'SUPERADMIN'): Promise<SystemSettings> {
    const updated = await this.settingsRepo.updateSettings(updates, updatedBy);
    await this.addAuditLog({
      actor: updatedBy,
      actorRole: 'SUPERADMIN',
      action: 'SETTING_CHANGED',
      result: 'SUCCESS',
      metadata: { updates },
    });
    return updated;
  }

  public async rollbackSetting(versionId: string, actor = 'SUPERADMIN'): Promise<SystemSettings> {
    const rolledBack = await this.settingsRepo.rollbackSettings(versionId, actor);
    await this.addAuditLog({
      actor,
      actorRole: 'SUPERADMIN',
      action: 'SETTING_ROLLBACK',
      result: 'SUCCESS',
      metadata: { versionId },
    });
    return rolledBack;
  }

  // ==========================================
  // RETRY POLICIES
  // ==========================================
  public async getRetryPolicies(): Promise<RetryPolicy[]> {
    return await this.retryPolicyRepo.getRetryPolicies();
  }

  public async getRetryPolicyByCode(errorCode: string): Promise<RetryPolicy | undefined> {
    const policies = await this.retryPolicyRepo.getRetryPolicies();
    return policies.find((p) => p.errorCode === errorCode && p.enabled);
  }

  public async saveRetryPolicy(policy: RetryPolicy): Promise<RetryPolicy> {
    return await this.retryPolicyRepo.saveRetryPolicy(policy);
  }

  // ==========================================
  // APPLICATION ATTEMPTS (LIFECYCLE HIERARCHY)
  // ==========================================
  public async getApplicationAttempts(jobId?: string): Promise<ApplicationAttempt[]> {
    if (jobId) {
      return await this.attemptRepo.getAttemptsByJobId(jobId);
    }
    // Return all attempts
    return [];
  }

  public async getApplicationAttemptById(attemptId: string): Promise<ApplicationAttempt | null> {
    return await this.attemptRepo.getAttemptById(attemptId);
  }

  public async saveApplicationAttempt(attempt: ApplicationAttempt): Promise<ApplicationAttempt> {
    return await this.attemptRepo.saveAttempt(attempt);
  }

  // ==========================================
  // WORKFLOW RUNS & STEP RUNS
  // ==========================================
  public async getWorkflowRuns(jobId?: string): Promise<WorkflowRun[]> {
    if (jobId) {
      return await this.workflowRunRepo.getRunsByJobId(jobId);
    }
    return [];
  }

  public async getWorkflowRunById(workflowRunId: string): Promise<WorkflowRun | null> {
    return await this.workflowRunRepo.getRunById(workflowRunId);
  }

  public async saveWorkflowRun(run: WorkflowRun): Promise<WorkflowRun> {
    return await this.workflowRunRepo.saveRun(run);
  }

  public async getStepRuns(filter?: { workflowRunId?: string; jobId?: string; status?: string }): Promise<StepRun[]> {
    return await this.stepRunRepo.getStepRuns(filter);
  }

  public async getStepRunById(stepRunId: string): Promise<StepRun | null> {
    return await this.stepRunRepo.getStepRunById(stepRunId);
  }

  public async saveStepRun(stepRun: StepRun): Promise<StepRun> {
    return await this.stepRunRepo.saveStepRun(stepRun);
  }

  // ==========================================
  // AUDIT LOGS (APPEND-ONLY, REDACTED)
  // ==========================================
  public async getAuditLogs(filter?: { jobId?: string; actor?: string; limit?: number }): Promise<AuditLog[]> {
    return await this.auditLogRepo.getAuditLogs(filter);
  }

  public async addAuditLog(log: Omit<AuditLog, 'auditId' | 'timestamp'>): Promise<AuditLog> {
    return await this.auditLogRepo.addAuditLog(log);
  }

  // ==========================================
  // NOTIFICATIONS
  // ==========================================
  public async getNotifications(limit = 50): Promise<Notification[]> {
    return await this.notificationRepo.getNotifications({ limit });
  }

  public async addNotification(notification: Notification, idempotencyKey?: string): Promise<Notification> {
    return await this.notificationRepo.addNotification(notification, idempotencyKey);
  }

  public async updateNotification(notificationId: string, updates: Partial<Notification>): Promise<Notification | null> {
    return await this.notificationRepo.updateNotification(notificationId, updates);
  }

  // ==========================================
  // INTEGRATIONS & SYNC LOGS
  // ==========================================
  public async getIntegrations(): Promise<IntegrationStatusItem[]> {
    const list = await this.integrationRepo.getIntegrations();
    // Dynamically reconcile the 'firebase' item with the actual runtime persistence mode
    return list.map((item) => {
      if (item.id === 'firebase') {
        if (this.persistenceMode === 'FIRESTORE') {
          return {
            ...item,
            status: this.initialized ? 'CONNECTED' : 'DEGRADED',
            details: {
              mode: 'FIRESTORE',
              canonical: true,
              databaseId: config.firebase.databaseId || '(default)',
            },
          };
        } else if (this.persistenceMode === 'FIRESTORE_EMULATOR') {
          return {
            ...item,
            status: this.initialized ? 'CONNECTED' : 'DEGRADED',
            details: {
              mode: 'FIRESTORE_EMULATOR',
              emulatorHost: config.persistence.emulatorHost,
            },
          };
        } else {
          return {
            ...item,
            status: 'DEGRADED',
            name: 'In-Memory Store (Development Mode)',
            details: {
              mode: 'IN_MEMORY',
              note: 'Operating in explicit development in-memory mode. Cloud Firestore is not connected.',
            },
          };
        }
      }
      return item;
    });
  }

  public async updateIntegrationStatus(id: string, updates: Partial<IntegrationStatusItem>): Promise<IntegrationStatusItem> {
    const existingList = await this.integrationRepo.getIntegrations();
    const existing = existingList.find((i) => i.id === id);
    const item: IntegrationStatusItem = {
      id,
      name: existing?.name || id,
      status: existing?.status || 'CONNECTED',
      lastChecked: new Date().toISOString(),
      ...existing,
      ...updates,
    };
    return await this.integrationRepo.updateIntegration(item);
  }

  public async getSheetSyncLogs(limit = 50): Promise<SheetSyncLog[]> {
    return await this.sheetSyncLogRepo.getSyncLogs(limit);
  }

  public async addSheetSyncLog(log: SheetSyncLog): Promise<SheetSyncLog> {
    return await this.sheetSyncLogRepo.addSyncLog(log);
  }

  // ==========================================
  // SCHEDULER TASKS
  // ==========================================
  public async getSchedulerTasks(): Promise<SchedulerTask[]> {
    return await this.schedulerTaskRepo.getTasks();
  }

  public async claimSchedulerTask(taskId: string, workerId: string, lockDurationSeconds = 60): Promise<boolean> {
    return await this.schedulerTaskRepo.claimTask(taskId, workerId, lockDurationSeconds);
  }

  public async releaseSchedulerTask(taskId: string, workerId: string, outcome: { success: boolean; error?: string; durationMs?: number }): Promise<void> {
    return await this.schedulerTaskRepo.releaseTask(taskId, workerId, outcome);
  }

  // ==========================================
  // DASHBOARD METRICS
  // ==========================================
  public async getDashboardMetrics() {
    const { items: jobs } = await this.jobRepo.getJobs({ limit: 1000 });
    const sessions = await this.sessionRepo.getSessions();
    const humanTasks = await this.humanTaskRepo.getTasks();
    const settings = await this.getSettings();

    const activeSessions = sessions.filter((s) => s.status === 'RUNNING' || s.status === 'PAUSED' || s.status === 'STARTING').length;
    const capacityLimit = settings.concurrencyLimit;
    const availableCapacity = capacityLimit !== null ? Math.max(0, capacityLimit - activeSessions) : 999;

    return {
      totalJobs: jobs.length,
      queued: jobs.filter((j) => j.status === 'QUEUED' || j.status === 'PREPARING').length,
      running: jobs.filter(
        (j) =>
          j.status === 'BROWSER_STARTING' ||
          j.status === 'BROWSER_READY' ||
          j.status === 'SIGNUP_STARTED' ||
          j.status === 'REGISTRATION_CONTINUING'
      ).length,
      humanActionRequired: humanTasks.filter((t) => t.status === 'OPEN' || t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS').length,
      waitingForReview: jobs.filter((j) => j.status === 'WAITING_FOR_REVIEW').length,
      approved: jobs.filter((j) => j.status === 'APPROVED' || j.status === 'COMPLETED').length,
      rejected: jobs.filter((j) => j.status === 'REJECTED').length,
      errors: jobs.filter((j) => j.status === 'ERROR').length,
      activeSessions,
      availableCapacity: capacityLimit === null ? 'UNLIMITED' : availableCapacity,
      concurrencyLimit: capacityLimit === null ? 'UNLIMITED' : capacityLimit,
      dailyJobLimit: settings.dailyJobLimit === null ? 'UNLIMITED' : settings.dailyJobLimit,
    };
  }

  public async resetDemoData(): Promise<boolean> {
    if (this.isTestMode) {
      const testJob = this.jobRepo as InMemoryJobRepository;
      testJob.jobs.clear();
      initialJobs.forEach((j) => testJob.jobs.set(j.jobId, { ...j }));
      return true;
    }
    await reconcileFirestoreSeed();
    return true;
  }
}

export const repository = new Repository();
