/**
 * Custom Persistence and Firestore Error Hierarchy
 * Strictly ensures no silent fallback and unambiguous error codes
 */

export class PersistenceError extends Error {
  public readonly code: string;
  public readonly safeContext?: Record<string, any>;

  constructor(message: string, code = 'PERSISTENCE_ERROR', safeContext?: Record<string, any>) {
    super(message);
    this.name = 'PersistenceError';
    this.code = code;
    this.safeContext = safeContext;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class FirestoreUnavailableError extends PersistenceError {
  constructor(message = 'Firestore datastore is unavailable or unconfigured in production. Fallback to memory or local JSON is strictly disabled.') {
    super(message, 'FIRESTORE_UNAVAILABLE');
    this.name = 'FirestoreUnavailableError';
  }
}

export class PersistenceConfigurationError extends PersistenceError {
  constructor(message: string, safeContext?: Record<string, any>) {
    super(message, 'PERSISTENCE_CONFIGURATION_ERROR', safeContext);
    this.name = 'PersistenceConfigurationError';
  }
}

export class ConcurrencyConflictError extends PersistenceError {
  constructor(message: string, safeContext?: Record<string, any>) {
    super(message, 'CONCURRENCY_CONFLICT', safeContext);
    this.name = 'ConcurrencyConflictError';
  }
}

export class DuplicateEntityError extends PersistenceError {
  constructor(message: string, safeContext?: Record<string, any>) {
    super(message, 'DUPLICATE_ENTITY_CONFLICT', safeContext);
    this.name = 'DuplicateEntityError';
  }
}

export class EntityNotFoundError extends PersistenceError {
  constructor(entityName: string, entityId: string) {
    super(`${entityName} with ID '${entityId}' was not found.`, 'ENTITY_NOT_FOUND', { entityName, entityId });
    this.name = 'EntityNotFoundError';
  }
}

export class ValidationError extends PersistenceError {
  constructor(message: string, validationErrors?: any) {
    super(message, 'PERSISTENCE_VALIDATION_ERROR', { validationErrors });
    this.name = 'ValidationError';
  }
}
