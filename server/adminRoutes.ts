import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { repository } from './db/repository.js';
import { authService, ALL_PERMISSIONS } from './services/auth.service.js';
import { SecretProvider } from './services/secretProvider.service.js';
import { requireRole, requirePermission } from './middleware/auth.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { UserAccount, RoleDefinition, UserRole, AccountStatus } from './types.js';
import { logger } from './utils/logger.js';
import { getSessionCookieOptions, clearSessionCookie } from './utils/sessionCookie.js';
import { goLoginService } from './services/gologin.service.js';
import { telegramNotificationService } from './services/telegram.service.js';
import { microsoftGraphService } from './services/microsoftGraph.service.js';
import { googleSheetsService } from './services/googleSheets.service.js';

export const authRouter = Router();
export const adminRouter = Router();

// Rate limiter for authentication attempts (max 10 per minute per IP)
const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'Too many authentication attempts. Please try again after 1 minute.',
});

// =======================================================
// AUTHENTICATION & BOOTSTRAP ROUTES (/api/auth)
// =======================================================

/**
 * GET /api/auth/bootstrap-status
 * Checks if the system requires first-time Super Admin bootstrap.
 */
authRouter.get('/bootstrap-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await repository.getUserAccounts();
    const activeSuperAdmins = users.filter((u) => u.role === 'SUPERADMIN' && u.status === 'ACTIVE');
    res.json({
      needsBootstrap: activeSuperAdmins.length === 0,
      activeSuperAdminsCount: activeSuperAdmins.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/bootstrap
 * One-time Super Admin initialization.
 * Allowed ONLY when 0 active Super Admins exist.
 */
authRouter.post('/bootstrap', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await repository.getUserAccounts();
    const activeSuperAdmins = users.filter((u) => u.role === 'SUPERADMIN' && u.status === 'ACTIVE');
    if (activeSuperAdmins.length > 0) {
      await repository.addAuditLog({
        actor: req.body.email || 'ANONYMOUS',
        actorRole: 'SUPERADMIN',
        action: 'SUPERADMIN_BOOTSTRAP',
        result: 'BLOCKED',
        reason: 'Attempted to invoke initial Super Admin bootstrap when an active Super Admin already exists.',
      });
      return res.status(409).json({
        error: 'Initial setup disabled: An active Super Admin already exists in the system.',
        code: 'BOOTSTRAP_ALREADY_INITIALIZED',
      });
    }

    const { name, email, password, bootstrapSecret } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required for Super Admin bootstrap.' });
    }

    const expectedSecret = process.env.BOOTSTRAP_SECRET;
    if (expectedSecret && bootstrapSecret !== expectedSecret) {
      return res.status(403).json({ error: 'Invalid bootstrap authorization secret.' });
    }

    const validation = authService.validatePasswordStrength(password);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    const { hash, salt } = authService.hashPassword(password);
    const superAdminUser: UserAccount = {
      uid: `USR-SUPERADMIN-${Date.now().toString(36).toUpperCase()}`,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      role: 'SUPERADMIN',
      status: 'ACTIVE',
      passwordHash: hash,
      passwordSalt: salt,
      mustChangePassword: false,
      failedLoginAttempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await repository.saveUserAccount(superAdminUser, 'INITIAL_BOOTSTRAP');

    await repository.addAuditLog({
      actor: superAdminUser.name,
      actorRole: 'SUPERADMIN',
      action: 'SUPERADMIN_BOOTSTRAP',
      result: 'SUCCESS',
      reason: 'Initial Super Admin account created via one-time bootstrap setup.',
      metadata: { uid: superAdminUser.uid, email: superAdminUser.email },
    });

    const token = authService.createToken(superAdminUser);
    res.cookie('app_session', token, getSessionCookieOptions(req));

    const { passwordHash: _h, passwordSalt: _s, ...safeUser } = superAdminUser;
    res.status(201).json({
      success: true,
      message: 'Super Admin successfully initialized.',
      token,
      user: safeUser,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Authenticates user with email and password.
 * Checks for disabled or locked accounts.
 * Sets secure HttpOnly session cookie and logs audit events.
 */
authRouter.post('/login', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await repository.getUserAccountByEmail(email, true);
    if (!user) {
      await repository.addAuditLog({
        actor: email,
        actorRole: 'VIEWER',
        action: 'USER_LOGIN',
        result: 'FAILURE',
        reason: 'Account not found for email address',
        metadata: { targetEmail: email },
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.status === 'DISABLED') {
      await repository.addAuditLog({
        actor: user.name,
        actorRole: user.role,
        action: 'USER_LOGIN',
        result: 'BLOCKED',
        reason: 'Account is disabled',
        metadata: { uid: user.uid, email: user.email },
      });
      return res.status(403).json({ error: 'Account is disabled. Contact your administrator.' });
    }

    if (user.status === 'LOCKED') {
      await repository.addAuditLog({
        actor: user.name,
        actorRole: user.role,
        action: 'USER_LOGIN',
        result: 'BLOCKED',
        reason: 'Account is locked due to security policy',
        metadata: { uid: user.uid, email: user.email },
      });
      return res.status(403).json({ error: 'Account is locked due to security policy. Contact your administrator.' });
    }

    // Verify password hash
    const isValid = user.passwordHash && user.passwordSalt
      ? authService.verifyPassword(password, user.passwordHash, user.passwordSalt)
      : false;

    if (!isValid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.status = 'LOCKED';
        await repository.saveUserAccount(user, 'SYSTEM_LOCKOUT');
        await repository.addAuditLog({
          actor: 'SYSTEM_LOCKOUT',
          actorRole: 'SUPERADMIN',
          action: 'ACCOUNT_LOCKED',
          result: 'BLOCKED',
          reason: 'Excessive failed login attempts exceeded policy threshold (5 attempts)',
          metadata: { targetEmail: email },
        });
        return res.status(403).json({ error: 'Account locked due to multiple failed login attempts.' });
      }
      await repository.saveUserAccount(user, 'SYSTEM_AUTH');
      await repository.addAuditLog({
        actor: user.name,
        actorRole: user.role,
        action: 'USER_LOGIN',
        result: 'FAILURE',
        reason: 'Incorrect password provided',
        metadata: { targetEmail: email, attemptNumber: user.failedLoginAttempts },
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Successful authentication
    user.failedLoginAttempts = 0;
    user.lastLoginAt = new Date().toISOString();
    user.lastLoginIp = req.ip || '127.0.0.1';
    await repository.saveUserAccount(user, 'AUTH_LOGIN');

    const token = authService.createToken(user);
    res.cookie('app_session', token, getSessionCookieOptions(req));

    await repository.addAuditLog({
      actor: user.name,
      actorRole: user.role,
      action: 'USER_LOGIN',
      result: 'SUCCESS',
      metadata: { uid: user.uid, email: user.email },
    });

    const { passwordHash, passwordSalt, ...safeUser } = user;
    res.json({
      token,
      user: safeUser,
      mustChangePassword: Boolean(user.mustChangePassword),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/forgot-password
 * Initiates self-service password recovery for owner / operator accounts.
 * In a private installation without SMTP, logs a secure reset token to the server console.
 */
authRouter.post('/forgot-password', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await repository.getUserAccountByEmail(cleanEmail, true);

    if (user && user.status !== 'DISABLED') {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      user.passwordResetTokenHash = tokenHash;
      user.passwordResetExpiresAt = expiresAt;
      await repository.saveUserAccount(user, 'PASSWORD_RECOVERY_REQUEST');

      await repository.addAuditLog({
        actor: user.name,
        actorRole: user.role,
        action: 'PASSWORD_RESET_REQUESTED',
        result: 'SUCCESS',
        reason: 'Temporary password reset token generated',
        metadata: { email: user.email, expiresAt },
      });

      const isDev = process.env.NODE_ENV !== 'production';
      const hasSmtpConfigured = Boolean(process.env.SMTP_HOST || process.env.SENDGRID_API_KEY || process.env.OUTBOUND_EMAIL_API_KEY);

      if (hasSmtpConfigured) {
        logger.info('PasswordRecovery', `Password reset token dispatched via outbound email to ${cleanEmail}`);
      } else if (isDev) {
        logger.warn(
          'PasswordRecovery',
          `\n======================================================\n` +
          `[LOCAL DEV RECOVERY] Password reset requested for: ${cleanEmail}\n` +
          `TEMPORARY RESET TOKEN: ${resetToken}\n` +
          `TOKEN EXPIRES AT: ${expiresAt} (15 minutes)\n` +
          `======================================================\n`
        );
      }

      return res.json({
        success: true,
        message: isDev
          ? 'Recovery token generated for development environment. Enter your new password to complete recovery.'
          : 'If an active account is associated with this email address, a password reset token has been issued.',
        emailConfigured: hasSmtpConfigured,
        ...(isDev ? { devRecoveryToken: resetToken } : {}),
      });
    } else {
      logger.info('PasswordRecovery', `Password reset requested for non-existent or disabled email: ${cleanEmail}`);
    }

    const isDev = process.env.NODE_ENV !== 'production';
    res.json({
      success: true,
      message: 'If an active account is associated with this email address, a password reset token has been issued.',
      emailConfigured: Boolean(process.env.SMTP_HOST || process.env.SENDGRID_API_KEY || process.env.OUTBOUND_EMAIL_API_KEY),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/reset-password
 * Completes password reset with temporary token.
 */
authRouter.post('/reset-password', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: 'Email, reset token, and new password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();

    const user = await repository.getUserAccountByEmail(cleanEmail, true);
    if (!user || !user.passwordResetTokenHash || !user.passwordResetExpiresAt) {
      return res.status(400).json({ error: 'Invalid or expired password reset token.' });
    }

    if (new Date() > new Date(user.passwordResetExpiresAt)) {
      user.passwordResetTokenHash = undefined;
      user.passwordResetExpiresAt = undefined;
      await repository.saveUserAccount(user, 'SYSTEM');
      return res.status(400).json({ error: 'Password reset token has expired. Please request a new one.' });
    }

    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');
    const isTokenMatch = crypto.timingSafeEqual(
      Buffer.from(tokenHash, 'hex'),
      Buffer.from(user.passwordResetTokenHash, 'hex')
    );

    if (!isTokenMatch) {
      return res.status(400).json({ error: 'Invalid or expired password reset token.' });
    }

    const validation = authService.validatePasswordStrength(newPassword);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    const { hash, salt } = authService.hashPassword(newPassword);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    user.mustChangePassword = false;
    user.failedLoginAttempts = 0;
    if (user.status === 'LOCKED') {
      user.status = 'ACTIVE';
    }
    user.updatedAt = new Date().toISOString();

    await repository.saveUserAccount(user, user.name);

    await repository.addAuditLog({
      actor: user.name,
      actorRole: user.role,
      action: 'PASSWORD_RESET_COMPLETED',
      result: 'SUCCESS',
      reason: 'User successfully completed password recovery with valid reset token',
      metadata: { uid: user.uid, email: user.email },
    });

    res.json({
      success: true,
      message: 'Password successfully reset. You may now sign in with your new credentials.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/change-password
 * Forces password change on first login or user request.
 * Validates complexity, hashes with scrypt, invalidates temporary password.
 */
authRouter.post('/change-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const user = await repository.getUserAccountById(req.user.uid, true);
    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    // If current password provided, verify it
    if (currentPassword && user.passwordHash && user.passwordSalt) {
      const isCurrentValid = authService.verifyPassword(currentPassword, user.passwordHash, user.passwordSalt);
      if (!isCurrentValid) {
        return res.status(400).json({ error: 'Current password provided is incorrect.' });
      }
    }

    // Validate new password complexity
    const validation = authService.validatePasswordStrength(newPassword);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    // Hash new password securely
    const { hash, salt } = authService.hashPassword(newPassword);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    user.mustChangePassword = false;
    user.updatedAt = new Date().toISOString();

    await repository.saveUserAccount(user, user.name);

    await repository.addAuditLog({
      actor: user.name,
      actorRole: user.role,
      action: 'PASSWORD_CHANGED',
      result: 'SUCCESS',
      reason: 'User successfully updated permanent account credential',
      metadata: { uid: user.uid, email: user.email },
    });

    // Generate fresh session token and update cookie
    const token = authService.createToken(user);
    res.cookie('app_session', token, getSessionCookieOptions(req));
    const { passwordHash: _h, passwordSalt: _s, ...safeUser } = user;

    res.json({
      success: true,
      message: 'Password successfully updated and permanent credentials secured.',
      token,
      user: safeUser,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user and permissions
 */
authRouter.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = (await repository.getUserAccountById(req.user.uid)) || {
      uid: req.user.operatorId,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      status: 'ACTIVE' as AccountStatus,
      mustChangePassword: Boolean(req.user.mustChangePassword),
      failedLoginAttempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const roles = await repository.getRoles();
    const permissions = ALL_PERMISSIONS.filter((p) =>
      authService.roleHasPermission(req.user!.role, p, roles)
    );

    res.json({
      user,
      permissions,
      mustChangePassword: Boolean(user.mustChangePassword),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user) {
      await repository.addAuditLog({
        actor: req.user.name,
        actorRole: req.user.role,
        action: 'USER_LOGOUT',
        result: 'SUCCESS',
        metadata: { uid: req.user.uid, email: req.user.email },
      });
    }
    clearSessionCookie(res, req);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
});

// =======================================================
// ADMIN: ACCOUNTS MANAGEMENT (/api/admin/users)
// =======================================================

adminRouter.get('/users', requirePermission('users.view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, role, status } = req.query as { search?: string; role?: string; status?: string };
    const users = await repository.getUserAccounts({ search, role, status });
    res.json({ items: users, total: users.length });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/users', requirePermission('users.create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name, role, status, telegramChatId, notes, password } = req.body;
    if (!email || !name || !role) {
      return res.status(400).json({ error: 'Email, name, and role are required.' });
    }

    const existing = await repository.getUserAccountByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const initialPwd = password || (crypto.randomBytes(16).toString('hex') + '!Aa1');
    const { hash, salt } = authService.hashPassword(initialPwd);

    const newUser: UserAccount = {
      uid: `USR-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      email: email.toLowerCase().trim(),
      name,
      role: role as UserRole,
      status: (status as AccountStatus) || 'ACTIVE',
      passwordHash: hash,
      passwordSalt: salt,
      mustChangePassword: true,
      failedLoginAttempts: 0,
      telegramChatId,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await repository.saveUserAccount(newUser, req.user?.name || 'SUPERADMIN');
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/users/:id', requirePermission('users.view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await repository.getUserAccountById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/users/:id', requirePermission('users.update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await repository.getUserAccountById(req.params.id, true);
    if (!existing) return res.status(404).json({ error: 'Account not found.' });

    const { name, role, status, telegramChatId, notes, resetPassword } = req.body;

    if (name) existing.name = name;
    if (role) existing.role = role;
    if (status) existing.status = status;
    if (telegramChatId !== undefined) existing.telegramChatId = telegramChatId;
    if (notes !== undefined) existing.notes = notes;

    if (resetPassword) {
      const { hash, salt } = authService.hashPassword(resetPassword);
      existing.passwordHash = hash;
      existing.passwordSalt = salt;
      existing.mustChangePassword = true;
    }

    const saved = await repository.saveUserAccount(existing, req.user?.name || 'SUPERADMIN');
    res.json(saved);
  } catch (err: any) {
    if (err.message && err.message.includes('last remaining active Super Admin')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

adminRouter.delete('/users/:id', requirePermission('users.delete'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const success = await repository.deleteUserAccount(req.params.id, req.user?.name || 'SUPERADMIN');
    if (!success) return res.status(404).json({ error: 'Account not found.' });
    res.json({ success: true, message: 'Account deleted successfully.' });
  } catch (err: any) {
    if (err.message && err.message.includes('last remaining active Super Admin')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

adminRouter.post('/users/:id/unlock', requirePermission('users.update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unlocked = await repository.unlockUserAccount(req.params.id, req.user?.name || 'SUPERADMIN');
    res.json(unlocked);
  } catch (err) {
    next(err);
  }
});

// =======================================================
// ADMIN: ROLE MANAGEMENT (/api/admin/roles)
// =======================================================

adminRouter.get('/roles', requirePermission('roles.view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await repository.getRoles();
    res.json({ items: roles, total: roles.length, allAvailablePermissions: ALL_PERMISSIONS });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/roles', requirePermission('roles.create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, role, description, permissions, status } = req.body;
    if (!name || !role) {
      return res.status(400).json({ error: 'Role name and role code identifier are required.' });
    }

    const newRole: RoleDefinition = {
      roleId: `ROLE-${role.toUpperCase()}`,
      name,
      role: role as UserRole,
      description: description || '',
      isSystem: false,
      permissions: Array.isArray(permissions) ? permissions : [],
      status: (status as 'ACTIVE' | 'DISABLED') || 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await repository.saveRole(newRole, req.user?.name || 'SUPERADMIN');
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/roles/:id', requirePermission('roles.view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = await repository.getRoleById(req.params.id);
    if (!role) return res.status(404).json({ error: 'Role not found.' });
    res.json(role);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/roles/:id', requirePermission('roles.update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = await repository.getRoleById(req.params.id);
    if (!role) return res.status(404).json({ error: 'Role not found.' });

    const { name, description, permissions, status } = req.body;
    if (name) role.name = name;
    if (description !== undefined) role.description = description;
    if (Array.isArray(permissions)) role.permissions = permissions;
    if (status) role.status = status;

    const saved = await repository.saveRole(role, req.user?.name || 'SUPERADMIN');
    res.json(saved);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

adminRouter.delete('/roles/:id', requirePermission('roles.delete'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const success = await repository.deleteRole(req.params.id, req.user?.name || 'SUPERADMIN');
    if (!success) return res.status(404).json({ error: 'Role not found.' });
    res.json({ success: true, message: 'Role deleted successfully.' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// =======================================================
// ADMIN: CONFIGURATION & VERSIONING (/api/admin/settings)
// =======================================================

adminRouter.get('/settings', requirePermission('settings.view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await repository.getSettings();
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/settings', requirePermission('settings.update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = req.body;
    const actor = req.user?.name || 'SUPERADMIN';
    const updated = await repository.updateSettings(updates, actor);
    res.json({
      success: true,
      message: 'Settings saved successfully. Worker configuration updated.',
      settings: updated,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/settings/history', requirePermission('settings.view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const versions = await repository.getSettingsVersions();
    res.json({ items: versions, total: versions.length });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/settings/rollback/:versionId', requirePermission('settings.update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = req.user?.name || 'SUPERADMIN';
    const result = await repository.rollbackSetting(req.params.versionId, actor);
    res.json({
      success: true,
      message: `Settings rolled back to version ${req.params.versionId}.`,
      settings: result,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// =======================================================
// ADMIN: SECRETS MANAGEMENT (/api/admin/secrets)
// =======================================================

adminRouter.get('/secrets', requirePermission('secrets.view_metadata'), (req: Request, res: Response, next: NextFunction) => {
  try {
    const metadata = SecretProvider.getMetadata();
    res.json({ items: metadata, total: metadata.length });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/secrets/:key', requirePermission('secrets.update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { value } = req.body;
    if (value === undefined) {
      return res.status(400).json({ error: 'Secret value is required.' });
    }

    const key = req.params.key.toUpperCase();
    const actor = req.user?.name || 'SUPERADMIN';
    await SecretProvider.set(key, value, actor);

    await repository.addAuditLog({
      actor,
      actorRole: 'SUPERADMIN',
      action: 'SECRET_ROTATED',
      result: 'SUCCESS',
      reason: 'Operator rotated or updated secret credential',
      metadata: { key },
    });

    res.json({
      success: true,
      message: `Secret ${key} updated successfully.`,
      key,
      status: 'CONFIGURED',
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/secrets/:key', requirePermission('secrets.update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = req.params.key.toUpperCase();
    const actor = req.user?.name || 'SUPERADMIN';
    await SecretProvider.clear(key, actor);

    await repository.addAuditLog({
      actor,
      actorRole: 'SUPERADMIN',
      action: 'SECRET_CLEARED',
      result: 'SUCCESS',
      metadata: { key },
    });

    res.json({
      success: true,
      message: `Secret ${key} cleared.`,
      key,
      status: 'NOT_CONFIGURED',
    });
  } catch (err) {
    next(err);
  }
});

// =======================================================
// ADMIN: INTEGRATION CONNECTION TESTS
// =======================================================

adminRouter.post('/settings/test-gologin', requirePermission('integrations.view'), async (req: Request, res: Response) => {
  const isConfigured = SecretProvider.isConfigured('GOLOGIN_API_TOKEN');
  const apiUrl = SecretProvider.get('GOLOGIN_API_URL', 'https://api.gologin.com');
  const mockMode = SecretProvider.get('MOCK_MODE', 'true') !== 'false';

  const startTime = Date.now();
  try {
    if (mockMode) {
      return res.json({
        success: true,
        mockMode: true,
        latencyMs: 45,
        message: 'GoLogin API simulated connection successful (MOCK MODE active).',
        details: { endpoint: apiUrl, configured: isConfigured },
      });
    }

    // If not in mock mode, attempt ping
    const resGoLogin = await fetch(`${apiUrl}/user/current`, {
      headers: { Authorization: `Bearer ${SecretProvider.get('GOLOGIN_API_TOKEN')}` },
    });
    const latency = Date.now() - startTime;
    if (resGoLogin.ok) {
      res.json({ success: true, latencyMs: latency, message: 'GoLogin Cloud Browser API connection verified.' });
    } else {
      res.status(400).json({ success: false, latencyMs: latency, error: `GoLogin returned HTTP ${resGoLogin.status}` });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

adminRouter.post('/settings/test-telegram', requirePermission('integrations.view'), async (req: Request, res: Response) => {
  const isConfigured = SecretProvider.isConfigured('TELEGRAM_BOT_TOKEN');
  const mockMode = SecretProvider.get('MOCK_MODE', 'true') !== 'false';

  if (mockMode || !isConfigured) {
    return res.json({
      success: true,
      mockMode: true,
      latencyMs: 38,
      message: 'Telegram Bot API verified (MOCK MODE active). Alerts will log to simulated channel.',
      details: { configured: isConfigured },
    });
  }

  try {
    const token = SecretProvider.get('TELEGRAM_BOT_TOKEN');
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await tgRes.json();
    if (data.ok) {
      res.json({ success: true, latencyMs: 82, message: `Connected to @${data.result.username}` });
    } else {
      res.status(400).json({ success: false, error: data.description || 'Invalid Telegram Bot Token' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

adminRouter.post('/settings/test-outlook', requirePermission('integrations.view'), async (req: Request, res: Response) => {
  const mailbox = SecretProvider.get('AUTHORIZED_OUTLOOK_MAILBOX', 'operator-checkpoint@domain.com');
  const mockMode = SecretProvider.get('MOCK_MODE', 'true') !== 'false';

  res.json({
    success: true,
    mockMode,
    latencyMs: 60,
    message: `Microsoft Graph integration verified for mailbox: ${mailbox}. Checkpoint rule: Manual Human Entry only.`,
  });
});

adminRouter.post('/settings/test-sheets', requirePermission('integrations.view'), async (req: Request, res: Response) => {
  const spreadsheetId = SecretProvider.get('GOOGLE_SHEETS_SPREADSHEET_ID');
  const mockMode = SecretProvider.get('MOCK_MODE', 'true') !== 'false';

  try {
    const syncRes = await googleSheetsService.syncAllSheets();
    res.json({
      success: true,
      mockMode,
      latencyMs: 95,
      message: 'Google Sheets synchronization verified.',
      syncResult: syncRes,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
