# Ticket 04 verification

Date: 2026-10-23
Review baseline: fa9d6a2294da5bdb592d0b82b2299b3d92061076.

## Implementation

The strict Zod contract in lib/storage/profile.ts defines replace/delete by block ID and insert by new ID plus afterId (null means first). The reserved p-open-questions block retains its heading. This small application-specific protocol has no general Markdown editing package. Whole-document before/after panels do not need a custom diff engine.

Schema v2 preserves v1 data and adds proposals and a permanent ID ledger. Proposals commit atomically with a completed assistant reply. Approval is a separate user action. Successfully completed replacement batches supersede pending batches only in their own chat. Undo appends history. Stale insertion collisions remain reviewable for reconciliation. Every inserted ID in an approved batch stays reserved, even if removed within that batch.

Claude exposes only propose_profile_edit through an in-process MCP server. Built-in tools, local settings, provider sessions, and API-key credentials remain disabled. Three turns allow the tool response and explanation. Each request rebuilds the current revision, confirmed profile, historical IDs, and active-chat-only messages and proposals. The career-editor prompt preserves disputed facts and records contradictions under Open questions.

## Evidence

- Full suite: 31 behavior tests pass. Typecheck, lint, and production build pass.
- Storage checks cover approval-only mutation, batch rollback, stable IDs, deletion, stale unrelated edits, stale conflicts, renewed review, undo, v1 migration, reopening, and historical ID non-reuse.
- Provider/chat checks cover completed proposals, latest-profile context, failed replacement preservation, interrupted staged proposals, real in-memory MCP tool validation, and existing streaming/failure/retry behavior.
- Pending reviews, previews, and revision history pass the installed React encoder. No raw SQLite rows cross these boundaries.
- live.ts passed against the real subscription on synthetic in-memory data. Rough notes produced a proposal without saving. An uncertain 2020/2021 date left the experience block unchanged and proposed an Open questions edit. Approval and undo preserved history.
- transport.ts passed against production Server Actions on port 3801 with an isolated temporary database. Checks include live proposal streaming, review, approval, reopening, wrong-chat and unexpected-field rejection, stale restore rejection, and undo. The fixture initially omitted next.config.ts; copying the existing config fixed startup. Personal data was untouched.

No browser automation or rendered-markup assertions were used. The Flight probe checks protocol error frames only. The temporary server and database are removed after verification.

## Dependencies and documentation

react-markdown 10.1.0 renders Markdown with the default URL policy, raw HTML skipped, and images disabled. Registry review: TypeScript declarations included; latest release 2025-03-07; 22,730,612 weekly downloads; GitHub pushed 2026-10-03, five open issues, not archived. The MCP SDK is a direct development dependency for the in-memory provider boundary test.

Sources reviewed:

- https://github.com/remarkjs/react-markdown
- https://registry.npmjs.org/react-markdown
- https://api.npmjs.org/downloads/point/last-week/react-markdown
- https://api.github.com/repos/remarkjs/react-markdown
- https://ui.shadcn.com/docs/components
- https://ui.shadcn.com/blocks

Reused shadcn cards, buttons, dialog and chat primitives; installed Tabs through its CLI. Read installed Next guides for use-server, Server Actions and server/client boundaries. No qualifying Next feedback candidate remained; the isolated-server failure was routine fixture configuration.

## Inline code review

Repository rules prohibit delegated reviews. The main agent reviewed both axes using the code-review skill and the baseline above.

Standards: zero remaining findings. Actions validate inputs and ownership. React receives plain records. No endpoints or browser fetches were added. Tests stay at behavior boundaries. UI reuses shadcn; unchanged Markdown is memoized during streaming. Documentation matches the implementation.

Spec: zero remaining implementation findings. Review found and fixed ID reuse within a single batch and in-flight stale insertion collisions. Each has a regression that failed before the fix and passed after it. Structured CV generation remains later work.

## Manual visual check

Open a profile chat at http://localhost:3800. Paste rough notes and inspect the document beside chat. Compare Before and After approval; the confirmed profile must remain empty until approval. Ask for a revision, edit/send the prepared message, approve, reload, and inspect History and Restore this revision. Change a targeted block from another chat, refresh the first chat's profile, and check that its old proposal requires reconciliation. Other tabs do not update automatically.

Visual layout and browser interactions remain user verification under .ai/rules/testing.md. No browser was opened.
