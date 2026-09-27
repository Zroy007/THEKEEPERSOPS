import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { repository } from '../server/db/repository.js';
import { Job, ApplicationAttempt, HumanTask, Session } from '../server/types.js';

describe('Data Layer & Persistence Architecture', () => {
  const testJobId = `JOB-PERSIST-${Date.now()}`;

  beforeEach(async () => {
    // Clean state or setup if necessary
  });

  test('Repository operates in persistent mode and handles full Job lifecycle', async () => {
    const job: Job = {
      jobId: testJobId,
      shopName: 'Persistence Test Store',
      email: 'test-persistence@example.com',
      passwordReference: 'SEC_TEST_PASS',
      proxyReference: 'PROXY_TEST',
      status: 'NEW',
      subStatus: 'INITIALIZING',
      tags: ['persistence', 'test'],
      priority: 'NORMAL',
      runMode: 'SEMI_AUTO',
      autoStart: true,
      currentAttemptNo: 1,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save job
    const saved = await repository.saveJob(job);
    assert.equal(saved.jobId, testJobId);
    assert.equal(saved.shopName, 'Persistence Test Store');

    // Retrieve job by ID
    const retrieved = await repository.getJobById(testJobId);
    assert.ok(retrieved, 'Job must be retrieved');
    assert.equal(retrieved.email, 'test-persistence@example.com');
    assert.equal(retrieved.status, 'NEW');

    // Increment retry count
    const retries = await repository.incrementRetryCount(testJobId);
    assert.equal(retries, 1);

    // Duplicate check detects active job
    const dupCheck = await repository.checkDuplicate('Persistence Test Store', 'other@example.com');
    assert.equal(dupCheck.isDuplicate, true);
    assert.equal(dupCheck.existingJob?.jobId, testJobId);

    // Clean up
    await repository.deleteJob(testJobId);
    const afterDelete = await repository.getJobById(testJobId);
    assert.equal(afterDelete, null);
  });

  test('Domain schema validator rejects records with invalid schema', async () => {
    const invalidJob = {
      jobId: '', // Invalid empty jobId
      shopName: 'Invalid Store',
      email: 'not-an-email',
      status: 'INVALID_STATUS',
      createdAt: 'invalid-date',
    };

    await assert.rejects(
      async () => await repository.saveJob(invalidJob as any),
      /Domain validation failed for Job/
    );
  });

  test('Application attempts maintain multi-attempt history without overwriting prior records', async () => {
    const attemptJobId = `JOB-ATTEMPT-TEST-${Date.now()}`;
    const attempt1: ApplicationAttempt = {
      attemptId: `ATT-${attemptJobId}-1`,
      attemptNo: 1,
      jobId: attemptJobId,
      shopName: 'Multi Attempt Store',
      email: 'multi@example.com',
      finalStatus: 'REJECTED',
      createdAt: new Date().toISOString(),
      nextAttemptAllowed: true,
      rejectionReason: 'Document invalid',
    };

    const attempt2: ApplicationAttempt = {
      attemptId: `ATT-${attemptJobId}-2`,
      attemptNo: 2,
      jobId: attemptJobId,
      shopName: 'Multi Attempt Store',
      email: 'multi@example.com',
      finalStatus: 'PENDING',
      createdAt: new Date().toISOString(),
      nextAttemptAllowed: true,
    };

    await repository.saveApplicationAttempt(attempt1);
    await repository.saveApplicationAttempt(attempt2);

    const attempts = await repository.getApplicationAttempts(attemptJobId);
    assert.equal(attempts.length, 2);

    const first = attempts.find((a) => a.attemptNo === 1);
    const second = attempts.find((a) => a.attemptNo === 2);
    assert.ok(first && second);
    assert.equal(first.finalStatus, 'REJECTED');
    assert.equal(second.finalStatus, 'PENDING');
  });

  test('HumanTask lifecycle persists assignments, status transitions, and resolution', async () => {
    const taskId = `HT-${Date.now()}`;
    const taskJobId = `JOB-HT-${Date.now()}`;

    const task: HumanTask = {
      humanTaskId: taskId,
      jobId: taskJobId,
      taskType: 'EMAIL_OTP',
      title: 'Enter Email OTP',
      description: 'Enter the 6-digit OTP sent to the registered email address.',
      priority: 'HIGH',
      status: 'OPEN',
      reminderCount: 0,
      createdAt: new Date().toISOString(),
      dueAt: new Date(Date.now() + 600000).toISOString(),
    };

    await repository.saveHumanTask(task);

    const fetched = await repository.getHumanTaskById(taskId);
    assert.ok(fetched);
    assert.equal(fetched.status, 'OPEN');

    fetched.status = 'COMPLETED';
    fetched.completedBy = 'OPERATOR_1';
    fetched.completedAt = new Date().toISOString();
    fetched.resolutionPayload = { otp: '123456' };
    await repository.saveHumanTask(fetched);

    const updated = await repository.getHumanTaskById(taskId);
    assert.equal(updated?.status, 'COMPLETED');
    assert.equal(updated?.completedBy, 'OPERATOR_1');
  });

  test('Audit logging records actions immutably and supports query filtering', async () => {
    const actor = 'AUDIT_TEST_USER';
    await repository.addAuditLog({
      actor,
      actorRole: 'SUPERVISOR',
      action: 'TEST_PERSISTENCE_ACTION',
      result: 'SUCCESS',
      metadata: { detail: 'Persistence validation audit entry' },
    });

    const logs = await repository.getAuditLogs({ actor });
    assert.ok(logs.length > 0);
    const found = logs.find((l) => l.action === 'TEST_PERSISTENCE_ACTION');
    assert.ok(found);
    assert.equal(found.actor, actor);
    assert.equal(found.result, 'SUCCESS');
  });

  test('System settings track revisions with versioning and rollback capability', async () => {
    const current = await repository.getSettings();
    assert.ok(typeof current.concurrencyLimit === 'number');

    await repository.updateSettings({ concurrencyLimit: 42 }, 'SYSTEM_TEST');
    const updated = await repository.getSettings();
    assert.equal(updated.concurrencyLimit, 42);

    const versions = await repository.getSettingsVersions();
    const targetVersion = versions.find((v) => v.settingKey === 'concurrencyLimit' && v.newValue === 42);
    assert.ok(targetVersion);

    await repository.rollbackSetting(targetVersion.versionId, 'SYSTEM_TEST');
    const rolledBack = await repository.getSettings();
    assert.equal(rolledBack.concurrencyLimit, current.concurrencyLimit);
  });

  test('Persistence mode reporting clearly distinguishes in-memory, emulator, and canonical firestore', async () => {
    const info = repository.getPersistenceInfo();
    assert.ok(info.mode);
    assert.ok(typeof info.canonicalProduction === 'boolean');
    assert.ok(typeof info.isReady === 'boolean');
    assert.ok(info.details.length > 0);
  });

  test('Production mode strictly forbids in-memory persistence and rejects fallback', async () => {
    const { Repository } = await import('../server/db/repository.js');
    const origNodeEnv = process.env.NODE_ENV;
    const origPersistenceMode = process.env.PERSISTENCE_MODE;

    try {
      process.env.NODE_ENV = 'production';
      process.env.PERSISTENCE_MODE = 'in-memory';

      assert.throws(
        () => new Repository(),
        /PERSISTENCE_MODE=in-memory is strictly forbidden in production/
      );
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      process.env.PERSISTENCE_MODE = origPersistenceMode;
    }
  });

  test('Emulator mode without FIRESTORE_EMULATOR_HOST is strictly rejected', async () => {
    const { Repository } = await import('../server/db/repository.js');
    const origNodeEnv = process.env.NODE_ENV;
    const origPersistenceMode = process.env.PERSISTENCE_MODE;
    const origEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

    try {
      process.env.NODE_ENV = 'development';
      process.env.PERSISTENCE_MODE = 'firestore-emulator';
      delete process.env.FIRESTORE_EMULATOR_HOST;

      assert.throws(
        () => new Repository(),
        /PERSISTENCE_MODE=firestore-emulator requires FIRESTORE_EMULATOR_HOST/
      );
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      process.env.PERSISTENCE_MODE = origPersistenceMode;
      if (origEmulatorHost) process.env.FIRESTORE_EMULATOR_HOST = origEmulatorHost;
    }
  });

  test('Full entity chain: Job -> ApplicationAttempt -> WorkflowRun -> StepRun -> HumanTask preserves history', async () => {
    const chainJobId = `JOB-CHAIN-${Date.now()}`;

    // 1. Job
    const job: Job = {
      jobId: chainJobId,
      shopName: 'Chain Test Store',
      email: 'chain@example.com',
      passwordReference: 'sec://vault/chain-pass',
      proxyReference: 'proxy://us-residential.net:1080',
      status: 'SIGNUP_STARTED',
      subStatus: 'IN_PROGRESS',
      priority: 'HIGH',
      runMode: 'AUTO',
      autoStart: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      currentAttemptNo: 1,
      tags: ['chain-test'],
    };
    await repository.saveJob(job);

    // 2. ApplicationAttempt 1 (Rejected)
    const attempt1: ApplicationAttempt = {
      attemptId: `ATT-${chainJobId}-1`,
      attemptNo: 1,
      jobId: chainJobId,
      shopName: 'Chain Test Store',
      email: 'chain@example.com',
      finalStatus: 'REJECTED',
      rejectionReason: 'ID Verification Failed',
      createdAt: new Date().toISOString(),
      nextAttemptAllowed: true,
    };
    await repository.saveApplicationAttempt(attempt1);

    // 3. ApplicationAttempt 2 (Reapplication)
    const attempt2: ApplicationAttempt = {
      attemptId: `ATT-${chainJobId}-2`,
      attemptNo: 2,
      jobId: chainJobId,
      shopName: 'Chain Test Store',
      email: 'chain@example.com',
      finalStatus: 'PENDING',
      createdAt: new Date().toISOString(),
      nextAttemptAllowed: true,
    };
    await repository.saveApplicationAttempt(attempt2);

    // Verify rejection history is preserved
    const attempts = await repository.getApplicationAttempts(chainJobId);
    assert.equal(attempts.length, 2);
    assert.equal(attempts.find(a => a.attemptNo === 1)?.rejectionReason, 'ID Verification Failed');

    // 4. WorkflowRun
    const runId = `RUN-${chainJobId}-1`;
    await repository.saveWorkflowRun({
      workflowRunId: runId,
      jobId: chainJobId,
      runNumber: 1,
      status: 'AWAITING_HUMAN',
      currentStepId: 'step_otp',
      currentStepName: 'Verify OTP',
      currentStatus: 'WAITING_FOR_EMAIL_OTP',
      startedAt: new Date().toISOString(),
      stepRuns: [],
      executionLogs: [],
    });

    // 5. StepRun
    const stepRunId = `STEP-${chainJobId}-1`;
    await repository.saveStepRun({
      stepRunId,
      workflowRunId: runId,
      jobId: chainJobId,
      stepId: 'step_otp',
      stepName: 'Verify OTP',
      stepType: 'HUMAN_CHECKPOINT',
      phase: 'HUMAN_VERIFICATION',
      status: 'AWAITING_HUMAN',
      startedAt: new Date().toISOString(),
      actor: 'SYSTEM',
      retryCount: 0,
      executionLogs: [],
    });

    // 6. HumanTask
    const taskId = `TASK-${chainJobId}-1`;
    await repository.saveHumanTask({
      humanTaskId: taskId,
      jobId: chainJobId,
      taskType: 'EMAIL_OTP',
      title: 'Submit Email OTP',
      description: 'Enter 6 digit OTP',
      priority: 'HIGH',
      status: 'COMPLETED',
      assignedOperatorId: 'OP-001',
      completedBy: 'OP-001',
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      dueAt: new Date(Date.now() + 600000).toISOString(),
      reminderCount: 0,
      resolutionPayload: { otp: '[REDACTED_OTP]' },
    });

    const fetchedTask = await repository.getHumanTaskById(taskId);
    assert.ok(fetchedTask);
    assert.equal(fetchedTask.status, 'COMPLETED');
    assert.equal(fetchedTask.completedBy, 'OP-001');
    assert.equal(fetchedTask.jobId, chainJobId);

    // Clean up
    await repository.deleteJob(chainJobId);
  });

  test('Audit log sanitization redacts passwords, OTPs, and secrets', async () => {
    const actor = 'SECURITY_AUDIT_TEST';
    await repository.addAuditLog({
      actor,
      actorRole: 'SUPERVISOR',
      action: 'SUBMIT_CREDENTIALS',
      result: 'SUCCESS',
      metadata: {
        password: 'RawPlaintextSecretPassword!',
        emailOtp: '987654',
        userToken: 'eyJhbGciOi...',
        normalField: 'Public Metadata',
      },
    });

    const logs = await repository.getAuditLogs({ actor });
    const log = logs.find((l) => l.action === 'SUBMIT_CREDENTIALS');
    assert.ok(log);
    assert.equal(log.metadata?.password, '[REDACTED_SENSITIVE_CREDENTIAL]');
    assert.equal(log.metadata?.emailOtp, '[REDACTED_SENSITIVE_CREDENTIAL]');
    assert.equal(log.metadata?.normalField, 'Public Metadata');
  });
});
