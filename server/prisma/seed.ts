import { prisma } from '../src/config/database';
import { seedDatabase } from '../src/lib/seedData';

export { seedDatabase };

if (require.main === module) {
  seedDatabase()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
