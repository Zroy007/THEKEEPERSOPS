import { Request, Response, NextFunction } from 'express';
import { repository } from '../db/repository.js';
import { UserRole, Permission } from '../types.js';
import { authService } from '../services/auth.service.js';
import { clearSessionCookie } from '../utils/sessionCookie.js';
import { logger } from '../utils/logger.js';

export interface AuthContext {
  uid: string;
  operatorId: string;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthContext;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1. Whitelist unauthenticated public endpoints
  // Note: authMiddleware is mounted on /api, so req.path is relative to /api (e.g. /auth/login)
  const isPublicPath =
    req.path === '/auth/login' ||
    req.path === '/auth/bootstrap' ||
    req.path === '/auth/bootstrap-status' ||
    req.path === '/auth/forgot-password' ||
    req.path === '/auth/reset-password' ||
    req.path === '/health' ||
    req.path === '/ready';

  // 2. Extract session token: inspect Authorization Bearer header and HttpOnly cookie
  let bearerToken: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerToken = authHeader.substring(7).trim();
  }
  const cookieToken: string | undefined = req.cookies?.app_session;

  // Determine valid session: check Bearer token first (explicit client state), then fallback to Cookie
  let token: string | undefined;
  let payload = bearerToken ? authService.verifyToken(bearerToken) : null;

  if (payload) {
    token = bearerToken;
    // If cookie was also present but stale/invalid, clear it cleanly so client isn't polluted
    if (cookieToken && !authService.verifyToken(cookieToken)) {
      clearSessionCookie(res, req);
    }
  } else if (cookieToken) {
    const cookiePayload = authService.verifyToken(cookieToken);
    if (cookiePayload) {
      payload = cookiePayload;
      token = cookieToken;
    } else {
      clearSessionCookie(res, req);
    }
  }

  // 3. If a valid token and payload exist, verify user account
  if (payload && token) {
    const account = await repository.getUserAccountById(payload.uid, true);
    if (!account) {
      clearSessionCookie(res, req);
      if (isPublicPath) {
        next();
        return;
      }
      res.status(401).json({
        error: 'Unauthorized: User account not found.',
        code: 'ACCOUNT_NOT_FOUND',
      });
      return;
    }

    if (account.status === 'DISABLED') {
      res.status(403).json({
        error: 'Forbidden: Account is disabled. Please contact an administrator.',
        code: 'ACCOUNT_DISABLED',
      });
      return;
    }

    if (account.status === 'LOCKED') {
      res.status(403).json({
        error: 'Forbidden: Account is locked due to security policy. Please contact an administrator.',
        code: 'ACCOUNT_LOCKED',
      });
      return;
    }

    // CSRF protection for cookie-authenticated mutating requests
    if (req.cookies && req.cookies.app_session && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
      const customHeader = req.headers['x-requested-with'] || req.headers['x-csrf-token'];
      const secFetchSite = req.headers['sec-fetch-site'];
      const isSameOrigin = !secFetchSite || secFetchSite === 'same-origin' || secFetchSite === 'same-site';
      if (!customHeader && !isSameOrigin) {
        res.status(403).json({
          error: 'Forbidden: Missing CSRF verification header.',
          code: 'CSRF_BLOCKED',
        });
        return;
      }
    }

    // Force password change check
    if (account.mustChangePassword) {
      const isAllowedPasswordPath =
        req.path === '/auth/change-password' ||
        req.path === '/auth/me' ||
        req.path === '/auth/logout';

      if (!isAllowedPasswordPath) {
        res.status(403).json({
          error: 'Password change required before accessing application functionality.',
          code: 'PASSWORD_CHANGE_REQUIRED',
          mustChangePassword: true,
        });
        return;
      }
    }

    req.user = {
      uid: account.uid,
      operatorId: account.uid,
      name: account.name,
      email: account.email,
      role: account.role,
      mustChangePassword: Boolean(account.mustChangePassword),
    };

    next();
    return;
  }

  // 4. If tokens were provided but all failed verification
  if (bearerToken || cookieToken) {
    clearSessionCookie(res, req);
    if (isPublicPath) {
      next();
      return;
    }
    res.status(401).json({
      error: 'Unauthorized: Session token is invalid or expired. Please sign in.',
      code: 'INVALID_SESSION',
    });
    return;
  }

  // 5. If no token provided: allow if public endpoint
  if (isPublicPath) {
    next();
    return;
  }

  // 6. STRICT DENY-BY-DEFAULT: Reject unauthenticated request with HTTP 401
  res.status(401).json({
    error: 'Unauthorized: Authentication required. Please sign in.',
    code: 'AUTHENTICATION_REQUIRED',
  });
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: Authentication required.', code: 'AUTHENTICATION_REQUIRED' });
      return;
    }

    // SUPERADMIN has unconditional access to any role-restricted endpoint
    if (req.user.role === 'SUPERADMIN') {
      next();
      return;
    }

    // ADMIN can access any operational endpoint unless it strictly requires SUPERADMIN
    if (req.user.role === 'ADMIN' && !allowedRoles.includes('SUPERADMIN')) {
      next();
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: Role ${req.user.role} does not have required permissions [${allowedRoles.join(', ')}]`,
        code: 'FORBIDDEN_ROLE',
      });
      return;
    }

    next();
  };
}

export function requirePermission(...permissions: Permission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: Authentication required.', code: 'AUTHENTICATION_REQUIRED' });
      return;
    }

    // SUPERADMIN has unconditional access
    if (req.user.role === 'SUPERADMIN') {
      next();
      return;
    }

    const roles = await repository.getRoles();
    const hasAny = permissions.some((p) =>
      authService.roleHasPermission(req.user!.role, p, roles)
    );

    if (!hasAny) {
      res.status(403).json({
        error: `Forbidden: Role ${req.user.role} lacks required permission [${permissions.join(', ')}].`,
        code: 'FORBIDDEN_PERMISSION',
      });
      return;
    }

    next();
  };
}

