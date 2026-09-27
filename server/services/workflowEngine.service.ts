import { repository } from '../db/repository.js';
import {
  Job,
  JobStatus,
  HumanTask,
  HumanTaskType,
  ApplicationAttempt,
  UserRole,
  WorkflowRun,
  StepRun,
  WorkflowStepDefinition,
} from '../types.js';
import { goLoginService } from './gologin.service.js';
import { telegramNotificationService } from './telegram.service.js';
import { lockManager } from '../utils/concurrencyLock.js';
import { logger } from '../utils/logger.js';
import { workflowStepRegistry } from './workflowSteps.js';

// Deterministic state transition mapping
export const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  NEW: ['QUEUED', 'CANCELLED'],
  QUEUED: ['PREPARING', 'PAUSED', 'CANCELLED'],
  PREPARING: ['PROFILE_CREATED', 'ERROR', 'PAUSED'],
  PROFILE_CREATED: ['PROXY_CHECKING', 'PROXY_READY', 'ERROR', 'PAUSED'],
  PROXY_CHECKING: ['PROXY_READY', 'ERROR', 'RETRY_PENDING', 'MANUAL_REVIEW'],
  PROXY_READY: ['BROWSER_STARTING', 'ERROR', 'PAUSED'],
  BROWSER_STARTING: ['BROWSER_READY', 'ERROR', 'RETRY_PENDING', 'MANUAL_REVIEW'],
  BROWSER_READY: ['SIGNUP_STARTED', 'PAUSED', 'ERROR'],
  SIGNUP_STARTED: ['WAITING_FOR_EMAIL_OTP', 'PASSWORD_STAGE', 'ERROR', 'PAUSED'],
  WAITING_FOR_EMAIL_OTP: ['HUMAN_ACTION_COMPLETED', 'ERROR', 'PAUSED', 'MANUAL_REVIEW'],
  PASSWORD_STAGE: ['REGISTRATION_CONTINUING', 'ERROR', 'PAUSED'],
  REGISTRATION_CONTINUING: [
    'HUMAN_IDENTITY_VERIFICATION',
    'HUMAN_SELFIE_REQUIRED',
    'HUMAN_BIOMETRIC_REQUIRED',
    'SHOP_INFORMATION',
    'PHONE_VERIFICATION',
    'READY_FOR_SUBMISSION',
    'ERROR',
    'PAUSED',
  ],
  HUMAN_IDENTITY_VERIFICATION: ['HUMAN_ACTION_COMPLETED', 'MANUAL_REVIEW', 'ERROR', 'PAUSED'],
  HUMAN_SELFIE_REQUIRED: ['HUMAN_ACTION_COMPLETED', 'MANUAL_REVIEW', 'ERROR', 'PAUSED'],
  HUMAN_BIOMETRIC_REQUIRED: ['HUMAN_ACTION_COMPLETED', 'MANUAL_REVIEW', 'ERROR', 'PAUSED'],
  HUMAN_ACTION_COMPLETED: [
    'PASSWORD_STAGE',
    'REGISTRATION_CONTINUING',
    'HUMAN_IDENTITY_VERIFICATION',
    'HUMAN_SELFIE_REQUIRED',
    'HUMAN_BIOMETRIC_REQUIRED',
    'SHOP_INFORMATION',
    'PHONE_VERIFICATION',
    'READY_FOR_SUBMISSION',
    'ERROR',
    'PAUSED',
  ],
  SHOP_INFORMATION: ['PHONE_VERIFICATION', 'READY_FOR_SUBMISSION', 'ERROR', 'PAUSED'],
  PHONE_VERIFICATION: ['HUMAN_ACTION_COMPLETED', 'READY_FOR_SUBMISSION', 'MANUAL_REVIEW', 'ERROR', 'PAUSED'],
  READY_FOR_SUBMISSION: ['SUBMITTED', 'MANUAL_REVIEW', 'ERROR', 'PAUSED'],
  SUBMITTED: ['WAITING_FOR_REVIEW', 'MANUAL_REVIEW', 'ERROR'],
  WAITING_FOR_REVIEW: ['APPROVED', 'REJECTED', 'MANUAL_REVIEW', 'ERROR'],
  APPROVED: ['COMPLETED'],
  REJECTED: ['MANUAL_REVIEW', 'QUEUED'], // Legitimate reapplication allowed
  CANCELLED: [],
  PAUSED: [
    'QUEUED',
    'PREPARING',
    'BROWSER_READY',
    'SIGNUP_STARTED',
    'WAITING_FOR_EMAIL_OTP',
    'HUMAN_IDENTITY_VERIFICATION',
    'SUBMITTED',
    'CANCELLED',
    'READY_FOR_SUBMISSION',
    'REGISTRATION_CONTINUING',
  ],
  ERROR: ['RETRY_PENDING', 'MANUAL_REVIEW', 'CANCELLED'],
  RETRY_PENDING: ['QUEUED', 'PREPARING', 'PROXY_CHECKING', 'BROWSER_STARTING'],
  MANUAL_REVIEW: [
    'QUEUED',
    'READY_FOR_SUBMISSION',
    'REJECTED',
    'CANCELLED',
    'PREPARING',
    'BROWSER_READY',
    'SIGNUP_STARTED',
  ],
  COMPLETED: [],
};

