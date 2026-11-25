import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { getDb } from '../db.js';

const router = Router();

function isKnownWorkspace(workspace: unknown): workspace is string {
  return typeof workspace === 'string'
    && Object.prototype.hasOwnProperty.call(config.pigeon.apiKeys, workspace);
}

function validSignature(rawBody: Buffer, header: unknown): boolean {
  if (typeof header !== 'string') return false;
  const timestampPart = header.split(',').find((part) => part.startsWith('t='));
  const signaturePart = header.split(',').find((part) => part.startsWith('v1='));
  if (!timestampPart || !signaturePart) return false;

  const timestamp = timestampPart.slice(2);
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return false;

  const signature = createHmac('sha256', config.pigeon.webhookSecret)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest();
  const provided = Buffer.from(signaturePart.slice(3), 'hex');
  return provided.length === signature.length && timingSafeEqual(provided, signature);
}

router.post('/', (req, res, next) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  if (!validSignature(rawBody, req.header('x-pigeon-signature'))) {
    res.status(401).json({ error: 'invalid webhook signature' });
    return;
  }

  let event: {
    id?: unknown;
    type?: unknown;
    workspace?: unknown;
    occurred_at?: unknown;
    data?: Record<string, unknown>;
  };
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    res.status(400).json({ error: 'invalid json' });
    return;
  }

  if (!isKnownWorkspace(event.workspace) || typeof event.type !== 'string') {
    res.status(200).json({ ok: true });
    return;
  }

  void getDb()
    .then(async (db) => {
      const eventId = String(event.id ?? '');
      const events = db.collection('webhook_events');
      if (eventId) {
        const inserted = await events.updateOne(
          { eventId },
          { $setOnInsert: { eventId, workspace: event.workspace, receivedAt: new Date() } },
          { upsert: true },
        );
        if (inserted.upsertedCount === 0) {
          res.status(200).json({ ok: true });
          return;
        }
      }

      if (event.type === 'message.inbound') {
        const data = event.data ?? {};
        const messageId = String(data.message_id ?? '');
        const contact = String(data.from ?? '');
        if (messageId && contact) {
          await db.collection('conversations').updateOne(
            { workspace: event.workspace, contact },
            { $setOnInsert: { workspace: event.workspace, contact, assignee: null } },
            { upsert: true },
          );
          await db.collection('inbound').updateOne(
            { workspace: event.workspace, messageId },
            { $setOnInsert: {
              workspace: event.workspace,
              contact,
              messageId,
              occurredAt: String(event.occurred_at ?? new Date().toISOString()),
            } },
            { upsert: true },
          );
        }
      } else if (event.type === 'message.status') {
        const data = event.data ?? {};
        const clientRef = String(data.client_ref ?? '');
        const status = String(data.status ?? '');
        if (clientRef && ['queued', 'sent', 'delivered', 'failed'].includes(status)) {
          await db.collection('outbound').updateOne(
            { workspace: event.workspace, clientRef },
            { $set: { status } },
          );
        }
      }
      res.status(200).json({ ok: true });
    })
    .catch(next);
});

export default router;
