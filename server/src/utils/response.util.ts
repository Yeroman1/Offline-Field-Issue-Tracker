import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '../types';

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Operation successful',
  statusCode = 200,
  meta?: Record<string, any>
): Response {
  const isObject = data && typeof data === 'object' && !Array.isArray(data);
  const payload = {
    success: true,
    message,
    ...(isObject ? (data as any) : {}),
    data,
    meta,
  };
  return res.status(statusCode).json(payload);
}

export function sendCreated<T>(
  res: Response,
  data: T,
  message = 'Resource created successfully',
  meta?: Record<string, any>
): Response {
  return sendSuccess(res, data, message, 201, meta);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  message = 'Records retrieved successfully'
): Response {
  return res.status(200).json({
    success: true,
    message,
    reports: data,
    data,
    total: pagination.total,
    limit: pagination.limit,
    page: pagination.page,
    offset: (pagination.page - 1) * pagination.limit,
    pagination,
  });
}

export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  code: string,
  details?: any
): Response {
  const payload = {
    success: false,
    message,
    code,
    error: {
      code,
      details,
      message,
    },
    details,
  };
  return res.status(statusCode).json(payload);
}
