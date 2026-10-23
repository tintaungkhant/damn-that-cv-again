# 03: Provider layer and streaming chat

Status: claimed
Blocked by: 01, 02

## Goal

Plain-text chat that streams through an isolated provider layer.

## Scope

- Provider interface in `lib/ai/`. Only `lib/ai/claude/` imports the Agent SDK. Request options come from the spike findings.
- A Server Action sends the message and returns a stream of typed events: `text-delta`, `proposal`, `usage`, `error`, `done`. No Route Handler, no SSE endpoint, no browser `fetch` (`.ai/rules/server-actions.md`).
- First, check that a Server Action can return a stream (for example a `ReadableStream` or async iterable) that the browser reads as it arrives, on this Next.js and React version. Also check whether other Server Actions wait while that stream is open, because Next.js dispatches Server Actions one at a time per client. If either check fails, record the result here and flag it to the user. A streaming endpoint would break `.ai/rules/server-actions.md` and needs the user's approval.
- Context is rebuilt from SQLite per request: instructions, current profile, active chat history, new message.
- Save the user message before the request. Save the assistant message only on `done`. On failure, mark the user message failed and show retry.
- Distinct errors for subscription rate limit and context limit.

## Acceptance

- [ ] Replies stream into the chat view (acceptance condition 11).
- [ ] Killing a request midway leaves the user message, marked failed, and retry works (acceptance condition 7).
- [ ] No file outside `lib/ai/claude/` imports the SDK (acceptance condition 10).

## Comments

- 2026-10-23: Began implementation after reviewing completed dependencies 01 and 02. Storage turn lifecycle now saves before generation, retries the latest failed message in place, commits the assistant atomically, and recovers interrupted turns on app startup. Verified with storage behavior tests and typechecking.
