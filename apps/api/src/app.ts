import express, { Express } from 'express';
import cors from 'cors';
import { env } from './config/index.js';
import { apiRouter } from './routes/index.js';
import { requestLogger, notFoundHandler, errorHandler, securityHeaders, apiLimiter } from './middleware/index.js';

export function createApp(): Express {
  const app = express();

  // Security Headers (Helmet-equivalent protection)
  app.use(securityHeaders());

  // Configure CORS
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use(requestLogger);

  // Apply general API rate limiter
  app.use('/api', apiLimiter);

  // Mount API router under /api
  app.use('/api', apiRouter);

  // Root fallback
  app.get('/', (_req, res) => {
    res.json({
      name: 'telegram-forwarder-api',
      version: '0.1.0',
      status: 'running',
      health: '/api/health',
    });
  });

  // 404 Not Found handler
  app.use(notFoundHandler);

  // Global Error handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
