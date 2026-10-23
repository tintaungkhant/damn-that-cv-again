# 06: Build CV chats

Status: needs-triage
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

- [ ] Tailors to a pasted job description and explains selections without invented facts (acceptance condition 4).
- [ ] Drafts persist independently of acceptance. Accepted CVs survive profile changes and discarded proposals (acceptance condition 5).

## Comments
