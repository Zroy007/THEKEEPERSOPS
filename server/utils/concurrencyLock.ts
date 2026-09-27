import { logger } from './logger.js';

interface LockRecord {
  holderId: string;
  acquiredAt: number;
  expiresAt: number;
}

class ConcurrencyLockManager {
  private locks: Map<string, LockRecord> = new Map();

  /**
   * Attempts to acquire an exclusive lock for a resource key
   * Returns true if lock was acquired, false if already held by another worker
   */
  async acquireLock(resourceKey: string, holderId: string, ttlMs = 30000): Promise<boolean> {
    const now = Date.now();
    const existing = this.locks.get(resourceKey);

    if (existing) {
      if (existing.expiresAt > now) {
        if (existing.holderId === holderId) {
          // Re-entrant / renewal
          existing.expiresAt = now + ttlMs;
          return true;
        }
        logger.warn('LockManager', `Resource ${resourceKey} is currently locked by ${existing.holderId}`);
        return false;
      }
      // Expired lock: release and re-acquire
      this.locks.delete(resourceKey);
    }

    this.locks.set(resourceKey, {
      holderId,
      acquiredAt: now,
      expiresAt: now + ttlMs,
    });

    return true;
  }

  /**
   * Releases an exclusive lock for a resource key if held by holderId
   */
  async releaseLock(resourceKey: string, holderId: string): Promise<boolean> {
    const existing = this.locks.get(resourceKey);
    if (!existing) return true;

    if (existing.holderId === holderId) {
      this.locks.delete(resourceKey);
      return true;
    }

    logger.warn('LockManager', `Cannot release lock on ${resourceKey}: held by ${existing.holderId}, not ${holderId}`);
    return false;
  }

  /**
   * Executes a callback function with an exclusive lock, automatically releasing on completion
   */
  async withLock<T>(
    resourceKey: string,
    holderId: string,
    fn: () => Promise<T>,
    ttlMs = 30000
  ): Promise<T> {
    const acquired = await this.acquireLock(resourceKey, holderId, ttlMs);
    if (!acquired) {
      throw new Error(`Conflict: Resource '${resourceKey}' is already locked by another process.`);
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(resourceKey, holderId);
    }
  }

  /**
   * Cleanup expired locks periodically
   */
  pruneExpired() {
    const now = Date.now();
    for (const [key, lock] of this.locks.entries()) {
      if (lock.expiresAt <= now) {
        this.locks.delete(key);
      }
    }
  }
}

export const lockManager = new ConcurrencyLockManager();

// Run periodic pruning without preventing process exit
const lockPruneTimer = setInterval(() => lockManager.pruneExpired(), 15000);
if (lockPruneTimer && typeof lockPruneTimer.unref === 'function') {
  lockPruneTimer.unref();
}
