import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { validateTransition, StatusTransitionError } from '../lib/statusMachine';

export const reportsRouter = Router();

const createReportSchema = z.object({
  id: z.string().optional(),
  reportNumber: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  category: z.string().min(1, 'Category is required'),
  priority: z.string().min(1, 'Priority is required'),
  status: z.string().default('submitted'),
  syncStatus: z.string().default('synced'),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  locationName: z.string().optional().nullable(),
  locationAccuracy: z.number().optional().nullable(),
  reporterName: z.string().optional().nullable(),
  reporterId: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  assignedTeam: z.string().optional().nullable(),
  resolutionNotes: z.string().optional().nullable(),
  resolvedBy: z.string().optional().nullable(),
  resolvedAt: z.string().optional().nullable(),
  version: z.number().int().optional(),
});

const updateStatusSchema = z.object({
  status: z.string().min(1, 'Status is required'),
  actorName: z.string().optional(),
  comment: z.string().optional(),
  assignedTo: z.string().optional().nullable(),
  assignedTeam: z.string().optional().nullable(),
  resolutionNotes: z.string().optional().nullable(),
  resolvedBy: z.string().optional().nullable(),
  version: z.number().int().optional(),
});

// Helper to generate sequential report number (NP-XXXX)
async function generateReportNumber(): Promise<string> {
  const reports = await prisma.report.findMany({
    select: { reportNumber: true },
  });
  const existingSet = new Set(reports.map((r) => r.reportNumber));

  let maxNum = 8800;
  for (const r of reports) {
    if (r.reportNumber && r.reportNumber.startsWith('NP-')) {
      const match = r.reportNumber.match(/^NP-(\d+)$/);
      if (match) {
        const numPart = parseInt(match[1], 10);
        if (numPart > maxNum) {
          maxNum = numPart;
        }
      }
    }
  }

  let nextNum = maxNum + 1;
  while (existingSet.has(`NP-${nextNum}`)) {
    nextNum++;
  }
  return `NP-${nextNum}`;
}

// GET /api/reports (with filters: status, priority, category, search, since, limit, offset, sort, order)
reportsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const {
      status,
      priority,
      category,
      search,
      since,
      limit = '50',
      offset = '0',
      sort = 'createdAt',
      order = 'desc',
    } = req.query;

    const where: any = {};

    if (status && typeof status === 'string') {
      if (status.includes(',')) {
        where.status = { in: status.split(',').map((s) => s.trim()) };
      } else if (status !== 'all') {
        where.status = status;
      }
    }

    if (priority && typeof priority === 'string' && priority !== 'all') {
      if (priority.includes(',')) {
        where.priority = { in: priority.split(',').map((p) => p.trim()) };
      } else {
        where.priority = priority;
      }
    }

    if (category && typeof category === 'string' && category !== 'all') {
      if (category.includes(',')) {
        where.category = { in: category.split(',').map((c) => c.trim()) };
      } else {
        where.category = category;
      }
    }

    if (since && typeof since === 'string') {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        where.updatedAt = { gte: sinceDate };
      }
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { reportNumber: { contains: search } },
        { locationName: { contains: search } },
        { reporterName: { contains: search } },
      ];
    }

    const take = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 200);
    const skip = Math.max(parseInt(offset as string, 10) || 0, 0);
    const validSortFields = ['createdAt', 'updatedAt', 'priority', 'status', 'reportNumber', 'title'];
    const orderByField = validSortFields.includes(sort as string) ? (sort as string) : 'createdAt';
    const orderByDirection = (order as string).toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        take,
        skip,
        orderBy: { [orderByField]: orderByDirection },
        include: {
          activityLogs: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      }),
      prisma.report.count({ where }),
    ]);

    res.json({
      reports,
      total,
      limit: take,
      offset: skip,
    });
  } catch (error: any) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports', details: error.message });
  }
});

