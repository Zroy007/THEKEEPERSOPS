import { AuditLog } from '../../types.js';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'passwordsalt',
  'otp',
  'emailotp',
  'phoneotp',
  'code',
  'verificationcode',
  'token',
  'accesstoken',
  'authtoken',
  'jwt',
  'secret',
  'secretkey',
  'privatekey',
  'gologintoken',
  'proxycredentials',
  'proxyauth',
  'identitydocument',
  'passport',
  'driverlicense',
  'idcard',
  'selfie',
  'biometric',
  'biometrics',
  'facevector',
]);

/**
 * Recursively sanitizes any object or metadata dictionary to redact sensitive credentials
 */
export function sanitizeSensitiveFields(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeSensitiveFields);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('otp') || lowerKey.includes('secret')) {
      sanitized[key] = '[REDACTED_SENSITIVE_CREDENTIAL]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeSensitiveFields(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Sanitizes an AuditLog entry before writing to Firestore
 */
export function sanitizeAuditLog(log: AuditLog): AuditLog {
  return {
    ...log,
    metadata: sanitizeSensitiveFields(log.metadata || {}),
    reason: log.reason ? sanitizeSensitiveText(log.reason) : undefined,
  };
}

/**
 * Strips secrets or OTP patterns from free-form text strings
 */
function sanitizeSensitiveText(text: string): string {
  // Mask 6-digit OTP codes in message text
  return text.replace(/\b\d{6}\b/g, '[OTP_REDACTED]');
}
