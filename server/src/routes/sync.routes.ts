import { Router } from 'express';
import { processBatchSync } from '../controllers/sync.controller';
import { writeLimiter } from '../middleware/rateLimiter.middleware';
import { requireRole } from '../middleware/auth.middleware';

export const syncRouter = Router();

// POST /api/sync - Batch offline synchronization engine (Authenticated roles only)
syncRouter.post('/', writeLimiter, requireRole(['FIELD_WORKER', 'COORDINATOR']), processBatchSync);

