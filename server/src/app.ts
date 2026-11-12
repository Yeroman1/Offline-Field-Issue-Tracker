import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health';
import { reportsRouter } from './routes/reports';
import { syncRouter } from './routes/sync';
import { statsRouter } from './routes/stats';
import { activityRouter } from './routes/activity';

dotenv.config();

export const app = express();

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Mount routes under /api
app.use('/api/health', healthRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/sync', syncRouter);
app.use('/api/stats', statsRouter);
app.use('/api/activity', activityRouter);

// Fallback 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.baseUrl}` });
});

export default app;

