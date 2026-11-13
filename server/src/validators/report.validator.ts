import { z } from 'zod';
import { ReportCategory, ReportPriority, ReportStatus } from '../types';

const categoryValues = Object.values(ReportCategory) as [string, ...string[]];
const priorityValues = Object.values(ReportPriority) as [string, ...string[]];
const statusValues = Object.values(ReportStatus) as [string, ...string[]];

// Case-insensitive enum normalizer
const categoryEnum = z.string().transform((val) => val.toUpperCase().replace(/\s+/g, '_')).pipe(z.enum(categoryValues));
const priorityEnum = z.string().transform((val) => val.toUpperCase()).pipe(z.enum(priorityValues));
const statusEnum = z.string().transform((val) => val.toUpperCase()).pipe(z.enum(statusValues));

export const locationSchema = z.union([
  z.string(),
  z.object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    locationName: z.string().optional(),
    locationAccuracy: z.number().nonnegative().optional(),
    rawText: z.string().optional(),
  }),
]);

export const createReportSchema = z.object({
  clientReportId: z.string().uuid('clientReportId must be a valid UUIDv4'),
  title: z.string().min(3, 'Title must be at least 3 characters long').max(255),
  category: categoryEnum,
  description: z.string().min(5, 'Description must be at least 5 characters long'),
  location: locationSchema,
  priority: priorityEnum,
  reportedAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
  reporterId: z.string().uuid('reporterId must be a valid UUID'),
  reporterName: z.string().optional(),
  sourceDeviceId: z.string().min(1, 'sourceDeviceId is required'),
  idempotencyKey: z.string().min(1, 'idempotencyKey is required'),
  initialStatus: statusEnum.optional().default('SUBMITTED'),
});

export const updateReportSchema = z
  .object({
    title: z.string().min(3).max(255).optional(),
    description: z.string().min(5).optional(),
    category: categoryEnum.optional(),
    priority: priorityEnum.optional(),
    location: locationSchema.optional(),
    assignedTo: z.string().nullable().optional(),
    assignedTeam: z.string().nullable().optional(),
    resolutionNotes: z.string().nullable().optional(),
    resolvedBy: z.string().nullable().optional(),
    expectedVersion: z.number().int().positive('expectedVersion is required for optimistic concurrency'),
    actorId: z.string().optional(),
    actorName: z.string().optional(),
    // Explicitly reject prohibited protected fields
    id: z.never({ message: 'id cannot be updated' }).optional(),
    clientReportId: z.never({ message: 'clientReportId cannot be updated' }).optional(),
    reporterId: z.never({ message: 'reporterId cannot be updated' }).optional(),
    status: z.never({ message: 'Status cannot be updated via general update. Use PATCH /api/reports/:id/status' }).optional(),
    version: z.never({ message: 'version cannot be set directly. Provide expectedVersion' }).optional(),
    syncStatus: z.never({ message: 'syncStatus cannot be modified via report update' }).optional(),
  })
  .strict();

export const statusTransitionSchema = z.object({
  status: statusEnum,
  expectedVersion: z.number().int().positive('expectedVersion is required for optimistic concurrency'),
  note: z.string().optional(),
  actorId: z.string().optional(),
  actorName: z.string().optional(),
  assignedTo: z.string().nullable().optional(),
  assignedTeam: z.string().nullable().optional(),
  resolutionNotes: z.string().nullable().optional(),
  resolvedBy: z.string().nullable().optional(),
});

export const assignReportSchema = z.object({
  assignedTo: z.string().min(1, 'assignedTo is required'),
  assignedTeam: z.string().optional(),
  expectedVersion: z.number().int().positive('expectedVersion is required for optimistic concurrency'),
  note: z.string().optional(),
  actorId: z.string().optional(),
  actorName: z.string().optional(),
});

export const getReportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.string().optional(),
  syncStatus: z.string().optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
  reporter: z.string().optional(),
  assignee: z.string().optional(),
  since: z.string().optional(),
  sortBy: z.enum(['createdAt', 'reportedAt', 'priority', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const syncFailureSchema = z.object({
  errorMessage: z.string().min(1, 'errorMessage is required').max(1000),
  actorId: z.string().optional(),
  sourceDeviceId: z.string().optional(),
});

