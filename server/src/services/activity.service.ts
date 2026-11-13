import { prisma } from '../config/database';

export interface ActivityFilterOptions {
  reportId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

export class ActivityService {
  async getActivities(options: ActivityFilterOptions) {
    const { reportId, action, limit = 50, offset = 0 } = options;

    const where: any = {};
    if (reportId && typeof reportId === 'string') {
      where.reportId = reportId;
    }
    if (action && typeof action === 'string') {
      where.action = action.toUpperCase();
    }

    const take = Math.min(Math.max(limit, 1), 200);
    const skip = Math.max(offset, 0);

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

    return {
      activities,
      total,
      limit: take,
      offset: skip,
    };
  }

  async getActivitiesByReportId(reportId: string) {
    return prisma.activityLog.findMany({
      where: { reportId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const activityService = new ActivityService();