export class WorkflowEngine {
  /**
   * Extensible Step Management
   */
  public registerWorkflowStep(step: WorkflowStepDefinition): void {
    workflowStepRegistry.registerStep(step);
  }

  public getWorkflowSteps(): WorkflowStepDefinition[] {
    return workflowStepRegistry.getAllSteps();
  }

  public getWorkflowStep(stepId: string): WorkflowStepDefinition | undefined {
    return workflowStepRegistry.getStep(stepId);
  }

  /**
   * Retrieves or initializes the active WorkflowRun for a Job.
   * Preserves historical runs on reapplication.
   */
  public async getOrCreateActiveWorkflowRun(job: Job): Promise<WorkflowRun> {
    if (job.currentWorkflowRunId) {
      const existing = await repository.getWorkflowRunById(job.currentWorkflowRunId);
      if (existing) {
        return existing;
      }
    }

    const runs = await repository.getWorkflowRuns(job.jobId);
    const active = runs.find((r) => r.status === 'RUNNING' || r.status === 'AWAITING_HUMAN' || r.status === 'PAUSED');
    if (active) {
      job.currentWorkflowRunId = active.workflowRunId;
      await repository.saveJob(job);
      return active;
    }

    const runNumber = job.currentAttemptNo || 1;
    const workflowRunId = `RUN-${job.jobId.replace('JOB-', '')}-${runNumber}-${Date.now().toString().slice(-4)}`;
    const initialStep = workflowStepRegistry.getStepByStatus(job.status);

    const newRun: WorkflowRun = {
      workflowRunId,
      jobId: job.jobId,
      runNumber,
      status: 'RUNNING',
      currentStepId: initialStep?.stepId || 'step_account_prep',
      currentStepName: initialStep?.name || 'Account & Context Preparation',
      currentStatus: job.status,
      currentStep: job.status,
      startedAt: new Date().toISOString(),
      stepRuns: [],
      executionLogs: [
        {
          timestamp: new Date().toISOString(),
          fromStatus: job.status,
          toStatus: job.status,
          actor: 'WORKFLOW_ENGINE',
          message: `Workflow Run #${runNumber} initialized for ${job.shopName}`,
        },
      ],
    };

    await repository.saveWorkflowRun(newRun);
    job.currentWorkflowRunId = workflowRunId;
    await repository.saveJob(job);
    return newRun;
  }

