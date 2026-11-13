import { Request, Response, NextFunction } from 'express';
import { statsService } from '../services/stats.service';

export async function getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await statsService.getDashboardStats();
    res.status(200).json({
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      ...stats,
    });
  } catch (error) {
    next(error);
  }
}

