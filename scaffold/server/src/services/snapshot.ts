import { config } from '../config.js';
import { getDb } from '../db.js';

interface ContactSnapshot {
  inbound: string[];
  assignee: string | null;
}

export interface Snapshot {
  workspaces: Record<string, {
    contacts: Record<string, ContactSnapshot>;
    outbound: Record<string, string>;
  }>;
}

export async function buildSnapshot(): Promise<Snapshot> {
  const db = await getDb();
  const snapshot: Snapshot = { workspaces: {} };

  for (const workspace of Object.keys(config.pigeon.apiKeys)) {
    const conversations = await db.collection('conversations')
      .find({ workspace })
      .toArray();
    const messages = await db.collection('messages')
      .find({ workspace })
      .sort({ occurredAt: 1, messageId: 1 })
      .toArray();
    const outbound = await db.collection('outbound')
      .find({ workspace })
      .toArray();
    const contacts: Record<string, ContactSnapshot> = {};

    for (const conversation of conversations) {
      contacts[String(conversation.contact)] = {
        inbound: [],
        assignee: typeof conversation.assignee === 'string' ? conversation.assignee : null,
      };
    }
    for (const message of messages) {
      const contact = String(message.contact);
      if (!contacts[contact]) contacts[contact] = { inbound: [], assignee: null };
      contacts[contact].inbound.push(String(message.messageId));
    }

    snapshot.workspaces[workspace] = {
      contacts,
      outbound: Object.fromEntries(
        outbound.map((message) => [String(message.clientRef), String(message.status)]),
      ),
    };
  }

  return snapshot;
}
