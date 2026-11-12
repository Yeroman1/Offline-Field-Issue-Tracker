import { PrismaClient } from '@prisma/client';
import { env } from './env';

declare global {
  // Prevent multiple instances of Prisma Client in development
  var __prismaInstance: PrismaClient | undefined;
}

export const prisma =
  global.__prismaInstance ||
  new PrismaClient({
    log: env.IS_PRODUCTION ? ['error'] : ['error', 'warn'],
  });

if (!env.IS_PRODUCTION) {
  global.__prismaInstance = prisma;
}

/**
 * Checks database connectivity safely without exposing credentials or throwing fatal errors.
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    return false;
  }
}

