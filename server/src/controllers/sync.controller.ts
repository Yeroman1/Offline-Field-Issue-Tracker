import { Request, Response, NextFunction } from 'express';
import { syncService } from '../services/sync.service';
import { sendSuccess } from '../utils/response.util';

export async function acknowledgeSync(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actorId = req.actor?.id || req.body.actorId;
    const result = await syncService.acknowledgeSync(req.params.id, actorId);
    sendSuccess(res, result, 'Report sync successfully acknowledged');
  } catch (error) {
    next(error);
  }
}

export async function recordSyncFailure(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = {
      errorMessage: req.body.errorMessage,
      actorId: req.actor?.id || req.body.actorId,
      sourceDeviceId: req.body.sourceDeviceId || req.actor?.deviceId,
    };
    const result = await syncService.recordSyncFailure(req.params.id, dto);
    sendSuccess(res, result, 'Sync failure details recorded');
  } catch (error) {
    next(error);
  }
}

export async function processBatchSync(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawItems = Array.isArray(req.body)
      ? req.body
      : Array.isArray(req.body?.items)
      ? req.body.items
      : [];

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid sync payload. Expected array of sync items or object with items property.',
        error: { code: 'INVALID_BATCH_PAYLOAD' },
      });
      return;
    }

    const results = await syncService.processBatchSync(rawItems);
    res.status(200).json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    next(error);
  }
}

