import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/db';
import { Report, OutboxItem, SyncApiResponse, SyncBatchItem } from '../types';
import { getSimulatedOffline } from '../hooks/useNetworkStatus';
import { supabase } from '../utils/supabase';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  } catch {}
  return headers;
}

const BASE_URL = typeof window !== 'undefined' && window.location.origin
  ? '' // use relative URL with Vite proxy
  : 'http://localhost:3001';

const LAST_SYNC_KEY = 'nilepixel_last_sync_timestamp';
export const MAX_RETRY_ATTEMPTS = 5;

/**
 * Calculates exponential backoff delay with jitter.
 * delay = min(maxMs, baseMs * 2^attempts) + random(0, jitterMs)
 */
export function calculateBackoffDelay(
  attempts: number,
  baseMs = 1000,
  maxMs = 30000,
  jitterMs = 1000
): number {
  const exponential = Math.min(maxMs, baseMs * Math.pow(2, attempts));
  const jitter = Math.random() * jitterMs;
  return Math.floor(exponential + jitter);
}

/**
 * Determines whether an error is transient (network / 5xx) or permanent (validation / schema / 4xx).
 */
export function isPermanentError(errorMsg?: string): boolean {
  if (!errorMsg) return false;
  const msg = errorMsg.toLowerCase();
  return (
    msg.includes('validation') ||
    msg.includes('transition') ||
    msg.includes('forbidden') ||
    msg.includes('unauthorized') ||
    msg.includes('not found') ||
    msg.includes('conflict') ||
    msg.includes('syntax') ||
    msg.includes('missing required') ||
    msg.includes('bad request') ||
    msg.includes('unprocessable')
  );
}

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

export class SyncEngine {
  private isSyncing = false;
  private inFlightPromise: Promise<SyncResult> | null = null;
  private listeners: Set<SyncListener> = new Set();
  private autoSyncInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Recovery sweep: reset any stranded 'syncing' items from interrupted runs/refreshes
      this.recoverStrandedItems().catch(() => {});

