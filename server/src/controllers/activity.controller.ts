import { Request, Response, NextFunction } from 'express';
import { activityService } from '../services/activity.service';

export async function getActivities(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { reportId, action, limit, offset } = req.query;

    const result = await activityService.getActivities({
      reportId: reportId as string | undefined,
      action: action as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    res.status(200).json({
      success: true,
      message: 'Activity history retrieved successfully',
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

