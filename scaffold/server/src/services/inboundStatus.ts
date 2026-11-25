import { getDb } from '../db.js';
import { appendEvent } from './events.js';

const statusRank: Record<string, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  failed: 2,
};

export interface InboundStatusEvent {
  workspace: string;
  data: {
    client_ref: string;
    status: string;
  };
}

export async function handleStatus(event: InboundStatusEvent): Promise<void> {
  const { workspace, data: { client_ref: clientRef, status } } = event;
  if (!Object.prototype.hasOwnProperty.call(statusRank, status)) return;
  const nextRank = statusRank[status];

  const db = await getDb();
  const outbound = db.collection('outbound');
  const current = await outbound.findOne({ workspace, clientRef });
  if (!current) return;

  const currentStatus = current.status === undefined
    ? 'queued'
    : typeof current.status === 'string'
      ? current.status
      : '';
  const currentRank = statusRank[currentStatus];
  if (!Object.prototype.hasOwnProperty.call(statusRank, currentStatus) || nextRank <= currentRank) return;

  const statusFilter = typeof current.status === 'string'
    ? { status: current.status }
    : { status: { $exists: false } };
  const result = await outbound.updateOne(
    { workspace, clientRef, ...statusFilter },
    { $set: { status } },
  );
  if (result.modifiedCount !== 1) return;

  await appendEvent(workspace, `message.status:${clientRef}:${status}`, {
    type: 'message.status',
    contact: String(current.contact ?? ''),
    client_ref: clientRef,
    status,
  });
}