  /**
   * Validate and transition job state deterministically,
   * advancing WorkflowRun and recording StepRun executions.
   */
  public async transitionJob(params: {
    jobId: string;
    newStatus: JobStatus;
    actor: string;
    actorRole?: UserRole;
    reason?: string;
    metadata?: Record<string, any>;
  }): Promise<Job> {
    const job = await repository.getJobById(params.jobId);
    if (!job) {
      throw new Error(`Job not found: ${params.jobId}`);
    }

    const currentStatus = job.status;
    const allowed = VALID_TRANSITIONS[currentStatus] || [];

    // Allow self-transition or transitions from PAUSED/ERROR with supervisor permission
    const isSpecialOverride =
      params.actorRole === 'ADMIN' ||
      params.actorRole === 'SUPERVISOR' ||
      params.newStatus === 'PAUSED' ||
      params.newStatus === 'CANCELLED' ||
      params.newStatus === 'ERROR';

    if (!allowed.includes(params.newStatus) && !isSpecialOverride && currentStatus !== params.newStatus) {
      throw new Error(
        `Invalid state transition: Cannot move Job ${job.jobId} from ${currentStatus} to ${params.newStatus}. Allowed: [${allowed.join(', ')}]`
      );
    }

    // 1. Get or create the active WorkflowRun
    const workflowRun = await this.getOrCreateActiveWorkflowRun(job);

    // 2. Append transition to WorkflowRun executionLogs
    workflowRun.executionLogs.push({
      timestamp: new Date().toISOString(),
      fromStatus: currentStatus,
      toStatus: params.newStatus,
      actor: params.actor,
      message: params.reason || `Transitioned to ${params.newStatus}`,
    });

    // 3. Complete or update previous StepRun if one was active
    const activeStepRuns = await repository.getStepRuns({ workflowRunId: workflowRun.workflowRunId });
    const currentActiveStep = activeStepRuns.find(
      (s) => s.status === 'RUNNING' || s.status === 'AWAITING_HUMAN'
    );

    if (currentActiveStep && currentStatus !== params.newStatus) {
      if (params.newStatus === 'ERROR') {
        currentActiveStep.status = 'FAILED';
        currentActiveStep.errorCode = job.lastErrorCode;
        currentActiveStep.errorMessage = params.reason || job.lastErrorMessage;
      } else if (params.newStatus === 'PAUSED') {
        currentActiveStep.status = 'PAUSED';
      } else {
        currentActiveStep.status = 'COMPLETED';
        currentActiveStep.completedAt = new Date().toISOString();
      }
      currentActiveStep.executionLogs.push({
        timestamp: new Date().toISOString(),
        level: params.newStatus === 'ERROR' ? 'ERROR' : 'INFO',
        message: `Step ended due to transition to ${params.newStatus}: ${params.reason || 'Transition'}`,
      });
      await repository.saveStepRun(currentActiveStep);
    }

    // 4. Update Job status
    job.status = params.newStatus;
    job.updatedAt = new Date().toISOString();

    // Map sub-status based on new status
    switch (params.newStatus) {
      case 'QUEUED':
        job.subStatus = 'WAITING_FOR_WORKER';
        break;
      case 'WAITING_FOR_EMAIL_OTP':
      case 'HUMAN_IDENTITY_VERIFICATION':
      case 'HUMAN_SELFIE_REQUIRED':
      case 'HUMAN_BIOMETRIC_REQUIRED':
      case 'PHONE_VERIFICATION':
        job.subStatus = 'AWAITING_HUMAN';
        break;
      case 'WAITING_FOR_REVIEW':
        job.subStatus = 'REVIEW_POLLING';
        job.nextCheckAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        break;
      case 'APPROVED':
      case 'COMPLETED':
        job.subStatus = 'SUCCESS';
        job.completedAt = new Date().toISOString();
        break;
      case 'ERROR':
        job.subStatus = 'FAILED_TRANSIENT';
        break;
      case 'MANUAL_REVIEW':
        job.subStatus = 'MANUAL_ATTENTION';
        break;
      default:
        job.subStatus = 'IN_PROGRESS';
    }

    // 5. Look up Step Definition for the new status
    const stepDef = workflowStepRegistry.getStepByStatus(params.newStatus);
    let newStepRun: StepRun | undefined;

    if (stepDef && currentStatus !== params.newStatus) {
      const stepRunId = `SR-${workflowRun.workflowRunId}-${stepDef.stepId}-${Date.now().toString().slice(-4)}`;
      newStepRun = {
        stepRunId,
        workflowRunId: workflowRun.workflowRunId,
        jobId: job.jobId,
        stepId: stepDef.stepId,
        stepName: stepDef.name,
        stepType: stepDef.type,
        phase: stepDef.phase,
        status: stepDef.type === 'HUMAN_CHECKPOINT' ? 'AWAITING_HUMAN' : 'RUNNING',
        startedAt: new Date().toISOString(),
        actor: params.actor,
        retryCount: 0,
        executionLogs: [
          {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: `Step '${stepDef.name}' initiated by ${params.actor}`,
          },
        ],
      };
      repository.saveStepRun(newStepRun);

      workflowRun.currentStepId = stepDef.stepId;
      workflowRun.currentStepName = stepDef.name;
    }

    workflowRun.currentStatus = params.newStatus;
    workflowRun.currentStep = params.newStatus;

    // 6. Handle WorkflowRun lifecycle state
    if (params.newStatus === 'APPROVED' || params.newStatus === 'COMPLETED') {
      workflowRun.status = 'COMPLETED';
      workflowRun.endedAt = new Date().toISOString();
    } else if (params.newStatus === 'REJECTED') {
      workflowRun.status = 'FAILED';
      workflowRun.endedAt = new Date().toISOString();
    } else if (params.newStatus === 'CANCELLED') {
      workflowRun.status = 'TERMINATED';
      workflowRun.endedAt = new Date().toISOString();
    } else if (params.newStatus === 'PAUSED') {
      workflowRun.status = 'PAUSED';
    } else if (
      params.newStatus === 'WAITING_FOR_EMAIL_OTP' ||
      params.newStatus === 'HUMAN_IDENTITY_VERIFICATION' ||
      params.newStatus === 'HUMAN_SELFIE_REQUIRED' ||
      params.newStatus === 'HUMAN_BIOMETRIC_REQUIRED' ||
      params.newStatus === 'PHONE_VERIFICATION'
    ) {
      workflowRun.status = 'AWAITING_HUMAN';
    } else if (workflowRun.status === 'PAUSED' || workflowRun.status === 'AWAITING_HUMAN') {
      workflowRun.status = 'RUNNING';
    }

    await repository.saveWorkflowRun(workflowRun);
    await repository.saveJob(job);

    // 7. Append-Only Audit Log
    await repository.addAuditLog({
      actor: params.actor,
      actorRole: params.actorRole || 'ADMIN',
      action: 'STATE_TRANSITION',
      jobId: job.jobId,
      sessionId: job.currentSessionId,
      previousState: currentStatus,
      newState: params.newStatus,
      result: 'SUCCESS',
      reason: params.reason,
      metadata: {
        ...params.metadata,
        workflowRunId: workflowRun.workflowRunId,
        stepRunId: newStepRun?.stepRunId,
      },
    });

    // 8. Checkpoint Handler: Auto-generate Human Task if entering human checkpoint
    await this.handleHumanCheckpoint(job, params.newStatus, newStepRun);

    return job;
  }

