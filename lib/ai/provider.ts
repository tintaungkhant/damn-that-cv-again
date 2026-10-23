import type { SavedProposal } from "../storage/profile.ts";
import type { BuildSettings, CvRevision } from "../storage/build.ts";
export type ChatEvent =
  | { type: "text-delta"; text: string }
  | { type: "proposal"; kind: "profile" | "cv"; value: unknown }
  | { type: "usage"; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }
  | { type: "error"; code: "rate-limit" | "context-limit" | "interrupted" | "provider" | "validation"; message: string }
  | { type: "done" };
export type ProviderRequest = {
  instructions: string;
  profile: string;
  profileRevision?: string | null;
  usedProfileBlockIds?: string[];
  proposals?: SavedProposal[];
  build?: { settings: BuildSettings; draft: CvRevision | null; accepted: CvRevision | null };
  messages: { role: "user" | "assistant"; content: string }[];
};
export interface ChatProvider {
  stream(request: ProviderRequest, signal: AbortSignal): AsyncIterable<ChatEvent>;
}
