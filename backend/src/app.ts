import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';
import type { AppConfig } from './config.js';
import type { Database } from './db.js';
import { requireAuth } from './lib/auth.js';
import { HttpError, notFound } from './lib/errors.js';
import { createTaskRepository } from './repositories/tasks.js';
import { createUserRepository } from './repositories/users.js';
import { authRouter } from './routes/auth.js';
import { tasksRouter } from './routes/tasks.js';

export function createApp(db: Database, config: AppConfig) {
  const app = express();
  const users = createUserRepository(db);
  const tasks = createTaskRepository(db);

  app.disable('x-powered-by');
  app.use(helmet());
  if (config.corsOrigins.length > 0) {
    app.use(cors({ origin: config.corsOrigins }));
  }
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ status: 'ok', database: 'ok', uptimeSeconds: Math.round(process.uptime()) });
    } catch {
      res.status(503).json({ status: 'error', database: 'unavailable' });
    }
  });

  app.use('/api/auth', authRouter(users, config));
  app.use('/api/tasks', requireAuth(config.jwtSecret, users), tasksRouter(tasks));

  app.use('/api', () => {
    throw notFound('Endpoint not found');
  });

  app.use(errorHandler(config));
  return app;
}

function errorHandler(config: AppConfig): ErrorRequestHandler {
  return (error, _req, res, _next) => {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message ?? 'Invalid request',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
      return;
    }

    if (error instanceof HttpError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }

    // body-parser errors (malformed JSON, payload too large) carry an HTTP status
    if (typeof error?.status === 'number' && error.status >= 400 && error.status < 500) {
      res.status(error.status).json({
        error: {
          code: error.type === 'entity.parse.failed' ? 'INVALID_JSON' : 'BAD_REQUEST',
          message: error.type === 'entity.parse.failed' ? 'Malformed JSON body' : error.message,
        },
      });
      return;
    }

    console.error(error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: config.isProduction ? 'Internal server error' : String(error?.message ?? error),
      },
    });
  };
}
