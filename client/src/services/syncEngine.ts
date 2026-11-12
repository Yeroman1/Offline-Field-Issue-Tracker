import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/db';
import { Report, OutboxItem, SyncApiResponse, SyncBatchItem } from '../types';
import { getSimulatedOffline } from '../hooks/useNetworkStatus';

const BASE_URL = typeof window !== 'undefined' && window.location.origin
  ? '' // use relative URL with Vite proxy
  : 'http://localhost:3001';

const LAST_SYNC_KEY = 'nilepixel_last_sync_timestamp';

export interface SyncResult {
  success: boolean;
  syncedOutboxCount: number;
  pulledReportsCount: number;
  error?: string;
  timestamp: string;
}

export interface SyncEngineStatus {
  isSyncing: boolean;
  lastSyncTime: string | null;
  pendingCount: number;
  lastError: string | null;
}

type SyncListener = (status: SyncEngineStatus) => void;

class SyncEngine {
  private isSyncing = false;
  private listeners: Set<SyncListener> = new Set();
  private autoSyncInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Auto sync when coming back online
      window.addEventListener('online', () => {
        this.syncNow().catch(() => {});
      });
      window.addEventListener('nilepixel_offline_simulation_changed', () => {
        if (!getSimulatedOffline()) {
          this.syncNow().catch(() => {});
        }
      });
      // Start background poll every 30 seconds
      this.autoSyncInterval = setInterval(() => {
        if (navigator.onLine && !getSimulatedOffline()) {
          this.syncNow().catch(() => {});
        }
      }, 30000);
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(lastError: string | null = null): void {
    const status: SyncEngineStatus = {
      isSyncing: this.isSyncing,
      lastSyncTime: this.getLastSyncTime(),
      pendingCount: 0, // will be queried asynchronously or updated
      lastError,
    };
    db.outbox.where('status').equals('pending').count().then((cnt) => {
      status.pendingCount = cnt;
      this.listeners.forEach((l) => l(status));
    }).catch(() => {
      this.listeners.forEach((l) => l(status));
    });
  }

  public getLastSyncTime(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(LAST_SYNC_KEY);
  }

