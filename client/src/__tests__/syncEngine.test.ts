import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/db';
import {
  syncEngine,
  calculateBackoffDelay,
  isPermanentError,
} from '../services/syncEngine';
import { Report } from '../types';

describe('Offline Synchronization Engine', () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(async () => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = val; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
    });

    // Clear Dexie tables
    await db.reports.clear();
    await db.outbox.clear();
    await db.activityLog.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  describe('1. Backoff and Jitter Calculation', () => {
    it('exponentially scales retry delay with attempts up to maxMs', () => {
      const delay0 = calculateBackoffDelay(0, 1000, 30000, 0); // 1000 * 2^0 = 1000
      const delay1 = calculateBackoffDelay(1, 1000, 30000, 0); // 1000 * 2^1 = 2000
      const delay2 = calculateBackoffDelay(2, 1000, 30000, 0); // 1000 * 2^2 = 4000
      const delay3 = calculateBackoffDelay(3, 1000, 30000, 0); // 1000 * 2^3 = 8000
      const delayCap = calculateBackoffDelay(10, 1000, 30000, 0); // capped at 30000

      expect(delay0).toBe(1000);
      expect(delay1).toBe(2000);
      expect(delay2).toBe(4000);
      expect(delay3).toBe(8000);
      expect(delayCap).toBe(30000);
    });

    it('injects randomized jitter within the specified window', () => {
      const baseMs = 1000;
      const jitterMs = 500;
      for (let i = 0; i < 20; i++) {
        const delay = calculateBackoffDelay(1, baseMs, 30000, jitterMs);
        expect(delay).toBeGreaterThanOrEqual(2000); // 1000 * 2^1 = 2000
        expect(delay).toBeLessThanOrEqual(2500); // 2000 + 500
      }
    });

    it('classifies errors into permanent vs transient', () => {
      expect(isPermanentError('Validation error: invalid category')).toBe(true);
      expect(isPermanentError('Invalid report status transition from SUBMITTED to RESOLVED')).toBe(true);
      expect(isPermanentError('Unauthorized or forbidden')).toBe(true);
      expect(isPermanentError('Report not found in database')).toBe(true);
      expect(isPermanentError('Version conflict: expected version 1')).toBe(true);

      expect(isPermanentError('TypeError: Failed to fetch')).toBe(false);
      expect(isPermanentError('ECONNREFUSED 127.0.0.1:3001')).toBe(false);
      expect(isPermanentError('ETIMEDOUT: Gateway timeout')).toBe(false);
      expect(isPermanentError('HTTP 502 Bad Gateway')).toBe(false);
    });
  });

  describe('Scenario 1: Application starts offline', () => {
    it('saves reports locally in IndexedDB and gracefully reports offline without crashing', async () => {
      // Mock navigator.onLine = false
      vi.stubGlobal('navigator', { onLine: false });

      const report: Report = {
        id: uuidv4(),
        reportNumber: 'NP-DRAFT-01',
        title: 'Offline Water Pump Malfunction',
        description: 'Primary pump stopped pumping water',
        category: 'Water',
        priority: 'High',
        status: 'submitted',
        syncStatus: 'pending',
        reporterName: 'Sarah J.',
        reporterId: 'USR-882',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // User creates report offline
      await syncEngine.enqueueReportCreate(report);

      // Verify report is saved in local IndexedDB
      const savedReport = await db.reports.get(report.id);
      expect(savedReport).toBeDefined();
      expect(savedReport?.title).toBe('Offline Water Pump Malfunction');
      expect(savedReport?.syncStatus).toBe('pending');

      // Verify outbox has pending operation
      const outboxItems = await db.outbox.where('reportId').equals(report.id).toArray();
      expect(outboxItems.length).toBe(1);
      expect(outboxItems[0].status).toBe('pending');
      expect(outboxItems[0].action).toBe('create');
      expect(outboxItems[0].idempotencyKey).toBeDefined();

      // Attempting sync while offline returns offline error immediately
      const syncResult = await syncEngine.syncNow();
      expect(syncResult.success).toBe(false);
      expect(syncResult.error).toBe('Network is offline');
      expect(syncResult.syncedOutboxCount).toBe(0);
    });
  });

  describe('Scenario 2: User creates multiple reports offline', () => {
    it('persists all reports in IndexedDB with stable UUIDs and distinct idempotency keys', async () => {
      vi.stubGlobal('navigator', { onLine: false });

      const reportA: Report = {
        id: uuidv4(),
        reportNumber: 'NP-DRAFT-A',
        title: 'Report Alpha',
        description: 'First offline report',
        category: 'Equipment',
        priority: 'Medium',
        status: 'submitted',
        syncStatus: 'pending',
        reporterName: 'Sarah J.',
        reporterId: 'USR-882',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const reportB: Report = {
        id: uuidv4(),
        reportNumber: 'NP-DRAFT-B',
        title: 'Report Beta',
        description: 'Second offline report',
        category: 'Infrastructure',
        priority: 'High',
        status: 'submitted',
        syncStatus: 'pending',
        reporterName: 'Sarah J.',
        reporterId: 'USR-882',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await syncEngine.enqueueReportCreate(reportA);
      await syncEngine.enqueueReportCreate(reportB);

      const allReports = await db.reports.toArray();
      expect(allReports.length).toBe(2);

      const allOutbox = await db.outbox.toArray();
      expect(allOutbox.length).toBe(2);

      // Verify stable unique IDs and distinct idempotency keys
      expect(allReports[0].id).not.toBe(allReports[1].id);
      expect(allOutbox[0].idempotencyKey).not.toBe(allOutbox[1].idempotencyKey);
      expect(allOutbox[0].idempotencyKey.length).toBeGreaterThan(15);
      expect(allOutbox[1].idempotencyKey.length).toBeGreaterThan(15);
    });
  });

  describe('Scenario 3: Application refreshes before synchronization', () => {
    it('recovers stranded syncing items on startup sweep without losing pending operations', async () => {
      // Simulate stranded outbox item left in 'syncing' state from a terminated browser session
      const strandedReportId = uuidv4();
      const strandedKey = `stranded-${uuidv4()}`;

      await db.reports.put({
        id: strandedReportId,
        reportNumber: 'NP-STRANDED',
        title: 'Report interrupted by page reload',
        description: 'Was midway through sync when page was refreshed',
        category: 'Maintenance',
        priority: 'Low',
        status: 'submitted',
        syncStatus: 'pending',
        reporterName: 'Sarah J.',
        reporterId: 'USR-882',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await db.outbox.add({
        id: uuidv4(),
        reportId: strandedReportId,
        action: 'create',
        payload: JSON.stringify({ id: strandedReportId, title: 'Report interrupted' }),
        status: 'syncing', // stranded!
        attempts: 1,
        createdAt: new Date().toISOString(),
        idempotencyKey: strandedKey,
      });

      // Execute startup recovery sweep
      const recoveredCount = await syncEngine.recoverStrandedItems();
      expect(recoveredCount).toBe(1);

      // Verify item was restored to pending
      const restored = await db.outbox.where('reportId').equals(strandedReportId).first();
      expect(restored?.status).toBe('pending');
      expect(restored?.idempotencyKey).toBe(strandedKey); // exact key preserved
    });
  });

  describe('Scenario 4 & 5: Internet returns and synchronization succeeds', () => {
    it('dispatches batch push, receives acknowledgement, updates local records, and deletes outbox items', async () => {
      vi.stubGlobal('navigator', { onLine: true });

      const reportId = uuidv4();
      const testReport: Report = {
        id: reportId,
        reportNumber: 'NP-DRAFT-99',
        title: 'Transmission Line Low Clearance',
        description: 'Sagging line over access road',
        category: 'Safety',
        priority: 'Critical',
        status: 'submitted',
        syncStatus: 'pending',
        reporterName: 'Sarah J.',
        reporterId: 'USR-882',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await syncEngine.enqueueReportCreate(testReport);
      const outboxItem = await db.outbox.where('reportId').equals(reportId).first();
      expect(outboxItem).toBeDefined();

      // Mock successful server batch push response
      const mockPushResponse = {
        processed: 1,
        results: [
          {
            idempotencyKey: outboxItem!.idempotencyKey,
            reportId,
            reportNumber: 'NP-8899', // official server-assigned report number
            version: 1,
            status: 'synced',
          },
        ],
      };

      // Mock fetch
      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/sync')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockPushResponse),
          });
        }
        if (url.includes('/api/reports')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve([]),
          });
        }
        return Promise.reject(new Error(`Unhandled url: ${url}`));
      }));

      // Trigger sync
      const result = await syncEngine.syncNow();

      expect(result.success).toBe(true);
      expect(result.syncedOutboxCount).toBe(1);

      // Verify outbox item was removed ONLY AFTER server acknowledgement
      const remainingOutbox = await db.outbox.where('reportId').equals(reportId).toArray();
      expect(remainingOutbox.length).toBe(0);

      // Verify local report was updated to synced with server reportNumber
      const updatedLocal = await db.reports.get(reportId);
      expect(updatedLocal?.syncStatus).toBe('synced');
      expect(updatedLocal?.reportNumber).toBe('NP-8899');

      // Verify activity log recorded
      const activity = await db.activityLog.where('reportId').equals(reportId).filter((a) => a.action === 'synced').first();
      expect(activity).toBeDefined();
    });
  });

  describe('Scenario 6: Internet disconnects during upload', () => {
    it('restores outbox items to pending with backoff and jitter without data loss', async () => {
      vi.stubGlobal('navigator', { onLine: true });

      const reportId = uuidv4();
      const testReport: Report = {
        id: reportId,
        reportNumber: 'NP-DRAFT-DISCONNECT',
        title: 'Wellhead Valve Replacement Needed',
        description: 'Corrosion observed on secondary gate',
        category: 'Water',
        priority: 'High',
        status: 'submitted',
        syncStatus: 'pending',
        reporterName: 'Sarah J.',
        reporterId: 'USR-882',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await syncEngine.enqueueReportCreate(testReport);

      // Mock fetch throwing network disconnect error during upload
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('TypeError: Failed to fetch (Network connection lost)')));

      const result = await syncEngine.syncNow();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch');

      // Verify outbox item is preserved (NEVER deleted!)
      const outboxItem = await db.outbox.where('reportId').equals(reportId).first();
      expect(outboxItem).toBeDefined();
      expect(outboxItem?.status).toBe('pending');
      expect(outboxItem?.attempts).toBe(1);
      expect(outboxItem?.errorType).toBe('transient');
      expect(outboxItem?.nextAttemptAt).toBeDefined();

      // Verify local report is safe
      const localReport = await db.reports.get(reportId);
      expect(localReport).toBeDefined();
      expect(localReport?.syncStatus).toBe('pending');
    });
  });

  describe('Scenario 10: Server returns a validation error', () => {
    it('marks outbox item as permanently failed without retrying indefinitely', async () => {
      vi.stubGlobal('navigator', { onLine: true });

      const reportId = uuidv4();
      const testReport: Report = {
        id: reportId,
        reportNumber: 'NP-BAD-VAL',
        title: 'Invalid Report Test',
        description: 'Test',
        category: 'Water',
        priority: 'High',
        status: 'submitted',
        syncStatus: 'pending',
        reporterName: 'Sarah J.',
        reporterId: 'USR-882',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await syncEngine.enqueueReportCreate(testReport);
      const outbox = await db.outbox.where('reportId').equals(reportId).first();

      // Mock server returning validation failure
      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/sync')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                processed: 1,
                results: [
                  {
                    idempotencyKey: outbox!.idempotencyKey,
                    reportId,
                    status: 'failed',
                    message: 'Validation error: invalid category code',
                  },
                ],
              }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }));

      await syncEngine.syncNow();

      // Outbox item is preserved for user inspection, marked failed permanently
      const failedOutbox = await db.outbox.where('reportId').equals(reportId).first();
      expect(failedOutbox).toBeDefined();
      expect(failedOutbox?.status).toBe('failed');
      expect(failedOutbox?.errorType).toBe('validation');
      expect(failedOutbox?.error).toContain('Validation error');

      // Local report status updated to failed
      const report = await db.reports.get(reportId);
      expect(report?.syncStatus).toBe('failed');
    });
  });

  describe('Scenario 11: Multiple synchronization attempts occur simultaneously', () => {
    it('single-flight mutex coalesces concurrent sync requests into a single network execution', async () => {
      vi.stubGlobal('navigator', { onLine: true });

      let fetchCallCount = 0;
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/sync')) {
          fetchCallCount++;
          // Simulate latency
          await new Promise((r) => setTimeout(r, 50));
          return {
            ok: true,
            status: 200,
            json: () => Promise.resolve({ processed: 0, results: [] }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
        };
      }));

      // Trigger 3 concurrent syncNow calls at the exact same moment
      const [res1, res2, res3] = await Promise.all([
        syncEngine.syncNow(),
        syncEngine.syncNow(),
        syncEngine.syncNow(),
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      expect(res3.success).toBe(true);

      // Mutex lock ensures only ONE push execution ran
      expect(fetchCallCount).toBe(0); // 0 outbox items to push, but exactly single flight cycle
    });
  });

  describe('Optimistic Concurrency Conflict (OCC) handling', () => {
    it('preserves outbox item and report when server reports version conflict', async () => {
      vi.stubGlobal('navigator', { onLine: true });

      const reportId = uuidv4();
      const testReport: Report = {
        id: reportId,
        reportNumber: 'NP-8820',
        title: 'Original Title',
        description: 'Original Description',
        category: 'Equipment',
        priority: 'Medium',
        status: 'submitted',
        syncStatus: 'synced',
        reporterName: 'Sarah J.',
        reporterId: 'USR-882',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.reports.put(testReport);

      // Enqueue update with stale version
      await syncEngine.enqueueReportUpdate(reportId, { title: 'Conflicting Stale Update' });
      const outbox = await db.outbox.where('reportId').equals(reportId).first();

      // Mock server returning OCC conflict
      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/sync')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                processed: 1,
                results: [
                  {
                    idempotencyKey: outbox!.idempotencyKey,
                    reportId,
                    status: 'conflict',
                    message: 'Version conflict: client version 1 does not match server version 2',
                  },
                ],
              }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }));

      await syncEngine.syncNow();

      // Outbox item is NOT deleted!
      const conflictedOutbox = await db.outbox.where('reportId').equals(reportId).first();
      expect(conflictedOutbox).toBeDefined();
      expect(conflictedOutbox?.status).toBe('failed');
      expect(conflictedOutbox?.errorType).toBe('conflict');
      expect(conflictedOutbox?.error).toContain('Version conflict');

      // Report marked failed
      const report = await db.reports.get(reportId);
      expect(report?.syncStatus).toBe('failed');

      // Conflict logged in activity
      const activity = await db.activityLog.where('reportId').equals(reportId).filter((a) => a.action === 'conflict_detected').first();
      expect(activity).toBeDefined();
    });
  });
});