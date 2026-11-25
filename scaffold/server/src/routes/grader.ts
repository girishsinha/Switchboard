import { Router } from 'express';
import { config } from '../config.js';
import { graderAuth } from '../middleware/graderAuth.js';
import { resetAllData } from '../services/admin.js';
import { buildSnapshot } from '../services/snapshot.js';
import { acceptReply } from '../services/outbound.js';
import { claimConversation } from '../services/conversations.js';

const router = Router();
router.use('/__grader', graderAuth);

router.post('/__grader/reset', async (_req, res, next) => {
  try {
    await resetAllData();
    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/__grader/snapshot', async (_req, res, next) => {
  try {
    res.status(200).json(await buildSnapshot());
  } catch (error) {
    next(error);
  }
});

router.post('/__grader/reply', async (req, res, next) => {
  const { workspace, contact, text, client_ref: clientRef } = req.body as Record<string, unknown>;
  if (
    typeof workspace !== 'string' || workspace.length === 0
    || typeof contact !== 'string' || contact.length === 0
    || typeof text !== 'string'
    || typeof clientRef !== 'string' || clientRef.length === 0
  ) {
    res.status(400).json({ error: 'invalid reply' });
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(config.pigeon.apiKeys, workspace)) {
    res.status(404).json({ error: 'unknown workspace' });
    return;
  }

  try {
    await acceptReply({ workspace, contact, text, clientRef });
    res.status(202).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post('/__grader/claim', async (req, res, next) => {
  const { workspace, contact, agent } = req.body as Record<string, unknown>;
  if (
    typeof workspace !== 'string' || workspace.length === 0
    || typeof contact !== 'string' || contact.length === 0
    || typeof agent !== 'string' || agent.length === 0
  ) {
    res.status(400).json({ error: 'invalid claim' });
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(config.pigeon.apiKeys, workspace)) {
    res.status(404).json({ error: 'unknown workspace' });
    return;
  }

  try {
    const won = await claimConversation({ workspace, contact, agent });
    res.status(won ? 200 : 409).json({ assignee: won ? agent : null });
  } catch (error) {
    next(error);
  }
});

export default router;
