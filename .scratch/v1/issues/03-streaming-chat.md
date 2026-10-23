# 03: Provider layer and streaming chat

Status: resolved
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

- [x] Replies stream into the chat view (acceptance condition 11).
- [x] Killing a request midway leaves the user message, marked failed, and retry works (acceptance condition 7).
- [x] No file outside `lib/ai/claude/` imports the SDK (acceptance condition 10).

## Comments

- 2026-10-23: Began implementation after reviewing completed dependencies 01 and 02. Storage turn lifecycle now saves before generation, retries the latest failed message in place, commits the assistant atomically, and recovers interrupted turns on app startup. Verified with storage behavior tests and typechecking.

- 2026-10-23: Implemented provider contract in `lib/ai/provider.ts`, isolated subscription adapter in `lib/ai/claude/`, chat orchestration in `lib/ai/chat.ts`, validated Server Actions in `app/chat-actions.ts`, and shadcn message/composer UI. Context reads the latest confirmed profile and only active chat history from SQLite. No provider sessions own application history. Proposal events are typed but rejected until their later schema tickets; this ticket enables plain text only.
- Transport gate passed: incremental HTTP delivery and installed Next action queue/reducer probes show another action finishes while the returned stream remains open. Production HTTP checks cover a real Claude reply, disconnect, and retry. No endpoint or browser fetch was added. Reproduction and measurements: `.scratch/v1/streaming/findings.md`. Browser and visual checks were not run, per `.ai/rules/testing.md`.
- Package review: reuse the spike-verified Agent SDK, existing zod, and native ReadableStream; an extra streaming package is unnecessary because the installed Flight transport handles it. Handwritten logic is application-specific turn orchestration. shadcn Message, Bubble, and Textarea were installed through the CLI after checking the component and block catalogs. SDK is externalized from Next bundling because it requires native runtime paths.
- A single local server recovers pending messages on startup. Stop/disconnect/timeout mark failed; partial assistant text is never saved. Five-minute timeout prevents abandoned provider requests hanging indefinitely. Requests reject blank/oversized input and concurrent turns, and only the latest failed message can be retried.

- Final review used starting commit `7a24668` and ran both axes inline, as required by the agent-workflow rule. Standards: no remaining findings. Spec: fixed a reproduced cancellation/retry race where an old stream disconnect could fail a newer attempt; the regression test now passes. Final gates: 19 behavior tests, typecheck, lint, production build. User visual check remains intentionally unperformed under the testing rule.
