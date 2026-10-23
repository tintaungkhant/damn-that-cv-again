export type ChatEvent =
  | { type: "text-delta"; text: string }
  | { type: "proposal"; kind: "profile" | "cv"; value: unknown }
  | { type: "usage"; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }
  | { type: "error"; code: "rate-limit" | "context-limit" | "interrupted" | "provider" | "validation"; message: string }
  | { type: "done" };
export type ProviderRequest = {
  instructions: string;
  profile: string;
  messages: { role: "user" | "assistant"; content: string }[];
};
export interface ChatProvider {
  stream(request: ProviderRequest, signal: AbortSignal): AsyncIterable<ChatEvent>;
}
