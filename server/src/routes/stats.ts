import { Router } from 'express';
import { getStats } from '../controllers/stats.controller';

export const statsRouter = Router();

// GET /api/stats: Aggregate metrics and operational sync telemetry
statsRouter.get('/', getStats);
