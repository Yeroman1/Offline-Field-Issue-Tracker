import { Router } from 'express';
import { getActivities } from '../controllers/activity.controller';
import { requireRole } from '../middleware/auth.middleware';

export const activityRouter = Router();

// GET /api/activity: List activity audit history with pagination & reportId filter (Authenticated roles only)
activityRouter.get('/', requireRole(['FIELD_WORKER', 'COORDINATOR']), getActivities);
