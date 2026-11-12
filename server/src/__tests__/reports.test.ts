import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import { v4 as uuidv4 } from 'uuid';

describe('Reports API', () => {
  const testReportId = uuidv4();
  const testReportNumber = 'NP-TEST-9901';

  beforeAll(async () => {
    // Clean test reports if any
    await prisma.activityLog.deleteMany({ where: { reportId: testReportId } });
    await prisma.report.deleteMany({ where: { id: testReportId } });
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { reportId: testReportId } });
    await prisma.report.deleteMany({ where: { id: testReportId } });
    await prisma.$disconnect();
  });

  describe('GET /api/health', () => {
    it('returns healthy status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
    });
  });

  describe('POST /api/reports', () => {
    it('creates a new report with generated reportNumber and initial activity log', async () => {
      const res = await request(app)
        .post('/api/reports')
        .send({
          id: testReportId,
          title: 'Culvert structural crack detected',
          description: 'Crack widened by 2cm after recent rain.',
          category: 'Infrastructure',
          priority: 'High',
          status: 'submitted',
          latitude: 4.86,
          longitude: 31.59,
          locationName: 'North Access Road',
          reporterName: 'Tester A',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(testReportId);
      expect(res.body.title).toBe('Culvert structural crack detected');
      expect(res.body.reportNumber).toMatch(/^NP-\d+/);
      expect(res.body.version).toBe(1);

      // Verify activity log was logged
      const activity = await prisma.activityLog.findFirst({
        where: { reportId: testReportId, action: 'created' },
      });
      expect(activity).toBeDefined();
      expect(activity?.newValue).toBe('submitted');
    });

    it('rejects creation with missing required fields (title)', async () => {
      const res = await request(app).post('/api/reports').send({
        category: 'Infrastructure',
        priority: 'High',
      });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/reports', () => {
    it('lists reports with pagination and filtering', async () => {
      const res = await request(app).get('/api/reports?category=Infrastructure');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('reports');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.reports)).toBe(true);

      const found = res.body.reports.some((r: any) => r.id === testReportId);
      expect(found).toBe(true);
    });

    it('filters by status', async () => {
      const res = await request(app).get('/api/reports?status=submitted');
      expect(res.status).toBe(200);
      res.body.reports.forEach((r: any) => {
        expect(r.status).toBe('submitted');
      });
    });

    it('filters by search term', async () => {
      const res = await request(app).get('/api/reports?search=Culvert');
      expect(res.status).toBe(200);
      expect(res.body.reports.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/reports/:id', () => {
    it('retrieves single report with activity logs', async () => {
      const res = await request(app).get(`/api/reports/${testReportId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(testReportId);
      expect(res.body).toHaveProperty('activityLogs');
      expect(res.body.activityLogs.length).toBeGreaterThan(0);
    });

    it('returns 404 for non-existent report', async () => {
      const res = await request(app).get('/api/reports/non-existent-uuid');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/reports/:id/status', () => {
    it('successfully transitions from submitted -> assigned', async () => {
      const res = await request(app)
        .patch(`/api/reports/${testReportId}/status`)
        .send({
          status: 'assigned',
          actorName: 'Coordinator Ahmed',
          assignedTo: 'Engineer Sarah',
          assignedTeam: 'Civil Works',
          comment: 'Assigned for geotechnical inspection',
          version: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('assigned');
      expect(res.body.assignedTo).toBe('Engineer Sarah');
      expect(res.body.version).toBe(2);

      // Verify activity log
      const log = await prisma.activityLog.findFirst({
        where: { reportId: testReportId, action: 'status_change', newValue: 'assigned' },
      });
      expect(log).toBeDefined();
      expect(log?.previousValue).toBe('submitted');
    });

    it('rejects invalid transition (assigned -> resolved is invalid: must be in_progress first)', async () => {
      const res = await request(app)
        .patch(`/api/reports/${testReportId}/status`)
        .send({
          status: 'resolved',
          actorName: 'Coordinator Ahmed',
          version: 2,
        });

      expect(res.status).toBe(422);
      expect(res.body).toHaveProperty('error');
    });

    it('rejects when version mismatch occurs (optimistic concurrency conflict 409)', async () => {
      // Current version is 2, send stale version 1
      const res = await request(app)
        .patch(`/api/reports/${testReportId}/status`)
        .send({
          status: 'in_progress',
          actorName: 'Engineer Sarah',
          version: 1, // Stale!
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Concurrency conflict');
    });

    it('successfully transitions assigned -> in_progress with matching version', async () => {
      const res = await request(app)
        .patch(`/api/reports/${testReportId}/status`)
        .send({
          status: 'in_progress',
          actorName: 'Engineer Sarah',
          comment: 'Field crew arrived on site',
          version: 2,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('in_progress');
      expect(res.body.version).toBe(3);
    });

    it('successfully transitions in_progress -> resolved and sets resolvedAt', async () => {
      const res = await request(app)
        .patch(`/api/reports/${testReportId}/status`)
        .send({
          status: 'resolved',
          actorName: 'Engineer Sarah',
          resolutionNotes: 'Culvert wall reinforced with stone masonry and fast-curing concrete.',
          version: 3,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('resolved');
      expect(res.body.resolvedAt).not.toBeNull();
      expect(res.body.resolutionNotes).toContain('stone masonry');
      expect(res.body.version).toBe(4);
    });
  });

  describe('GET /api/stats', () => {
    it('returns telemetry counters by status, priority, and category', async () => {
      const res = await request(app).get('/api/stats');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalReports');
      expect(res.body).toHaveProperty('byStatus');
      expect(res.body).toHaveProperty('byPriority');
      expect(res.body).toHaveProperty('byCategory');
      expect(res.body).toHaveProperty('syncStats');
      expect(res.body.byStatus).toHaveProperty('resolved');
      expect(res.body.byPriority).toHaveProperty('High');
    });
  });

  describe('GET /api/activity', () => {
    it('lists activity history with report info', async () => {
      const res = await request(app).get(`/api/activity?reportId=${testReportId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('activities');
      expect(res.body.activities.length).toBeGreaterThan(0);
    });
  });
});

