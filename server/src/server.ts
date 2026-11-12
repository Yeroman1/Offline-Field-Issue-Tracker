import app from './app';
import prisma from './lib/prisma';
import { seedDatabase } from './lib/seedData';

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    // Check if database needs seeding
    const count = await prisma.report.count();
    if (count === 0) {
      console.log('Database empty on startup. Running initial seed...');
      await seedDatabase();
    } else {
      console.log(`Database already populated with ${count} reports.`);
    }

    const server = app.listen(PORT, () => {
      console.log(`🚀 NilePixel Field Tracker API running on http://localhost:${PORT}`);
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

