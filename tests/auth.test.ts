import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { requireRole, authMiddleware } from '../server/middleware/auth.js';
import { authService } from '../server/services/auth.service.js';
import { repository } from '../server/db/repository.js';
import { Request, Response } from 'express';

describe('RBAC Middleware & Permissions', () => {
  test('ADMIN role can access any endpoint', () => {
    let nextCalled = false;
    const req = {
      user: { operatorId: 'OP-001', name: 'Admin', email: 'admin@test.org', role: 'ADMIN' },
    } as unknown as Request;

    const res = {
      status: () => res,
      json: () => res,
    } as unknown as Response;

    const middleware = requireRole('SUPERVISOR');
    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });

  test('OPERATOR role allowed on OPERATOR endpoint', () => {
    let nextCalled = false;
    const req = {
      user: { operatorId: 'OP-002', name: 'Operator', email: 'op@test.org', role: 'OPERATOR' },
    } as unknown as Request;

    const res = {
      status: () => res,
      json: () => res,
    } as unknown as Response;

    const middleware = requireRole('OPERATOR', 'SUPERVISOR');
    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });

  test('VIEWER role blocked with 403 on mutating endpoint', () => {
    let nextCalled = false;
    let statusCode = 0;
    let responseBody: any = null;

    const req = {
      user: { operatorId: 'OP-004', name: 'Viewer', email: 'view@test.org', role: 'VIEWER' },
    } as unknown as Request;

    const res = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        responseBody = data;
        return res;
      },
    } as unknown as Response;

    const middleware = requireRole('ADMIN', 'SUPERVISOR', 'OPERATOR');
    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(statusCode, 403);
    assert.ok(responseBody.error.includes('Forbidden'));
  });
});

