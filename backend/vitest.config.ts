import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each run gets its own throwaway SQLite file (created by globalSetup)
    env: {
      DATABASE_URL: 'file:./test.db',
      NODE_ENV: 'test',
    },
    globalSetup: ['./src/__tests__/globalSetup.ts'],
    setupFiles: ['./src/__tests__/setup.ts'],
    environment: 'node',
    // SQLite file DB — avoid two workers hitting the same file
    fileParallelism: false,
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
