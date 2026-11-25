import { MongoServerError } from 'mongodb';
import { getDb } from '../db.js';
import { getRedis } from '../redis.js';

export interface EventFrame {
  type: string;
  [key: string]: unknown;
}

export async function nextSeq(workspace: string): Promise<number> {
  const db = await getDb();
  let counter;
  try {
    counter = await db.collection('counters').findOneAndUpdate(
      { workspace },
      { $setOnInsert: { workspace }, $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
    counter = await db.collection('counters').findOneAndUpdate(
      { workspace },
      { $inc: { seq: 1 } },
      { returnDocument: 'after' },
    );
  }
  if (!counter || typeof counter.seq !== 'number') {
    throw new Error(`Could not allocate event sequence for workspace ${workspace}`);
  }
  return counter.seq;
}

export async function appendEvent(
  workspace: string,
  dedupeKey: string,
  payload: EventFrame,
): Promise<boolean> {
  const db = await getDb();
  const existing = await db.collection('events').findOne({ workspace, dedupeKey });
  if (existing) return false;
  const frame = { ...payload, workspace, seq: await nextSeq(workspace), dedupeKey };

  try {
    await db.collection('events').insertOne(frame);
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      const duplicate = await db.collection('events').findOne({ workspace, dedupeKey });
      if (duplicate) return false;
    }
    throw error;
  }

  await getRedis().publish(`switchboard:events:${workspace}`, JSON.stringify(frame));
  return true;
}

export async function replayEvents(
  workspace: string,
  after: number,
): Promise<Array<Record<string, unknown>>> {
  const db = await getDb();
  return db.collection('events')
    .find({ workspace, seq: { $gt: after } })
    .sort({ seq: 1 })
    .toArray();
}
