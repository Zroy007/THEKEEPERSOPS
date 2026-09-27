import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { workflowEngine, VALID_TRANSITIONS } from '../server/services/workflowEngine.service.js';
import { repository } from '../server/db/repository.js';
import { Job } from '../server/types.js';

describe('WorkflowEngine State Machine & Transitions', () => {
  test('valid transitions follow deterministic graph', () => {
    assert.ok(VALID_TRANSITIONS['NEW'].includes('QUEUED'));
    assert.ok(VALID_TRANSITIONS['QUEUED'].includes('PREPARING'));
    assert.ok(VALID_TRANSITIONS['WAITING_FOR_EMAIL_OTP'].includes('HUMAN_ACTION_COMPLETED'));
    assert.ok(VALID_TRANSITIONS['READY_FOR_SUBMISSION'].includes('SUBMITTED'));
    assert.ok(VALID_TRANSITIONS['SUBMITTED'].includes('WAITING_FOR_REVIEW'));
    assert.ok(VALID_TRANSITIONS['WAITING_FOR_REVIEW'].includes('APPROVED'));
    assert.ok(VALID_TRANSITIONS['WAITING_FOR_REVIEW'].includes('REJECTED'));
  });

  test('invalid transition throws descriptive error', async () => {
    const testJobId = `TEST-JOB-${Date.now()}`;
    const job: Job = {
      jobId: testJobId,
      shopName: 'Test Invalid Transition Shop',
      email: 'invalid.transition@test.org',
      passwordReference: 'sec://vault/test',
      proxyReference: 'proxy://test',
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
      tags: ['test'],
    };
    await repository.saveJob(job);

    await assert.rejects(
      async () => {
        // QUEUED cannot jump directly to APPROVED as OPERATOR
        await workflowEngine.transitionJob({
          jobId: testJobId,
          newStatus: 'APPROVED',
          actor: 'TEST_OPERATOR',
          actorRole: 'OPERATOR',
        });
      },
      (err: any) => {
        return err.message.includes('Invalid state transition');
      }
    );
  });

  test('entering human checkpoint WAITING_FOR_EMAIL_OTP creates HumanTask', async () => {
    const testJobId = `TEST-OTP-${Date.now()}`;
    const job: Job = {
      jobId: testJobId,
      shopName: 'Test OTP Checkpoint Shop',
      email: 'otp.check@test.org',
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
      tags: ['test'],
    };
    await repository.saveJob(job);

    await workflowEngine.transitionJob({
      jobId: testJobId,
      newStatus: 'WAITING_FOR_EMAIL_OTP',
      actor: 'AUTOMATION_RUNNER',
    });

    const updatedJob = await repository.getJobById(testJobId);
    assert.equal(updatedJob?.status, 'WAITING_FOR_EMAIL_OTP');
    assert.equal(updatedJob?.subStatus, 'AWAITING_HUMAN');

    const tasks = await repository.getHumanTasksByJobId(testJobId);
    assert.ok(tasks.length > 0);
    assert.equal(tasks[0].taskType, 'EMAIL_OTP');
    assert.equal(tasks[0].status, 'OPEN');
  });

  test('resolving HumanTask resumes workflow to READY_FOR_SUBMISSION', async () => {
    const testJobId = `TEST-RESOLVE-${Date.now()}`;
    const job: Job = {
      jobId: testJobId,
      shopName: 'Test Resolve Task Shop',
      email: 'resolve.task@test.org',
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
      tags: ['test'],
    };
    await repository.saveJob(job);

    await workflowEngine.transitionJob({
      jobId: testJobId,
      newStatus: 'WAITING_FOR_EMAIL_OTP',
      actor: 'AUTOMATION_RUNNER',
    });

    const tasks = await repository.getHumanTasksByJobId(testJobId);
    assert.ok(tasks.length > 0);
    const task = tasks[0];

    const result = await workflowEngine.completeHumanTask({
      taskId: task.humanTaskId,
      completedBy: 'OP-TEST',
      notes: 'Manually verified 6-digit code',
    });

    assert.equal(result.task.status, 'COMPLETED');
    assert.equal(result.job.status, 'READY_FOR_SUBMISSION');
    assert.equal(result.job.humanAction, undefined);
  });

  test('submission and reapplication preserves attempt numbering', async () => {
    const testJobId = `TEST-REAPPLY-${Date.now()}`;
    const job: Job = {
      jobId: testJobId,
      shopName: 'Reapplication Test Brand',
      email: 'reapply.brand@test.org',
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
      tags: ['test'],
    };
    await repository.saveJob(job);

    // 1. Submit attempt #1
    await workflowEngine.submitApplication(testJobId, 'OPERATOR_1');
    const attempts1 = await repository.getApplicationAttempts(testJobId);
    assert.equal(attempts1.length, 1);
    assert.equal(attempts1[0].attemptNo, 1);

    // 2. Reject attempt #1
    await workflowEngine.recordRejection({
      jobId: testJobId,
      rejectionReason: 'ID document photo blurry',
      actor: 'REVIEW_SYSTEM',
    });
    const rejectedJob = await repository.getJobById(testJobId);
    assert.equal(rejectedJob?.status, 'REJECTED');

    // 3. Create legitimate reapplication attempt #2
    const reappliedJob = await workflowEngine.createReapplicationAttempt(testJobId, 'SUPERVISOR_1');
    assert.equal(reappliedJob.currentAttemptNo, 2);
    assert.equal(reappliedJob.status, 'QUEUED');

    // Submit attempt #2
    await workflowEngine.transitionJob({
      jobId: testJobId,
      newStatus: 'PREPARING',
      actor: 'QUEUE_WORKER',
    });
    await workflowEngine.transitionJob({
      jobId: testJobId,
      newStatus: 'PROFILE_CREATED',
      actor: 'QUEUE_WORKER',
    });
    await workflowEngine.transitionJob({
      jobId: testJobId,
      newStatus: 'PROXY_READY',
      actor: 'QUEUE_WORKER',
    });
    await workflowEngine.transitionJob({
      jobId: testJobId,
      newStatus: 'BROWSER_STARTING',
      actor: 'QUEUE_WORKER',
    });
    await workflowEngine.transitionJob({
      jobId: testJobId,
      newStatus: 'BROWSER_READY',
      actor: 'QUEUE_WORKER',
    });
    await workflowEngine.transitionJob({
      jobId: testJobId,
      newStatus: 'SIGNUP_STARTED',
      actor: 'QUEUE_WORKER',
    });
    await workflowEngine.transitionJob({
      jobId: testJobId,
      newStatus: 'PASSWORD_STAGE',
      actor: 'QUEUE_WORKER',
    });
    await workflowEngine.transitionJob({
      jobId: testJobId,
      newStatus: 'REGISTRATION_CONTINUING',
      actor: 'QUEUE_WORKER',
    });
    await workflowEngine.transitionJob({
      jobId: testJobId,
      newStatus: 'READY_FOR_SUBMISSION',
      actor: 'QUEUE_WORKER',
    });
    await workflowEngine.submitApplication(testJobId, 'OPERATOR_1');

    const allAttempts = await repository.getApplicationAttempts(testJobId);
    assert.equal(allAttempts.length, 2);
    const attempt2 = allAttempts.find((a) => a.attemptNo === 2);
    const attempt1 = allAttempts.find((a) => a.attemptNo === 1);
    assert.ok(attempt2, 'Attempt 2 must exist');
    assert.ok(attempt1, 'Attempt 1 must exist');
    assert.equal(attempt1?.finalStatus, 'REJECTED');
  });
});
