import { getDb } from '../db.js';
import { getRedis } from '../redis.js';

export async function resetAllData(): Promise<void> {
  const db = await getDb();
  await db.dropDatabase();
  await getRedis().flushdb();
}
