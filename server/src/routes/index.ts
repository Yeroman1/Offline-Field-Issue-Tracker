import { Router } from 'express';
import { healthRouter } from './health.routes';
import { reportRouter } from './report.routes';
import { syncRouter } from './sync.routes';
import { statsRouter } from './stats';
import { activityRouter } from './activity';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/reports', reportRouter);
apiRouter.use('/sync', syncRouter);
apiRouter.use('/stats', statsRouter);
apiRouter.use('/activity', activityRouter);

export { healthRouter, reportRouter, syncRouter, statsRouter, activityRouter };

