import { Router } from 'express';
import { getDb } from '../db.js';
import { getRedis } from '../redis.js';

const router = Router();

router.get('/healthz', async (_req, res) => {
  try {
    await getDb().then((db) => db.admin().ping());
    const redis = getRedis();
    if (redis.status !== 'ready') {
      res.status(503).json({ ok: false });
      return;
    }
    await redis.ping();
    res.status(200).json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

export default router;
