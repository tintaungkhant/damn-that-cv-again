# 04: Profile chats and proposals

Status: resolved
Blocked by: 03

## Goal

The shared career profile, edited only through approved proposals.

## Scope

- Profile Markdown with stable block IDs (`<!-- id:p-042 -->`) and an `## Open questions` section.
- Zod schema for proposal operations (`replace`, `insert`, `delete` by block ID) against a base revision, exposed as the `propose_profile_edit` tool.
- Profile chat view: Markdown beside the conversation, before/after comparison, approve the whole batch, ask for a revision.
- Save each approval as a revision. Undo to a previous revision.
- Stale base: reapply operations if target blocks are unchanged, otherwise ask the assistant to reconcile and present again.
- Pasted rough notes become the first profile.
- The system prompt carries the career-editor behaviour from the spec.

## Acceptance

- [x] The profile changes only after approval, history is kept, and stale revisions are detected (acceptance condition 2).
- [x] A reopened chat uses the latest confirmed profile and no other chat's discussion (acceptance condition 3).
- [x] A disputed fact stays unchanged and appears under open questions.

## Comments

- Storage slice: schema v2 adds durable pending proposals and a block-ID ledger. Approval is transactional, previews detect conflicting stale targets, and undo appends history. Storage behavior checks pass.

- Completed provider tool, career-editor prompt, shared Markdown review beside chat, before/after comparison, whole-batch approval, editable revision/reconciliation requests, history and undo. Build chats can propose profile facts too. Current profile and active-chat-only context are rebuilt each turn.
- Verified 31 behavior tests, typecheck, lint, production build, live subscription on synthetic data, and isolated HTTP Server Actions including approval, reopen and undo. Evidence and manual visual checklist: .scratch/v1/profile/findings.md. Inline standards/spec review found no remaining issues. Browser and visual checks remain user verification per the testing rule.
