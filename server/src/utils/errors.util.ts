export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', code = 'CONFLICT', details?: any) {
    super(message, 409, code, details);
  }
}

export class VersionConflictError extends ConflictError {
  constructor(currentVersion: number, expectedVersion: number) {
    super(
      `Version conflict: Expected version ${expectedVersion}, but the current database version is ${currentVersion}. The record has been modified by another process.`,
      'VERSION_CONFLICT',
      { currentVersion, expectedVersion }
    );
  }
}

export class IdempotencyConflictError extends ConflictError {
  constructor() {
    super(
      'Idempotency key has already been used with a different request payload. Reusing idempotency keys with altered payloads is forbidden.',
      'IDEMPOTENCY_CONFLICT'
    );
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, code = 'BUSINESS_RULE_VIOLATION', details?: any) {
    super(message, 422, code, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

