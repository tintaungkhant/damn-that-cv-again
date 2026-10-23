# Ticket 03 streaming verification

Date: 2026-10-23. Next.js 16.4.2, React 19.3.0, Node 26.11.1, Agent SDK 0.3.309.

## Transport gate

Pass. A Server Action returns a native `ReadableStream` of serializable event objects. The installed React Flight decoder exposes it before completion. No endpoint or browser-side fetch is necessary.

- First probe: root at 231 ms, first event at 232 ms, done at 2236 ms.
- Repeat: first event at 56 ms, done at 2059 ms.
- Installed Next action queue plus `serverActionReducer`: queued ping returned `pong` at 23 ms while the prior action's stream closed at 2020 ms. The queue waits for the action's root result, not for all stream chunks.
- Source confirmation: `next/dist/client/components/router-reducer/reducers/server-action-reducer.js` resolves `response.a` and returns router state without waiting for stream exhaustion when there is no revalidation/redirect. `app-router-instance.js` advances the queue after that reducer settles.

The queue harness runs the actual installed dispatcher/reducer in Node. Its module-loader shim supplies the Node Flight decoder and empty module manifest in place of the bundler's client alias. This is not a browser test and does not prove rendered behavior. The repository prohibits browser automation and visual tests.

For reproduction, copy `actions.ts.fixture` and `page.tsx.fixture` to `app/transport-probe/actions.ts` and `app/transport-probe/page.tsx`, run `bun run dev --port 3801`, GET `/transport-probe` to compile, then run `node .scratch/v1/streaming/probe.mjs`. Remove that temporary directory after stopping the dev server. The probe page is not shipped.

## Live provider and production action

- `node .scratch/v1/streaming/live.ts`: real local subscription reply; first text at 2023 ms, another delta at 2765 ms, usage and done at 2793 ms. No API key was supplied.
- `node .scratch/v1/streaming/production.ts`: real production Server Action on port 3800, HTTP 200, first delta at 1902 ms, done at 2371 ms. Two complete messages were readable through storage afterward.
- `node .scratch/v1/streaming/interruption.ts`: abort the HTTP connection after its first text delta. One user message remained with failed status, no assistant. Retry used the same user message ID, streamed to done, and left exactly two complete messages.

Production scripts create a temporary profile chat in the local database and delete it in `finally`; they do not delete other chats. They use the current confirmed profile like normal chat requests and consume subscription usage. Run them only against this locally running production build.

## Persistence and limits

Behavior tests use real SQLite and deterministic providers at the external boundary. They cover save-before-request, completion-only assistant persistence, interrupted-turn recovery, cancellation/retry races, stop, exceptions, missing completion, rejected proposals, current-profile refresh, chat-history isolation, credential stripping, and distinct subscription/context errors. No visual assertions.

SDK imports remain in `lib/ai/claude/` for application code and adapter tests. The original Ticket 01 throwaway spike still imports its own isolated SDK, as recorded in that ticket.

The SDK must be listed in `serverExternalPackages`. Bundling its native process paths on Windows caused a Turbopack build panic; native loading fixed the production build. The Next installed `serverExternalPackages` guide documents this option for Node-specific dependencies.

## Manual visual check

Open http://localhost:3800, create or open a chat, and send career notes. Check that text appears incrementally, Stop reply exposes retry, retry does not duplicate the user message, and reopening retains the complete conversation. Visual review remains with the user under `.ai/rules/testing.md`.

## Send/reopen serialization regression

The initial probes covered streaming but omitted returning populated SQLite message rows through React. Node SQLite rows have null prototypes, which React rejects. This caused errors both in the conversation Server Component props and in `readChatMessages`, despite streaming itself working.

`getMessages` now copies each row into an ordinary object. `lib/storage/serialization.test.ts` reproduces the rejection using the installed React encoder and passes after the fix. `node .scratch/v1/streaming/reopen.ts` checks the production Flight response for server error frames and decodes the real message-read action for every existing populated chat; it performs no writes or visual assertions. Two saved conversations passed. A fresh production chat reply also passed (first delta 1803 ms, done 2325 ms). All 20 behavior tests and static/build checks pass.
