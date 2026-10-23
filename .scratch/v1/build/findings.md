# Ticket 06: Build CV chats

## Implementation

The user approved the Ticket 05 contract before this work. Review baseline: `70482bf896b885165be69b3edbb0a9f8255794c9`.

- Schema v3 preserves existing records and adds `build_context` with job description, optional role/company, project limit (default five, zero means no projects), version, and accepted CV pointer. CV revisions add source profile revision and selection explanation.
- The Claude adapter exposes `propose_cv` only in build chats, using the approved `cvSchema.shape`. One profile batch and one CV proposal may coexist per successful reply. Both are buffered until terminal success; assistant text and proposals save atomically.
- Every request includes latest confirmed profile, active chat history, saved job details, latest pending draft, and the accepted CV. Other chats' discussions/settings/drafts are excluded. Drafts reference their request snapshot even if another chat approves new notes mid-reply.
- CV claims need existing confirmed block IDs, excluding `p-open-questions`. Unconfirmed facts require a profile proposal and explicit approval first. Instructions prohibit fabricated metrics/experience and require a selection explanation and alternatives outside CV JSON. Reference checks cannot prove semantic truth; factual review remains manual.
- Drafts save automatically. Acceptance changes an explicit pointer. Discard only affects drafts. Restore appends a draft from any historical revision, requiring separate acceptance. Accepted content and history survive new drafts, discard, job-detail changes and shared profile edits.
- Server Actions validate all inputs and stored chat category/ownership. Settings compare a version, revision actions compare the reviewed accepted pointer, and both reject active replies.
- Build review composes installed shadcn Card, Tabs, Input, Textarea, Label and Button. Accepted CV stays visible above draft/history. Each revision has readable and internal JSON tabs. Selection notes remain outside CV content. Prepare-draft/revision controls fill an editable message, not an automatic send. Profile proposals remain available in the Career profile tab.

## Reuse and sources

No new dependency. Reused installed Zod 4.6.7 (required by the approved contract), existing SDK in-process tools, SQLite transactions, and shadcn components. App-specific revision state uses SQLite operations rather than a general state-machine package: there are only three statuses and an explicit accepted pointer. No handwritten schema validator, Markdown parser, or UI component library.

Read installed Next.js Server Actions and Server/Client Components guides. Consulted official Zod API docs (https://zod.dev/api), shadcn component catalog (https://ui.shadcn.com/docs/components), and blocks (https://ui.shadcn.com/blocks). Existing installed components cover this ticket; no CLI additions were needed.

## Verification

Behavior tests cover automatic drafts, accept/discard/restore, migration from v2, reopen, deletion, stale/active-reply guards, settings validation, evidence rejection, atomic failure, duplicate proposals, missing explanation, profile-chat CV rejection, context isolation, snapshot changes, SDK tool calls, and React transport. Existing v1 migration and unsupported-version fixtures now account for schema v3.

`live.ts` used the real local Claude subscription with synthetic in-memory notes and job context. It passed tailored queue-work generation, omission of unsupported Kubernetes/metrics, selection notes, explicit acceptance, a shorter replacement draft, accepted-content preservation, discard and restore. Personal data was untouched.

`transport.ts` started an isolated production server on port 3801 with a temporary database. Direct HTTP Server Action requests passed job settings persistence, real Claude proposal streaming, draft persistence, acceptance, discard, restore, stale settings/acceptance guards, wrong-chat and unknown-field rejection, and reopening without React errors. No browser, screenshots, or rendered-markup assertions were used.

## Manual checks

At port 3800, open a Build CV chat. Save job details, prepare and send a draft request, inspect readable/JSON tabs and selection notes, accept, request a revision, discard, restore history as a draft, and reopen. Check visual layout and factual wording. Profile changes should show a saved-snapshot notice while leaving CV content unchanged. Review discovered facts in Career profile and approve them before asking for a refreshed CV.

## Review

Code-review skill applied inline because repository rules prohibit subagents. Standards and spec reviewed separately against the fixed baseline. Review found that disabling document controls during a failed reply would prevent correcting missing job details before retry. Controls now block active replies only; a regression test covers saving corrected job details and retrying the same user message. No outstanding standards findings or spec findings remain. Final gates: all 49 behavior tests passed (14 added), TypeScript typecheck passed, ESLint passed, production build passed, and whitespace checks passed. Standards: 0 outstanding findings. Spec: 0 outstanding findings. No qualifying Next.js feedback candidates arose.
