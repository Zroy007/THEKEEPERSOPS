import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

interface ClientBucket {
  timestamps: number[];
}

export function createRateLimiter(options: RateLimitConfig) {
  const clients: Map<string, ClientBucket> = new Map();
  const { windowMs, maxRequests, message = 'Too many requests. Please try again later.' } = options;

  // Prune inactive clients every 60s
  const pruneTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of clients.entries()) {
      bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
      if (bucket.timestamps.length === 0) {
        clients.delete(ip);
      }
    }
  }, 60000);
  if (pruneTimer && typeof pruneTimer.unref === 'function') {
    pruneTimer.unref();
  }

  return function rateLimiter(req: Request, res: Response, next: NextFunction) {
    const identifier = (req.user?.operatorId || req.ip || req.socket.remoteAddress || 'unknown') as string;
    const now = Date.now();

    let bucket = clients.get(identifier);
    if (!bucket) {
      bucket = { timestamps: [] };
      clients.set(identifier, bucket);
    }

    // Filter to current window
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

    const remaining = Math.max(0, maxRequests - bucket.timestamps.length);
    const resetTime = Math.ceil((bucket.timestamps[0] ? bucket.timestamps[0] + windowMs : now + windowMs) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTime);

    if (bucket.timestamps.length >= maxRequests) {
      logger.warn('RateLimiter', `Rate limit exceeded for ${identifier} on ${req.method} ${req.path}`);
      return res.status(429).json({
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterSeconds: Math.ceil((bucket.timestamps[0] + windowMs - now) / 1000),
      });
    }

    bucket.timestamps.push(now);
    next();
  };
}

// Global API rate limiter: 180 requests per minute
export const globalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 180,
  message: 'Global API rate limit exceeded.',
});

// Stricter limiter for mutations / job creation: 45 requests per minute
export const mutationRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 45,
  message: 'Mutation rate limit exceeded. Please throttle job submissions.',
});
