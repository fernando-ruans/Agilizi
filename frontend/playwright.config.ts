import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Starts both apps unless they're already running (they usually are during dev).
  // Note: no __dirname here — package.json is "type": "module" so it is undefined.
  webServer: [
    {
      command: 'npm run dev --prefix ../backend',
      url: 'http://localhost:3333/health',
      reuseExistingServer: true,
      timeout: 90_000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 90_000,
    },
  ],
});
