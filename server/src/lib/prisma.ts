import { PrismaClient } from '@prisma/client';
import { env, isProduction } from '../config/env.js';

declare global {
  var __prisma__: PrismaClient | undefined;
}

export const prisma = globalThis.__prisma__ ?? new PrismaClient();

if (!isProduction) {
  globalThis.__prisma__ = prisma;
}

async function configureDatabase() {
  await prisma.$connect();

  if (!isProduction || !env.DATABASE_URL.startsWith('file:')) {
    return;
  }

  // Keep SQLite responsive for the single-server production deployment.
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL');
  await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL');
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000');
}

export const databaseReady = configureDatabase();
