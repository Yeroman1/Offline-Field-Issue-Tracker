import app from './app';
import { prisma } from './config/database';
import { env } from './config/env';

const PORT = env.PORT || 3001;

async function start() {
  try {
    const count = await prisma.report.count();
    console.log(`Connected to database. Current operational reports count: ${count}`);

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 NilePixel Field Tracker API running on http://0.0.0.0:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    });

    const shutdown = async () => {
      console.log('Shutting down server...');
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module || !process.env.VITEST) {
  start();
}

export { app };
