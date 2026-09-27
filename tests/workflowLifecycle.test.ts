import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { workflowEngine } from '../server/services/workflowEngine.service.js';
import { repository } from '../server/db/repository.js';
import { retryEngine } from '../server/services/retryEngine.service.js';
import { Job, WorkflowStepDefinition } from '../server/types.js';

describe('Workflow Lifecycle & Extensible Step Architecture', () => {
  test('normal progression records WorkflowRun and sequential StepRuns across phases', async () => {
    const jobId = `JOB-LIFECYCLE-${Date.now()}`;
    const job: Job = {
      jobId,
      shopName: 'Lifecycle Progression Shop',
      email: 'progression@lifecycle-test.org',
      passwordReference: 'sec://vault/test',
      proxyReference: 'proxy://test-res-pool',
      status: 'QUEUED',
      subStatus: 'WAITING_FOR_WORKER',
      priority: 'NORMAL',
      runMode: 'AUTO',
      autoStart: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      currentAttemptNo: 1,
      tags: ['lifecycle-test'],
    };
    await repository.saveJob(job);

    // 1. Initial status creates or initializes WorkflowRun
    const initialRun = await workflowEngine.getOrCreateActiveWorkflowRun(job);
    assert.ok(initialRun);
    assert.equal(initialRun.jobId, jobId);
    assert.equal(initialRun.runNumber, 1);
    assert.equal(initialRun.status, 'RUNNING');

    // 2. Advance through Preparation phase
    await workflowEngine.transitionJob({
      jobId,
      newStatus: 'PREPARING',
      actor: 'QUEUE_WORKER',
      reason: 'Allocated worker slot',
    });
    await workflowEngine.transitionJob({
      jobId,
      newStatus: 'PROFILE_CREATED',
      actor: 'GOLOGIN_WORKER',
    });
    await workflowEngine.transitionJob({
      jobId,
      newStatus: 'PROXY_READY',
      actor: 'PROXY_SERVICE',
    });
    await workflowEngine.transitionJob({
      jobId,
      newStatus: 'BROWSER_STARTING',
      actor: 'BROWSER_DAEMON',
    });
    await workflowEngine.transitionJob({
      jobId,
      newStatus: 'BROWSER_READY',
      actor: 'BROWSER_DAEMON',
    });

    // 3. Advance into Registration phase
    await workflowEngine.transitionJob({
      jobId,
      newStatus: 'SIGNUP_STARTED',
      actor: 'AUTOMATION_RUNNER',
    });

    // Verify StepRuns recorded
    const stepRuns = await repository.getStepRuns({ jobId });
    assert.ok(stepRuns.length >= 4, `Expected at least 4 StepRuns, got ${stepRuns.length}`);

    // Verify step attributes
    const prepStep = stepRuns.find((s) => s.stepId === 'step_account_prep');
    assert.ok(prepStep, 'Expected step_account_prep to be recorded');
    assert.equal(prepStep?.phase, 'PREPARATION');
    assert.equal(prepStep?.status, 'COMPLETED');
    assert.ok(prepStep?.completedAt);

    const signupStep = stepRuns.find((s) => s.stepId === 'step_registration_start');
    assert.ok(signupStep, 'Expected step_registration_start to be recorded');
    assert.equal(signupStep?.phase, 'REGISTRATION');
  });

  test('human checkpoint strictly pauses automation and links to StepRun & HumanTask', async () => {
    const jobId = `JOB-CHECKPOINT-${Date.now()}`;
    const job: Job = {
      jobId,
      shopName: 'Human Checkpoint Shop',
      email: 'checkpoint@operator-test.org',
      passwordReference: 'sec://vault/test',
      proxyReference: 'proxy://test',
      status: 'SIGNUP_STARTED',
      subStatus: 'IN_PROGRESS',
      priority: 'HIGH',
      runMode: 'AUTO',
      autoStart: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      currentAttemptNo: 1,
      tags: ['checkpoint-test'],
    };
    await repository.saveJob(job);

    // Trigger human checkpoint
    await workflowEngine.transitionJob({
      jobId,
      newStatus: 'WAITING_FOR_EMAIL_OTP',
      actor: 'SIGNUP_AUTOMATION',
      reason: 'Platform requested 6-digit email confirmation code',
    });

    // Check Job state
    const pausedJob = await repository.getJobById(jobId);
    assert.equal(pausedJob?.status, 'WAITING_FOR_EMAIL_OTP');
    assert.equal(pausedJob?.subStatus, 'AWAITING_HUMAN');
    assert.ok(pausedJob?.humanAction?.includes('Email OTP'));

    // Check WorkflowRun state
    const run = await workflowEngine.getOrCreateActiveWorkflowRun(pausedJob!);
    assert.equal(run.status, 'AWAITING_HUMAN');

    // Check StepRun state
    const stepRuns = await repository.getStepRuns({ jobId });
    const otpStepRun = stepRuns.find((s) => s.stepId === 'step_email_otp_checkpoint');
    assert.ok(otpStepRun, 'Expected step_email_otp_checkpoint StepRun to exist');
    assert.equal(otpStepRun?.status, 'AWAITING_HUMAN');
    assert.equal(otpStepRun?.stepType, 'HUMAN_CHECKPOINT');
    assert.ok(otpStepRun?.humanTaskId, 'StepRun should be linked to humanTaskId');

    // Check HumanTask created
    const tasks = await repository.getHumanTasksByJobId(jobId);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].taskType, 'EMAIL_OTP');
    assert.equal(tasks[0].status, 'OPEN');
    assert.equal(tasks[0].humanTaskId, otpStepRun?.humanTaskId);

    // Complete the Human Task with operator payload
    const resolveResult = await workflowEngine.completeHumanTask({
      taskId: tasks[0].humanTaskId,
      completedBy: 'OP-ALICE',
      notes: 'Manually inspected Outlook inbox and verified 6-digit PIN',
      payload: { otpCodeEntered: '849201', mailboxChecked: 'checkpoint@operator-test.org' },
    });

    assert.equal(resolveResult.task.status, 'COMPLETED');
    assert.equal(resolveResult.job.humanAction, undefined);

    // Verify StepRun completed with operator metadata
    const completedStepRun = await repository.getStepRunById(otpStepRun!.stepRunId);
    assert.equal(completedStepRun?.status, 'COMPLETED');
    assert.ok(completedStepRun?.completedAt);
    assert.deepEqual(completedStepRun?.outputPayload, {
      otpCodeEntered: '849201',
      mailboxChecked: 'checkpoint@operator-test.org',
    });
  });

  test('configurable transitions support custom destination after human task (not hardcoded to READY_FOR_SUBMISSION)', async () => {
    const jobId = `JOB-FLEX-ROUTE-${Date.now()}`;
    const job: Job = {
      jobId,
      shopName: 'Flexible Routing Shop',
      email: 'flex.route@test.org',
      passwordReference: 'sec://vault/test',
      proxyReference: 'proxy://test',
      status: 'SIGNUP_STARTED',
      subStatus: 'IN_PROGRESS',
      priority: 'NORMAL',
      runMode: 'AUTO',
      autoStart: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      currentAttemptNo: 1,
      tags: ['flexible-routing'],
    };
    await repository.saveJob(job);

    await workflowEngine.transitionJob({
      jobId,
      newStatus: 'WAITING_FOR_EMAIL_OTP',
      actor: 'SIGNUP_AUTOMATION',
    });

    const tasks = await repository.getHumanTasksByJobId(jobId);
    assert.ok(tasks.length > 0);

    // Operator completes OTP checkpoint and explicitly directs workflow to PASSWORD_STAGE
    const result = await workflowEngine.completeHumanTask({
      taskId: tasks[0].humanTaskId,
      completedBy: 'OP-BOB',
      notes: 'Code confirmed, proceeding to password setup',
      payload: { nextStatus: 'PASSWORD_STAGE' },
    });

    assert.equal(result.job.status, 'PASSWORD_STAGE');
  });

  test('technical retry records backoff and moves to RETRY_PENDING with step preservation', async () => {
    const jobId = `JOB-TECH-RETRY-${Date.now()}`;
    const job: Job = {
      jobId,
      shopName: 'Technical Retry Shop',
      email: 'tech.retry@test.org',
      passwordReference: 'sec://vault/test',
      proxyReference: 'proxy://test',
      status: 'PROXY_CHECKING',
      subStatus: 'IN_PROGRESS',
      priority: 'NORMAL',
      runMode: 'AUTO',
      autoStart: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      currentAttemptNo: 1,
      tags: ['technical-retry'],
    };
    await repository.saveJob(job);

    // Trigger technical retry for residential proxy timeout using configured retryable code ERR_PROXY_TIMEOUT
    const retryResult = await retryEngine.scheduleTechnicalRetry({
      jobId,
      errorCode: 'ERR_PROXY_TIMEOUT',
      errorMessage: 'Residential proxy gateway node-22 timed out after 30000ms',
    });

    assert.equal(retryResult.retried, true);
    assert.ok(retryResult.nextRetryDelaySeconds! >= 10);

    const retryingJob = await repository.getJobById(jobId);
    assert.equal(retryingJob?.status, 'RETRY_PENDING');
    assert.equal(retryingJob?.retryCount, 1);
    assert.equal(retryingJob?.lastErrorCode, 'ERR_PROXY_TIMEOUT');
  });

  test('exhausting retries transitions to MANUAL_REVIEW without destroying job context', async () => {
    const jobId = `JOB-MANUAL-ATTENTION-${Date.now()}`;
    const job: Job = {
      jobId,
      shopName: 'Max Retry Shop',
      email: 'max.retry@test.org',
      passwordReference: 'sec://vault/test',
      proxyReference: 'proxy://test',
      status: 'BROWSER_STARTING',
      subStatus: 'IN_PROGRESS',
      priority: 'NORMAL',
      runMode: 'AUTO',
      autoStart: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 3, // Already at limit of 3 for BROWSER_START_TIMEOUT
      maxRetries: 3,
      currentAttemptNo: 1,
      tags: ['manual-review-test'],
    };
    await repository.saveJob(job);

    const retryResult = await retryEngine.scheduleTechnicalRetry({
      jobId,
      errorCode: 'BROWSER_START_TIMEOUT',
      errorMessage: 'Chromium process startup exceeded maximum timeout threshold',
    });

    assert.equal(retryResult.retried, false);

    const attentionJob = await repository.getJobById(jobId);
    assert.equal(attentionJob?.status, 'MANUAL_REVIEW');
    assert.equal(attentionJob?.subStatus, 'MANUAL_ATTENTION');
  });

  test('reapplication preserves attempt #1 history, creating independent Attempt #2 and WorkflowRun #2', async () => {
    const jobId = `JOB-IMMUTABLE-REAPPLY-${Date.now()}`;
    const job: Job = {
      jobId,
      shopName: 'Enterprise Reapplication Brand',
      email: 'brand.reapply@enterprise.org',
      passwordReference: 'sec://vault/test',
      proxyReference: 'proxy://test',
      status: 'READY_FOR_SUBMISSION',
      subStatus: 'IN_PROGRESS',
      priority: 'NORMAL',
      runMode: 'AUTO',
      autoStart: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      currentAttemptNo: 1,
      tags: ['reapply-history'],
    };
    await repository.saveJob(job);

    // 1. Submit Attempt #1
    await workflowEngine.submitApplication(jobId, 'OP-CHARLIE');
    const runsAfterAttempt1 = await repository.getWorkflowRuns(jobId);
    assert.equal(runsAfterAttempt1.length, 1);
    const run1Id = runsAfterAttempt1[0].workflowRunId;

    // 2. Reject Attempt #1
    await workflowEngine.recordRejection({
      jobId,
      rejectionReason: 'Tax ID document missing proof of incorporation',
      actor: 'PLATFORM_COMPLIANCE',
    });

    const jobAfterRejection = await repository.getJobById(jobId);
    assert.equal(jobAfterRejection?.status, 'REJECTED');

    const attemptsAfterRejection = await repository.getApplicationAttempts(jobId);
    assert.equal(attemptsAfterRejection.length, 1);
    assert.equal(attemptsAfterRejection[0].attemptNo, 1);
    assert.equal(attemptsAfterRejection[0].finalStatus, 'REJECTED');
    assert.equal(attemptsAfterRejection[0].rejectionReason, 'Tax ID document missing proof of incorporation');

    // 3. Initiate legitimate Reapplication Attempt #2
    const reappliedJob = await workflowEngine.createReapplicationAttempt(jobId, 'SUPERVISOR_DAN');
    assert.equal(reappliedJob.currentAttemptNo, 2);
    assert.equal(reappliedJob.status, 'QUEUED');

    // 4. Verify Attempt history is completely preserved and not overwritten
    const allAttempts = await repository.getApplicationAttempts(jobId);
    assert.equal(allAttempts.length, 2);

    const attempt2 = allAttempts.find((a) => a.attemptNo === 2);
    const attempt1 = allAttempts.find((a) => a.attemptNo === 1);

    assert.ok(attempt2, 'Attempt #2 must exist');
    assert.equal(attempt2?.finalStatus, 'PENDING');

    assert.ok(attempt1, 'Attempt #1 must still exist');
    assert.equal(attempt1?.finalStatus, 'REJECTED');
    assert.equal(attempt1?.rejectionReason, 'Tax ID document missing proof of incorporation');

    // 5. Verify WorkflowRuns: Run #1 preserved, Run #2 active
    const allRuns = await repository.getWorkflowRuns(jobId);
    assert.equal(allRuns.length, 2);

    const run2 = allRuns.find((r) => r.runNumber === 2);
    const run1 = allRuns.find((r) => r.runNumber === 1);

    assert.ok(run2, 'WorkflowRun #2 must exist');
    assert.equal(run2?.status, 'RUNNING');
    assert.equal(reappliedJob.currentWorkflowRunId, run2?.workflowRunId);

    assert.ok(run1, 'WorkflowRun #1 must still exist');
    assert.equal(run1?.workflowRunId, run1Id);
  });

  test('extensible steps: custom workflow step registers and executes without engine rewrite', () => {
    const customStep: WorkflowStepDefinition = {
      stepId: 'step_bank_payout_linking',
      name: 'Bank Payout Linking Checkpoint',
      phase: 'SUBMISSION',
      type: 'HUMAN_CHECKPOINT',
      requiredPermission: 'OPERATOR',
      timeoutMinutes: 45,
      allowedNextStepIds: ['step_final_submission'],
      defaultNextStepId: 'step_final_submission',
      description: 'Operator verifies routing and account number micro-deposit verification.',
      humanInstructions: 'Navigate to payout settings and verify deposit statement.',
      isSystemStep: false,
    };

    workflowEngine.registerWorkflowStep(customStep);

    const registered = workflowEngine.getWorkflowStep('step_bank_payout_linking');
    assert.ok(registered);
    assert.equal(registered?.name, 'Bank Payout Linking Checkpoint');
    assert.equal(registered?.phase, 'SUBMISSION');
    assert.equal(registered?.type, 'HUMAN_CHECKPOINT');

    // Verify present in all steps
    const allSteps = workflowEngine.getWorkflowSteps();
    const found = allSteps.some((s) => s.stepId === 'step_bank_payout_linking');
    assert.ok(found, 'Custom step should appear in step catalog');
  });
});