      // Auto sync when coming back online
      window.addEventListener('online', () => {
        this.syncNow().catch(() => {});
      });
      window.addEventListener('nilepixel_offline_simulation_changed', () => {
        if (!getSimulatedOffline()) {
          this.syncNow().catch(() => {});
        }
      });
      // Background poll every 30 seconds
      this.autoSyncInterval = setInterval(() => {
        if (navigator.onLine && !getSimulatedOffline()) {
          this.syncNow().catch(() => {});
        }
      }, 30000);
    }
  }

  /**
   * Resets any stranded outbox items left in 'syncing' state (e.g. if the tab was closed or refreshed).
   * Ensures no report operation is silently dropped.
   */
  public async recoverStrandedItems(): Promise<number> {
    const stranded = await db.outbox.where('status').equals('syncing').toArray();
    if (stranded.length > 0) {
      await db.outbox.where('status').equals('syncing').modify({
        status: 'pending',
      });
    }
    return stranded.length;
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => {
      this.listeners.delete(listener);
    };
  }

  public notify(lastError: string | null = null): void {
    const status: SyncEngineStatus = {
      isSyncing: this.isSyncing,
      lastSyncTime: this.getLastSyncTime(),
      pendingCount: 0,
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
   * Enqueue a new report creation in local database and persistent outbox.
   * Reports are guaranteed stored locally before any network attempt.
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
        description: `Field report ${report.reportNumber || 'draft'} saved locally and queued for synchronization`,
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
   * Enqueue a report update in local database and persistent outbox.
   */
  public async enqueueReportUpdate(
    reportId: string,
    updates: Partial<Report>,
    actorName: string = 'Field Technician'
  ): Promise<void> {
    const existing = await db.reports.get(reportId);
    if (!existing) {
      throw new Error(`Report ${reportId} not found in local database`);
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
        description: `Update to report ${updatedReport.reportNumber} saved locally and queued for synchronization`,
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
   * Concurrency Guard: Single-flight mutex wrapper.
   * If a sync operation is already in flight, returns the active promise
   * so multiple concurrent callers await the same execution.
   */
  public syncNow(): Promise<SyncResult> {
    if (this.inFlightPromise) {
      return this.inFlightPromise;
    }

    this.inFlightPromise = this.executeSyncCycle().finally(() => {
      this.inFlightPromise = null;
    });

    return this.inFlightPromise;
  }

  /**
   * Core synchronization execution:
   * 1. Push ready outbox items with exponential backoff respect.
   * 2. Pull server-authoritative delta updates.
   */
  private async executeSyncCycle(): Promise<SyncResult> {
    if (getSimulatedOffline() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return {
        success: false,
        syncedOutboxCount: 0,
        pulledReportsCount: 0,
        error: 'Network is offline',
        timestamp: new Date().toISOString(),
      };
    }

    this.isSyncing = true;
    this.notify();

    let syncedOutboxCount = 0;
    let pulledReportsCount = 0;
    let syncError: string | undefined = undefined;

    let itemsInFlight: OutboxItem[] = [];

    try {
      // 1. SELECT READY OUTBOX ITEMS (status = pending and nextAttemptAt <= now)
      const nowIso = new Date().toISOString();
      const allPending = await db.outbox
        .where('status')
        .equals('pending')
        .toArray();

      itemsInFlight = allPending
        .filter((item) => !item.nextAttemptAt || item.nextAttemptAt <= nowIso)
        .slice(0, 50);

      if (itemsInFlight.length > 0) {
        // Mark items as 'syncing' atomically before dispatching network request
        await db.outbox
          .where('id')
          .anyOf(itemsInFlight.map((i) => i.id))
          .modify({ status: 'syncing' });

        const batch: SyncBatchItem[] = itemsInFlight.map((item) => ({
          idempotencyKey: item.idempotencyKey,
          action: item.action,
          data: JSON.parse(item.payload),
        }));

        const authHeaders = await getAuthHeaders();
        const pushUrl = `${BASE_URL}/api/sync`;
        const resp = await fetch(pushUrl, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(batch),
        }).catch(async () => {
          // Fallback to direct localhost if relative path / proxy failed
          return await fetch('http://localhost:3001/api/sync', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(batch),
          });
        });

        if (!resp.ok) {
          throw new Error(`Sync push HTTP error: status ${resp.status} ${resp.statusText}`);
        }

        const data: SyncApiResponse = await resp.json();
        const resultsMap = new Map(data.results.map((r) => [r.idempotencyKey, r]));

        // Process each outbox item result according to server response
        for (const item of itemsInFlight) {
          const res = resultsMap.get(item.idempotencyKey);

          if (res && res.status === 'synced') {
            // SUCCESS: Server acknowledged. Now and ONLY now remove outbox item.
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
              // Remove outbox item on positive server confirmation
              await db.outbox.delete(item.id);

              await db.activityLog.add({
                id: uuidv4(),
                reportId: item.reportId,
                action: 'synced',
                actorName: 'SyncEngine',
                description: `Successfully synchronized with central NilePixel server (NP-Cloud)`,
                newValue: 'synced',
                createdAt: new Date().toISOString(),
              });
            });
            syncedOutboxCount++;
          } else if (res && res.status === 'conflict') {
            // CONFLICT: Version mismatch (OCC).
            // NEVER remove from outbox! Mark failed, retain for user resolution, alert.
            await db.transaction('rw', db.reports, db.outbox, db.activityLog, async () => {
              await db.outbox.update(item.id, {
                status: 'failed',
                errorType: 'conflict',
                error: res.message || 'Version conflict detected with server',
                lastAttemptAt: new Date().toISOString(),
              });
              await db.reports.update(item.reportId, { syncStatus: 'failed' });
              await db.activityLog.add({
                id: uuidv4(),
                reportId: item.reportId,
                action: 'conflict_detected',
                actorName: 'SyncEngine',
                description: `Conflict: ${res.message || 'Remote record was modified concurrently'}`,
                newValue: 'conflict',
                createdAt: new Date().toISOString(),
              });
            });
          } else {
            // FAILURE: Permanent validation error OR transient error
            const errorMsg = res?.message || 'Server rejected synchronization operation';
            const permanent = isPermanentError(errorMsg);

            if (permanent) {
              // PERMANENT VALIDATION FAILURE: Fail fast, do not retry indefinitely
              await db.transaction('rw', db.reports, db.outbox, db.activityLog, async () => {
                await db.outbox.update(item.id, {
                  status: 'failed',
                  errorType: 'validation',
                  error: errorMsg,
                  lastAttemptAt: new Date().toISOString(),
                });
                await db.reports.update(item.reportId, { syncStatus: 'failed' });
                await db.activityLog.add({
                  id: uuidv4(),
                  reportId: item.reportId,
                  action: 'sync_rejected',
                  actorName: 'SyncEngine',
                  description: `Permanent validation failure: ${errorMsg}`,
                  newValue: 'validation_error',
                  createdAt: new Date().toISOString(),
                });
              });
            } else {
              // TRANSIENT ERROR: Retry with exponential backoff and jitter
              const newAttempts = (item.attempts || 0) + 1;
              if (newAttempts >= MAX_RETRY_ATTEMPTS) {
                await db.transaction('rw', db.reports, db.outbox, db.activityLog, async () => {
                  await db.outbox.update(item.id, {
                    status: 'failed',
                    errorType: 'transient',
                    attempts: newAttempts,
                    error: `Exceeded maximum retry attempts (${MAX_RETRY_ATTEMPTS}): ${errorMsg}`,
                    lastAttemptAt: new Date().toISOString(),
                  });
                  await db.reports.update(item.reportId, { syncStatus: 'failed' });
                });
              } else {
                const backoffDelay = calculateBackoffDelay(newAttempts);
                const nextAttemptAt = new Date(Date.now() + backoffDelay).toISOString();
                await db.outbox.update(item.id, {
                  status: 'pending',
                  attempts: newAttempts,
                  lastAttemptAt: new Date().toISOString(),
                  nextAttemptAt,
                  error: errorMsg,
                  errorType: 'transient',
                });
              }
            }
          }
        }
      }

      // 2. PULL SERVER-AUTHORITATIVE DELTA UPDATES
      const lastSync = this.getLastSyncTime();
      let pullUrl = `${BASE_URL}/api/reports`;
      if (lastSync) {
        pullUrl += `?since=${encodeURIComponent(lastSync)}`;
      }

      const pullHeaders = { ...(await getAuthHeaders()), 'Cache-Control': 'no-cache' };
      const pullResp = await fetch(pullUrl, {
        method: 'GET',
        headers: pullHeaders,
      }).catch(async () => {
        let url3001 = 'http://localhost:3001/api/reports';
        if (lastSync) url3001 += `?since=${encodeURIComponent(lastSync)}`;
        return await fetch(url3001, {
          method: 'GET',
          headers: pullHeaders,
        });
      });

      if (pullResp && pullResp.ok) {
        const pullData = await pullResp.json();
        const incomingReports: Report[] = Array.isArray(pullData)
          ? pullData
          : pullData.reports || pullData.data || [];

        for (const remoteReport of incomingReports) {
          const local = await db.reports.get(remoteReport.id);
          // Only overwrite if local report doesn't have an uncommitted pending outbox change with a higher/conflicting version
          const pendingForReport = await db.outbox.where('reportId').equals(remoteReport.id).first();
          if (!pendingForReport) {
            await db.reports.put({
              ...remoteReport,
              syncStatus: 'synced',
            });
            pulledReportsCount++;
          } else if (local && remoteReport.version > local.version) {
            await db.reports.put({
              ...remoteReport,
              syncStatus: 'synced',
            });
            pulledReportsCount++;
          }
        }
      }

      const now = new Date().toISOString();
      this.setLastSyncTime(now);

      return {
        success: true,
        syncedOutboxCount,
        pulledReportsCount,
        timestamp: now,
      };
    } catch (err: any) {
      syncError = err.message || 'Sync network failure';

      // RECOVERY: On network error / disconnect during upload, restore in-flight items
      // Calculate backoff so they are scheduled for retry rather than immediately hammered
      for (const item of itemsInFlight) {
        const attempts = (item.attempts || 0) + 1;
        if (attempts >= MAX_RETRY_ATTEMPTS) {
          await db.outbox.update(item.id, {
            status: 'failed',
            attempts,
            error: syncError,
            errorType: 'transient',
            lastAttemptAt: new Date().toISOString(),
          }).catch(() => {});
          await db.reports.update(item.reportId, { syncStatus: 'failed' }).catch(() => {});
        } else {
          const delay = calculateBackoffDelay(attempts);
          const nextAttemptAt = new Date(Date.now() + delay).toISOString();
          await db.outbox.update(item.id, {
            status: 'pending',
            attempts,
            error: syncError,
            errorType: 'transient',
            lastAttemptAt: new Date().toISOString(),
            nextAttemptAt,
          }).catch(() => {});
        }
      }

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