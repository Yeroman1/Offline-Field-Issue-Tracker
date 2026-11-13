// NilePixel Offline Field Issue Tracker — Domain & API Types

export enum ReportCategory {
  BROKEN_WATER = 'BROKEN_WATER',
  DAMAGED_EQUIPMENT = 'DAMAGED_EQUIPMENT',
  SERVICE_INTERRUPTION = 'SERVICE_INTERRUPTION',
  SAFETY_CONCERN = 'SAFETY_CONCERN',
  MAINTENANCE_REQUIRED = 'MAINTENANCE_REQUIRED',
}

export enum ReportPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ReportStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

export enum SyncStatus {
  PENDING = 'PENDING',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, any>;
  error?: {
    code: string;
    details?: any;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface LocationPayload {
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAccuracy?: number;
  rawText?: string;
}

export interface CreateReportDTO {
  clientReportId: string;
  title: string;
  category: ReportCategory | string;
  description: string;
  location: string | LocationPayload;
  priority: ReportPriority | string;
  reportedAt: string;
  reporterId: string;
  reporterName?: string;
  sourceDeviceId: string;
  idempotencyKey: string;
  initialStatus?: ReportStatus | string;
}

export interface UpdateReportDTO {
  title?: string;
  description?: string;
  category?: ReportCategory | string;
  priority?: ReportPriority | string;
  location?: string | LocationPayload;
  assignedTo?: string | null;
  assignedTeam?: string | null;
  resolutionNotes?: string | null;
  resolvedBy?: string | null;
  expectedVersion: number;
  actorId?: string;
  actorName?: string;
}

export interface StatusTransitionDTO {
  status: ReportStatus | string;
  expectedVersion: number;
  note?: string;
  actorId?: string;
  actorName?: string;
  assignedTo?: string | null;
  assignedTeam?: string | null;
  resolutionNotes?: string | null;
  resolvedBy?: string | null;
}

export interface SyncFailureDTO {
  errorMessage: string;
  actorId?: string;
  sourceDeviceId?: string;
}

export interface AuthenticatedActor {
  id: string;
  role: 'FIELD_WORKER' | 'COORDINATOR' | 'ADMIN' | 'SIMULATED';
  deviceId?: string;
  name?: string;
  isSimulated: boolean;
}

