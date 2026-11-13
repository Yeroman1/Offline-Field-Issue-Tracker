import { Request, Response, NextFunction } from 'express';
import { reportService } from '../services/report.service';
import { sendCreated, sendSuccess, sendPaginated } from '../utils/response.util';

export async function createReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = {
      ...req.body,
      reporterId: req.body.reporterId || req.actor?.id,
      reporterName: req.body.reporterName || req.actor?.fullName || req.actor?.name,
    };
    const result = await reportService.createReport(payload, req.body);
    sendCreated(res, result, 'Report created and synchronized successfully');
  } catch (error) {
    next(error);
  }
}

export async function getReports(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { reports, pagination } = await reportService.getReports(req.query as any);
    sendPaginated(res, reports, pagination, 'Reports retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function getReportById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const report = await reportService.getReportById(req.params.id);
    sendSuccess(res, report, 'Report retrieved successfully');
  } catch (error) {
    next(error);
  }
}

export async function updateReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = {
      ...req.body,
      actorId: req.actor?.id,
      actorName: req.actor?.name,
    };
    const updated = await reportService.updateReport(req.params.id, dto);
    sendSuccess(res, updated, 'Report updated successfully');
  } catch (error) {
    next(error);
  }
}

export async function transitionReportStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = {
      ...req.body,
      actorId: req.actor?.id || req.body.actorId,
      actorName: req.actor?.name || req.body.actorName,
    };
    const updated = await reportService.transitionReportStatus(req.params.id, dto);
    sendSuccess(res, updated, `Report status successfully transitioned to '${updated.status}'`);
  } catch (error) {
    next(error);
  }
}

export async function assignReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = {
      ...req.body,
      actorId: req.actor?.id || req.body.actorId,
      actorName: req.actor?.name || req.body.actorName,
    };
    const updated = await reportService.assignReport(req.params.id, dto);
    sendSuccess(res, updated, `Report successfully assigned to '${updated.assignedTo}'`);
  } catch (error) {
    next(error);
  }
}

