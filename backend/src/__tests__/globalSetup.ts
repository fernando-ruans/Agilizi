import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// vitest runs from the backend root; avoid import.meta (tsconfig is commonjs)
const backendRoot = process.cwd();
const testDbPath = path.join(backendRoot, 'prisma', 'test.db');

export default function setup() {
  const env = {
    ...process.env,
    DATABASE_URL: 'file:./test.db',
    NODE_ENV: 'test',
  };

  // Fresh schema for every run
  fs.rmSync(testDbPath, { force: true });
  fs.rmSync(`${testDbPath}-journal`, { force: true });

  execSync('npx prisma db push --skip-generate', {
    cwd: backendRoot,
    env,
    stdio: 'inherit',
  });

  console.log('✅ Test database schema created (prisma/test.db)');
}

export function teardown() {
  // Keep the file around for debugging failed runs; wiped on next setup
}
