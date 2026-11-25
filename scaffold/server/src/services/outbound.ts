export interface ReplyInput {
  workspace: string;
  contact: string;
  text: string;
  clientRef: string;
}

export async function acceptReply(_reply: ReplyInput): Promise<void> {
  // Reserved for the outbound implementation.
}
