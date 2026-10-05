// MUST be first: patches Express so rejected promises from async
// route handlers reach the error middleware (otherwise requests hang)
import 'express-async-errors';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { logger } from './utils/logger';

// Routes
import authRoutes from './routes/auth.routes';
import companyRoutes from './routes/company.routes';
import userRoutes from './routes/user.routes';
import clientRoutes from './routes/client.routes';
import supplierRoutes from './routes/supplier.routes';
import serviceRoutes from './routes/service.routes';
import budgetRoutes from './routes/budget.routes';
import orderRoutes from './routes/order.routes';
import cashRoutes from './routes/cash.routes';
import expenseRoutes from './routes/expense.routes';
import dashboardRoutes from './routes/dashboard.routes';
import productRoutes from './routes/product.routes';
import saleRoutes from './routes/sale.routes';
import uploadRoutes from './routes/upload.routes';
import cepRoutes from './routes/cep.routes';
import reportRoutes from './routes/report.routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

// Rate limiting — strict brute-force protection on auth, generous elsewhere.
// Only enforced in production: a local/self-hosted instance (and its test
// suite) would otherwise lock the user out after a handful of attempts.
const isProd = config.nodeEnv === 'production';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 20 : 10_000,
  message: 'Muitas tentativas de acesso. Tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Normal API usage: dashboard fires ~15 requests per load
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 5000 : 100_000,
  message: 'Muitas requisições. Tente novamente mais tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/auth', authLimiter);
app.use('/api/', apiLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
const apiPrefix = '/api/v1';
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/companies`, companyRoutes);
app.use(`${apiPrefix}/users`, userRoutes);
app.use(`${apiPrefix}/clients`, clientRoutes);
app.use(`${apiPrefix}/suppliers`, supplierRoutes);
app.use(`${apiPrefix}/services`, serviceRoutes);
app.use(`${apiPrefix}/budgets`, budgetRoutes);
app.use(`${apiPrefix}/orders`, orderRoutes);
app.use(`${apiPrefix}/cash`, cashRoutes);
app.use(`${apiPrefix}/expenses`, expenseRoutes);
app.use(`${apiPrefix}/dashboard`, dashboardRoutes);
app.use(`${apiPrefix}/products`, productRoutes);
app.use(`${apiPrefix}/sales`, saleRoutes);
app.use(`${apiPrefix}/uploads`, uploadRoutes);
app.use(`${apiPrefix}/cep`, cepRoutes);
app.use(`${apiPrefix}/reports`, reportRoutes);

// Uploaded images (static, unguessable UUID filenames — see plan/risks)
app.use('/uploads', express.static(config.uploadsDir));

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
