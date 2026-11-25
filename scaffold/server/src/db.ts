import { MongoClient, type Db } from 'mongodb';
import { config } from './config.js';

let client: MongoClient | undefined;

// Connects on first use. Call from anywhere: const db = await getDb();
export async function getDb(): Promise<Db> {
  if (!client) {
    client = new MongoClient(config.mongoUrl, { serverSelectionTimeoutMS: 1000 });
    try {
      await client.connect();
    } catch (error) {
      client = undefined;
      throw error;
    }
  }
  return client.db();
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = undefined;
  }
}
