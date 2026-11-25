export interface Snapshot {
  workspaces: Record<string, unknown>;
}

export async function buildSnapshot(): Promise<Snapshot> {
  return { workspaces: {} };
}
