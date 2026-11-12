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

export const INITIAL_SAMPLE_REPORTS: Report[] = [
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d471',
    reportNumber: 'NP-8821',
    title: 'Water Point Alpha-4 Main Pump Leakage',
    description: 'High pressure seepage detected at secondary gasket coupling. Flow rate reduced by approximately 35%. Risk of local flooding if valve fails.',
    category: 'Water',
    priority: 'Critical',
    status: 'in_progress',
    syncStatus: 'synced',
    latitude: 30.0444,
    longitude: 31.2357,
    locationName: 'Sector 4 - Alpha Wellhead',
    locationAccuracy: 3.2,
    reporterName: 'Sarah J.',
    reporterId: 'USR-882',
    assignedTo: 'Ahmed K.',
    assignedTeam: 'Hydro Rapid Response Alpha',
    version: 3,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    updatedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    photoCount: 2,
  },
  {
    id: 'c83d6e5a-2771-477a-b58c-4bc4594bb512',
    reportNumber: 'NP-8820',
    title: 'Culvert Drainage Blockage near Sector 7 Road',
    description: 'Accumulated silt and debris following recent dust storm obstructing gravity canal flow.',
    category: 'Infrastructure',
    priority: 'High',
    status: 'assigned',
    syncStatus: 'synced',
    latitude: 30.0521,
    longitude: 31.2482,
    locationName: 'Sector 7 - KM 14 Canal Crossway',
    locationAccuracy: 4.8,
    reporterName: 'Sarah J.',
    reporterId: 'USR-882',
    assignedTo: 'Tariq M.',
    assignedTeam: 'Civil Works Unit 2',
    version: 2,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    photoCount: 1,
  },
  {
    id: '9f2a41d8-043b-488f-a9cb-b203402d6433',
    reportNumber: 'NP-8819',
    title: 'Solar Inverter PV-09 Overheating Alert',
    description: 'Inverter chassis temperature spiked to 78°C under mid-day insolation. Cooling fan bearing seized.',
    category: 'Equipment',
    priority: 'Medium',
    status: 'submitted',
    syncStatus: 'synced',
    latitude: 30.0389,
    longitude: 31.2291,
    locationName: 'Solar Array Delta, Row 9',
    locationAccuracy: 2.1,
    reporterName: 'Sarah J.',
    reporterId: 'USR-882',
    version: 1,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    photoCount: 1,
  },
  {
    id: 'e1248092-23c1-4b11-a8cf-3cfa40a77844',
    reportNumber: 'NP-8818',
    title: 'Perimeter Intrusion Sensor False Alarms',
    description: 'Optical tripwire triggering intermittently due to heavy sand buildup along fence sector C.',
    category: 'Safety',
    priority: 'Low',
    status: 'resolved',
    syncStatus: 'synced',
    latitude: 30.0612,
    longitude: 31.2599,
    locationName: 'Perimeter Fence Sector C',
    locationAccuracy: 5.0,
    reporterName: 'Omar F.',
    reporterId: 'USR-104',
    assignedTo: 'Ahmed K.',
    assignedTeam: 'Security & Access Control',
    resolutionNotes: 'Cleaned optical lens and recalibrated ambient threshold. Sensor operational.',
    resolvedBy: 'Ahmed K.',
    resolvedAt: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
    version: 4,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
    photoCount: 0,
  },
  {
    id: 'a71e8471-f92e-4bce-92c1-c918ef03d955',
    reportNumber: 'NP-8817',
    title: 'Emergency Generator Fuel Line Rust',
    description: 'Minor oxidation noticed on reserve diesel tank conduit. Safe for now, requires proactive replacement.',
    category: 'Maintenance',
    priority: 'Low',
    status: 'draft',
    syncStatus: 'pending',
    latitude: 30.0465,
    longitude: 31.2312,
    locationName: 'Base Camp Generator Shed',
    locationAccuracy: 2.8,
    reporterName: 'Sarah J.',
    reporterId: 'USR-882',
    version: 1,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    photoCount: 1,
  },
  {
    id: 'b62f7902-83de-4144-88cb-e380f2d9e166',
    reportNumber: 'NP-8816',
    title: 'Irrigation Zone 3 Sub-manifold Valve Seized',
    description: 'Manual cutoff valve stuck at 20% open. Crew could not actuate with standard hand-wheel tool.',
    category: 'Water',
    priority: 'High',
    status: 'rejected',
    syncStatus: 'synced',
    latitude: 30.0411,
    longitude: 31.2395,
    locationName: 'Zone 3 Farmland East',
    locationAccuracy: 3.5,
    reporterName: 'Karim B.',
    reporterId: 'USR-319',
    assignedTo: 'Ahmed K.',
    assignedTeam: 'Field Operations',
    resolutionNotes: 'Duplicate issue. Valve was already scheduled for replacement in work order NP-8799.',
    resolvedBy: 'Ahmed K.',
    resolvedAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    version: 2,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    photoCount: 0,
  }
];

export async function seedDatabaseIfEmpty(): Promise<void> {
  const count = await db.reports.count();
  if (count === 0) {
    await db.reports.bulkAdd(INITIAL_SAMPLE_REPORTS);
    // Seed initial activity logs for these
    const sampleLogs: ActivityLog[] = [
      {
        id: 'log-1',
        reportId: 'f47ac10b-58cc-4372-a567-0e02b2c3d471',
        action: 'status_change',
        actorName: 'Ahmed K.',
        description: 'Status advanced to In Progress',
        previousValue: 'assigned',
        newValue: 'in_progress',
        createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      },
      {
        id: 'log-2',
        reportId: 'f47ac10b-58cc-4372-a567-0e02b2c3d471',
        action: 'assigned',
        actorName: 'Ahmed K.',
        description: 'Assigned to Hydro Rapid Response Alpha',
        previousValue: 'Unassigned',
        newValue: 'Ahmed K.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      },
      {
        id: 'log-3',
        reportId: 'e1248092-23c1-4b11-a8cf-3cfa40a77844',
        action: 'resolved',
        actorName: 'Ahmed K.',
        description: 'Issue resolved: Cleaned optical lens and recalibrated threshold',
        previousValue: 'in_progress',
        newValue: 'resolved',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
      },
    ];
    await db.activityLog.bulkAdd(sampleLogs);
  }
}
