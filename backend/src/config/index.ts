import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3333', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  uploadsDir: process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads'),
  // Assistente de IA (estilo Kilo Code auto/free). Cadeia ordenada
  // "provedor:modelo,provedor:modelo" — o primeiro disponível responde.
  aiBotEnabled: process.env.AI_BOT_ENABLED !== 'false',
  aiChain: (process.env.AI_CHAIN || 'gemini:gemini-2.0-flash').split(',').map((s) => s.trim()).filter(Boolean),
  aiTimeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '45000', 10),
  aiMaxContextItems: parseInt(process.env.AI_MAX_CONTEXT_ITEMS || '50', 10),
  aiDailyCap: parseInt(process.env.AI_DAILY_CAP || '100', 10),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  kiloApiKey: process.env.KILO_API_KEY || '',
  kiloApiUrl: process.env.KILO_API_URL || 'https://api.kilo.ai/api/gateway',
};
