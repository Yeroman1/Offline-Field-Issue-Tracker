import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

export const activityRouter = Router();

// GET /api/activity: list activity logs with limit, reportId filter
activityRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { reportId, limit = '50', offset = '0' } = req.query;

    const where: any = {};
    if (reportId && typeof reportId === 'string') {
      where.reportId = reportId;
    }

    const take = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 200);
    const skip = Math.max(parseInt(offset as string, 10) || 0, 0);

    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          report: {
            select: {
              reportNumber: true,
              title: true,
              status: true,
            },
          },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({
      activities,
      total,
      limit: take,
      offset: skip,
    });
  } catch (error: any) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs', details: error.message });
  }
});

