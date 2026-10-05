import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn(`Operational error: ${err.message}`, {
      statusCode: err.statusCode,
      stack: err.stack,
    });

    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  logger.error('Unexpected error:', {
    message: err.message,
    stack: err.stack,
  });

  return res.status(500).json({
    status: 'error',
    message: 'Erro interno do servidor',
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: `Rota ${req.method} ${req.originalUrl} não encontrada`,
  });
};
