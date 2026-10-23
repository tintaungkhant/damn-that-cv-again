# 14: Verify the expanded workspace

Status: ready-for-human
Blocked by: 11, 12, 13 (complete)

## Goal

Prove attachments, application history, and navigation preserve existing workflows.

## Scope

Audit [feature spec](../spec.md), run focused storage/provider/Server Action transport checks with synthetic inputs, and existing regression gates. Verify migrations from a populated pre-feature database, restart persistence, retry/cancel, attachment deletion, job-history atomicity, and bounded chat queries. Update README, product spec, relevant findings, and tickets with evidence. Provide a manual checklist for both screen sizes; do not automate a browser. Do not replace the user's local database without authorization.

## Acceptance

- [x] Automated acceptance and regression results are recorded, including binary transport and migration preservation.
- [x] Tests, typecheck, lint, and production build pass.
- [x] User checklist covers all attachment formats/downloads, job edits/status/comment history, 120-chat navigation, and panel hide/show.
- [x] Manual acceptance is recorded separately; pending visual checks are never marked passed by the agent.
- [x] Documentation distinguishes delivered behavior from deferred features and contains no contradictory scope claims.
- [ ] User runs `docs/workspace-acceptance.md` on wide and narrow screens and records the result.

## Comments

- 2026-10-23: Planned. No new backup/restore feature, scraping, or CV-to-job synchronization.
- 2026-10-23: Automated acceptance complete. See [evidence](../acceptance/findings.md). `acceptance/actions.ts` uses commit `f024bfb`'s storage code to write a populated v3 database (120 chats, confirmed profile, accepted CV, failed turn). The built production app migrates it to v6. Real Server Actions then check every attachment format, SHA-256-identical `Uint8Array` downloads, failed-reply retry, cancellation, restart, chat deletion, job validation, duplicate and stale writes, atomic history, and bounded lists. All 12 checks passed with no Claude call, no browser, and no access to `data/app.sqlite`. The 73 regression tests, typecheck, lint, and build pass. No application code changed, so no TDD seam applied. Docs: README, product spec, increment spec, ADR-0001, attachment findings, and the attachment checks were updated. Deferred features are now listed in one place. User checklist: `docs/workspace-acceptance.md`, with a disposable 120-chat workspace from `acceptance/workspace.ts`. Status is `ready-for-human` until the user records the manual results. The agent marked no visual check as passed.
