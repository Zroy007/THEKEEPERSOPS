import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { retryEngine } from '../server/services/retryEngine.service.js';
import { repository } from '../server/db/repository.js';
import { Job } from '../server/types.js';

describe('RetryEngine & Technical Error Classification', () => {
  test('technical error codes are eligible for retry', async () => {
    const check1 = await retryEngine.isEligibleForRetry('PROXY_ERROR');
    assert.equal(check1.eligible, true);
    assert.ok(check1.policy);

    const check2 = await retryEngine.isEligibleForRetry('BROWSER_START_TIMEOUT');
    assert.equal(check2.eligible, true);
  });

  test('business and identity errors are strictly non-retryable', async () => {
    const nonRetryableCodes = [
      'IDENTITY_VERIFICATION_FAILED',
      'AUTHENTICATION_FAILED',
      'UNEXPECTED_SECURITY_CHECKPOINT',
      'APPLICATION_REJECTED',
      'FRAUD_FLAG_SUSPENDED',
    ];

    for (const code of nonRetryableCodes) {
      const check = await retryEngine.isEligibleForRetry(code);
      assert.equal(check.eligible, false, `Code ${code} should not be eligible for automated retry`);
    }
  });

  test('exponential backoff delay calculates correctly with upper bound', () => {
    const mockPolicy = {
      policyId: 'POL-TEST',
      errorCode: 'PROXY_ERROR',
      description: 'Test',
      maxRetries: 3,
      initialDelaySeconds: 10,
      backoffMultiplier: 2,
      maxDelaySeconds: 60,
      enabled: true,
      isTechnicalOnly: true,
    };

    // Retry 0: base 10s -> with jitter 10 - 12s
    const delay0 = retryEngine.calculateBackoffDelay(mockPolicy, 0);
    assert.ok(delay0 >= 10 && delay0 <= 13);

    // Retry 1: base 20s -> with jitter 20 - 24s
    const delay1 = retryEngine.calculateBackoffDelay(mockPolicy, 1);
    assert.ok(delay1 >= 20 && delay1 <= 25);

    // Retry 4: base 160s clamped to maxDelaySeconds (60s) -> with jitter 60 - 72s
    const delay4 = retryEngine.calculateBackoffDelay(mockPolicy, 4);
    assert.ok(delay4 >= 60 && delay4 <= 72);
  });

  test('exhausting max retries moves job to MANUAL_REVIEW', async () => {
    const testJobId = `TEST-RETRY-JOB-${Date.now()}`;
    const job: Job = {
      jobId: testJobId,
      shopName: 'Max Retry Shop',
      email: 'max.retry@test.org',
      passwordReference: 'sec://vault/test',
      proxyReference: 'proxy://test',
      status: 'PROXY_CHECKING',
      subStatus: 'IN_PROGRESS',
      priority: 'NORMAL',
      runMode: 'AUTO',
      autoStart: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 3, // Already at max (3)
      maxRetries: 3,
      currentAttemptNo: 1,
      tags: ['test'],
    };
    await repository.saveJob(job);

    const result = await retryEngine.scheduleTechnicalRetry({
      jobId: testJobId,
      errorCode: 'PROXY_ERROR',
      errorMessage: 'Residential proxy port refused connection',
    });

    assert.equal(result.retried, false);
    const updated = await repository.getJobById(testJobId);
    assert.equal(updated?.status, 'MANUAL_REVIEW');
  });
});
