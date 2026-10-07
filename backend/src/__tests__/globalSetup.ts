import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// vitest runs from the backend root; avoid import.meta (tsconfig is commonjs)
const backendRoot = process.cwd();
const testDbPath = path.join(backendRoot, 'prisma', 'test.db');

export default async function setup() {
  const env = {
    ...process.env,
    DATABASE_URL: 'file:./test.db',
    NODE_ENV: 'test',
  };

  // Fresh schema for every run
  fs.rmSync(testDbPath, { force: true });
  fs.rmSync(`${testDbPath}-journal`, { force: true });

  try {
    execSync('npx prisma db push --skip-generate', {
      cwd: backendRoot,
      env,
      stdio: 'inherit',
    });
  } catch {
    // The Prisma schema engine binary can fail on some machines with an
    // empty error — fall back to applying the migration SQL directly
    // through the query engine (which works fine there).
    console.log('⚠️ prisma db push failed, applying migrations SQL directly...');
    await applyMigrationsDirectly();
  }

  console.log('✅ Test database schema created (prisma/test.db)');
}

async function applyMigrationsDirectly() {
  process.env.DATABASE_URL = 'file:./test.db';
  const prisma = new PrismaClient();
  const migDir = path.join(backendRoot, 'prisma', 'migrations');
  await prisma.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS "_prisma_migrations" ("id" TEXT PRIMARY KEY NOT NULL, "checksum" TEXT NOT NULL, "finished_at" DATETIME, "migration_name" TEXT NOT NULL, "logs" TEXT, "rolled_back_at" DATETIME, "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "applied_steps_count" INTEGER NOT NULL DEFAULT 0)'
  );
  const dirs = fs.readdirSync(migDir).filter((d) => d !== 'migration_lock.toml').sort();
  for (const d of dirs) {
    const sql = fs.readFileSync(path.join(migDir, d, 'migration.sql'), 'utf8');
    const statements = sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await prisma.$executeRawUnsafe(stmt);
    }
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await prisma.$executeRawUnsafe(
      "INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, applied_steps_count, finished_at) VALUES ('" + id + "', 'direct', '" + d + "', CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP)"
    );
  }
  await prisma.$disconnect();
}

export function teardown() {
  // Keep the file around for debugging failed runs; wiped on next setup
}
