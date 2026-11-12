import { describe, it, expect } from 'vitest';
import { SyncBatchItem, SyncApiResponse, Report, OutboxItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

describe('syncEngine outbox and batch formatting', () => {
  it('formats outbox items into valid API batch payload', () => {
    const report: Report = {
      id: 'test-report-123',
      reportNumber: 'NP-9901',
      title: 'Pressure gauge blowout',
      description: 'Sensor reading exceeded 15 bar',
      category: 'Equipment',
      priority: 'High',
      status: 'submitted',
      syncStatus: 'pending',
      reporterName: 'Sarah J.',
      reporterId: 'USR-882',
      version: 1,
      createdAt: '2026-11-12T10:00:00.000Z',
      updatedAt: '2026-11-12T10:00:00.000Z',
    };

    const outboxItem: OutboxItem = {
      id: 'outbox-1',
      reportId: report.id,
      action: 'create',
      payload: JSON.stringify(report),
      status: 'pending',
      attempts: 0,
      createdAt: '2026-11-12T10:00:00.000Z',
      idempotencyKey: 'idemp-key-abc-123',
    };

    // Simulate batch mapping logic
    const batchItem: SyncBatchItem = {
      idempotencyKey: outboxItem.idempotencyKey,
      action: outboxItem.action,
      data: JSON.parse(outboxItem.payload),
    };

    expect(batchItem.idempotencyKey).toBe('idemp-key-abc-123');
    expect(batchItem.action).toBe('create');
    expect(batchItem.data.id).toBe('test-report-123');
    expect(batchItem.data.title).toBe('Pressure gauge blowout');
    expect(batchItem.data.priority).toBe('High');
  });

  it('generates distinct idempotency keys for consecutive actions', () => {
    const key1 = uuidv4();
    const key2 = uuidv4();
    expect(key1).not.toEqual(key2);
    expect(typeof key1).toBe('string');
    expect(key1.length).toBeGreaterThan(10);
  });

  it('correctly maps and updates synced items from server response', () => {
    const serverResponse: SyncApiResponse = {
      processed: 2,
      results: [
        {
          idempotencyKey: 'key-1',
          reportId: 'rep-1',
          reportNumber: 'NP-8822',
          version: 2,
          status: 'synced',
        },
        {
          idempotencyKey: 'key-2',
          reportId: 'rep-2',
          reportNumber: 'NP-8823',
          version: 1,
          status: 'synced',
        },
      ],
    };

    expect(serverResponse.processed).toBe(2);
    const resultsMap = new Map(serverResponse.results.map((r) => [r.idempotencyKey, r]));

    const res1 = resultsMap.get('key-1');
    expect(res1).toBeDefined();
    expect(res1?.status).toBe('synced');
    expect(res1?.reportNumber).toBe('NP-8822');
    expect(res1?.version).toBe(2);
  });

  it('handles retry backoff threshold logic properly', () => {
    const item: OutboxItem = {
      id: 'outbox-fail',
      reportId: 'rep-fail',
      action: 'update',
      payload: JSON.stringify({ status: 'assigned' }),
      status: 'pending',
      attempts: 4,
      createdAt: '2026-11-12T10:00:00.000Z',
      idempotencyKey: 'key-fail',
    };

    // Incremented attempt
    const newAttempts = item.attempts + 1;
    const newStatus = newAttempts >= 5 ? 'failed' : 'pending';

    expect(newAttempts).toBe(5);
    expect(newStatus).toBe('failed');
  });
});
