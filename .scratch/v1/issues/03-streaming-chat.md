# 03: Provider layer and streaming chat

Status: needs-triage
Blocked by: 01, 02

## Goal

Plain-text chat that streams through an isolated provider layer.

## Scope

- Provider interface in `lib/ai/`. Only `lib/ai/claude/` imports the Agent SDK. Request options come from the spike findings.
- A route handler streams SSE events: `text-delta`, `proposal`, `usage`, `error`, `done`.
- Context is rebuilt from SQLite per request: instructions, current profile, active chat history, new message.
- Save the user message before the request. Save the assistant message only on `done`. On failure, mark the user message failed and show retry.
- Distinct errors for subscription rate limit and context limit.

## Acceptance

- [ ] Replies stream into the chat view (acceptance condition 11).
- [ ] Killing a request midway leaves the user message, marked failed, and retry works (acceptance condition 7).
- [ ] No file outside `lib/ai/claude/` imports the SDK (acceptance condition 10).

## Comments
