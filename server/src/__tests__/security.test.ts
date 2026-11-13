import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { identifyActor, requireRole } from '../middleware/auth.middleware';
import { errorHandler } from '../middleware/errorHandler.middleware';

describe('16. Security & Authorization Middleware', () => {
  // Setup a test express instance with role-guarded routes
  const testApp = express();
  testApp.use(express.json());
  testApp.use(identifyActor);

  // Protected coordinator endpoint
  testApp.get(
    '/api/test/coordinator-only',
    requireRole(['COORDINATOR', 'ADMIN']),
    (req, res) => {
      res.json({
        success: true,
        actor: req.actor,
      });
    }
  );

  // Field worker endpoint
  testApp.post(
    '/api/test/field-action',
    requireRole(['FIELD_WORKER', 'COORDINATOR', 'ADMIN']),
    (req, res) => {
      res.json({
        success: true,
        actor: req.actor,
      });
    }
  );

  testApp.use(errorHandler);

  it('populates simulated actor context from headers without trusting request body', async () => {
    const res = await request(testApp)
      .post('/api/test/field-action')
      .set('x-actor-id', 'usr-test-123')
      .set('x-actor-role', 'FIELD_WORKER')
      .set('x-actor-name', 'Alice Tester')
      .send({
        // Malicious body attempting to elevate itself to ADMIN
        role: 'ADMIN',
        actorRole: 'ADMIN',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.actor.id).toBe('usr-test-123');
    expect(res.body.actor.role).toBe('FIELD_WORKER');
    expect(res.body.actor.isSimulated).toBe(true);
  });

  it('rejects forbidden access when role is insufficient (e.g. FIELD_WORKER accessing coordinator endpoint)', async () => {
    const res = await request(testApp)
      .get('/api/test/coordinator-only')
      .set('x-actor-id', 'worker-456')
      .set('x-actor-role', 'FIELD_WORKER');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('permits access when authorized role header is present', async () => {
    const res = await request(testApp)
      .get('/api/test/coordinator-only')
      .set('x-actor-id', 'coord-789')
      .set('x-actor-role', 'COORDINATOR');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.actor.role).toBe('COORDINATOR');
  });
});

