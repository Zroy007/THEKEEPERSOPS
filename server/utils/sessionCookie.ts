import { Request, Response } from 'express';

/**
 * Returns environment-aware secure cookie options.
 * In production or over HTTPS (including Cloud Run / reverse proxies / AI Studio preview),
 * sets secure: true and sameSite: 'none' to support iframe embedding.
 * In direct HTTP local development, safely falls back to sameSite: 'lax' and secure: false.
 */
export function getSessionCookieOptions(req?: Request) {
  const isHttps = Boolean(
    process.env.NODE_ENV === 'production' ||
    req?.secure ||
    req?.headers?.['x-forwarded-proto'] === 'https' ||
    req?.headers?.['x-forwarded-ssl'] === 'on'
  );

  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? ('none' as const) : ('lax' as const),
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}

/**
 * Clears the session cookie with matching security flags to ensure browser removal.
 */
export function clearSessionCookie(res: Response, req?: Request) {
  const opts = getSessionCookieOptions(req);
  res.clearCookie('app_session', {
    path: opts.path,
    secure: opts.secure,
    sameSite: opts.sameSite,
    httpOnly: opts.httpOnly,
  });
}
