import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const code = err.code || (statusCode === 404 ? 'NOT_FOUND' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR');

  logger.error('ErrorHandler', `${req.method} ${req.path} failed: ${err.message}`, {
    statusCode,
    code,
    path: req.path,
    method: req.method,
    operatorId: req.user?.operatorId,
  });

  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    error: err.message || 'An internal server error occurred',
    code,
    timestamp: new Date().toISOString(),
    ...(err.details ? { details: err.details } : {}),
    ...(!isProduction && err.stack ? { stack: err.stack } : {}),
  });
}
