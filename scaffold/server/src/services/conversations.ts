export interface ClaimInput {
  workspace: string;
  contact: string;
  agent: string;
}

export async function claimConversation(_claim: ClaimInput): Promise<boolean> {
  return true;
}
