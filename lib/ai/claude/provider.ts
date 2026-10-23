import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { query, type Query } from "@anthropic-ai/claude-agent-sdk";
import type { ChatEvent, ChatProvider } from "../provider.ts";

type RunQuery = (input: Parameters<typeof query>[0]) => Pick<Query, typeof Symbol.asyncIterator | "close">;
function errorEvent(detail: string): ChatEvent {
  if (/rate.?limit|blocking_limit|credits_required/i.test(detail)) return { type: "error", code: "rate-limit", message: "Claude subscription limit reached. Wait for the limit to reset, then retry." };
  if (/prompt_too_long|prompt is too long|context.{0,30}(limit|length|exceed)|too many tokens/i.test(detail)) return { type: "error", code: "context-limit", message: "This conversation exceeds Claude's context limit. Start a shorter chat; your saved profile and messages are unchanged." };
  return { type: "error", code: "provider", message: "Claude could not finish. Check your local Claude subscription login, then retry." };
}

export function createClaudeProvider(run: RunQuery = query): ChatProvider {
  return {
    async *stream(request, signal) {
      const cwd = mkdtempSync(join(tmpdir(), "cv-chat-"));
      let session: ReturnType<RunQuery> | undefined;
      try {
        const env = { ...process.env };
        delete env.ANTHROPIC_API_KEY;
        delete env.ANTHROPIC_AUTH_TOKEN;
        const abortController = new AbortController();
        const abort = () => abortController.abort();
        signal.addEventListener("abort", abort, { once: true });
        try {
          signal.throwIfAborted();
          session = run({
            prompt: JSON.stringify({ confirmedProfile: request.profile, conversation: request.messages }),
            options: {
              systemPrompt: request.instructions,
              tools: [], settingSources: [], skills: [], title: "cv-chat",
              strictMcpConfig: true, mcpServers: {}, allowedTools: [],
              includePartialMessages: true, persistSession: false, maxTurns: 1,
              cwd, env, abortController,
            },
          });
          for await (const message of session) {
            signal.throwIfAborted();
            if (message.type === "rate_limit_event" && message.rate_limit_info.status === "rejected") {
              yield errorEvent("rate_limit"); return;
            }
            if (message.type === "assistant" && message.error) {
              yield errorEvent(`${message.error} ${JSON.stringify(message.message.content)}`); return;
            }
            if (message.type === "stream_event" && message.event.type === "content_block_delta" && message.event.delta.type === "text_delta") {
              yield { type: "text-delta", text: message.event.delta.text };
            }
            if (message.type === "result") {
              if (message.is_error || message.subtype !== "success") {
                yield errorEvent(JSON.stringify(message)); return;
              }
              yield { type: "usage", inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens,
                cacheReadTokens: message.usage.cache_read_input_tokens ?? 0, cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0 };
              yield { type: "done" };
              return;
            }
          }
          yield errorEvent("Missing completion");
        } finally { signal.removeEventListener("abort", abort); }
      } catch (error) {
        if (signal.aborted) yield { type: "error", code: "interrupted", message: "Reply interrupted. Retry your saved message." };
        else yield errorEvent(error instanceof Error ? error.message : String(error));
      } finally { session?.close(); rmSync(cwd, { recursive: true, force: true }); }
    },
  };
}
