import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

interface IdempotentRecord {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
  createdAt: number;
}

class IdempotencyManager {
  private cache: Map<string, IdempotentRecord> = new Map();
  private notificationCache: Map<string, number> = new Map();
  private TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Checks if an idempotency key exists and returns cached response
   */
  getRecord(key: string): IdempotentRecord | undefined {
    const record = this.cache.get(key);
    if (!record) return undefined;
    if (Date.now() - record.createdAt > this.TTL_MS) {
      this.cache.delete(key);
      return undefined;
    }
    return record;
  }

  /**
   * Stores response for an idempotency key
   */
  saveRecord(key: string, statusCode: number, body: any, headers: Record<string, string> = {}) {
    this.cache.set(key, {
      statusCode,
      body,
      headers,
      createdAt: Date.now(),
    });
  }

  /**
   * Deduplication check for notifications
   * Returns true if notification is a duplicate within windowMs (default 5 min)
   */
  isDuplicateNotification(dedupKey: string, windowMs = 5 * 60 * 1000): boolean {
    const now = Date.now();
    const lastSent = this.notificationCache.get(dedupKey);

    if (lastSent && now - lastSent < windowMs) {
      logger.warn('Deduplication', `Blocked duplicate notification for key: ${dedupKey}`);
      return true;
    }

    this.notificationCache.set(dedupKey, now);
    return false;
  }

  prune() {
    const now = Date.now();
    for (const [key, record] of this.cache.entries()) {
      if (now - record.createdAt > this.TTL_MS) {
        this.cache.delete(key);
      }
    }
    for (const [key, timestamp] of this.notificationCache.entries()) {
      if (now - timestamp > 60 * 60 * 1000) {
        this.notificationCache.delete(key);
      }
    }
  }
}

export const idempotencyManager = new IdempotencyManager();
const idempotencyPruneTimer = setInterval(() => idempotencyManager.prune(), 60000);
if (idempotencyPruneTimer && typeof idempotencyPruneTimer.unref === 'function') {
  idempotencyPruneTimer.unref();
}

/**
 * Express middleware to support Idempotency-Key headers
 */
export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only apply to mutating requests (POST, PUT, PATCH)
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return next();
  }

  const idempotencyKey = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as string;
  if (!idempotencyKey) {
    return next();
  }

  const cached = idempotencyManager.getRecord(idempotencyKey);
  if (cached) {
    logger.info('Idempotency', `Returning cached response for key: ${idempotencyKey}`);
    res.setHeader('X-Cache-Lookup', 'HIT');
    return res.status(cached.statusCode).json(cached.body);
  }

  // Intercept response json method
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    // Only cache successful or non-server-error responses
    if (res.statusCode < 500) {
      idempotencyManager.saveRecord(idempotencyKey, res.statusCode, body);
    }
    return originalJson(body);
  };

  next();
}
