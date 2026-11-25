import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { getDb, closeDb } from './db.js';
import { ensureIndexes } from './db/indexes.js';
import { getRedis, closeRedis } from './redis.js';

await getDb();
await ensureIndexes();
await getRedis().ping();

const app = createApp();
const server = createServer(app);

server.listen(config.port, () => {
  console.log(`server on http://localhost:${config.port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`received ${signal}; shutting down`);
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  await Promise.all([closeDb(), closeRedis()]);
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
