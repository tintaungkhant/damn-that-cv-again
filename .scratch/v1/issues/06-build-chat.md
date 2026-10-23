# 06: Build CV chats

Status: resolved
Blocked by: 04, 05

## Goal

Tailor a CV to a pasted job description.

## Scope

- A build chat stores the job description and an optional target role and company.
- `propose_cv` tool with the CV schema as input. Every valid proposal is saved as a draft revision automatically.
- Accept marks a revision ready for export. The last accepted revision stays visible while a new proposal is discussed. Discarding a proposal leaves the accepted CV alone.
- Revision history and restore.
- Selection explanations and alternatives are shown in the app, not in the CV.
- Readable CV view, with raw JSON in a separate tab.
- Default of up to five projects, adjustable per chat.
- New profile facts go through the profile approval flow.
- Existing revisions do not change when the profile changes. Refresh only on request.

## Acceptance

- [x] Tailors to a pasted job description and explains selections without invented facts (acceptance condition 4).
- [x] Drafts persist independently of acceptance. Accepted CVs survive profile changes and discarded proposals (acceptance condition 5).

## Comments

2026-10-23: Storage slice adds schema v3, per-chat job settings, automatic draft persistence, accepted pointers, discard, restore-as-draft, profile snapshot references, and evidence checks. Tests cover migration, restart, stale actions, rollback, isolation, and deletion. Provider and UI work remain.

2026-10-23: Provider/service slice enables `propose_cv` only in build requests, supplies saved job context and active/accepted CVs, buffers both proposal kinds, and commits them only on successful completion. Evidence is checked against the request snapshot. Server Actions validate job settings and revision mutations. Failure tests preserve accepted content and reject incomplete, duplicate, or unconfirmed claims. UI remains in progress.

2026-10-23: Complete. Build review UI supports saved job details, readable/JSON views, separate accepted CV and draft review, discard, and history restoration as a new draft. All 49 behavior tests, typecheck, lint and production build passed. Real Claude and isolated HTTP Server Action checks passed on synthetic data; see `.scratch/v1/build/findings.md`, `live.ts`, and `transport.ts`. Inline standards/spec review has no outstanding findings. Visual layout and factual wording checks remain manual under the testing rule. Copy/download remains Ticket 07.
