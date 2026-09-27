import { repository } from '../db/repository.js';
import { Job, RetryPolicy } from '../types.js';
import { workflowEngine } from './workflowEngine.service.js';

export class RetryEngine {
  /**
   * Determine if an error is eligible for automated technical retry
   */
  public async isEligibleForRetry(errorCode: string): Promise<{ eligible: boolean; policy?: RetryPolicy; reason?: string }> {
    const settings = await repository.getSettings();
    if (!settings.autoRetryTechnicalErrors) {
      return { eligible: false, reason: 'Automatic technical retries disabled in settings.' };
    }

    // Explicit non-retryable categories
    const nonRetryableCodes = [
      'IDENTITY_VERIFICATION_FAILED',
      'AUTHENTICATION_FAILED',
      'UNEXPECTED_SECURITY_CHECKPOINT',
      'APPLICATION_REJECTED',
      'FRAUD_FLAG_SUSPENDED',
    ];

    if (nonRetryableCodes.includes(errorCode)) {
      return { eligible: false, reason: 'Business or identity error code is not eligible for automatic retry.' };
    }

    const policy = await repository.getRetryPolicyByCode(errorCode);
    if (!policy || !policy.enabled) {
      return { eligible: false, reason: `No active retry policy found for code ${errorCode}.` };
    }

    return { eligible: true, policy };
  }

  /**
   * Calculate exponential backoff with jitter
   */
  public calculateBackoffDelay(policy: RetryPolicy, currentRetryCount: number): number {
    const baseDelay = policy.initialDelaySeconds * Math.pow(policy.backoffMultiplier, currentRetryCount);
    const clampedDelay = Math.min(baseDelay, policy.maxDelaySeconds);
    // Add 10-20% full jitter
    const jitter = clampedDelay * 0.15 * Math.random();
    return Math.floor(clampedDelay + jitter);
  }

  /**
   * Execute or schedule retry for a job
   */
  public async scheduleTechnicalRetry(params: {
    jobId: string;
    errorCode: string;
    errorMessage: string;
  }): Promise<{ retried: boolean; nextRetryDelaySeconds?: number; reason: string }> {
    const job = await repository.getJobById(params.jobId);
    if (!job) throw new Error(`Job not found: ${params.jobId}`);

    const check = await this.isEligibleForRetry(params.errorCode);
    if (!check.eligible || !check.policy) {
      // Move to ERROR or MANUAL_REVIEW
      await workflowEngine.transitionJob({
        jobId: job.jobId,
        newStatus: 'ERROR',
        actor: 'RETRY_ENGINE',
        reason: `Non-retryable failure (${params.errorCode}): ${params.errorMessage}`,
      });
      return { retried: false, reason: check.reason || 'Not retryable' };
    }

    if (job.retryCount >= check.policy.maxRetries) {
      await workflowEngine.transitionJob({
        jobId: job.jobId,
        newStatus: 'MANUAL_REVIEW',
        actor: 'RETRY_ENGINE',
        reason: `Max retry limit (${check.policy.maxRetries}) reached for error ${params.errorCode}`,
      });
      return { retried: false, reason: 'Maximum retries exhausted.' };
    }

    const delay = this.calculateBackoffDelay(check.policy, job.retryCount);
    job.retryCount += 1;
    job.lastErrorCode = params.errorCode;
    job.lastErrorMessage = params.errorMessage;
    await repository.saveJob(job);

    await workflowEngine.transitionJob({
      jobId: job.jobId,
      newStatus: 'RETRY_PENDING',
      actor: 'RETRY_ENGINE',
      reason: `Technical retry #${job.retryCount} scheduled after ${delay}s backoff for ${params.errorCode}.`,
    });

    return {
      retried: true,
      nextRetryDelaySeconds: delay,
      reason: `Retry scheduled with ${delay}s delay.`,
    };
  }
}

export const retryEngine = new RetryEngine();
