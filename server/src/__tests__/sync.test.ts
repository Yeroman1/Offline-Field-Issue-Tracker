import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

describe('Synchronization Endpoints', () => {
  const reporterId = uuidv4();
  const clientReportId = uuidv4();
  const idempotencyKey = `sync-ack-${uuidv4()}`;

  let reportId: string;
  let reportNumber: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/reports')
      .send({
        clientReportId,
        title: 'Communication Repeater Low Battery Warning',
        category: 'SERVICE_INTERRUPTION',
        description: 'Solar charge controller offline; battery at 15%.',
        location: 'Mountain Repeater Station 2',
        priority: 'MEDIUM',
        reportedAt: new Date().toISOString(),
        reporterId,
        sourceDeviceId: 'device-test-sync',
        idempotencyKey,
      });

    reportId = res.body.id || res.body.data.id;
    reportNumber = res.body.reportNumber || res.body.data.reportNumber;
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { reportId } });
    await prisma.statusTransition.deleteMany({ where: { reportId } });
    await prisma.syncMetadata.deleteMany({ where: { reportId } });
    await prisma.report.deleteMany({ where: { id: reportId } });
    await prisma.idempotencyRecord.deleteMany({ where: { key: idempotencyKey } });
    await prisma.$disconnect();
  });

  describe('14. Sync Acknowledgment (POST /api/reports/:id/sync/acknowledge)', () => {
    it('acknowledges sync, updates sync status to SYNCED, sets acknowledgedAt, and leaves business status unchanged', async () => {
      // First ensure report is in SUBMITTED business status
      const beforeReport = await prisma.report.findUnique({ where: { id: reportId } });
      expect(beforeReport?.status).toBe('SUBMITTED');

      const res = await request(app)
        .post(`/api/reports/${reportId}/sync/acknowledge`)
        .send({ actorId: reporterId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const result = res.body.data || res.body;
      expect(result.syncStatus).toBe('SYNCED');
      expect(result.acknowledgedAt).toBeDefined();

      // Verify business status remains untouched
      const afterReport = await prisma.report.findUnique({
        where: { id: reportId },
        include: { syncMetadata: true },
      });
      expect(afterReport?.status).toBe('SUBMITTED');
      expect(afterReport?.syncMetadata?.syncStatus).toBe('SYNCED');
      expect(afterReport?.syncMetadata?.acknowledgedAt).not.toBeNull();

      // Verify activity log recorded
      const activity = await prisma.activityLog.findFirst({
        where: { reportId, action: 'SYNC_ACKNOWLEDGED' },
      });
      expect(activity).toBeDefined();
    });

    it('is safe to retry (idempotent)', async () => {
      const res = await request(app)
        .post(`/api/reports/${reportId}/sync/acknowledge`)
        .send({ actorId: reporterId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('15. Sync Failure (POST /api/reports/:id/sync/failure)', () => {
    it('records sync failure, increments attempt count, records lastAttemptAt and error message', async () => {
      const initialMeta = await prisma.syncMetadata.findUnique({
        where: { reportId },
      });
      const initialAttempts = initialMeta?.attemptCount || 1;

      const failurePayload = {
        errorMessage: 'Network timeout during payload upload to primary field server',
        actorId: reporterId,
      };

      const res = await request(app)
        .post(`/api/reports/${reportId}/sync/failure`)
        .send(failurePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const result = res.body.data || res.body;
      expect(result.syncStatus).toBe('FAILED');
      expect(result.attemptCount).toBe(initialAttempts + 1);
      expect(result.errorMessage).toBe(failurePayload.errorMessage);
      expect(result.lastAttemptAt).toBeDefined();

      // Verify in database
      const updatedMeta = await prisma.syncMetadata.findUnique({
        where: { reportId },
      });
      expect(updatedMeta?.syncStatus).toBe('FAILED');
      expect(updatedMeta?.attemptCount).toBe(initialAttempts + 1);

      // Verify activity log recorded
      const activity = await prisma.activityLog.findFirst({
        where: { reportId, action: 'SYNC_FAILED' },
      });
      expect(activity).toBeDefined();
      expect(activity?.description).toContain('Network timeout');
    });
  });

  describe('Batch Offline Engine (POST /api/sync)', () => {
    const batchReportId = uuidv4();
    const batchIdempKey = `batch-key-${uuidv4()}`;

    afterAll(async () => {
      await prisma.activityLog.deleteMany({ where: { reportId: batchReportId } });
      await prisma.syncMetadata.deleteMany({ where: { reportId: batchReportId } });
      await prisma.report.deleteMany({ where: { id: batchReportId } });
      await prisma.idempotencyRecord.deleteMany({ where: { key: batchIdempKey } });
    });

    it('processes batch creation of queued offline items', async () => {
      const batchPayload = [
        {
          idempotencyKey: batchIdempKey,
          action: 'create',
          data: {
            id: batchReportId,
            clientReportId: batchReportId,
            title: 'Water Well Filter Clogged in Sub-district 9',
            description: 'Suspended sediment clogged intake screen.',
            category: 'BROKEN_WATER',
            priority: 'HIGH',
            status: 'SUBMITTED',
            reporterName: 'Tech Alice',
            reporterId: uuidv4(),
            sourceDeviceId: 'tablet-field-09',
          },
        },
      ];

      const res = await request(app).post('/api/sync').send(batchPayload);

      expect(res.status).toBe(200);
      expect(res.body.processed).toBe(1);
      expect(res.body.results[0].success).toBe(true);
      expect(res.body.results[0].duplicate).toBe(false);
      expect(res.body.results[0].report.id).toBe(batchReportId);
    });

    it('returns duplicate: true with cached response when idempotency key is replayed in batch', async () => {
      const duplicatePayload = [
        {
          idempotencyKey: batchIdempKey,
          action: 'create',
          data: { id: batchReportId },
        },
      ];

      const res = await request(app).post('/api/sync').send(duplicatePayload);

      expect(res.status).toBe(200);
      expect(res.body.processed).toBe(1);
      expect(res.body.results[0].duplicate).toBe(true);
    });

    it('rejects empty or malformed sync batches', async () => {
      const res = await request(app).post('/api/sync').send([]);
      expect(res.status).toBe(400);
    });

    it('Scenario 7 & 8: Server saves report and returns cached idempotency response when request is retried (lost response)', async () => {
      const lostResponseReportId = uuidv4();
      const lostResponseKey = `lost-resp-${uuidv4()}`;

      // First attempt: Server receives and processes the request
      const firstAttempt = await request(app)
        .post('/api/sync')
        .send([
          {
            idempotencyKey: lostResponseKey,
            action: 'create',
            data: {
              id: lostResponseReportId,
              clientReportId: lostResponseReportId,
              title: 'Valve Pressure Gauge Frozen',
              category: 'EQUIPMENT_FAILURE',
              priority: 'HIGH',
              status: 'SUBMITTED',
              reporterName: 'Tariq M.',
              reporterId: uuidv4(),
            },
          },
        ]);

      expect(firstAttempt.status).toBe(200);
      expect(firstAttempt.body.results[0].status).toBe('synced');
      const originalReportNumber = firstAttempt.body.results[0].reportNumber;

      // Simulate client retrying because response was lost in transit:
      // Client resends the exact same batch item with the same idempotencyKey
      const retryAttempt = await request(app)
        .post('/api/sync')
        .send([
          {
            idempotencyKey: lostResponseKey,
            action: 'create',
            data: { id: lostResponseReportId },
          },
        ]);

      expect(retryAttempt.status).toBe(200);
      expect(retryAttempt.body.results[0].duplicate).toBe(true);
      expect(retryAttempt.body.results[0].reportNumber).toBe(originalReportNumber);

      // Verify in DB that only 1 record exists
      const count = await prisma.report.count({ where: { id: lostResponseReportId } });
      expect(count).toBe(1);

      // Clean up
      await prisma.activityLog.deleteMany({ where: { reportId: lostResponseReportId } });
      await prisma.syncMetadata.deleteMany({ where: { reportId: lostResponseReportId } });
      await prisma.report.deleteMany({ where: { id: lostResponseReportId } });
      await prisma.idempotencyRecord.deleteMany({ where: { key: lostResponseKey } });
    });

    it('Scenario 9: Duplicate request with same clientReportId returns existing record without creating duplicate', async () => {
      const duplicateClientReportId = uuidv4();
      const keyA = `key-a-${uuidv4()}`;
      const keyB = `key-b-${uuidv4()}`;

      // First client submission
      const resA = await request(app)
        .post('/api/sync')
        .send([
          {
            idempotencyKey: keyA,
            action: 'create',
            data: {
              id: duplicateClientReportId,
              clientReportId: duplicateClientReportId,
              title: 'Substation Transformer Overheating',
              category: 'INFRASTRUCTURE_DAMAGE',
              priority: 'CRITICAL',
              status: 'SUBMITTED',
              reporterName: 'Engineer Omar',
              reporterId: uuidv4(),
            },
          },
        ]);

      expect(resA.status).toBe(200);
      expect(resA.body.results[0].status).toBe('synced');

      // Second submission with distinct idempotency key but SAME clientReportId
      const resB = await request(app)
        .post('/api/sync')
        .send([
          {
            idempotencyKey: keyB,
            action: 'create',
            data: {
              id: duplicateClientReportId,
              clientReportId: duplicateClientReportId,
              title: 'Substation Transformer Overheating (duplicate submission)',
            },
          },
        ]);

      expect(resB.status).toBe(200);
      expect(resB.body.results[0].duplicate).toBe(true);
      expect(resB.body.results[0].reportId).toBe(duplicateClientReportId);

      const dbCount = await prisma.report.count({ where: { clientReportId: duplicateClientReportId } });
      expect(dbCount).toBe(1);

      // Clean up
      await prisma.activityLog.deleteMany({ where: { reportId: duplicateClientReportId } });
      await prisma.syncMetadata.deleteMany({ where: { reportId: duplicateClientReportId } });
      await prisma.report.deleteMany({ where: { id: duplicateClientReportId } });
      await prisma.idempotencyRecord.deleteMany({ where: { key: { in: [keyA, keyB] } } });
    });

    it('Scenario 10: Server returns validation error for illegal status transition during sync', async () => {
      const valReportId = uuidv4();
      const createKey = `create-val-${uuidv4()}`;
      const invalidUpdateKey = `invalid-up-${uuidv4()}`;

      // Create a report in SUBMITTED status
      await request(app)
        .post('/api/sync')
        .send([
          {
            idempotencyKey: createKey,
            action: 'create',
            data: {
              id: valReportId,
              title: 'Solar Inverter Tripped',
              category: 'EQUIPMENT_FAILURE',
              priority: 'MEDIUM',
              status: 'SUBMITTED',
              reporterName: 'Nadia S.',
              reporterId: uuidv4(),
            },
          },
        ]);

      // Attempt illegal status transition from SUBMITTED directly to RESOLVED without assignment or progress
      const res = await request(app)
        .post('/api/sync')
        .send([
          {
            idempotencyKey: invalidUpdateKey,
            action: 'update',
            data: {
              id: valReportId,
              status: 'RESOLVED',
              expectedVersion: 1,
            },
          },
        ]);

      expect(res.status).toBe(200);
      expect(res.body.results[0].status).toBe('failed');
      expect(res.body.results[0].error).toContain('Invalid report status transition');

      // Clean up
      await prisma.activityLog.deleteMany({ where: { reportId: valReportId } });
      await prisma.syncMetadata.deleteMany({ where: { reportId: valReportId } });
      await prisma.report.deleteMany({ where: { id: valReportId } });
      await prisma.idempotencyRecord.deleteMany({ where: { key: { in: [createKey, invalidUpdateKey] } } });
    });

    it('Scenario 12: Two clients attempt conflicting updates - server detects OCC version conflict', async () => {
      const occReportId = uuidv4();
      const initKey = `occ-init-${uuidv4()}`;
      const clientAKey = `client-a-${uuidv4()}`;
      const clientBKey = `client-b-${uuidv4()}`;

      // 1. Initial report created (version = 1)
      const createRes = await request(app)
        .post('/api/sync')
        .send([
          {
            idempotencyKey: initKey,
            action: 'create',
            data: {
              id: occReportId,
              title: 'Telemetry Antenna Misaligned',
              category: 'MAINTENANCE_REQUIRED',
              priority: 'LOW',
              status: 'SUBMITTED',
              reporterName: 'Base Station 1',
              reporterId: uuidv4(),
            },
          },
        ]);
      expect(createRes.body.results[0].version).toBe(1);

      // 2. Client A updates report successfully from version 1 -> 2
      const resA = await request(app)
        .post('/api/sync')
        .send([
          {
            idempotencyKey: clientAKey,
            action: 'update',
            data: {
              id: occReportId,
              description: 'Client A: Antenna realigned by 15 degrees north',
              expectedVersion: 1,
            },
          },
        ]);
      expect(resA.status).toBe(200);
      expect(resA.body.results[0].status).toBe('synced');
      expect(resA.body.results[0].version).toBe(2);

      // 3. Client B attempts update with stale version 1 (concurrent conflict)
      const resB = await request(app)
        .post('/api/sync')
        .send([
          {
            idempotencyKey: clientBKey,
            action: 'update',
            data: {
              id: occReportId,
              description: 'Client B: Stale concurrent edit from offline device',
              expectedVersion: 1, // Stale! Server is now at version 2
            },
          },
        ]);
      expect(resB.status).toBe(200);
      expect(resB.body.results[0].status).toBe('conflict');
      expect(resB.body.results[0].error).toContain('Version conflict');

      // Verify the database still has Client A's version (2)
      const finalReport = await prisma.report.findUnique({ where: { id: occReportId } });
      expect(finalReport?.version).toBe(2);
      expect(finalReport?.description).toContain('Client A');

      // Clean up
      await prisma.activityLog.deleteMany({ where: { reportId: occReportId } });
      await prisma.syncMetadata.deleteMany({ where: { reportId: occReportId } });
      await prisma.report.deleteMany({ where: { id: occReportId } });
      await prisma.idempotencyRecord.deleteMany({ where: { key: { in: [initKey, clientAKey, clientBKey] } } });
    });
  });
});
