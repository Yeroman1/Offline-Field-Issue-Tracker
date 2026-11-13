import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.util';
import { sendError } from '../utils/response.util';
import { env } from '../config/env';
import { Prisma } from '@prisma/client';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Custom Application Errors (Known domain errors)
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.message, err.code, err.details);
    return;
  }

  // 2. Prisma Database Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[]) || [];
      const field = Array.isArray(target) ? target.join(', ') : 'field';
      sendError(
        res,
        409,
        `Unique constraint violation: A record with this ${field} already exists.`,
        'DUPLICATE_ENTITY',
        { fields: target }
      );
      return;
    }

    if (err.code === 'P2025') {
      sendError(res, 404, 'The requested database record does not exist.', 'NOT_FOUND');
      return;
    }

    if (err.code === 'P2003') {
      sendError(res, 400, 'Database relationship constraint violation.', 'INVALID_RELATION');
      return;
    }

    // Generic safe DB error
    sendError(res, 500, 'Database transaction failed.', 'DATABASE_ERROR');
    return;
  }

  // 3. Express JSON Parse Error
  if ('type' in err && (err as any).type === 'entity.parse.failed') {
    sendError(res, 400, 'Malformed JSON payload provided.', 'INVALID_JSON');
    return;
  }

  // 4. Unhandled / Unexpected Errors
  const isDev = !env.IS_PRODUCTION;
  sendError(
    res,
    500,
    isDev ? err.message : 'An unexpected internal server error occurred.',
    'INTERNAL_SERVER_ERROR',
    isDev ? { stack: err.stack } : undefined
  );
}

