import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database';
import {
  CreateReportDTO,
  UpdateReportDTO,
  StatusTransitionDTO,
  PaginationMeta,
  LocationPayload,
  ReportStatus,
  ReportCategory,
  ReportPriority,
} from '../types';
import {
  NotFoundError,
  ConflictError,
  VersionConflictError,
  IdempotencyConflictError,
} from '../utils/errors.util';
import { computePayloadHash } from '../utils/hash.util';
import { validateStatusTransition } from './statusMachine.service';

/**
 * Sequential human-readable report number generator (e.g. NP-8801, NP-8802).
 */
export async function generateNextReportNumber(tx: any = prisma): Promise<string> {
  // Acquire transaction-level advisory lock in PostgreSQL to serialize concurrent numbering
  try {
    if (typeof tx.$executeRawUnsafe === 'function') {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(880088);');
    }
  } catch {
    // Non-Postgres fallback or lock ignored
  }

  const reports = await tx.report.findMany({
    select: { reportNumber: true },
    where: { reportNumber: { startsWith: 'NP-' } },
  });

  const existingSet = new Set(reports.map((r: any) => r.reportNumber));

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

/**
 * Helper to normalize location input into structured columns and raw text.
 */
function parseLocation(locationInput: string | LocationPayload | undefined) {
  let locationString = '';
  let latitude: number | null = null;
  let longitude: number | null = null;
  let locationName: string | null = null;
  let locationAccuracy: number | null = null;

  if (typeof locationInput === 'string') {
    locationString = locationInput;
    locationName = locationInput;
  } else if (locationInput && typeof locationInput === 'object') {
    latitude = locationInput.latitude ?? null;
    longitude = locationInput.longitude ?? null;
    locationName = locationInput.locationName ?? null;
    locationAccuracy = locationInput.locationAccuracy ?? null;
    locationString = locationInput.rawText || locationInput.locationName || JSON.stringify(locationInput);
  }

  return { locationString, latitude, longitude, locationName, locationAccuracy };
}

export class ReportService {
  /**
   * Creates a new report with atomic transaction, idempotency guarantees, and audit history.
   */
  async createReport(dto: CreateReportDTO, rawBody: any) {
    const payloadHash = computePayloadHash(rawBody);

    // 1. Idempotency Check: Verify if idempotencyKey was previously processed
    const existingIdempotency = await prisma.idempotencyRecord.findUnique({
      where: { key: dto.idempotencyKey },
    });

    if (existingIdempotency) {
      if (existingIdempotency.payloadHash === payloadHash) {
        // Idempotency replay: Return cached response directly
        try {
          return JSON.parse(existingIdempotency.response);
        } catch {
          return { data: existingIdempotency.response, replayed: true };
        }
      } else {
        // Idempotency key reused with modified payload -> Reject
        throw new IdempotencyConflictError();
      }
    }

    // 2. Client Report ID Deduplication Check
    const existingClientReport = await prisma.report.findUnique({
      where: { clientReportId: dto.clientReportId },
      include: {
        syncMetadata: true,
        statusTransitions: true,
        activityLogs: true,
      },
    });

    if (existingClientReport) {
      throw new ConflictError(
        `A report with clientReportId '${dto.clientReportId}' already exists.`,
        'DUPLICATE_CLIENT_REPORT_ID',
        { clientReportId: dto.clientReportId, reportNumber: existingClientReport.reportNumber }
      );
    }

    // 3. Normalize location data
    const loc = parseLocation(dto.location);
    const initialStatus = (dto.initialStatus || ReportStatus.SUBMITTED).toUpperCase();

    // 4. Atomic transaction creating Report, SyncMetadata, StatusTransition, ActivityLog, IdempotencyRecord with retry on reportNumber collision
    let retries = 3;
    let createdResult: any;

    while (retries > 0) {
      try {
        createdResult = await prisma.$transaction(async (tx) => {
          const reportNumber = await generateNextReportNumber(tx as any);
          const reportId = uuidv4();

          // Ensure UserProfile exists for reporter
          if (dto.reporterId) {
            await tx.userProfile.upsert({
              where: { id: dto.reporterId },
              update: {
                fullName: dto.reporterName || undefined,
              },
              create: {
                id: dto.reporterId,
                email: `${dto.reporterId}@field.nilepixel.org`,
                fullName: dto.reporterName || 'Field Reporter',
                role: 'FIELD_WORKER',
              },
            });
          }

          const report = await tx.report.create({
            data: {
              id: reportId,
              clientReportId: dto.clientReportId,
              reportNumber,
              title: dto.title,
              category: dto.category.toUpperCase(),
              description: dto.description,
              location: loc.locationString,
              latitude: loc.latitude,
              longitude: loc.longitude,
              locationName: loc.locationName,
              locationAccuracy: loc.locationAccuracy,
              priority: dto.priority.toUpperCase(),
              status: initialStatus,
              reportedAt: new Date(dto.reportedAt),
              reporterId: dto.reporterId,
              reporterName: dto.reporterName || null,
              sourceDeviceId: dto.sourceDeviceId,
              version: 1,
            },
          });

          const syncMetadata = await tx.syncMetadata.create({
            data: {
              id: uuidv4(),
              reportId: report.id,
              syncStatus: 'SYNCED',
              attemptCount: 1,
              lastAttemptAt: new Date(),
              acknowledgedAt: new Date(),
            },
          });

          const statusTransition = await tx.statusTransition.create({
            data: {
              id: uuidv4(),
              reportId: report.id,
              fromStatus: 'DRAFT',
              toStatus: initialStatus,
              actorId: dto.reporterId,
              note: 'Initial report creation and submission',
            },
          });

          const activityLog = await tx.activityLog.create({
            data: {
              id: uuidv4(),
              reportId: report.id,
              action: 'REPORT_CREATED',
              actorId: dto.reporterId,
              actorName: dto.reporterName || 'Field Reporter',
              description: `Report ${reportNumber} created with initial status '${initialStatus}'`,
              newValue: initialStatus,
            },
          });

          const responsePayload = {
            ...report,
            syncMetadata,
            statusTransitions: [statusTransition],
            activityLogs: [activityLog],
          };

          // Record idempotency execution
          await tx.idempotencyRecord.create({
            data: {
              key: dto.idempotencyKey,
              payloadHash,
              statusCode: 201,
              response: JSON.stringify(responsePayload),
            },
          });

          return responsePayload;
        }, {
          maxWait: 15000,
          timeout: 45000,
        });
        break;
      } catch (err: any) {
        if (err.code === 'P2002' && (String(err.meta?.target || '').includes('reportNumber') || String(err.message || '').includes('reportNumber')) && retries > 1) {
          retries--;
          await new Promise((res) => setTimeout(res, 50 * (4 - retries)));
          continue;
        }
        throw err;
      }
    }

    return createdResult;
  }

  /**
   * Retrieves reports with database-level filtering, search, pagination, and sorting.
   */
  async getReports(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    syncStatus?: string;
    category?: string;
    priority?: string;
    reporter?: string;
    assignee?: string;
    since?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filter by since timestamp for delta synchronization
    if (query.since) {
      const sinceDate = new Date(query.since);
      if (!isNaN(sinceDate.getTime())) {
        where.updatedAt = { gt: sinceDate };
      }
    }

    // Filter by status (single or comma-separated)
    if (query.status && query.status !== 'all') {
      if (query.status.includes(',')) {
        where.status = { in: query.status.split(',').map((s) => s.trim().toUpperCase()) };
      } else {
        where.status = query.status.toUpperCase();
      }
    }

    // Filter by category
    if (query.category && query.category !== 'all') {
      if (query.category.includes(',')) {
        where.category = { in: query.category.split(',').map((c) => c.trim().toUpperCase()) };
      } else {
        where.category = query.category.toUpperCase();
      }
    }

    // Filter by priority
    if (query.priority && query.priority !== 'all') {
      if (query.priority.includes(',')) {
        where.priority = { in: query.priority.split(',').map((p) => p.trim().toUpperCase()) };
      } else {
        where.priority = query.priority.toUpperCase();
      }
    }

    // Filter by reporter
    if (query.reporter) {
      where.reporterId = query.reporter;
    }

    // Filter by assignee
    if (query.assignee) {
      where.assignedTo = query.assignee;
    }

    // Filter by syncStatus (via SyncMetadata relation)
    if (query.syncStatus && query.syncStatus !== 'all') {
      where.syncMetadata = {
        syncStatus: query.syncStatus.toUpperCase(),
      };
    }

    // Search across title and description
    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term } },
        { description: { contains: term } },
        { reportNumber: { contains: term } },
        { locationName: { contains: term } },
      ];
    }

    // Sorting
    const sortField = query.sortBy || 'createdAt';
    const sortDir = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: sortDir },
        include: {
          syncMetadata: true,
          activityLogs: {
            take: 3,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.report.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    const pagination: PaginationMeta = {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    return { reports, pagination };
  }

  /**
   * Retrieves a single report with full audit history and sync metadata.
   */
  async getReportById(idOrNumber: string) {
    const report = await prisma.report.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { reportNumber: idOrNumber }, { clientReportId: idOrNumber }],
      },
      include: {
        syncMetadata: true,
        statusTransitions: {
          orderBy: { createdAt: 'asc' },
        },
        activityLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!report) {
      throw new NotFoundError(`Report with identifier '${idOrNumber}' not found.`);
    }

    return report;
  }

  /**
   * Updates non-protected report fields with optimistic concurrency control.
   */
  async updateReport(idOrNumber: string, dto: UpdateReportDTO) {
    const existing = await prisma.report.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { reportNumber: idOrNumber }],
      },
    });

    if (!existing) {
      throw new NotFoundError(`Report with identifier '${idOrNumber}' not found.`);
    }

    // Optimistic Concurrency Control
    if (dto.expectedVersion !== existing.version) {
      throw new VersionConflictError(existing.version, dto.expectedVersion);
    }

    // Build update payload safely (protected fields already stripped/forbidden by Zod)
    const updateData: any = {
      version: existing.version + 1,
    };

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.category !== undefined) updateData.category = dto.category.toUpperCase();
    if (dto.priority !== undefined) updateData.priority = dto.priority.toUpperCase();
    if (dto.assignedTo !== undefined) updateData.assignedTo = dto.assignedTo;
    if (dto.assignedTeam !== undefined) updateData.assignedTeam = dto.assignedTeam;
    if (dto.resolutionNotes !== undefined) updateData.resolutionNotes = dto.resolutionNotes;
    if (dto.resolvedBy !== undefined) updateData.resolvedBy = dto.resolvedBy;

    if (dto.location !== undefined) {
      const loc = parseLocation(dto.location);
      updateData.location = loc.locationString;
      if (loc.latitude !== null) updateData.latitude = loc.latitude;
      if (loc.longitude !== null) updateData.longitude = loc.longitude;
      if (loc.locationName !== null) updateData.locationName = loc.locationName;
      if (loc.locationAccuracy !== null) updateData.locationAccuracy = loc.locationAccuracy;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.report.updateMany({
        where: {
          id: existing.id,
          version: dto.expectedVersion,
        },
        data: updateData,
      });

      if (updateResult.count === 0) {
        const current = await tx.report.findUnique({ where: { id: existing.id } });
        throw new VersionConflictError(current?.version || 0, dto.expectedVersion);
      }

      const savedReport = await tx.report.findUniqueOrThrow({
        where: { id: existing.id },
        include: {
          syncMetadata: true,
          activityLogs: {
            take: 5,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          id: uuidv4(),
          reportId: savedReport.id,
          action: 'REPORT_UPDATED',
          actorId: dto.actorId || null,
          actorName: dto.actorName || 'System User',
          description: `Report fields updated. Version incremented to ${savedReport.version}.`,
          previousValue: JSON.stringify({ version: existing.version }),
          newValue: JSON.stringify({ version: savedReport.version }),
        },
      });

      return savedReport;
    }, {
      maxWait: 15000,
      timeout: 45000,
    });

    return updated;
  }

  /**
   * Executes a validated report status transition with state machine enforcement.
   */
  async transitionReportStatus(idOrNumber: string, dto: StatusTransitionDTO) {
    const existing = await prisma.report.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { reportNumber: idOrNumber }],
      },
    });

    if (!existing) {
      throw new NotFoundError(`Report with identifier '${idOrNumber}' not found.`);
    }

    // 1. Optimistic Concurrency Check
    if (dto.expectedVersion !== existing.version) {
      throw new VersionConflictError(existing.version, dto.expectedVersion);
    }

    // 2. Validate Status Transition via State Machine (throws 422 if invalid)
    const { targetStatus } = validateStatusTransition(existing.status, dto.status);

    // 3. Execute atomic transition update
    const updated = await prisma.$transaction(async (tx) => {
      const updateData: any = {
        status: targetStatus,
        version: existing.version + 1,
      };

      if (dto.assignedTo !== undefined) updateData.assignedTo = dto.assignedTo;
      if (dto.assignedTeam !== undefined) updateData.assignedTeam = dto.assignedTeam;
      if (dto.resolutionNotes !== undefined) updateData.resolutionNotes = dto.resolutionNotes;
      if (dto.resolvedBy !== undefined) updateData.resolvedBy = dto.resolvedBy;

      if (targetStatus === ReportStatus.RESOLVED) {
        updateData.resolvedAt = new Date();
        if (!updateData.resolvedBy) {
          updateData.resolvedBy = dto.actorName || dto.actorId || 'Coordinator';
        }
      }

      const updateResult = await tx.report.updateMany({
        where: {
          id: existing.id,
          version: dto.expectedVersion,
        },
        data: updateData,
      });

      if (updateResult.count === 0) {
        const current = await tx.report.findUnique({ where: { id: existing.id } });
        throw new VersionConflictError(current?.version || 0, dto.expectedVersion);
      }

      const savedReport = await tx.report.findUniqueOrThrow({
        where: { id: existing.id },
        include: {
          syncMetadata: true,
          statusTransitions: {
            orderBy: { createdAt: 'desc' },
          },
          activityLogs: {
            take: 5,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      // Record transition history audit
      await tx.statusTransition.create({
        data: {
          id: uuidv4(),
          reportId: savedReport.id,
          fromStatus: existing.status,
          toStatus: targetStatus,
          actorId: dto.actorId || null,
          note: dto.note || `Status transition from ${existing.status} to ${targetStatus}`,
        },
      });

      // Record activity log
      await tx.activityLog.create({
        data: {
          id: uuidv4(),
          reportId: savedReport.id,
          action: 'STATUS_UPDATED',
          actorId: dto.actorId || null,
          actorName: dto.actorName || 'Workflow Coordinator',
          description: dto.note || `Status transitioned from ${existing.status} to ${targetStatus}`,
          previousValue: existing.status,
          newValue: targetStatus,
        },
      });

      return savedReport;
    }, {
      maxWait: 15000,
      timeout: 45000,
    });

    return updated;
  }

  /**
   * Assigns a report to a technician or engineering crew with optimistic concurrency control.
   */
  async assignReport(idOrNumber: string, dto: {
    assignedTo: string;
    assignedTeam?: string;
    expectedVersion: number;
    note?: string;
    actorId?: string;
    actorName?: string;
  }) {
    const existing = await prisma.report.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { reportNumber: idOrNumber }],
      },
    });

    if (!existing) {
      throw new NotFoundError(`Report with identifier '${idOrNumber}' not found.`);
    }

    if (dto.expectedVersion !== existing.version) {
      throw new VersionConflictError(existing.version, dto.expectedVersion);
    }

    const newStatus = existing.status === ReportStatus.SUBMITTED ? ReportStatus.ASSIGNED : existing.status;

    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.report.updateMany({
        where: {
          id: existing.id,
          version: dto.expectedVersion,
        },
        data: {
          assignedTo: dto.assignedTo,
          assignedTeam: dto.assignedTeam || existing.assignedTeam,
          status: newStatus,
          version: existing.version + 1,
        },
      });

      if (updateResult.count === 0) {
        const current = await tx.report.findUnique({ where: { id: existing.id } });
        throw new VersionConflictError(current?.version || 0, dto.expectedVersion);
      }

      const savedReport = await tx.report.findUniqueOrThrow({
        where: { id: existing.id },
        include: {
          syncMetadata: true,
          statusTransitions: { orderBy: { createdAt: 'desc' } },
          activityLogs: { take: 5, orderBy: { createdAt: 'desc' } },
        },
      });

      if (existing.status !== newStatus) {
        await tx.statusTransition.create({
          data: {
            id: uuidv4(),
            reportId: savedReport.id,
            fromStatus: existing.status,
            toStatus: newStatus,
            actorId: dto.actorId || null,
            note: dto.note || `Assigned to ${dto.assignedTo}`,
          },
        });
      }

      await tx.activityLog.create({
        data: {
          id: uuidv4(),
          reportId: savedReport.id,
          action: 'ASSIGNED',
          actorId: dto.actorId || null,
          actorName: dto.actorName || 'Coordinator',
          description: dto.note || `Assigned to ${dto.assignedTo}${dto.assignedTeam ? ` (${dto.assignedTeam})` : ''}`,
          previousValue: existing.assignedTo || 'Unassigned',
          newValue: dto.assignedTo,
        },
      });

      return savedReport;
    }, {
      maxWait: 15000,
      timeout: 45000,
    });

    return updated;
  }
}

export const reportService = new ReportService();

