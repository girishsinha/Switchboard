import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { config } from '../config.js';
import { handleInbound } from '../services/inbound.js';
import { handleStatus } from '../services/inboundStatus.js';

const router = Router();

function isKnownWorkspace(workspace: unknown): workspace is string {
  return typeof workspace === 'string'
    && Object.prototype.hasOwnProperty.call(config.pigeon.apiKeys, workspace);
}

function validSignature(rawBody: Buffer, header: unknown): boolean {
  if (typeof header !== 'string') return false;
  const parts = header.split(',');
  const timestampPart = parts.find((part) => /^t=\d+$/.test(part));
  const signaturePart = parts.find((part) => /^v1=[\da-f]{64}$/i.test(part));
  if (!timestampPart || !signaturePart) return false;

  const timestamp = timestampPart.slice(2);
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Date.now() / 1000 - seconds > 300) return false;

  const signature = createHmac('sha256', config.pigeon.webhookSecret)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest();
  const provided = Buffer.from(signaturePart.slice(3), 'hex');
  return provided.length === signature.length && timingSafeEqual(provided, signature);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  if (!validSignature(rawBody, req.header('x-pigeon-signature'))) {
    res.status(401).json({ error: 'invalid webhook signature' });
    return;
  }

  let event: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody.toString('utf8'));
    if (!isRecord(parsed)) throw new SyntaxError('Webhook body must be an object');
    event = parsed;
  } catch {
    res.status(400).json({ error: 'invalid json' });
    return;
  }

  if (!isKnownWorkspace(event.workspace) || typeof event.type !== 'string') {
    res.status(200).json({ ok: true });
    return;
  }
  if (event.type !== 'message.inbound' && event.type !== 'message.status') {
    res.status(200).json({ ok: true });
    return;
  }
  if (!isRecord(event.data)) {
    res.status(400).json({ error: 'invalid event data' });
    return;
  }

  try {
    if (event.type === 'message.inbound') {
      const { message_id: messageId, from: contact, text } = event.data;
      const occurredAt = event.occurred_at;
      if (
        typeof messageId !== 'string' || !messageId
        || typeof contact !== 'string' || !contact
        || typeof text !== 'string'
        || typeof occurredAt !== 'string'
        || !Number.isFinite(Date.parse(occurredAt))
      ) {
        res.status(400).json({ error: 'invalid inbound event' });
        return;
      }

      await handleInbound({
        workspace: event.workspace,
        occurred_at: occurredAt,
        data: { message_id: messageId, from: contact, text },
      });
    } else {
      const { client_ref: clientRef, status } = event.data;
      if (typeof clientRef !== 'string' || !clientRef || typeof status !== 'string') {
        res.status(400).json({ error: 'invalid status event' });
        return;
      }

      await handleStatus({
        workspace: event.workspace,
        data: { client_ref: clientRef, status },
      });
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
