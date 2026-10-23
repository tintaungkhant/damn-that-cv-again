# 14: Verify the expanded workspace

Status: ready-for-agent
Blocked by: 11, 12, 13

## Goal

Prove attachments, application history, and navigation preserve existing workflows.

## Scope

Audit [feature spec](../spec.md), run focused storage/provider/Server Action transport checks with synthetic inputs, and existing regression gates. Verify migrations from a populated pre-feature database, restart persistence, retry/cancel, attachment deletion, job-history atomicity, and bounded chat queries. Update README, product spec, relevant findings, and tickets with evidence. Provide a manual checklist for both screen sizes; do not automate a browser. Do not replace the user's local database without authorization.

## Acceptance

- [ ] Automated acceptance and regression results are recorded, including binary transport and migration preservation.
- [ ] Tests, typecheck, lint, and production build pass.
- [ ] User checklist covers all attachment formats/downloads, job edits/status/comment history, 120-chat navigation, and panel hide/show.
- [ ] Manual acceptance is recorded separately; pending visual checks are never marked passed by the agent.
- [ ] Documentation distinguishes delivered behavior from deferred features and contains no contradictory scope claims.

## Comments

- 2026-10-23: Planned. No new backup/restore feature, scraping, or CV-to-job synchronization.