  public setLastSyncTime(isoString: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LAST_SYNC_KEY, isoString);
  }

  /**
   * Enqueue a new report creation in outbox
   */
  public async enqueueReportCreate(report: Report): Promise<void> {
    const idempotencyKey = uuidv4();
    const outboxItem: OutboxItem = {
      id: uuidv4(),
      reportId: report.id,
      action: 'create',
      payload: JSON.stringify(report),
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
      idempotencyKey,
    };

    await db.transaction('rw', db.reports, db.outbox, db.activityLog, async () => {
      await db.reports.put({ ...report, syncStatus: 'pending' });
      await db.outbox.add(outboxItem);
      await db.activityLog.add({
        id: uuidv4(),
        reportId: report.id,
        action: 'queued_sync',
        actorName: report.reporterName,
        description: `Field report ${report.reportNumber || 'draft'} queued for cloud synchronization`,
        newValue: 'pending',
        createdAt: new Date().toISOString(),
      });
    });

    this.notify();

    // Trigger sync immediately if online
    if (typeof navigator !== 'undefined' && navigator.onLine && !getSimulatedOffline()) {
      this.syncNow().catch(() => {});
    }
  }

  /**
   * Enqueue a report update in outbox
   */
  public async enqueueReportUpdate(
    reportId: string,
    updates: Partial<Report>,
    actorName: string = 'Sarah J.'
  ): Promise<void> {
    const existing = await db.reports.get(reportId);
    if (!existing) {
      throw new Error(`Report ${reportId} not found`);
    }

    const updatedReport: Report = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const idempotencyKey = uuidv4();
    const outboxItem: OutboxItem = {
      id: uuidv4(),
      reportId,
      action: 'update',
      payload: JSON.stringify(updatedReport),
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
      idempotencyKey,
    };

    await db.transaction('rw', db.reports, db.outbox, db.activityLog, async () => {
      await db.reports.put(updatedReport);
      await db.outbox.add(outboxItem);
      await db.activityLog.add({
        id: uuidv4(),
        reportId,
        action: 'queued_update',
        actorName,
        description: `Update to report ${updatedReport.reportNumber} queued for cloud synchronization`,
        newValue: updates.status || 'updated',
        createdAt: new Date().toISOString(),
      });
    });

    this.notify();

    if (typeof navigator !== 'undefined' && navigator.onLine && !getSimulatedOffline()) {
      this.syncNow().catch(() => {});
    }
  }

  /**
   * Execute full synchronization cycle: push outbox, pull upstream updates
   */
  public async syncNow(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, syncedOutboxCount: 0, pulledReportsCount: 0, error: 'Sync already in progress', timestamp: new Date().toISOString() };
    }

    if (getSimulatedOffline() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return { success: false, syncedOutboxCount: 0, pulledReportsCount: 0, error: 'Network is offline', timestamp: new Date().toISOString() };
    }

    this.isSyncing = true;
    this.notify();

    let syncedOutboxCount = 0;
    let pulledReportsCount = 0;
    let syncError: string | undefined = undefined;

    try {
      // 1. PUSH OUTBOX
      const pendingItems = await db.outbox
        .where('status')
        .equals('pending')
        .limit(50)
        .toArray();

      if (pendingItems.length > 0) {
        // Mark items as syncing
        await db.outbox.where('id').anyOf(pendingItems.map((i) => i.id)).modify({ status: 'syncing' });

        const batch: SyncBatchItem[] = pendingItems.map((item) => ({
          idempotencyKey: item.idempotencyKey,
          action: item.action,
          data: JSON.parse(item.payload),
        }));

        const pushUrl = `${BASE_URL}/api/sync`;
        const resp = await fetch(pushUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
        }).catch(async () => {
          // Retry direct localhost:3001 if vite proxy failed
          return await fetch('http://localhost:3001/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batch),
          });
        });

        if (!resp.ok) {
          throw new Error(`Sync push failed with status ${resp.status}: ${resp.statusText}`);
        }

        const data: SyncApiResponse = await resp.json();
        const resultsMap = new Map(data.results.map((r) => [r.idempotencyKey, r]));

        // Process each outbox item result
        for (const item of pendingItems) {
          const res = resultsMap.get(item.idempotencyKey);
          if (res && (res.status === 'synced' || res.status === 'conflict')) {
            // Success! Update local report
            await db.transaction('rw', db.reports, db.outbox, db.activityLog, async () => {
              const localReport = await db.reports.get(item.reportId);
              if (localReport) {
                const updatedFields: Partial<Report> = {
                  syncStatus: 'synced',
                };
                if (res.reportNumber) {
                  updatedFields.reportNumber = res.reportNumber;
                }
                if (res.version) {
                  updatedFields.version = res.version;
                }
                await db.reports.update(item.reportId, updatedFields);
              }
              // Remove outbox item
              await db.outbox.delete(item.id);
              await db.activityLog.add({
                id: uuidv4(),
                reportId: item.reportId,
                action: 'synced',
                actorName: 'SyncEngine',
                description: `Successfully synchronized with central NilePixel server (NP-Cloud)`,
                createdAt: new Date().toISOString(),
              });
            });
            syncedOutboxCount++;
          } else {
            // Failed for this specific item
            const newAttempts = (item.attempts || 0) + 1;
            const newStatus = newAttempts >= 5 ? 'failed' : 'pending';
            await db.outbox.update(item.id, {
              attempts: newAttempts,
              status: newStatus,
              lastAttemptAt: new Date().toISOString(),
            });
            if (newStatus === 'failed') {
              await db.reports.update(item.reportId, { syncStatus: 'failed' });
            }
          }
        }
      }

      // 2. PULL UPSTREAM UPDATES
      const lastSync = this.getLastSyncTime();
      let pullUrl = `${BASE_URL}/api/reports`;
      if (lastSync) {
        pullUrl += `?since=${encodeURIComponent(lastSync)}`;
      }

      const pullResp = await fetch(pullUrl, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      }).catch(async () => {
        let url3001 = 'http://localhost:3001/api/reports';
        if (lastSync) url3001 += `?since=${encodeURIComponent(lastSync)}`;
        return await fetch(url3001, {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
        });
      });

      if (pullResp && pullResp.ok) {
        const pullData = await pullResp.json();
        const incomingReports: Report[] = Array.isArray(pullData)
          ? pullData
          : pullData.reports || [];

        for (const remoteReport of incomingReports) {
          const local = await db.reports.get(remoteReport.id);
          // Only overwrite if local report isn't currently pending in outbox with higher version
          const pendingForReport = await db.outbox.where('reportId').equals(remoteReport.id).first();
          if (!pendingForReport) {
            await db.reports.put({
              ...remoteReport,
              syncStatus: 'synced',
            });
            pulledReportsCount++;
          } else if (local && remoteReport.version > local.version) {
            // Conflict or server has newer version
            await db.reports.put({
              ...remoteReport,
              syncStatus: 'synced',
            });
            pulledReportsCount++;
          }
        }
      }

      const nowIso = new Date().toISOString();
      this.setLastSyncTime(nowIso);

      return {
        success: true,
        syncedOutboxCount,
        pulledReportsCount,
        timestamp: nowIso,
      };
    } catch (err: any) {
      syncError = err.message || 'Sync failed';
      // Reset any syncing items back to pending so they can retry
      await db.outbox.where('status').equals('syncing').modify({
        status: 'pending',
        lastAttemptAt: new Date().toISOString(),
      });
      return {
        success: false,
        syncedOutboxCount,
        pulledReportsCount,
        error: syncError,
        timestamp: new Date().toISOString(),
      };
    } finally {
      this.isSyncing = false;
      this.notify(syncError);
    }
  }

  public destroy(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }
    this.listeners.clear();
  }
}

export const syncEngine = new SyncEngine();
