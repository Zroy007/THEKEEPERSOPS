import crypto from 'node:crypto';
import { UserAccount, UserRole, Permission, RoleDefinition } from '../types.js';
import { SecretProvider } from './secretProvider.service.js';
import { logger } from '../utils/logger.js';

export const ALL_PERMISSIONS: Permission[] = [
  'users.view',
  'users.create',
  'users.update',
  'users.disable',
  'users.delete',
  'roles.view',
  'roles.create',
  'roles.update',
  'roles.delete',
  'settings.view',
  'settings.update',
  'secrets.view_metadata',
  'secrets.update',
  'integrations.view',
  'integrations.configure',
  'jobs.view',
  'jobs.create',
  'jobs.update',
  'jobs.pause',
  'jobs.resume',
  'jobs.retry',
  'sessions.view',
  'sessions.control',
  'human_tasks.view',
  'human_tasks.assign',
  'human_tasks.complete',
  'applications.view',
  'applications.update',
  'reports.view',
  'audit_logs.view',
  'system_health.view',
];

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPERADMIN: [...ALL_PERMISSIONS],
  ADMIN: [
    'users.view',
    'roles.view',
    'settings.view',
    'secrets.view_metadata',
    'integrations.view',
    'jobs.view',
    'jobs.create',
    'jobs.update',
    'jobs.pause',
    'jobs.resume',
    'jobs.retry',
    'sessions.view',
    'sessions.control',
    'human_tasks.view',
    'human_tasks.assign',
    'human_tasks.complete',
    'applications.view',
    'applications.update',
    'reports.view',
    'audit_logs.view',
    'system_health.view',
  ],
  SUPERVISOR: [
    'settings.view',
    'integrations.view',
    'jobs.view',
    'jobs.create',
    'jobs.update',
    'jobs.pause',
    'jobs.resume',
    'jobs.retry',
    'sessions.view',
    'sessions.control',
    'human_tasks.view',
    'human_tasks.assign',
    'human_tasks.complete',
    'applications.view',
    'applications.update',
    'reports.view',
    'audit_logs.view',
    'system_health.view',
  ],
  OPERATOR: [
    'jobs.view',
    'jobs.create',
    'jobs.update',
    'jobs.pause',
    'jobs.resume',
    'sessions.view',
    'human_tasks.view',
    'human_tasks.complete',
    'applications.view',
  ],
  VIEWER: [
    'jobs.view',
    'applications.view',
    'reports.view',
  ],
};

export const INITIAL_ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    roleId: 'ROLE-SUPERADMIN',
    name: 'Super Administrator',
    role: 'SUPERADMIN',
    description: 'Supreme administrator with unrestricted control over users, roles, system configuration, secrets, and operational entities.',
    isSystem: true,
    permissions: [...ALL_PERMISSIONS],
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    roleId: 'ROLE-ADMIN',
    name: 'Platform Administrator',
    role: 'ADMIN',
    description: 'Operational administrator with full job, session, and retry policy management. Read-only for system secrets and configuration.',
    isSystem: true,
    permissions: [...DEFAULT_ROLE_PERMISSIONS.ADMIN],
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    roleId: 'ROLE-SUPERVISOR',
    name: 'Operations Supervisor',
    role: 'SUPERVISOR',
    description: 'Team lead overseeing active jobs, review queues, operator task distribution, and daily reports.',
    isSystem: true,
    permissions: [...DEFAULT_ROLE_PERMISSIONS.SUPERVISOR],
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    roleId: 'ROLE-OPERATOR',
    name: 'Human Operator',
    role: 'OPERATOR',
    description: 'Human-in-the-loop specialist executing manual checkpoints, OTP verification, and browser sessions.',
    isSystem: true,
    permissions: [...DEFAULT_ROLE_PERMISSIONS.OPERATOR],
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    roleId: 'ROLE-VIEWER',
    name: 'Read-Only Viewer',
    role: 'VIEWER',
    description: 'Auditor or stakeholder with read-only visibility into dashboard metrics, job records, and reports.',
    isSystem: true,
    permissions: [...DEFAULT_ROLE_PERMISSIONS.VIEWER],
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export interface TokenPayload {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  mustChangePassword: boolean;
  iat: number;
  exp: number;
}

class AuthService {
  /**
   * Hashes a password using scrypt with a unique random salt
   */
  public hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const passwordSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, passwordSalt, 64).toString('hex');
    return { hash, salt: passwordSalt };
  }

  /**
   * Verifies password against stored hash and salt in constant time
   */
  public verifyPassword(password: string, storedHash: string, salt: string): boolean {
    try {
      const derivedHash = crypto.scryptSync(password, salt, 64).toString('hex');
      const a = Buffer.from(derivedHash, 'hex');
      const b = Buffer.from(storedHash, 'hex');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * Validates password strength
   */
  public validatePasswordStrength(password: string): { valid: boolean; message?: string } {
    if (!password || password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters in length.' };
    }
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumberOrSpecial = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
    if (!hasLetter || !hasNumberOrSpecial) {
      return { valid: false, message: 'Password must contain at least one letter and one number or symbol.' };
    }
    return { valid: true };
  }

  /**
   * Signs a secure session token
   */
  public createToken(user: UserAccount): string {
    const payload: TokenPayload = {
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: Boolean(user.mustChangePassword),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
    };

    const secret = SecretProvider.get('JWT_SECRET', 'dev-super-secret-jwt-key-2026');
    const headerBase64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${headerBase64}.${payloadBase64}`)
      .digest('base64url');

    return `${headerBase64}.${payloadBase64}.${signature}`;
  }

  /**
   * Verifies and decodes a session token
   */
  public verifyToken(token: string): TokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const [headerBase64, payloadBase64, signature] = parts;

      const secret = SecretProvider.get('JWT_SECRET', 'dev-super-secret-jwt-key-2026');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${headerBase64}.${payloadBase64}`)
        .digest('base64url');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return null;
      }

      const payload: TokenPayload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf-8'));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null; // Expired
      }
      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Checks if a role has a given permission
   */
  public roleHasPermission(role: UserRole, permission: Permission, customRoles?: RoleDefinition[]): boolean {
    if (role === 'SUPERADMIN') return true; // SuperAdmin possesses all permissions unconditionally

    if (customRoles) {
      const defined = customRoles.find((r) => r.role === role);
      if (defined) {
        return defined.permissions.includes(permission);
      }
    }

    const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role] || [];
    return defaultPerms.includes(permission);
  }
}

export const authService = new AuthService();
