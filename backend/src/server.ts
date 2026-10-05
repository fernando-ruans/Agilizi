import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { backfillCashSync } from './services/cashSync';

const startServer = async () => {
  try {
    // Test database connection
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
    await prisma.$disconnect();
  } catch (error) {
    logger.error('❌ Failed to connect to database:', error);
    process.exit(1);
  }

  // Repair records created before cash centralization (idempotent)
  try {
    const result = await backfillCashSync();
    logger.info('🔁 Cash sync backfill complete', result as any);
  } catch (error) {
    logger.error('Cash sync backfill failed (server continues):', error);
  }

  app.listen(config.port, () => {
    logger.info(`🚀 Server running on port ${config.port}`);
    logger.info(`📊 Environment: ${config.nodeEnv}`);
    logger.info(`🔗 API: http://localhost:${config.port}/api/v1`);
    logger.info(`❤️  Health: http://localhost:${config.port}/health`);
  });
};

startServer();
