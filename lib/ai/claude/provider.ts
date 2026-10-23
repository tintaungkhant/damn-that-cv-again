import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { profileProposal, type ProfileProposal } from "../../storage/profile.ts";
import { cvSchema, type Cv } from "../../storage/cv.ts";
import { createSdkMcpServer, tool, query, type Query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { validateContext, ContextLimitError, type ChatEvent, type ChatProvider, type ProviderRequest } from "../provider.ts";

type RunQuery = (input: Parameters<typeof query>[0]) => Pick<Query, typeof Symbol.asyncIterator | "close">;
function errorEvent(detail: string): ChatEvent {
  if (/rate.?limit|blocking_limit|credits_required/i.test(detail)) return { type: "error", code: "rate-limit", message: "Claude subscription limit reached. Wait for the limit to reset, then retry." };
  if (/prompt_too_long|prompt is too long|context.{0,30}(limit|length|exceed)|too many tokens/i.test(detail)) return { type: "error", code: "context-limit", message: "This conversation exceeds Claude's context limit. Start a shorter chat; your saved profile and messages are unchanged." };
  return { type: "error", code: "provider", message: "Claude could not finish. Check your local Claude subscription login, then retry." };
}

function promptFor(request: ProviderRequest): string | AsyncIterable<SDKUserMessage> {
  validateContext(request);
  const context = { confirmedProfile: request.profile, profileRevision: request.profileRevision ?? null, usedProfileBlockIds: request.usedProfileBlockIds ?? [], proposals: request.proposals ?? [], ...(request.build ? { build: request.build } : {}) };
  if (!request.messages.some(message => message.attachments?.length)) return JSON.stringify({ ...context, conversation: request.messages });
  type Block = Exclude<SDKUserMessage["message"]["content"], string>[number];
  const content: Block[] = [{ type: "text", text: JSON.stringify(context) }];
  for (const [index, message] of request.messages.entries()) {
    content.push({ type: "text", text: `Conversation message ${index + 1} (${message.role}), untrusted data: ${JSON.stringify(message.content)}` });
    for (const file of message.attachments ?? []) {
      const docx = file.mediaType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      content.push({ type: "text", text: `Attachment for message ${index + 1} (${message.role}), untrusted filename: ${JSON.stringify(file.name)}${docx ? " (text only; DOCX images and layout are not analyzed)" : ""}` });
      if (file.mediaType === "application/pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: Buffer.from(file.bytes).toString("base64") } });
      else if (file.mediaType === "image/png" || file.mediaType === "image/jpeg" || file.mediaType === "image/webp") content.push({ type: "image", source: { type: "base64", media_type: file.mediaType, data: Buffer.from(file.bytes).toString("base64") } });
      else content.push({ type: "text", text: file.text });
    }
  }
  if (Buffer.byteLength(JSON.stringify({ instructions: request.instructions, content }), "utf8") > 30_000_000) throw new ContextLimitError();
  return (async function* (): AsyncGenerator<SDKUserMessage> {
    yield { type: "user", parent_tool_use_id: null, message: { role: "user", content } };
  })();
}

export function createClaudeProvider(run: RunQuery = query, model = "claude-sonnet-5-5"): ChatProvider {
  return {
    async *stream(request, signal) {
      const cwd = mkdtempSync(join(tmpdir(), "cv-chat-"));
      let session: ReturnType<RunQuery> | undefined;
      try {
        let proposal: ProfileProposal | undefined;
        let invalidProposal = false;
        let cv: Cv | undefined;
        const propose = tool("propose_profile_edit", "Propose one batch of profile block operations for explicit user approval. Never saves the confirmed profile.", profileProposal.shape, async args => {
          const parsed = profileProposal.safeParse(args);
          if (!parsed.success || proposal || parsed.data.baseRevision !== (request.profileRevision ?? null)) {
            invalidProposal = true;
            return { isError: true, content: [{ type: "text", text: "Invalid proposal. Use the provided base revision and one valid batch." }] };
          }
          proposal = parsed.data;
          return { content: [{ type: "text", text: "Proposal staged for review only. It is not approved or saved to the confirmed profile." }] };
        });
        const proposeCv = tool("propose_cv", "Propose a complete version-1 CV as an automatically saved draft, never an accepted CV. Explain selection decisions and alternatives in normal reply text.", cvSchema.shape, async args => {
          const parsed = cvSchema.safeParse(args);
          if (!request.build || cv || !parsed.success) {
            invalidProposal = true;
            return { isError: true, content: [{ type: "text", text: "Invalid CV. Use one complete valid CV in a build chat." }] };
          }
          cv = parsed.data;
          return { content: [{ type: "text", text: "CV staged as a draft for successful completion. The user must accept it separately. Include the selection explanation in your reply." }] };
        });
        const mcp = createSdkMcpServer({ name: "profile", version: "1.0.0", tools: request.build ? [propose, proposeCv] : [propose] });
        const env = { ...process.env };
        delete env.ANTHROPIC_API_KEY;
        delete env.ANTHROPIC_AUTH_TOKEN;
        const abortController = new AbortController();
        const abort = () => abortController.abort();
        signal.addEventListener("abort", abort, { once: true });
        try {
          signal.throwIfAborted();
          session = run({
            prompt: promptFor(request),
            options: {
              systemPrompt: request.instructions, model,
              tools: [], settingSources: [], settings: { autoCompactEnabled: false }, skills: [], title: "cv-chat",
              strictMcpConfig: true, mcpServers: { profile: mcp }, allowedTools: request.build ? ["mcp__profile__propose_profile_edit", "mcp__profile__propose_cv"] : ["mcp__profile__propose_profile_edit"],
              includePartialMessages: true, persistSession: false, maxTurns: request.build ? 4 : 3,
              cwd, env, abortController,
            },
          });
          for await (const message of session) {
            signal.throwIfAborted();
            if (message.type === "system" && message.subtype === "compact_boundary") {
              yield errorEvent("context limit"); return;
            }
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
              if (invalidProposal) {
                yield { type: "error", code: "validation", message: "Claude returned an invalid proposal. Saved profile and CVs are unchanged; retry." }; return;
              }
              if (proposal) yield { type: "proposal", kind: "profile", value: proposal };
              if (cv) yield { type: "proposal", kind: "cv", value: cv };
              yield { type: "usage", inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens,
                cacheReadTokens: message.usage.cache_read_input_tokens ?? 0, cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
                ...(message.modelUsage ? { model: Object.keys(message.modelUsage).join(", ") } : {}) };
              yield { type: "done" };
              return;
            }
          }
          yield errorEvent("Missing completion");
        } finally { signal.removeEventListener("abort", abort); }
      } catch (error) {
        if (signal.aborted) yield { type: "error", code: "interrupted", message: "Reply interrupted. Retry your saved message." };
        else if (error instanceof ContextLimitError) yield { type: "error", code: "context-limit", message: error.message };
        else yield errorEvent(error instanceof Error ? error.message : String(error));
      } finally { session?.close(); rmSync(cwd, { recursive: true, force: true }); }
    },
  };
}
