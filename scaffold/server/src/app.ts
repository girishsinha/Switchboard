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
    res.status(500).json({ error: 'internal server error', detail: String(error) });
  });

  return app;
}
