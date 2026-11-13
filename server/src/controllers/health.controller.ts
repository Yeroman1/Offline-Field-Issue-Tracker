import { Request, Response } from 'express';
import { checkDatabaseHealth } from '../config/database';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const isDbConnected = await checkDatabaseHealth();
  const statusCode = isDbConnected ? 200 : 503;

  res.status(statusCode).json({
    status: isDbConnected ? 'ok' : 'degraded',
    database: isDbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'nilepixel-offline-field-tracker-server',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
}
