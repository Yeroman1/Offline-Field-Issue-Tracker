import { prisma } from '../config/database';

export class StatsService {
  async getDashboardStats() {
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
      prisma.syncMetadata.groupBy({
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
      DRAFT: 0,
      SUBMITTED: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      REJECTED: 0,
    };
    statusGroups.forEach((g) => {
      byStatus[g.status] = (byStatus[g.status] || 0) + g._count.status;
      byStatus[g.status.toLowerCase()] = (byStatus[g.status.toLowerCase()] || 0) + g._count.status;
    });

    const byPriority: Record<string, number> = {
      Low: 0,
      Medium: 0,
      High: 0,
      Critical: 0,
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    priorityGroups.forEach((g) => {
      byPriority[g.priority] = (byPriority[g.priority] || 0) + g._count.priority;
    });

    const byCategory: Record<string, number> = {};
    categoryGroups.forEach((g) => {
      byCategory[g.category] = g._count.category;
    });

    const totalSynced = syncStatusGroups
      .filter((g) => g.syncStatus.toLowerCase() === 'synced')
      .reduce((sum, g) => sum + g._count.syncStatus, 0);

    const pendingSync = syncStatusGroups
      .filter((g) => g.syncStatus.toLowerCase() === 'pending')
      .reduce((sum, g) => sum + g._count.syncStatus, 0);

    const syncStats = {
      totalSynced,
      pendingSync,
      totalSyncTransactions: idempotencyCount,
      lastSyncTimestamp: latestReport?.updatedAt || new Date(),
    };

    return {
      totalReports,
      byStatus,
      byPriority,
      byCategory,
      syncStats,
    };
  }
}

export const statsService = new StatsService();

