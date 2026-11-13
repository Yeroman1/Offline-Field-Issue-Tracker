import { Router } from 'express';
import { getActivities } from '../controllers/activity.controller';

export const activityRouter = Router();

// GET /api/activity: List activity audit history with pagination & reportId filter
activityRouter.get('/', getActivities);
