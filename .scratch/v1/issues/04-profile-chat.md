# 04: Profile chats and proposals

Status: needs-triage
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

- [ ] The profile changes only after approval, history is kept, and stale revisions are detected (acceptance condition 2).
- [ ] A reopened chat uses the latest confirmed profile and no other chat's discussion (acceptance condition 3).
- [ ] A disputed fact stays unchanged and appears under open questions.

## Comments