// GET /api/reports/:id (with activity logs)
reportsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const report = await prisma.report.findFirst({
      where: {
        OR: [{ id }, { reportNumber: id }],
      },
      include: {
        activityLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (error: any) {
    console.error('Error fetching report:', error);
    res.status(500).json({ error: 'Failed to fetch report', details: error.message });
  }
});

// POST /api/reports (creates report, logs activity, generates NP-XXXX if missing)
reportsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createReportSchema.parse(req.body);

    const reportId = parsed.id || uuidv4();
    let reportNumber = parsed.reportNumber;
    if (!reportNumber) {
      reportNumber = await generateReportNumber();
    } else {
      const existingWithNum = await prisma.report.findUnique({ where: { reportNumber } });
      if (existingWithNum && existingWithNum.id !== reportId) {
        reportNumber = await generateReportNumber();
      }
    }

    const report = await prisma.$transaction(async (tx) => {
      const created = await tx.report.create({
        data: {
          id: reportId,
          reportNumber,
          title: parsed.title,
          description: parsed.description || null,
          category: parsed.category,
          priority: parsed.priority,
          status: parsed.status,
          syncStatus: parsed.syncStatus,
          latitude: parsed.latitude ?? null,
          longitude: parsed.longitude ?? null,
          locationName: parsed.locationName ?? null,
          locationAccuracy: parsed.locationAccuracy ?? null,
          reporterName: parsed.reporterName ?? null,
          reporterId: parsed.reporterId ?? null,
          assignedTo: parsed.assignedTo ?? null,
          assignedTeam: parsed.assignedTeam ?? null,
          resolutionNotes: parsed.resolutionNotes ?? null,
          resolvedBy: parsed.resolvedBy ?? null,
          resolvedAt: parsed.resolvedAt ? new Date(parsed.resolvedAt) : null,
          version: parsed.version ?? 1,
        },
      });

      await tx.activityLog.create({
        data: {
          id: uuidv4(),
          reportId: created.id,
          action: 'created',
          actorName: parsed.reporterName || 'Field Reporter',
          description: `Report ${reportNumber} created with status '${parsed.status}'`,
          newValue: parsed.status,
        },
      });

      return created;
    });

    res.status(201).json(report);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: error.issues });
    }
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'Failed to create report', details: error.message });
  }
});

// PATCH /api/reports/:id/status (validates transition, version check for optimistic concurrency, updates status, logs activity)
reportsRouter.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = updateStatusSchema.parse(req.body);

    const currentReport = await prisma.report.findFirst({
      where: {
        OR: [{ id }, { reportNumber: id }],
      },
    });

    if (!currentReport) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // 1. Validate status transition (throws 422 if invalid)
    validateTransition(currentReport.status, parsed.status);

    // 2. Optimistic Concurrency Check: If version is provided, ensure it matches current version
    if (parsed.version !== undefined && parsed.version !== currentReport.version) {
      return res.status(409).json({
        error: 'Concurrency conflict',
        message: `Version mismatch: expected version ${currentReport.version}, but request specified ${parsed.version}.`,
        currentVersion: currentReport.version,
      });
    }

    // 3. Update in transaction with activity log
    const updated = await prisma.$transaction(async (tx) => {
      const updateData: any = {
        status: parsed.status,
        version: currentReport.version + 1,
      };

      if (parsed.assignedTo !== undefined) updateData.assignedTo = parsed.assignedTo;
      if (parsed.assignedTeam !== undefined) updateData.assignedTeam = parsed.assignedTeam;
      if (parsed.resolutionNotes !== undefined) updateData.resolutionNotes = parsed.resolutionNotes;
      if (parsed.resolvedBy !== undefined) updateData.resolvedBy = parsed.resolvedBy;

      if (parsed.status === 'resolved') {
        updateData.resolvedAt = new Date();
        if (!updateData.resolvedBy) {
          updateData.resolvedBy = parsed.actorName || 'Coordinator';
        }
      }

      const report = await tx.report.update({
        where: { id: currentReport.id },
        data: updateData,
        include: {
          activityLogs: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          id: uuidv4(),
          reportId: report.id,
          action: 'status_change',
          actorName: parsed.actorName || 'Coordinator',
          description:
            parsed.comment ||
            `Status changed from '${currentReport.status}' to '${parsed.status}'`,
          previousValue: currentReport.status,
          newValue: parsed.status,
        },
      });

      return report;
    });

    res.json(updated);
  } catch (error: any) {
    if (error instanceof StatusTransitionError) {
      return res.status(422).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating report status:', error);
    res.status(500).json({ error: 'Failed to update report status', details: error.message });
  }
});

