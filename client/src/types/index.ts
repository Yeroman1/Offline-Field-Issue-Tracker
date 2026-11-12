export type ReportCategory = 'Water' | 'Equipment' | 'Infrastructure' | 'Safety' | 'Maintenance';

export type ReportPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type ReportStatus = 'draft' | 'submitted' | 'assigned' | 'in_progress' | 'resolved' | 'rejected';

export type SyncStatus = 'synced' | 'pending' | 'failed';

export interface Report {
  id: string;
  reportNumber: string;
  title: string;
  description: string;
  category: ReportCategory;
  priority: ReportPriority;
  status: ReportStatus;
  syncStatus: SyncStatus;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAccuracy?: number;
  reporterName: string;
  reporterId: string;
  assignedTo?: string;
  assignedTeam?: string;
  resolutionNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  photoUrl?: string;
  photoCount?: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type OutboxAction = 'create' | 'update';
export type OutboxStatus = 'pending' | 'syncing' | 'failed';

export interface OutboxItem {
  id: string;
  reportId: string;
  action: OutboxAction;
  payload: string; // JSON string of Report or update fields
  status: OutboxStatus;
  attempts: number;
  lastAttemptAt?: string | null;
  nextAttemptAt?: string | null;
  error?: string | null;
  errorType?: 'transient' | 'validation' | 'conflict' | null;
  createdAt: string;
  idempotencyKey: string;
}

export interface ActivityLog {
  id: string;
  reportId: string;
  action: string;
  actorName: string;
  description: string;
  previousValue?: string | null;
  newValue?: string | null;
  createdAt: string;
}

export type UserRole = 'worker' | 'coordinator';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  team: string;
}

export interface SyncBatchItem {
  idempotencyKey: string;
  action: OutboxAction;
  data: Partial<Report> & { id: string; version?: number };
}

export interface SyncResponseItem {
  idempotencyKey: string;
  reportId: string;
  reportNumber?: string;
  version: number;
  status: 'synced' | 'conflict' | 'failed';
  message?: string;
}

export interface SyncApiResponse {
  processed: number;
  results: SyncResponseItem[];
}
