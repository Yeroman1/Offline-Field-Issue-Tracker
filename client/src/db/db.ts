import Dexie, { type EntityTable } from 'dexie';
import { Report, OutboxItem, ActivityLog } from '../types';

export class NilePixelDatabase extends Dexie {
  reports!: EntityTable<Report, 'id'>;
  outbox!: EntityTable<OutboxItem, 'id'>;
  activityLog!: EntityTable<ActivityLog, 'id'>;

  constructor() {
    super('NilePixelDB');
    this.version(1).stores({
      reports: 'id, reportNumber, category, priority, status, syncStatus, reporterId, assignedTo, createdAt, updatedAt',
      outbox: 'id, reportId, action, status, createdAt, idempotencyKey',
      activityLog: 'id, reportId, action, createdAt',
    });
  }
}

export const db = new NilePixelDatabase();
