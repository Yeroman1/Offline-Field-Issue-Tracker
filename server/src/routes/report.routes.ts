import { Router } from 'express';
import {
  createReport,
  getReports,
  getReportById,
  updateReport,
  transitionReportStatus,
  assignReport,
} from '../controllers/report.controller';
import {
  acknowledgeSync,
  recordSyncFailure,
} from '../controllers/sync.controller';
import { validate } from '../middleware/validate.middleware';
import { writeLimiter } from '../middleware/rateLimiter.middleware';
import { requireRole } from '../middleware/auth.middleware';
import {
  createReportSchema,
  updateReportSchema,
  statusTransitionSchema,
  assignReportSchema,
  getReportsQuerySchema,
  syncFailureSchema,
} from '../validators/report.validator';

export const reportRouter = Router();

// GET /api/reports - Paginated listing with filtering, search, and sorting
reportRouter.get('/', requireRole(['FIELD_WORKER', 'COORDINATOR']), validate(getReportsQuerySchema, 'query'), getReports);

// POST /api/reports - Create new report with strict idempotency & audit logging
reportRouter.post('/', writeLimiter, requireRole(['FIELD_WORKER', 'COORDINATOR']), validate(createReportSchema, 'body'), createReport);

// GET /api/reports/:id - Fetch single report with audit history and sync metadata
reportRouter.get('/:id', requireRole(['FIELD_WORKER', 'COORDINATOR']), getReportById);

// PATCH /api/reports/:id - Update permitted fields with optimistic concurrency
reportRouter.patch('/:id', writeLimiter, requireRole(['FIELD_WORKER', 'COORDINATOR']), validate(updateReportSchema, 'body'), updateReport);

// PATCH /api/reports/:id/status - State machine validated status transition
reportRouter.patch('/:id/status', writeLimiter, requireRole(['FIELD_WORKER', 'COORDINATOR']), validate(statusTransitionSchema, 'body'), transitionReportStatus);

// PATCH /api/reports/:id/assign - Assign report to technician/crew (Coordinator only)
reportRouter.patch('/:id/assign', writeLimiter, requireRole(['COORDINATOR']), validate(assignReportSchema, 'body'), assignReport);

// POST /api/reports/:id/sync/acknowledge - Acknowledge client synchronization
reportRouter.post('/:id/sync/acknowledge', writeLimiter, requireRole(['FIELD_WORKER', 'COORDINATOR']), acknowledgeSync);

// POST /api/reports/:id/sync/failure - Record sync failure diagnostics
reportRouter.post('/:id/sync/failure', writeLimiter, requireRole(['FIELD_WORKER', 'COORDINATOR']), validate(syncFailureSchema, 'body'), recordSyncFailure);

