import { beforeAll } from 'vitest';

// Ensure the test DB env wins over anything dotenv loads later
process.env.DATABASE_URL = 'file:./test.db';
process.env.NODE_ENV = 'test';

// Silence request logging noise during tests
process.env.LOG_LEVEL = 'silent';

beforeAll(() => {
  // Nothing global yet — kept for future matchers/mocks
});
