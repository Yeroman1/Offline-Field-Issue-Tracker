import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { validateTransition } from '../lib/statusMachine';

export const syncRouter = Router();

// Helper to generate NP-XXXX sequential number
async function generateReportNumber(tx: any): Promise<string> {
  const reports = await tx.report.findMany({
    select: { reportNumber: true },
    where: { reportNumber: { startsWith: 'NP-' } },
  });

  let maxNum = 8800;
  for (const r of reports) {
    const numPart = parseInt(r.reportNumber.replace('NP-', ''), 10);
    if (!isNaN(numPart) && numPart > maxNum) {
      maxNum = numPart;
    }
  }
  return `NP-${maxNum + 1}`;
}

export interface SyncItem {
  idempotencyKey: string;
  action: 'create' | 'update';
  data: any;
}

// POST /api/sync: batch sync items [{ idempotencyKey, action: 'create'|'update', data: {...} }]
syncRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawItems = Array.isArray(req.body)
      ? req.body
      : Array.isArray(req.body?.items)
      ? req.body.items
      : [];

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({
        error: 'Invalid sync payload. Expected array of sync items or object with items property.',
      });
    }

    const results: any[] = [];

    for (const item of rawItems as SyncItem[]) {
      const { idempotencyKey, action, data } = item;

      if (!idempotencyKey) {
        results.push({
          success: false,
          error: 'Missing idempotencyKey',
          duplicate: false,
        });
        continue;
      }

      // Check idempotency table first
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

      // If new, process in a transaction
      try {
        const itemResult = await prisma.$transaction(async (tx) => {
          let outcome: any = {};

          if (action === 'create') {
            const reportId = data.id || uuidv4();
            const reportNumber =
              data.reportNumber || (await generateReportNumber(tx));

            // Check if report with reportNumber or id already exists
            const existingReport = await tx.report.findFirst({
              where: {
                OR: [{ id: reportId }, { reportNumber }],
              },
            });

            if (existingReport) {
              outcome = {
                success: true,
                action: 'create',
                report: existingReport,
                reportNumber: existingReport.reportNumber,
                note: 'Report already existed, returned existing record',
              };
            } else {
              const created = await tx.report.create({
                data: {
                  id: reportId,
                  reportNumber,
                  title: data.title || 'Untitled Field Report',
                  description: data.description || null,
                  category: data.category || 'General',
                  priority: data.priority || 'Medium',
                  status: data.status || 'submitted',
                  syncStatus: 'synced',
                  latitude: data.latitude !== undefined ? Number(data.latitude) : null,
                  longitude: data.longitude !== undefined ? Number(data.longitude) : null,
                  locationName: data.locationName || null,
                  locationAccuracy:
                    data.locationAccuracy !== undefined
                      ? Number(data.locationAccuracy)
                      : null,
                  reporterName: data.reporterName || 'Field Reporter',
                  reporterId: data.reporterId || null,
                  assignedTo: data.assignedTo || null,
                  assignedTeam: data.assignedTeam || null,
                  resolutionNotes: data.resolutionNotes || null,
                  resolvedBy: data.resolvedBy || null,
                  resolvedAt: data.resolvedAt ? new Date(data.resolvedAt) : null,
                  version: data.version || 1,
                  createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
                },
              });

              await tx.activityLog.create({
                data: {
                  id: uuidv4(),
                  reportId: created.id,
                  action: 'synced_create',
                  actorName: data.reporterName || 'Field Sync',
                  description: `Report ${reportNumber} synchronized from client`,
                  newValue: created.status,
                },
              });

              outcome = {
                success: true,
                action: 'create',
                report: created,
                reportNumber: created.reportNumber,
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

            // If status is updated, validate transition
            if (data.status && data.status !== current.status) {
              validateTransition(current.status, data.status);
            }

            const updateData: any = {
              syncStatus: 'synced',
              version: current.version + 1,
            };

            if (data.title !== undefined) updateData.title = data.title;
            if (data.description !== undefined) updateData.description = data.description;
            if (data.category !== undefined) updateData.category = data.category;
            if (data.priority !== undefined) updateData.priority = data.priority;
            if (data.status !== undefined) updateData.status = data.status;
            if (data.latitude !== undefined) updateData.latitude = Number(data.latitude);
            if (data.longitude !== undefined) updateData.longitude = Number(data.longitude);
            if (data.locationName !== undefined) updateData.locationName = data.locationName;
            if (data.locationAccuracy !== undefined)
              updateData.locationAccuracy = Number(data.locationAccuracy);
            if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
            if (data.assignedTeam !== undefined) updateData.assignedTeam = data.assignedTeam;
            if (data.resolutionNotes !== undefined)
              updateData.resolutionNotes = data.resolutionNotes;
            if (data.resolvedBy !== undefined) updateData.resolvedBy = data.resolvedBy;

            if (data.status === 'resolved' && !current.resolvedAt) {
              updateData.resolvedAt = new Date();
              if (!updateData.resolvedBy) {
                updateData.resolvedBy = data.actorName || 'Field Reporter';
              }
            }

            const updated = await tx.report.update({
              where: { id: current.id },
              data: updateData,
            });

            await tx.activityLog.create({
              data: {
                id: uuidv4(),
                reportId: updated.id,
                action: 'synced_update',
                actorName: data.actorName || 'Field Sync',
                description: `Report ${updated.reportNumber} updated via sync`,
                previousValue: current.status,
                newValue: updated.status,
              },
            });

            outcome = {
              success: true,
              action: 'update',
              report: updated,
              reportNumber: updated.reportNumber,
            };
          } else {
            throw new Error(`Unsupported sync action: ${action}`);
          }

          // Record in Idempotency table
          await tx.idempotencyRecord.create({
            data: {
              key: idempotencyKey,
              response: JSON.stringify(outcome),
            },
          });

          return {
            ...outcome,
            idempotencyKey,
            duplicate: false,
          };
        });

        results.push(itemResult);
      } catch (err: any) {
        results.push({
          success: false,
          idempotencyKey,
          action,
          error: err.message,
          duplicate: false,
        });
      }
    }

    res.json({
      processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Error during batch sync:', error);
    res.status(500).json({ error: 'Sync processing failed', details: error.message });
  }
});

