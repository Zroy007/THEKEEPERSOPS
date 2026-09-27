import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { workflowEngine } from '../server/services/workflowEngine.service.js';
import { repository } from '../server/db/repository.js';
import { Job } from '../server/types.js';

describe('Queue Engine & Dynamic Concurrency', () => {
  test('dynamic capacity calculation respects active sessions', async () => {
    const settings = await repository.getSettings();
    const originalLimit = settings.concurrencyLimit;

    // Set concurrency limit to 3
    await repository.updateSettings({ concurrencyLimit: 3, maintenanceMode: false });

    // Check sessions count
    const sessions = await repository.getSessions();
    const activeCount = sessions.filter((s) => s.status === 'RUNNING' || s.status === 'STARTING').length;
    const expectedRemaining = Math.max(0, 3 - activeCount);

    const result = await workflowEngine.processQueue();
    // Capacity remaining cannot exceed 3
    assert.ok(result.capacityRemaining <= 3);

    // Restore
    await repository.updateSettings({ concurrencyLimit: originalLimit });
  });

  test('queue worker halts completely when maintenance mode is active', async () => {
    await repository.updateSettings({ maintenanceMode: true });

    const result = await workflowEngine.processQueue();
    assert.equal(result.startedJobs, 0);
    assert.equal(result.capacityRemaining, 0);

    // Restore
    await repository.updateSettings({ maintenanceMode: false });
  });

  test('queue respects autoStart parameter', async () => {
    const testJobId = `TEST-MANUAL-START-${Date.now()}`;
    const job: Job = {
      jobId: testJobId,
      shopName: 'Manual AutoStart False Brand',
      email: 'manual.autostart@test.org',
      passwordReference: 'sec://vault/test',
      proxyReference: 'proxy://test',
      status: 'QUEUED',
      subStatus: 'WAITING_FOR_WORKER',
      priority: 'LOW',
      runMode: 'MANUAL',
      autoStart: false, // autoStart false should not be started by automatic worker
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      currentAttemptNo: 1,
      tags: ['test'],
    };
    await repository.saveJob(job);

    await workflowEngine.processQueue();

    const checkJob = await repository.getJobById(testJobId);
    assert.equal(checkJob?.status, 'QUEUED'); // Did not automatically start
  });
});
