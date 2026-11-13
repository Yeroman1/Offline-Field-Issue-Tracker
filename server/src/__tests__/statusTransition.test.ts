import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

describe('Status Transition API (PATCH /api/reports/:id/status)', () => {
  const reporterId = uuidv4();
  const coordinatorId = uuidv4();
  const clientReportId = uuidv4();
  const idempotencyKey = `trans-${uuidv4()}`;

  let reportId: string;
  let reportNumber: string;

  beforeAll(async () => {
    // Create initial report with status SUBMITTED and version 1
    const res = await request(app)
      .post('/api/reports')
      .send({
        clientReportId,
        title: 'Transformer Oil Leakage at Substation Gamma',
        category: 'DAMAGED_EQUIPMENT',
        description: 'Cooling radiator fin cracked with active mineral oil leak.',
        location: 'Substation Gamma Yard',
        priority: 'CRITICAL',
        reportedAt: new Date().toISOString(),
        reporterId,
        sourceDeviceId: 'device-test-01',
        idempotencyKey,
      });

    reportId = res.body.id || res.body.data.id;
    reportNumber = res.body.reportNumber || res.body.data.reportNumber;
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { reportId } });
    await prisma.statusTransition.deleteMany({ where: { reportId } });
    await prisma.report.deleteMany({ where: { id: reportId } });
    await prisma.idempotencyRecord.deleteMany({ where: { key: idempotencyKey } });
    await prisma.$disconnect();
  });

  it('11. rejects invalid state transition (e.g. SUBMITTED -> RESOLVED directly) with HTTP 422', async () => {
    const invalidJump = {
      status: 'RESOLVED',
      expectedVersion: 1,
      note: 'Trying to jump directly from SUBMITTED to RESOLVED without assignment or progress',
      actorId: coordinatorId,
    };

    const res = await request(app)
      .patch(`/api/reports/${reportId}/status`)
      .send(invalidJump);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('12. rejects status transition when stale version provided (HTTP 409 Conflict)', async () => {
    const staleVersionTransition = {
      status: 'ASSIGNED',
      expectedVersion: 999, // Mismatched version
      note: 'Stale update test',
      actorId: coordinatorId,
    };

    const res = await request(app)
      .patch(`/api/reports/${reportId}/status`)
      .send(staleVersionTransition);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VERSION_CONFLICT');
  });

  it('10a. executes valid transition: SUBMITTED -> ASSIGNED with matching version', async () => {
    const validTransition1 = {
      status: 'ASSIGNED',
      expectedVersion: 1,
      assignedTo: 'Engineer Marcus',
      assignedTeam: 'High Voltage Crew 3',
      note: 'Assigned to HV Crew 3 for emergency containment',
      actorId: coordinatorId,
      actorName: 'Coordinator Elena',
    };

    const res = await request(app)
      .patch(`/api/reports/${reportId}/status`)
      .send(validTransition1);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const report = res.body.data || res.body;
    expect(report.status).toBe('ASSIGNED');
    expect(report.version).toBe(2);
    expect(report.assignedTo).toBe('Engineer Marcus');
    expect(report.assignedTeam).toBe('High Voltage Crew 3');
  });

  it('10b. executes valid transition: ASSIGNED -> IN_PROGRESS with version 2', async () => {
    const validTransition2 = {
      status: 'IN_PROGRESS',
      expectedVersion: 2,
      note: 'Technicians on site, oil absorption booms deployed',
      actorId: 'Engineer Marcus',
    };

    const res = await request(app)
      .patch(`/api/reports/${reportId}/status`)
      .send(validTransition2);

    expect(res.status).toBe(200);
    const report = res.body.data || res.body;
    expect(report.status).toBe('IN_PROGRESS');
    expect(report.version).toBe(3);
  });

  it('10c. executes valid transition: IN_PROGRESS -> RESOLVED with version 3 and records resolvedAt', async () => {
    const validTransition3 = {
      status: 'RESOLVED',
      expectedVersion: 3,
      resolutionNotes: 'Radiator fin brazed, oil refilled to nominal level, pressure tested 2 hours.',
      resolvedBy: 'Engineer Marcus',
      note: 'Final signoff and remediation complete',
      actorId: coordinatorId,
    };

    const res = await request(app)
      .patch(`/api/reports/${reportId}/status`)
      .send(validTransition3);

    expect(res.status).toBe(200);
    const report = res.body.data || res.body;
    expect(report.status).toBe('RESOLVED');
    expect(report.version).toBe(4);
    expect(report.resolvedAt).toBeDefined();
    expect(report.resolutionNotes).toBe(validTransition3.resolutionNotes);
  });

  it('13. verifies complete status transition audit history is recorded in database', async () => {
    const transitions = await prisma.statusTransition.findMany({
      where: { reportId },
      orderBy: { createdAt: 'asc' },
    });

    expect(transitions.length).toBeGreaterThanOrEqual(4);

    // Initial creation transition: DRAFT -> SUBMITTED
    expect(transitions[0].fromStatus).toBe('DRAFT');
    expect(transitions[0].toStatus).toBe('SUBMITTED');

    // Transition 1: SUBMITTED -> ASSIGNED
    expect(transitions[1].fromStatus).toBe('SUBMITTED');
    expect(transitions[1].toStatus).toBe('ASSIGNED');

    // Transition 2: ASSIGNED -> IN_PROGRESS
    expect(transitions[2].fromStatus).toBe('ASSIGNED');
    expect(transitions[2].toStatus).toBe('IN_PROGRESS');

    // Transition 3: IN_PROGRESS -> RESOLVED
    expect(transitions[3].fromStatus).toBe('IN_PROGRESS');
    expect(transitions[3].toStatus).toBe('RESOLVED');

    // Verify activity log entries also created for each transition
    const activities = await prisma.activityLog.findMany({
      where: { reportId, action: 'STATUS_UPDATED' },
    });
    expect(activities.length).toBe(3);
  });
});

