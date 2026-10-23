import type { PreparedAttachment } from "../attachments/types.ts";
import type { SavedProposal } from "../storage/profile.ts";
import type { BuildSettings, CvRevision } from "../storage/build.ts";
export type ChatEvent =
  | { type: "text-delta"; text: string }
  | { type: "proposal"; kind: "profile" | "cv"; value: unknown }
  | { type: "usage"; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; model?: string }
  | { type: "error"; code: "rate-limit" | "context-limit" | "interrupted" | "provider" | "validation"; message: string }
  | { type: "done" };
export type ProviderRequest = {
  instructions: string;
  profile: string;
  profileRevision?: string | null;
  usedProfileBlockIds?: string[];
  proposals?: SavedProposal[];
  build?: { settings: BuildSettings; draft: CvRevision | null; accepted: CvRevision | null };
  messages: { role: "user" | "assistant"; content: string; attachments?: PreparedAttachment[] }[];
};
export interface ChatProvider {
  stream(request: ProviderRequest, signal: AbortSignal): AsyncIterable<ChatEvent>;
}

export class ContextLimitError extends Error {
  constructor() { super("This conversation exceeds attachment/context limits (100 PDF pages, 20 images, or 30,000,000 bytes). Start a shorter chat or use smaller files."); }
}

export function validateContext(request: ProviderRequest) {
  const files = request.messages.flatMap(message => message.attachments ?? []);
  if (files.reduce((sum, file) => sum + file.pages, 0) > 100 || files.filter(file => file.mediaType.startsWith("image/")).length > 20) throw new ContextLimitError();
  const payload = JSON.stringify(request, (_key, value) => value instanceof Uint8Array ? Buffer.from(value).toString("base64") : value);
  if (Buffer.byteLength(payload, "utf8") > 30_000_000) throw new ContextLimitError();
}
