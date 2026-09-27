import { Job, HumanTask, Session, ApplicationAttempt } from '../types.js';

/**
 * Masks sensitive credentials inside proxy URLs
 * e.g., "http://user:secretpass@127.0.0.1:8080" -> "http://user:******@127.0.0.1:8080"
 */
export function maskProxyCredentials(proxyRef?: string): string {
  if (!proxyRef) return '';
  return proxyRef.replace(/(:\/\/[^:]+:)([^@]+)(@)/, '$1******$3');
}

/**
 * Sanitizes a Job object for client delivery and logs
 * Never exposes raw passwords or proxy credentials
 */
export function sanitizeJob(job: Job): Job {
  return {
    ...job,
    passwordReference: '[PROTECTED_VAULT_REFERENCE]',
    proxyReference: maskProxyCredentials(job.proxyReference),
  };
}

/**
 * Sanitizes a HumanTask object
 * Redacts any sensitive data (e.g. OTP, Passcode, SSN) inside resolutionPayload
 */
export function sanitizeHumanTask(task: HumanTask): HumanTask {
  if (!task.resolutionPayload) return task;

  const sanitizedPayload: Record<string, any> = { ...task.resolutionPayload };
  const sensitiveKeys = ['otp', 'code', 'password', 'token', 'secret', 'ssn', 'pin', 'verificationCode'];

  for (const key of Object.keys(sanitizedPayload)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      sanitizedPayload[key] = '******';
    }
  }

  return {
    ...task,
    resolutionPayload: sanitizedPayload,
  };
}

/**
 * Sanitizes a Session object
 * Redacts tokens from remote debugger URLs
 */
export function sanitizeSession(session: Session): Session {
  let sanitizedDebugger = session.remoteDebuggerUrl;
  if (sanitizedDebugger && sanitizedDebugger.includes('token=')) {
    sanitizedDebugger = sanitizedDebugger.replace(/token=[^&]+/g, 'token=******');
  }

  return {
    ...session,
    remoteDebuggerUrl: sanitizedDebugger,
  };
}

/**
 * Recursively sanitizes any arbitrary object or payload for logging
 */
export function sanitizeForLogging(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') {
    if (typeof obj === 'string') {
      return maskProxyCredentials(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLogging);
  }

  const result: Record<string, any> = {};
  const sensitiveRegex = /password|secret|token|otp|code|auth|cookie|key|credential/i;

  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveRegex.test(key) && typeof value === 'string' && value.length > 0) {
      result[key] = '******';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeForLogging(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
