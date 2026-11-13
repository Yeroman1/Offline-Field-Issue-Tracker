import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { healthRouter } from './routes/health.routes';
import { reportRouter } from './routes/report.routes';
import { syncRouter } from './routes/sync.routes';
import { statsRouter } from './routes/stats';
import { activityRouter } from './routes/activity';
import { identifyActor } from './middleware/auth.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';
import { generalLimiter } from './middleware/rateLimiter.middleware';

export const app = express();

// 1. Cross-Origin Resource Sharing (CORS)
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: true,
  })
);

// 2. Body Parser with payload size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. Security & Actor Identification Context (Simulated Actor Middleware)
app.use(identifyActor);

// 4. Global API Rate Limiting
app.use('/api', generalLimiter);

// 5. Mount API Endpoints
app.use('/api/health', healthRouter);
app.use('/api/reports', reportRouter);
app.use('/api/sync', syncRouter);
app.use('/api/stats', statsRouter);
app.use('/api/activity', activityRouter);

// 6. Fallback 404 Handler for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint not found: ${req.method} ${req.baseUrl}`,
    error: {
      code: 'ROUTE_NOT_FOUND',
    },
  });
});

// 7. Centralized Error Handling Middleware (must be registered after routes)
app.use(errorHandler);

export default app;
