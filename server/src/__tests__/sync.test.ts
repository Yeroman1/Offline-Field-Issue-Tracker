import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import { v4 as uuidv4 } from 'uuid';

describe('Sync Engine API (POST /api/sync)', () => {
  const syncReportId1 = uuidv4();
  const syncReportId2 = uuidv4();
  const idempotencyKey1 = `test-sync-key-${uuidv4()}`;
  const idempotencyKey2 = `test-sync-key-${uuidv4()}`;

  beforeAll(async () => {
    await prisma.activityLog.deleteMany({
      where: { reportId: { in: [syncReportId1, syncReportId2] } },
    });
    await prisma.report.deleteMany({
      where: { id: { in: [syncReportId1, syncReportId2] } },
    });
    await prisma.idempotencyRecord.deleteMany({
      where: { key: { in: [idempotencyKey1, idempotencyKey2] } },
    });
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({
      where: { reportId: { in: [syncReportId1, syncReportId2] } },
    });
    await prisma.report.deleteMany({
      where: { id: { in: [syncReportId1, syncReportId2] } },
    });
    await prisma.idempotencyRecord.deleteMany({
      where: { key: { in: [idempotencyKey1, idempotencyKey2] } },
    });
    await prisma.$disconnect();
  });

  it('processes batch creation of reports queued offline', async () => {
    const payload = [
      {
        idempotencyKey: idempotencyKey1,
        action: 'create',
        data: {
          id: syncReportId1,
          title: 'Solar Panel Inverter Trip in Ward 3',
          description: 'Offline logged issue while patrolling remote substation.',
          category: 'Equipment',
          priority: 'Critical',
          status: 'submitted',
          latitude: 4.851,
          longitude: 31.582,
          locationName: 'Ward 3 Substation',
          reporterName: 'Field Tech Sarah',
        },
      },
    ];

    const res = await request(app).post('/api/sync').send(payload);

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(1);
    expect(res.body.results[0].success).toBe(true);
    expect(res.body.results[0].duplicate).toBe(false);
    expect(res.body.results[0].report.id).toBe(syncReportId1);
    expect(res.body.results[0].reportNumber).toBeDefined();

    // Verify record in DB
    const inDb = await prisma.report.findUnique({ where: { id: syncReportId1 } });
    expect(inDb).not.toBeNull();
    expect(inDb?.syncStatus).toBe('synced');

    // Verify idempotency record saved
    const record = await prisma.idempotencyRecord.findUnique({
      where: { key: idempotencyKey1 },
    });
    expect(record).not.toBeNull();
  });

  it('returns cached response with duplicate: true when same idempotencyKey is resent', async () => {
    const duplicatePayload = [
      {
        idempotencyKey: idempotencyKey1, // Re-sending same key!
        action: 'create',
        data: {
          id: syncReportId1,
          title: 'Different Title That Should Be Ignored',
        },
      },
    ];

    const res = await request(app).post('/api/sync').send(duplicatePayload);

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(1);
    expect(res.body.results[0].duplicate).toBe(true);
    expect(res.body.results[0].idempotencyKey).toBe(idempotencyKey1);
    expect(res.body.results[0].report.title).toBe('Solar Panel Inverter Trip in Ward 3');
  });

  it('processes batch updates on existing records', async () => {
    const updatePayload = [
      {
        idempotencyKey: idempotencyKey2,
        action: 'update',
        data: {
          id: syncReportId1,
          status: 'assigned',
          assignedTo: 'Tech Specialist Michael',
          assignedTeam: 'Electrical Support Unit',
        },
      },
    ];

    const res = await request(app).post('/api/sync').send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(1);
    expect(res.body.results[0].success).toBe(true);
    expect(res.body.results[0].duplicate).toBe(false);

    const updated = await prisma.report.findUnique({ where: { id: syncReportId1 } });
    expect(updated?.status).toBe('assigned');
    expect(updated?.assignedTo).toBe('Tech Specialist Michael');
  });

  it('handles mixed batches with object payload wrapper { items: [...] }', async () => {
    const key3 = `test-sync-key-${uuidv4()}`;
    const payload = {
      items: [
        {
          idempotencyKey: key3,
          action: 'create',
          data: {
            id: syncReportId2,
            title: 'Water valve replacement required',
            category: 'Water',
            priority: 'Medium',
            status: 'submitted',
            locationName: 'Pumping Station B',
          },
        },
      ],
    };

    const res = await request(app).post('/api/sync').send(payload);

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(1);
    expect(res.body.results[0].success).toBe(true);

    // Clean up
    await prisma.activityLog.deleteMany({ where: { reportId: syncReportId2 } });
    await prisma.report.deleteMany({ where: { id: syncReportId2 } });
    await prisma.idempotencyRecord.deleteMany({ where: { key: key3 } });
  });

  it('rejects invalid or empty payloads gracefully', async () => {
    const res = await request(app).post('/api/sync').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

