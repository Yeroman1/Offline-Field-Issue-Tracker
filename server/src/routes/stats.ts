import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

export const statsRouter = Router();

// GET /api/stats: totalReports, byStatus, byPriority, byCategory, syncStats
statsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const [
      totalReports,
      statusGroups,
      priorityGroups,
      categoryGroups,
      syncStatusGroups,
      idempotencyCount,
      latestReport,
    ] = await Promise.all([
      prisma.report.count(),
      prisma.report.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.report.groupBy({
        by: ['priority'],
        _count: { priority: true },
      }),
      prisma.report.groupBy({
        by: ['category'],
        _count: { category: true },
      }),
      prisma.report.groupBy({
        by: ['syncStatus'],
        _count: { syncStatus: true },
      }),
      prisma.idempotencyRecord.count(),
      prisma.report.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);

    const byStatus: Record<string, number> = {
      draft: 0,
      submitted: 0,
      assigned: 0,
      in_progress: 0,
      resolved: 0,
      rejected: 0,
    };
    statusGroups.forEach((g) => {
      byStatus[g.status] = g._count.status;
    });

    const byPriority: Record<string, number> = {
      Low: 0,
      Medium: 0,
      High: 0,
      Critical: 0,
    };
    priorityGroups.forEach((g) => {
      byPriority[g.priority] = g._count.priority;
    });

    const byCategory: Record<string, number> = {};
    categoryGroups.forEach((g) => {
      byCategory[g.category] = g._count.category;
    });

    const syncStats = {
      totalSynced:
        syncStatusGroups.find((g) => g.syncStatus === 'synced')?._count.syncStatus || 0,
      pendingSync:
        syncStatusGroups.find((g) => g.syncStatus === 'pending')?._count.syncStatus || 0,
      totalSyncTransactions: idempotencyCount,
      lastSyncTimestamp: latestReport?.updatedAt || new Date(),
    };

    res.json({
      totalReports,
      byStatus,
      byPriority,
      byCategory,
      syncStats,
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  }
});

