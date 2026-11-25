import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';

export function graderAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.header('x-grader-token');
  const actual = Buffer.from(token ?? '');
  const expected = Buffer.from(config.graderToken);

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    res.status(401).json({ error: 'invalid grader token' });
    return;
  }
  next();
}
