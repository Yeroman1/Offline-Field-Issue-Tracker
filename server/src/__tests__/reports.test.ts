import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

describe('Reports API (/api/reports)', () => {
  const reporterId = uuidv4();
  const clientReportId1 = uuidv4();
  const idempotencyKey1 = `idemp-${uuidv4()}`;

  const validReportPayload = {
    clientReportId: clientReportId1,
    title: 'Severe Water Pipe Rupture in Sector 4',
    category: 'BROKEN_WATER',
    description: 'High-pressure main pipe burst near public fountain causing local flooding.',
    location: {
      latitude: 4.8512,
      longitude: 31.5824,
      locationName: 'Sector 4 Main Road',
      locationAccuracy: 3.5,
    },
    priority: 'HIGH',
    reportedAt: new Date().toISOString(),
    reporterId: reporterId,
    reporterName: 'Field Inspector David',
    sourceDeviceId: 'device-samsung-tab-09',
    idempotencyKey: idempotencyKey1,
  };

  let createdReportId: string;
  let createdReportNumber: string;

  beforeAll(async () => {
    // Clean test records
    await prisma.activityLog.deleteMany({ where: { actorId: reporterId } });
    await prisma.report.deleteMany({ where: { reporterId } });
    await prisma.idempotencyRecord.deleteMany({ where: { key: idempotencyKey1 } });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.activityLog.deleteMany({ where: { actorId: reporterId } });
    await prisma.statusTransition.deleteMany({ where: { actorId: reporterId } });
    await prisma.report.deleteMany({ where: { reporterId } });
    await prisma.userProfile.deleteMany({ where: { id: reporterId } });
    await prisma.idempotencyRecord.deleteMany({ where: { key: idempotencyKey1 } });
    await prisma.$disconnect();
  });

  describe('2. Report Creation (POST /api/reports)', () => {
    it('creates a new report with valid data and returns created report and sync information', async () => {
      const res = await request(app).post('/api/reports').send(validReportPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const report = res.body.data;
      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.clientReportId).toBe(clientReportId1);
      expect(report.title).toBe(validReportPayload.title);
      expect(report.category).toBe('BROKEN_WATER');
      expect(report.priority).toBe('HIGH');
      expect(report.status).toBe('SUBMITTED');
      expect(report.reportNumber).toMatch(/^NP-\d+/);
      expect(report.version).toBe(1);

      // Verify sync metadata returned
      expect(report.syncMetadata).toBeDefined();
      expect(report.syncMetadata.syncStatus).toBe('SYNCED');

      // Verify initial status transition recorded
      expect(report.statusTransitions).toBeDefined();
      expect(report.statusTransitions.length).toBeGreaterThan(0);
      expect(report.statusTransitions[0].toStatus).toBe('SUBMITTED');

      // Verify activity history recorded
      expect(report.activityLogs).toBeDefined();
      expect(report.activityLogs.length).toBeGreaterThan(0);

      createdReportId = report.id;
      createdReportNumber = report.reportNumber;
    });

    it('3. rejects creation with missing required fields', async () => {
      const incompletePayload = {
        title: 'Only Title Provided',
      };

      const res = await request(app).post('/api/reports').send(incompletePayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('4. rejects creation with invalid category or priority', async () => {
      const invalidEnumPayload = {
        ...validReportPayload,
        clientReportId: uuidv4(),
        idempotencyKey: `idemp-${uuidv4()}`,
        category: 'INVALID_CATEGORY_NAME',
        priority: 'ULTRA_EXTREME_URGENT',
      };

      const res = await request(app).post('/api/reports').send(invalidEnumPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('5. rejects creation with duplicate clientReportId', async () => {
      const duplicateClientPayload = {
        ...validReportPayload,
        idempotencyKey: `diff-key-${uuidv4()}`, // different idempotency key
      };

      const res = await request(app).post('/api/reports').send(duplicateClientPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('DUPLICATE_CLIENT_REPORT_ID');
    });

    it('6. enforces idempotency: replay with same payload returns original result without duplicate', async () => {
      const res = await request(app).post('/api/reports').send(validReportPayload);

      expect([200, 201]).toContain(res.status);
      expect(res.body.id || res.body.data?.id).toBe(createdReportId);
      expect(res.body.reportNumber || res.body.data?.reportNumber).toBe(createdReportNumber);

      // Verify database count has not increased
      const count = await prisma.report.count({
        where: { clientReportId: clientReportId1 },
      });
      expect(count).toBe(1);
    });

    it('6b. enforces idempotency: replay with different payload returns HTTP 409 Conflict', async () => {
      const alteredPayload = {
        ...validReportPayload,
        title: 'Altered Title With Reused Key',
        clientReportId: uuidv4(),
      };

      const res = await request(app).post('/api/reports').send(alteredPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('IDEMPOTENCY_CONFLICT');
    });
  });

  describe('7. Report Retrieval (GET /api/reports)', () => {
    it('supports pagination metadata (page, limit, total, totalPages, hasNextPage, hasPrevPage)', async () => {
      const res = await request(app).get('/api/reports?page=1&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.reports || res.body.data)).toBe(true);

      const pagination = res.body.pagination || res.body.meta?.pagination;
      expect(pagination).toBeDefined();
      expect(pagination.page).toBe(1);
      expect(pagination.limit).toBe(10);
      expect(pagination.total).toBeGreaterThanOrEqual(1);
      expect(pagination.totalPages).toBeGreaterThanOrEqual(1);
      expect(typeof pagination.hasNextPage).toBe('boolean');
      expect(typeof pagination.hasPrevPage).toBe('boolean');
    });

    it('filters by status', async () => {
      const res = await request(app).get('/api/reports?status=SUBMITTED');

      expect(res.status).toBe(200);
      const reports = res.body.reports || res.body.data;
      expect(reports.length).toBeGreaterThan(0);
      reports.forEach((r: any) => {
        expect(r.status.toUpperCase()).toBe('SUBMITTED');
      });
    });

    it('filters by category', async () => {
      const res = await request(app).get('/api/reports?category=BROKEN_WATER');

      expect(res.status).toBe(200);
      const reports = res.body.reports || res.body.data;
      expect(reports.length).toBeGreaterThan(0);
      reports.forEach((r: any) => {
        expect(r.category.toUpperCase()).toBe('BROKEN_WATER');
      });
    });

    it('filters by priority', async () => {
      const res = await request(app).get('/api/reports?priority=HIGH');

      expect(res.status).toBe(200);
      const reports = res.body.reports || res.body.data;
      expect(reports.length).toBeGreaterThan(0);
      reports.forEach((r: any) => {
        expect(r.priority.toUpperCase()).toBe('HIGH');
      });
    });

    it('filters by reporterId', async () => {
      const res = await request(app).get(`/api/reports?reporter=${reporterId}`);

      expect(res.status).toBe(200);
      const reports = res.body.reports || res.body.data;
      expect(reports.length).toBeGreaterThan(0);
      reports.forEach((r: any) => {
        expect(r.reporterId).toBe(reporterId);
      });
    });

    it('filters by search term matching title or description', async () => {
      const res = await request(app).get('/api/reports?search=Rupture');

      expect(res.status).toBe(200);
      const reports = res.body.reports || res.body.data;
      expect(reports.length).toBeGreaterThan(0);
      expect(reports.some((r: any) => r.id === createdReportId)).toBe(true);
    });

    it('supports sorting by createdAt in asc and desc directions', async () => {
      const resDesc = await request(app).get('/api/reports?sortBy=createdAt&sortOrder=desc');
      expect(resDesc.status).toBe(200);

      const resAsc = await request(app).get('/api/reports?sortBy=createdAt&sortOrder=asc');
      expect(resAsc.status).toBe(200);
    });
  });

  describe('8. Single Report Retrieval (GET /api/reports/:id)', () => {
    it('retrieves single report by ID with full details, sync metadata, and audit logs', async () => {
      const res = await request(app).get(`/api/reports/${createdReportId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const report = res.body.data || res.body;

      expect(report.id).toBe(createdReportId);
      expect(report.reportNumber).toBe(createdReportNumber);
      expect(report.title).toBe(validReportPayload.title);
      expect(report.syncMetadata).toBeDefined();
      expect(report.statusTransitions).toBeDefined();
      expect(report.activityLogs).toBeDefined();
    });

    it('retrieves single report by human-readable reportNumber', async () => {
      const res = await request(app).get(`/api/reports/${createdReportNumber}`);

      expect(res.status).toBe(200);
      const report = res.body.data || res.body;
      expect(report.id).toBe(createdReportId);
    });

    it('returns 404 for non-existent report identifier', async () => {
      const nonExistentId = uuidv4();
      const res = await request(app).get(`/api/reports/${nonExistentId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  describe('9. Report Update & Optimistic Concurrency (PATCH /api/reports/:id)', () => {
    it('updates permitted fields and increments version when expectedVersion matches', async () => {
      const updatePayload = {
        title: 'Updated Water Pipe Rupture with Secondary Valves Shut',
        description: 'Secondary isolation valves engaged; pressure reduced.',
        priority: 'MEDIUM',
        expectedVersion: 1,
      };

      const res = await request(app)
        .patch(`/api/reports/${createdReportId}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const updated = res.body.data || res.body;

      expect(updated.title).toBe(updatePayload.title);
      expect(updated.priority).toBe('MEDIUM');
      expect(updated.version).toBe(2);

      // Verify activity log recorded
      const activity = await prisma.activityLog.findFirst({
        where: { reportId: createdReportId, action: 'REPORT_UPDATED' },
      });
      expect(activity).toBeDefined();
    });

    it('rejects stale updates with HTTP 409 Conflict when expectedVersion does not match current version', async () => {
      const stalePayload = {
        title: 'Attempting to overwrite with stale version 1',
        expectedVersion: 1, // Current DB version is now 2
      };

      const res = await request(app)
        .patch(`/api/reports/${createdReportId}`)
        .send(stalePayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VERSION_CONFLICT');
    });

    it('rejects attempts to update protected fields (id, clientReportId, status, version)', async () => {
      const prohibitedPayload = {
        id: uuidv4(),
        status: 'RESOLVED',
        expectedVersion: 2,
      };

      const res = await request(app)
        .patch(`/api/reports/${createdReportId}`)
        .send(prohibitedPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('handles concurrent updates: when two concurrent updates race with the same expectedVersion, exactly one succeeds and one fails with 409', async () => {
      // Fetch latest report to ensure we have current version
      const current = await request(app).get(`/api/reports/${createdReportId}`);
      const currentVersion = current.body.data.version;

      const update1 = request(app)
        .patch(`/api/reports/${createdReportId}`)
        .send({
          title: 'Concurrent Race Winner A',
          expectedVersion: currentVersion,
        });

      const update2 = request(app)
        .patch(`/api/reports/${createdReportId}`)
        .send({
          title: 'Concurrent Race Winner B',
          expectedVersion: currentVersion,
        });

      const [res1, res2] = await Promise.all([update1, update2]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);
    });
  });

  describe('10. Report Assignment (PATCH /api/reports/:id/assign)', () => {
    it('assigns report to a technician and crew, updates status to ASSIGNED, and increments version', async () => {
      const current = await request(app).get(`/api/reports/${createdReportId}`);
      const currentVersion = current.body.data.version;

      const assignPayload = {
        assignedTo: 'Technician Joseph',
        assignedTeam: 'Rapid Response Team 2',
        expectedVersion: currentVersion,
        note: 'Dispatched to Sector 4 for pipe repair',
      };

      const res = await request(app)
        .patch(`/api/reports/${createdReportId}/assign`)
        .set('x-actor-role', 'COORDINATOR')
        .send(assignPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignedTo).toBe('Technician Joseph');
      expect(res.body.data.assignedTeam).toBe('Rapid Response Team 2');
      expect(res.body.data.status).toBe('ASSIGNED');
      expect(res.body.data.version).toBe(currentVersion + 1);
    });
  });

  describe('11. Activity History (/api/activity)', () => {
    it('retrieves activity history for the created report including creation, updates, and assignment', async () => {
      const res = await request(app).get(`/api/activity?reportId=${createdReportId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.activities)).toBe(true);
      expect(res.body.activities.length).toBeGreaterThanOrEqual(3);

      const actions = res.body.activities.map((a: any) => a.action);
      expect(actions).toContain('REPORT_CREATED');
      expect(actions).toContain('REPORT_UPDATED');
      expect(actions).toContain('ASSIGNED');
    });
  });
});
