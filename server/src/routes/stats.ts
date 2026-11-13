import { Router } from 'express';
import { getStats } from '../controllers/stats.controller';
import { requireRole } from '../middleware/auth.middleware';

export const statsRouter = Router();

// GET /api/stats: Aggregate metrics and operational sync telemetry (Authenticated roles only)
statsRouter.get('/', requireRole(['FIELD_WORKER', 'COORDINATOR']), getStats);
