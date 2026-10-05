import { PrismaClient } from '@prisma/client';

// Query logs flood dev output (backfill emits dozens per boot) — opt-in via DEBUG_PRISMA=true.
const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'development'
      ? process.env.DEBUG_PRISMA === 'true'
        ? ['query', 'error', 'warn']
        : ['error', 'warn']
      : ['error'],
});

export default prisma;
