import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database';
import { SyncFailureDTO } from '../types';
import { NotFoundError } from '../utils/errors.util';
import { computePayloadHash } from '../utils/hash.util';
import { generateNextReportNumber } from './report.service';
import { validateStatusTransition } from './statusMachine.service';

export class SyncService {
  /**
   * Acknowledges successful synchronization of a report.
   * Safe to retry (idempotent), leaves business status unchanged.
   */
  async acknowledgeSync(idOrNumber: string, actorId?: string) {
    const report = await prisma.report.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { reportNumber: idOrNumber }, { clientReportId: idOrNumber }],
      },
      include: {
        syncMetadata: true,
      },
    });

    if (!report) {
      throw new NotFoundError(`Report with identifier '${idOrNumber}' not found.`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      let syncMeta = await tx.syncMetadata.findUnique({
        where: { reportId: report.id },
      });

      const now = new Date();

      if (syncMeta) {
        syncMeta = await tx.syncMetadata.update({
          where: { reportId: report.id },
          data: {
            syncStatus: 'SYNCED',
            acknowledgedAt: now,
            errorMessage: null,
          },
        });
      } else {
        syncMeta = await tx.syncMetadata.create({
          data: {
            id: uuidv4(),
            reportId: report.id,
            syncStatus: 'SYNCED',
            attemptCount: 1,
            lastAttemptAt: now,
            acknowledgedAt: now,
          },
        });
      }

      await tx.activityLog.create({
        data: {
          id: uuidv4(),
          reportId: report.id,
          action: 'SYNC_ACKNOWLEDGED',
          actorId: actorId || null,
          actorName: 'Sync Service',
          description: `Synchronization acknowledged for report ${report.reportNumber}`,
          newValue: 'SYNCED',
        },
      });

      return {
        reportId: report.id,
        reportNumber: report.reportNumber,
        clientReportId: report.clientReportId,
        syncStatus: syncMeta.syncStatus,
        acknowledgedAt: syncMeta.acknowledgedAt,
        attemptCount: syncMeta.attemptCount,
      };
    }, {
      maxWait: 15000,
      timeout: 45000,
    });

    return updated;
  }

  /**
   * Records a sync failure without exposing sensitive internal details.
   * Increments attempt count and records failure timestamp and reason.
   */
  async recordSyncFailure(idOrNumber: string, dto: SyncFailureDTO) {
    const report = await prisma.report.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { reportNumber: idOrNumber }, { clientReportId: idOrNumber }],
      },
      include: {
        syncMetadata: true,
      },
    });

    if (!report) {
      throw new NotFoundError(`Report with identifier '${idOrNumber}' not found.`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date();
      let syncMeta = await tx.syncMetadata.findUnique({
        where: { reportId: report.id },
      });

      if (syncMeta) {
        syncMeta = await tx.syncMetadata.update({
          where: { reportId: report.id },
          data: {
            syncStatus: 'FAILED',
            attemptCount: { increment: 1 },
            lastAttemptAt: now,
            errorMessage: dto.errorMessage,
          },
        });
      } else {
        syncMeta = await tx.syncMetadata.create({
          data: {
            id: uuidv4(),
            reportId: report.id,
            syncStatus: 'FAILED',
            attemptCount: 1,
            lastAttemptAt: now,
            errorMessage: dto.errorMessage,
          },
        });
      }

      await tx.activityLog.create({
        data: {
          id: uuidv4(),
          reportId: report.id,
          action: 'SYNC_FAILED',
          actorId: dto.actorId || null,
          actorName: 'Sync Worker',
          description: `Sync attempt failed: ${dto.errorMessage}`,
          newValue: 'FAILED',
        },
      });

      return {
        reportId: report.id,
        reportNumber: report.reportNumber,
        clientReportId: report.clientReportId,
        syncStatus: syncMeta.syncStatus,
        attemptCount: syncMeta.attemptCount,
        lastAttemptAt: syncMeta.lastAttemptAt,
        errorMessage: syncMeta.errorMessage,
      };
    }, {
      maxWait: 15000,
      timeout: 45000,
    });

    return updated;
  }

  /**
   * Processes a batch of sync operations for offline clients (backwards-compatible with /api/sync).
   */
  async processBatchSync(rawItems: any[]) {
    const results: any[] = [];

    for (const item of rawItems) {
      const { idempotencyKey, action, data } = item;

      if (!idempotencyKey) {
        results.push({
          success: false,
          status: 'failed',
          error: 'Missing idempotencyKey',
          duplicate: false,
        });
        continue;
      }

      // Check idempotency record
      const existingRecord = await prisma.idempotencyRecord.findUnique({
        where: { key: idempotencyKey },
      });

      if (existingRecord) {
        let storedResult: any = {};
        try {
          storedResult = JSON.parse(existingRecord.response);
        } catch {
          storedResult = { data: existingRecord.response };
        }
        results.push({
          ...storedResult,
          idempotencyKey,
          duplicate: true,
        });
        continue;
      }

      try {
        const itemResult = await prisma.$transaction(async (tx) => {
          let outcome: any = {};

          if (action === 'create') {
            const clientReportId = data.clientReportId || data.id || uuidv4();
            const reportId = data.id || uuidv4();

            const existingReport = await tx.report.findFirst({
              where: {
                OR: [{ id: reportId }, { clientReportId }],
              },
            });

            if (existingReport) {
              outcome = {
                success: true,
                status: 'synced',
                reportId: existingReport.id,
                version: existingReport.version,
                action: 'create',
                report: existingReport,
                reportNumber: existingReport.reportNumber,
                duplicate: true,
                note: 'Report already exists, returning existing record',
              };
            } else {
              const repId = data.reporterId || uuidv4();
              await tx.userProfile.upsert({
                where: { id: repId },
                update: {
                  fullName: data.reporterName || undefined,
                },
                create: {
                  id: repId,
                  email: `${repId}@field.nilepixel.org`,
                  fullName: data.reporterName || 'Field Reporter',
                  role: 'FIELD_WORKER',
                },
              });

              const reportNumber = await generateNextReportNumber(tx as any);
              const status = (data.status || 'SUBMITTED').toUpperCase();
              const created = await tx.report.create({
                data: {
                  id: reportId,
                  clientReportId,
                  reportNumber,
                  title: data.title || 'Untitled Field Report',
                  description: data.description || 'No description provided',
                  category: (data.category || 'MAINTENANCE_REQUIRED').toUpperCase().replace(/\s+/g, '_'),
                  priority: (data.priority || 'MEDIUM').toUpperCase(),
                  status,
                  latitude: data.latitude !== undefined ? Number(data.latitude) : null,
                  longitude: data.longitude !== undefined ? Number(data.longitude) : null,
                  locationName: data.locationName || null,
                  locationAccuracy: data.locationAccuracy !== undefined ? Number(data.locationAccuracy) : null,
                  location: data.location || data.locationName || null,
                  reporterName: data.reporterName || 'Field Reporter',
                  reporterId: data.reporterId || uuidv4(),
                  sourceDeviceId: data.sourceDeviceId || 'field-device',
                  assignedTo: data.assignedTo || null,
                  assignedTeam: data.assignedTeam || null,
                  resolutionNotes: data.resolutionNotes || null,
                  resolvedBy: data.resolvedBy || null,
                  resolvedAt: data.resolvedAt ? new Date(data.resolvedAt) : null,
                  version: data.version || 1,
                  createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
                },
              });

              await tx.syncMetadata.create({
                data: {
                  id: uuidv4(),
                  reportId: created.id,
                  syncStatus: 'SYNCED',
                  attemptCount: 1,
                  lastAttemptAt: new Date(),
                  acknowledgedAt: new Date(),
                },
              });

              await tx.activityLog.create({
                data: {
                  id: uuidv4(),
                  reportId: created.id,
                  action: 'REPORT_CREATED',
                  actorName: data.reporterName || 'Field Sync',
                  description: `Report ${reportNumber} synchronized from client`,
                  newValue: created.status,
                },
              });

              outcome = {
                success: true,
                status: 'synced',
                reportId: created.id,
                version: created.version,
                action: 'create',
                report: created,
                reportNumber: created.reportNumber,
                duplicate: false,
              };
            }
          } else if (action === 'update') {
            const targetId = data.id || data.reportNumber;
            if (!targetId) {
              throw new Error('Update requires report id or reportNumber');
            }

            const current = await tx.report.findFirst({
              where: {
                OR: [{ id: targetId }, { reportNumber: targetId }],
              },
            });

            if (!current) {
              throw new Error(`Report not found for update: ${targetId}`);
            }

            // Optimistic concurrency check during batch sync
            const expectedVersion = data.expectedVersion !== undefined ? data.expectedVersion : data.version;
            if (expectedVersion !== undefined && expectedVersion !== current.version) {
              outcome = {
                success: false,
                status: 'conflict',
                reportId: current.id,
                version: current.version,
                action: 'update',
                report: current,
                reportNumber: current.reportNumber,
                duplicate: false,
                error: `Version conflict: client version ${expectedVersion} does not match server version ${current.version}`,
              };
              return outcome;
            }

            const isStatusChange = data.status && data.status.toUpperCase() !== current.status;
            if (isStatusChange) {
              validateStatusTransition(current.status, data.status);
            }

            const updateData: any = {
              version: current.version + 1,
            };

            if (data.title !== undefined) updateData.title = data.title;
            if (data.description !== undefined) updateData.description = data.description;
            if (data.category !== undefined) updateData.category = data.category.toUpperCase().replace(/\s+/g, '_');
            if (data.priority !== undefined) updateData.priority = data.priority.toUpperCase();
            if (data.status !== undefined) updateData.status = data.status.toUpperCase();
            if (data.latitude !== undefined) updateData.latitude = Number(data.latitude);
            if (data.longitude !== undefined) updateData.longitude = Number(data.longitude);
            if (data.locationName !== undefined) updateData.locationName = data.locationName;
            if (data.locationAccuracy !== undefined) updateData.locationAccuracy = Number(data.locationAccuracy);
            if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
            if (data.assignedTeam !== undefined) updateData.assignedTeam = data.assignedTeam;
            if (data.resolutionNotes !== undefined) updateData.resolutionNotes = data.resolutionNotes;
            if (data.resolvedBy !== undefined) updateData.resolvedBy = data.resolvedBy;

            if (data.status && data.status.toUpperCase() === 'RESOLVED' && !current.resolvedAt) {
              updateData.resolvedAt = new Date();
              if (!updateData.resolvedBy) {
                updateData.resolvedBy = data.actorName || 'Field Reporter';
              }
            }

            const updatedReport = await tx.report.update({
              where: { id: current.id },
              data: updateData,
            });

            // Write StatusTransition record if status was modified
            if (isStatusChange) {
              await tx.statusTransition.create({
                data: {
                  id: uuidv4(),
                  reportId: updatedReport.id,
                  fromStatus: current.status,
                  toStatus: data.status.toUpperCase(),
                  actorId: data.actorId || null,
                  note: data.note || `Status transitioned via offline batch sync from ${current.status} to ${data.status.toUpperCase()}`,
                },
              });
            }

            await tx.syncMetadata.upsert({
              where: { reportId: updatedReport.id },
              create: {
                id: uuidv4(),
                reportId: updatedReport.id,
                syncStatus: 'SYNCED',
                acknowledgedAt: new Date(),
              },
              update: {
                syncStatus: 'SYNCED',
                acknowledgedAt: new Date(),
              },
            });

            await tx.activityLog.create({
              data: {
                id: uuidv4(),
                reportId: updatedReport.id,
                action: isStatusChange ? 'STATUS_UPDATED' : 'REPORT_UPDATED',
                actorName: data.actorName || 'Field Sync',
                description: `Report ${updatedReport.reportNumber} updated via offline sync`,
                previousValue: isStatusChange ? current.status : undefined,
                newValue: updatedReport.status,
              },
            });

            outcome = {
              success: true,
              status: 'synced',
              reportId: updatedReport.id,
              version: updatedReport.version,
              action: 'update',
              report: updatedReport,
              reportNumber: updatedReport.reportNumber,
              duplicate: false,
            };
          } else {
            throw new Error(`Unknown action: ${action}`);
          }

          // Cache in idempotency table
          await tx.idempotencyRecord.create({
            data: {
              key: idempotencyKey,
              payloadHash: computePayloadHash(item),
              statusCode: 200,
              response: JSON.stringify(outcome),
            },
          });

          return outcome;
        }, {
          maxWait: 15000,
          timeout: 45000,
        });

        results.push({
          ...itemResult,
          idempotencyKey,
        });
      } catch (err: any) {
        results.push({
          success: false,
          status: 'failed',
          idempotencyKey,
          action,
          error: err.message,
          duplicate: false,
        });
      }
    }

    return results;
  }
}

export const syncService = new SyncService();
