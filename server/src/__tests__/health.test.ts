import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('1. Health Check Endpoint (GET /api/health)', () => {
  it('returns 200 with API status, database connection, timestamp, and uptime', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(['ok', 'healthy']).toContain(res.body.status);
    expect(res.body).toHaveProperty('database', 'connected');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');

    // Security check: Must not expose database credentials or internal connection strings
    const jsonString = JSON.stringify(res.body);
    expect(jsonString).not.toContain('postgresql://');
    expect(jsonString).not.toContain('prisma');
    expect(jsonString).not.toContain('password');
    expect(jsonString).not.toContain('.db');
  });
});

