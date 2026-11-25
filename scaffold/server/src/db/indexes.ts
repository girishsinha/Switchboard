import { getDb } from '../db.js';

export async function ensureIndexes(): Promise<void> {
  const db = await getDb();

  await Promise.all([
    db.collection('messages').createIndex(
      { workspace: 1, messageId: 1 },
      { unique: true },
    ),
    db.collection('messages').createIndex(
      { workspace: 1, contact: 1, occurredAt: 1, messageId: 1 },
    ),
    db.collection('conversations').createIndex(
      { workspace: 1, contact: 1 },
      { unique: true },
    ),
    db.collection('outbound').createIndex(
      { workspace: 1, clientRef: 1 },
      { unique: true },
    ),
    db.collection('events').createIndex(
      { workspace: 1, seq: 1 },
      { unique: true },
    ),
    db.collection('events').createIndex(
      { workspace: 1, dedupeKey: 1 },
      { unique: true },
    ),
    db.collection('counters').createIndex(
      { workspace: 1 },
      { unique: true },
    ),
  ]);
}
