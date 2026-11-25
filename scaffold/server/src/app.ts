import express, { type NextFunction, type Request, type Response } from 'express';
import healthRouter from './routes/health.js';
import graderRouter from './routes/grader.js';
import pigeonRouter from './routes/pigeon.js';

export function createApp(): express.Express {
  const app = express();

  app.use('/webhooks/pigeon', express.raw({ type: '*/*', limit: '1mb' }), pigeonRouter);
  app.use(express.json());
  app.use(healthRouter);
  app.use(graderRouter);

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = isClientError(error) ? error.status : 500;
    res.status(status).json({ error: status === 500 ? 'internal server error' : 'invalid request' });
  });

  return app;
}

function isClientError(error: unknown): error is { status: number } {
  if (error === null || typeof error !== 'object' || !('status' in error)) return false;
  const status = error.status;
  return typeof status === 'number' && status >= 400 && status < 500;
}
