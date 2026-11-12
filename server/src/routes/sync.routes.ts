import { Router } from 'express';
import { processBatchSync } from '../controllers/sync.controller';
import { writeLimiter } from '../middleware/rateLimiter.middleware';

export const syncRouter = Router();

// POST /api/sync - Batch offline synchronization engine
syncRouter.post('/', writeLimiter, processBatchSync);