  /**
   * Human Checkpoint Principle:
   * Pause automated loop, keep browser session alive, create HUMAN_TASK, alert operator.
   * Links the task to the active StepRun.
   */
  private async handleHumanCheckpoint(job: Job, status: JobStatus, activeStepRun?: StepRun) {
    let taskType: HumanTaskType | null = null;
    let title = '';
    let description = '';

    if (status === 'WAITING_FOR_EMAIL_OTP') {
      taskType = 'EMAIL_OTP';
      title = `Email OTP Verification: ${job.shopName}`;
      description = `1. Check authorized Outlook mailbox for ${job.email}.\n2. Retrieve 6-digit confirmation code.\n3. Enter manually into active browser session.\n4. Confirm completion here.`;
      job.humanAction = 'Awaiting manual entry of Email OTP from Outlook';
    } else if (status === 'HUMAN_IDENTITY_VERIFICATION') {
      taskType = 'IDENTITY_VERIFICATION';
      title = `Identity Verification Checkpoint: ${job.shopName}`;
      description = `Operator must perform required government ID document verification in active session.`;
      job.humanAction = 'Perform manual ID document verification in session';
    } else if (status === 'HUMAN_SELFIE_REQUIRED') {
      taskType = 'SELFIE';
      title = `Selfie Checkpoint: ${job.shopName}`;
      description = `Operator must complete selfie check in session.`;
      job.humanAction = 'Complete selfie verification in session';
    } else if (status === 'HUMAN_BIOMETRIC_REQUIRED') {
      taskType = 'BIOMETRIC';
      title = `Biometric Checkpoint: ${job.shopName}`;
      description = `Operator must confirm biometric authentication.`;
      job.humanAction = 'Complete biometric confirmation';
    } else if (status === 'PHONE_VERIFICATION') {
      taskType = 'PHONE_VERIFICATION';
      title = `Phone Verification Checkpoint: ${job.shopName}`;
      description = `Operator must verify SMS / phone code in session.`;
      job.humanAction = 'Complete manual SMS phone verification';
    }

    if (taskType) {
      const settings = await repository.getSettings();
      const existingTasks = await repository.getHumanTasksByJobId(job.jobId);
      const existingTask = existingTasks.find(
        (t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED'
      );

      if (!existingTask) {
        const taskId = `TASK-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 10)}`;
        const dueAt = new Date(Date.now() + settings.otpTimeoutMinutes * 60 * 1000).toISOString();

        const task: HumanTask = {
          humanTaskId: taskId,
          jobId: job.jobId,
          sessionId: job.currentSessionId,
          taskType,
          title,
          description,
          priority: job.priority,
          status: 'OPEN',
          assignedOperatorId: job.operatorId,
          createdAt: new Date().toISOString(),
          dueAt,
          reminderCount: 0,
        };

        await repository.saveHumanTask(task);

        // Associate with active StepRun if present
        if (activeStepRun) {
          activeStepRun.humanTaskId = taskId;
          activeStepRun.status = 'AWAITING_HUMAN';
          await repository.saveStepRun(activeStepRun);
        }

        await repository.saveJob(job);

        // Notify Operator via Telegram
        await telegramNotificationService.sendHumanTaskAlert(task, job);
      }
    }
  }

  /**
   * Complete a Human Task and advance workflow.
   * Completes StepRun, resumes WorkflowRun, and routes to next configured step.
   */
  public async completeHumanTask(params: {
    taskId: string;
    completedBy: string;
    role?: UserRole;
    notes?: string;
    payload?: Record<string, any>;
  }): Promise<{ task: HumanTask; job: Job }> {
    const task = await repository.getHumanTaskById(params.taskId);
    if (!task) throw new Error(`Task not found: ${params.taskId}`);

    const job = await repository.getJobById(task.jobId);
    if (!job) throw new Error(`Associated Job not found: ${task.jobId}`);

    task.status = 'COMPLETED';
    task.completedAt = new Date().toISOString();
    task.completedBy = params.completedBy;
    task.notes = params.notes;
    task.resolutionPayload = params.payload;
    await repository.saveHumanTask(task);

    job.humanAction = undefined;

    // Find and complete active StepRun
    const stepRuns = await repository.getStepRuns({ jobId: job.jobId });
    const associatedStepRun = stepRuns.find(
      (s) => s.humanTaskId === task.humanTaskId || s.status === 'AWAITING_HUMAN'
    );
    if (associatedStepRun) {
      associatedStepRun.status = 'COMPLETED';
      associatedStepRun.completedAt = new Date().toISOString();
      associatedStepRun.outputPayload = params.payload;
      associatedStepRun.executionLogs.push({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Human checkpoint completed by ${params.completedBy}: ${params.notes || 'Checkpoint approved'}`,
      });
      await repository.saveStepRun(associatedStepRun);
    }

    // Transition job to HUMAN_ACTION_COMPLETED
    await this.transitionJob({
      jobId: job.jobId,
      newStatus: 'HUMAN_ACTION_COMPLETED',
      actor: params.completedBy,
      actorRole: params.role || 'OPERATOR',
      reason: `Operator ${params.completedBy} completed human checkpoint [${task.taskType}].`,
    });

    // Advance to next step (allows explicit payload override or defaults to READY_FOR_SUBMISSION)
    const targetStatus: JobStatus = (params.payload?.nextStatus as JobStatus) || 'READY_FOR_SUBMISSION';
    const updatedJob = await this.transitionJob({
      jobId: job.jobId,
      newStatus: targetStatus,
      actor: 'WORKFLOW_ENGINE',
      reason: `Post-checkpoint continuation to ${targetStatus}.`,
    });

    return { task, job: updatedJob };
  }

  /**
   * Process Background Queue:
   * Dynamic concurrency checking!
   * availableCapacity = configuredCapacity - activeSessions
   */
  public async processQueue(): Promise<{ startedJobs: number; capacityRemaining: number }> {
    const settings = await repository.getSettings();
    if (settings.maintenanceMode) {
      return { startedJobs: 0, capacityRemaining: 0 };
    }

    const sessions = await repository.getSessions();
    const activeSessions = sessions.filter((s) => s.status === 'RUNNING' || s.status === 'STARTING').length;

    const capacityLimit = settings.concurrencyLimit;
    const availableCapacity = capacityLimit !== null ? Math.max(0, capacityLimit - activeSessions) : 999;

    if (availableCapacity <= 0) {
      return { startedJobs: 0, capacityRemaining: 0 };
    }

    const { items: queuedJobsList } = await repository.getJobs({ status: 'QUEUED' });
    const queuedJobs = queuedJobsList
      .filter((j) => j.autoStart)
      .slice(0, availableCapacity);

    let startedJobs = 0;
    for (const job of queuedJobs) {
      try {
        const acquired = await lockManager.acquireLock(`job:${job.jobId}`, 'queue_worker', 45000);
        if (!acquired) {
          logger.warn('QueueWorker', `Job ${job.jobId} is locked by another worker. Skipping.`);
          continue;
        }

        try {
          await this.startJobExecution(job);
          startedJobs++;
        } finally {
          await lockManager.releaseLock(`job:${job.jobId}`, 'queue_worker');
        }
      } catch (err: any) {
        logger.error('QueueWorker', `Error starting queued job ${job.jobId}: ${err.message}`);
      }
    }

    const updatedRemaining = capacityLimit !== null ? Math.max(0, capacityLimit - (activeSessions + startedJobs)) : 999;
    return { startedJobs, capacityRemaining: updatedRemaining };
  }

  /**
   * Checks for duplicate active jobs with same shopName or email
   */
  public async checkDuplicateJob(shopName: string, email: string): Promise<{ isDuplicate: boolean; existingJob?: Job }> {
    return await repository.checkDuplicate(shopName, email);
  }

  /**
   * Step a job through browser startup and preparation with exclusive lock
   */
  public async startJobExecution(job: Job): Promise<Job> {
    return lockManager.withLock(`job_execution:${job.jobId}`, 'job_executor', async () => {
      // 1. Transition to PREPARING
      await this.transitionJob({
        jobId: job.jobId,
        newStatus: 'PREPARING',
        actor: 'QUEUE_MANAGER',
        reason: 'Acquired capacity slot in queue worker.',
      });

      // 2. GoLogin Profile creation if not existing
      if (!job.gologinProfileId) {
        const { profileId, profileName } = await goLoginService.createProfile(job.jobId, job.shopName, job.proxyReference);
        job.gologinProfileId = profileId;
        job.gologinProfileName = profileName;
        await repository.saveJob(job);
      }

      await this.transitionJob({
        jobId: job.jobId,
        newStatus: 'PROFILE_CREATED',
        actor: 'WORKFLOW_ENGINE',
      });

      // 3. Proxy Check
      await this.transitionJob({
        jobId: job.jobId,
        newStatus: 'PROXY_CHECKING',
        actor: 'WORKFLOW_ENGINE',
        reason: 'Validating residential proxy tunnel.',
      });

      await this.transitionJob({
        jobId: job.jobId,
        newStatus: 'PROXY_READY',
        actor: 'WORKFLOW_ENGINE',
        reason: 'Residential proxy tunnel validated.',
      });

      // 4. Start Cloud Browser
      await this.transitionJob({
        jobId: job.jobId,
        newStatus: 'BROWSER_STARTING',
        actor: 'WORKFLOW_ENGINE',
      });

      const session = await goLoginService.startCloudBrowser(job.gologinProfileId!, job);
      job.currentSessionId = session.sessionId;
      job.startedAt = new Date().toISOString();
      repository.saveJob(job);

      await this.transitionJob({
        jobId: job.jobId,
        newStatus: 'BROWSER_READY',
        actor: 'WORKFLOW_ENGINE',
        reason: `Cloud browser session ${session.sessionId} ready.`,
      });

      // 5. Signup started
      await this.transitionJob({
        jobId: job.jobId,
        newStatus: 'SIGNUP_STARTED',
        actor: 'WORKFLOW_ENGINE',
        reason: 'Navigated to merchant signup portal.',
      });

      return job;
    });
  }

  /**
   * Submit application & track attempt history without overwriting previous attempts
   */
  public async submitApplication(jobId: string, actor: string): Promise<Job> {
    const job = await repository.getJobById(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const attemptNo = job.currentAttemptNo || 1;
    const attemptId = `ATT-${job.jobId.replace('JOB-', '')}-${attemptNo}`;

    // Create immutable attempt record
    const attempt: ApplicationAttempt = {
      attemptId,
      attemptNo,
      jobId: job.jobId,
      shopName: job.shopName,
      email: job.email,
      gologinProfileId: job.gologinProfileId,
      submittedAt: new Date().toISOString(),
      reviewStartedAt: new Date().toISOString(),
      finalStatus: 'PENDING',
      nextAttemptAllowed: true,
      operatorId: job.operatorId,
      createdAt: new Date().toISOString(),
      notes: `Submission attempt #${attemptNo} logged.`,
    };
    await repository.saveApplicationAttempt(attempt);

    // Link WorkflowRun to this attempt
    const workflowRun = await this.getOrCreateActiveWorkflowRun(job);
    workflowRun.attemptId = attemptId;
    await repository.saveWorkflowRun(workflowRun);

    job.submittedAt = new Date().toISOString();
    await repository.saveJob(job);

    await this.transitionJob({
      jobId: job.jobId,
      newStatus: 'SUBMITTED',
      actor,
      reason: `Application submitted for attempt #${attemptNo}.`,
    });

    await this.transitionJob({
      jobId: job.jobId,
      newStatus: 'WAITING_FOR_REVIEW',
      actor: 'WORKFLOW_ENGINE',
      reason: 'Moved to review monitor queue.',
    });

    return job;
  }

  /**
   * Record Application Rejection and update latest attempt without overwriting prior history
   */
  public async recordRejection(params: {
    jobId: string;
    rejectionReason: string;
    actor: string;
  }): Promise<Job> {
    const job = await repository.getJobById(params.jobId);
    if (!job) throw new Error(`Job not found: ${params.jobId}`);

    const currentAttempts = await repository.getApplicationAttempts(job.jobId);
    const latestAttempt = currentAttempts[0];
    if (latestAttempt) {
      latestAttempt.finalStatus = 'REJECTED';
      latestAttempt.rejectionReason = params.rejectionReason;
      latestAttempt.completedAt = new Date().toISOString();
      await repository.saveApplicationAttempt(latestAttempt);
    }

    job.lastErrorCode = 'APPLICATION_REJECTED';
    job.lastErrorMessage = params.rejectionReason;
    await repository.saveJob(job);

    await this.transitionJob({
      jobId: job.jobId,
      newStatus: 'REJECTED',
      actor: params.actor,
      reason: params.rejectionReason,
    });

    return job;
  }

  /**
   * Create a new legitimate reapplication attempt (e.g. ATTEMPT #2, #3)
   * Does NOT overwrite previous attempts or previous workflow runs!
   */
  public async createReapplicationAttempt(jobId: string, actor: string): Promise<Job> {
    const job = await repository.getJobById(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const nextAttemptNo = (job.currentAttemptNo || 1) + 1;
    job.currentAttemptNo = nextAttemptNo;
    job.status = 'QUEUED';
    job.subStatus = 'WAITING_FOR_WORKER';
    job.notes = `New reapplication attempt #${nextAttemptNo} requested by ${actor}.`;
    job.updatedAt = new Date().toISOString();

    // Create new ApplicationAttempt record for Attempt #N
    const newAttemptId = `ATT-${job.jobId.replace('JOB-', '')}-${nextAttemptNo}`;
    const newAttempt: ApplicationAttempt = {
      attemptId: newAttemptId,
      attemptNo: nextAttemptNo,
      jobId: job.jobId,
      shopName: job.shopName,
      email: job.email,
      gologinProfileId: job.gologinProfileId,
      finalStatus: 'PENDING',
      nextAttemptAllowed: true,
      operatorId: job.operatorId,
      createdAt: new Date().toISOString(),
      notes: `Reapplication attempt #${nextAttemptNo} initiated by ${actor}.`,
    };
    await repository.saveApplicationAttempt(newAttempt);

    // Initialize new WorkflowRun for Attempt #N
    const newRunId = `RUN-${job.jobId.replace('JOB-', '')}-${nextAttemptNo}-${Date.now().toString().slice(-4)}`;
    const initialStep = workflowStepRegistry.getStepByStatus('QUEUED');

    const newWorkflowRun: WorkflowRun = {
      workflowRunId: newRunId,
      jobId: job.jobId,
      runNumber: nextAttemptNo,
      attemptId: newAttemptId,
      status: 'RUNNING',
      currentStepId: initialStep?.stepId || 'step_account_prep',
      currentStepName: initialStep?.name || 'Account & Context Preparation',
      currentStatus: 'QUEUED',
      currentStep: 'QUEUED',
      startedAt: new Date().toISOString(),
      stepRuns: [],
      executionLogs: [
        {
          timestamp: new Date().toISOString(),
          fromStatus: 'REJECTED',
          toStatus: 'QUEUED',
          actor,
          message: `Reapplication Workflow Run #${nextAttemptNo} started.`,
        },
      ],
    };
    await repository.saveWorkflowRun(newWorkflowRun);

    job.currentWorkflowRunId = newRunId;
    await repository.saveJob(job);

    await repository.addAuditLog({
      actor,
      actorRole: 'SUPERVISOR',
      action: 'REAPPLICATION_CREATED',
      jobId: job.jobId,
      previousState: 'REJECTED',
      newState: 'QUEUED',
      result: 'SUCCESS',
      metadata: { attemptNo: nextAttemptNo, workflowRunId: newRunId },
    });

    return job;
  }
}

export const workflowEngine = new WorkflowEngine();
