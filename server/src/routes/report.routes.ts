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
reportRouter.get('/', validate(getReportsQuerySchema, 'query'), getReports);

// POST /api/reports - Create new report with strict idempotency & audit logging
reportRouter.post('/', writeLimiter, validate(createReportSchema, 'body'), createReport);

// GET /api/reports/:id - Fetch single report with audit history and sync metadata
reportRouter.get('/:id', getReportById);

// PATCH /api/reports/:id - Update permitted fields with optimistic concurrency
reportRouter.patch('/:id', writeLimiter, validate(updateReportSchema, 'body'), updateReport);

// PATCH /api/reports/:id/status - State machine validated status transition
reportRouter.patch('/:id/status', writeLimiter, validate(statusTransitionSchema, 'body'), transitionReportStatus);

// PATCH /api/reports/:id/assign - Assign report to technician/crew
reportRouter.patch('/:id/assign', writeLimiter, validate(assignReportSchema, 'body'), assignReport);

// POST /api/reports/:id/sync/acknowledge - Acknowledge client synchronization
reportRouter.post('/:id/sync/acknowledge', writeLimiter, acknowledgeSync);

// POST /api/reports/:id/sync/failure - Record sync failure diagnostics
reportRouter.post('/:id/sync/failure', writeLimiter, validate(syncFailureSchema, 'body'), recordSyncFailure);