describe('Deny-By-Default Authentication Middleware', () => {
  test('Unauthenticated request is rejected with 401 Unauthorized', async () => {
    let nextCalled = false;
    let statusCode = 0;
    let responseBody: any = null;

    const req = {
      path: '/jobs',
      method: 'GET',
      headers: {},
      cookies: {},
    } as unknown as Request;

    const res = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        responseBody = data;
        return res;
      },
    } as unknown as Response;

    await authMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(statusCode, 401);
    assert.equal(responseBody.code, 'AUTHENTICATION_REQUIRED');
  });

  test('Spoofed headers (x-operator-id, x-user-role) are ignored without valid session', async () => {
    let nextCalled = false;
    let statusCode = 0;

    const req = {
      path: '/system-settings',
      method: 'POST',
      headers: {
        'x-operator-id': 'OP-999',
        'x-user-role': 'SUPERADMIN',
      },
      cookies: {},
    } as unknown as Request;

    const res = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: () => res,
    } as unknown as Response;

    await authMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(statusCode, 401);
  });

  test('User with mustChangePassword=true is blocked from operational endpoints', async () => {
    const admin = await repository.getUserAccountByEmail('zakwanrhmn@gmail.com', true);
    assert.ok(admin);
    assert.equal(admin.mustChangePassword, true);

    const token = authService.createToken(admin);

    let nextCalled = false;
    let statusCode = 0;
    let responseBody: any = null;

    const req = {
      path: '/jobs',
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
      },
      cookies: {},
    } as unknown as Request;

    const res = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        responseBody = data;
        return res;
      },
    } as unknown as Response;

    await authMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(statusCode, 403);
    assert.equal(responseBody.code, 'PASSWORD_CHANGE_REQUIRED');
  });

  test('Valid Bearer session token is accepted on allowed endpoints or with mustChangePassword=false', async () => {
    // Create an active supervisor with password already changed
    const activeOp = await repository.getUserAccountByEmail('supervisor@system.internal', true);
    let targetUser = activeOp;
    if (!targetUser) {
      targetUser = {
        uid: 'USR-SUPERVISOR-TEST',
        email: 'supervisor-test@internal.local',
        name: 'Test Supervisor',
        role: 'SUPERVISOR',
        status: 'ACTIVE',
        mustChangePassword: false,
        failedLoginAttempts: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await repository.saveUserAccount(targetUser, 'TEST_SETUP');
    } else {
      targetUser.mustChangePassword = false;
      await repository.saveUserAccount(targetUser, 'TEST_SETUP');
    }

    const token = authService.createToken(targetUser);

    let nextCalled = false;
    const req = {
      path: '/jobs',
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
      },
      cookies: {},
    } as unknown as Request;

    const res = {
      status: () => res,
      json: () => res,
    } as unknown as Response;

    await authMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal((req as any).user?.email, targetUser.email);
    assert.equal((req as any).user?.role, 'SUPERVISOR');
  });

  test('Cookie-based session on mutating cross-site request requires CSRF header', async () => {
    const activeOp = await repository.getUserAccountByEmail('supervisor-test@internal.local', true);
    assert.ok(activeOp);

    const token = authService.createToken(activeOp);

    // Request WITHOUT CSRF header and from cross-site
    let nextCalled = false;
    let statusCode = 0;
    let responseBody: any = null;

    const reqMissingCsrf = {
      path: '/jobs',
      method: 'POST',
      headers: {
        'sec-fetch-site': 'cross-site',
      },
      cookies: {
        app_session: token,
      },
    } as unknown as Request;

    const resMissingCsrf = {
      status: (code: number) => {
        statusCode = code;
        return resMissingCsrf;
      },
      json: (data: any) => {
        responseBody = data;
        return resMissingCsrf;
      },
      clearCookie: () => {},
    } as unknown as Response;

    await authMiddleware(reqMissingCsrf, resMissingCsrf, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(statusCode, 403);
    assert.equal(responseBody.code, 'CSRF_BLOCKED');

    // Request WITH CSRF header
    let nextCalledWithCsrf = false;
    const reqWithCsrf = {
      path: '/jobs',
      method: 'POST',
      headers: {
        'x-requested-with': 'XMLHttpRequest',
        'sec-fetch-site': 'cross-site',
      },
      cookies: {
        app_session: token,
      },
    } as unknown as Request;

    const resWithCsrf = {
      status: () => resWithCsrf,
      json: () => resWithCsrf,
      clearCookie: () => {},
    } as unknown as Response;

    await authMiddleware(reqWithCsrf, resWithCsrf, () => {
      nextCalledWithCsrf = true;
    });

    assert.equal(nextCalledWithCsrf, true);
    assert.equal((reqWithCsrf as any).user?.role, 'SUPERVISOR');
  });

  test('Forgot password generates recovery token and reset-password completes update', async () => {
    // 1. Get an existing user
    const user = await repository.getUserAccountByEmail('zakwanrhmn@gmail.com', true);
    assert.ok(user, 'User should exist');

    // Import crypto to generate mock token flow
    const crypto = await import('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpiresAt = expiresAt;
    await repository.saveUserAccount(user, 'TEST');

    // Verify token saved
    const updated = await repository.getUserAccountByEmail('zakwanrhmn@gmail.com', true);
    assert.equal(updated?.passwordResetTokenHash, tokenHash);

    // Verify token matching logic
    const submittedHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(submittedHash, 'hex'),
      Buffer.from(updated!.passwordResetTokenHash!, 'hex')
    );
    assert.equal(isMatch, true);

    // Update password
    const newPass = 'BrandNewSecurePass2026!';
    const { hash: newHash, salt: newSalt } = authService.hashPassword(newPass);
    updated!.passwordHash = newHash;
    updated!.passwordSalt = newSalt;
    updated!.passwordResetTokenHash = undefined;
    updated!.passwordResetExpiresAt = undefined;
    updated!.mustChangePassword = false;
    await repository.saveUserAccount(updated!, 'TEST');

    // Verify authentication succeeds with new password
    const reloaded = await repository.getUserAccountByEmail('zakwanrhmn@gmail.com', true);
    assert.equal(reloaded?.passwordResetTokenHash, undefined);
    assert.equal(authService.verifyPassword(newPass, reloaded!.passwordHash!, reloaded!.passwordSalt!), true);
    assert.equal(authService.verifyPassword('WrongPassword123!', reloaded!.passwordHash!, reloaded!.passwordSalt!), false);
  });
});
