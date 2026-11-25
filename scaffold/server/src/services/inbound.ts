import { MongoServerError } from 'mongodb';
import { getDb } from '../db.js';
import { appendEvent } from './events.js';

export interface InboundEvent {
  workspace: string;
  occurred_at: string;
  data: {
    message_id: string;
    from: string;
    text: string;
  };
}

export async function handleInbound(event: InboundEvent): Promise<void> {
  const { workspace, occurred_at: occurredAtRaw, data } = event;
  const { message_id: messageId, from: contact, text } = data;
  const occurredAt = new Date(occurredAtRaw);
  if (!Number.isFinite(occurredAt.getTime())) {
    throw new TypeError('Invalid inbound occurred_at');
  }

  const db = await getDb();
  try {
    await db.collection('messages').insertOne({
      workspace,
      messageId,
      contact,
      text,
      occurredAt,
    });
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
  }

  const conversations = db.collection('conversations');
  try {
    await conversations.updateOne(
      { workspace, contact },
      {
        $setOnInsert: { workspace, contact, assignee: null },
        $max: { lastActivity: occurredAt },
      },
      { upsert: true },
    );
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
    await conversations.updateOne(
      { workspace, contact },
      { $max: { lastActivity: occurredAt } },
    );
  }

  await appendEvent(workspace, `message.inbound:${messageId}`, {
    type: 'message.inbound',
    contact,
    message_id: messageId,
  });
}
