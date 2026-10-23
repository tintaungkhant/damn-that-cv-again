# 12: Track applied jobs and activity

Status: resolved
Completed: 2026-10-23 (visual acceptance remains user-run)

## Goal

Save job applications and review every comment and change in one detail timeline.

## Scope

Implement [job-tracker scope](../spec.md#applied-job-tracker): SQLite migration, validation, versioned field/status writes, append-only activity, duplicate-submission protection, Server Actions, `/jobs` list, `/jobs/[id]` detail, and Jobs sidebar link. Search/filter/pagination run in storage. Use one atomic operation for status plus comment. Reuse existing dependencies; check the shadcn catalog and install missing components with its CLI.

## Acceptance

- [x] Required URL/title, optional description, six statuses, Applied default, and persistence work.
- [x] Comment-only, status-only, and combined submissions produce correct immutable events; combined submissions are atomic.
- [x] Creation and effective field edits retain old/new values; no-ops do not create history.
- [x] Invalid URLs/statuses, blank submissions, stale writes, repeated submissions, and missing/wrong-owner records have behavior tests.
- [x] Stable list pagination/search/status filters and activity ordering work across restart.
- [x] Comments render as plain text; URL never triggers server fetching; build-chat job settings remain independent.
- [x] Tests, typecheck, lint, build, synchronized docs, and manual scenarios accompany completed chunks.

## Comments

- 2026-10-23: Planned. Jira-like means simple detail editing and activity history, not a board or configurable workflow.
- 2026-10-23: User confirmed storage and Server Action test seams. Storage slice adds schema v5, validated job writes, immutable history, atomic combined activity, durable duplicate protection, ownership checks, and bounded SQL search/filter/pagination. Five focused tests cover restart, stable timestamp ties, invalid input, stale writes, wrong ownership, and injected transaction failure. Actions and UI follow. Existing Zod/SQLite dependencies suffice; see ADR-0001.
- 2026-10-23: Completed Server Actions, `/jobs` list/create, `/jobs/[id]` field/activity forms and plain-text history, and Jobs sidebar navigation. Installed Native Select and Pagination through the shadcn CLI after checking its catalog. Seven new storage/action tests pass; the full suite passes all 69 tests. Typecheck, lint and production build pass. Legacy migration fixtures now remove v5 tables before simulating older schemas. See [manual checks and evidence](../../../docs/job-tracker-checks.md). No browser/visual checks ran; user visual acceptance remains pending.
- 2026-10-23: Inline Standards/Spec review against pre-ticket commit `1ba1e5a` found no remaining issues after correcting refreshed status selection, uncertain retry keys/versions, and form identity across job navigation. Reused shadcn FieldSet and Empty primitives. Final review evidence is in `docs/job-tracker-checks.md`. Next.js feedback pass found no qualifying framework friction during this ticket.
- 2026-10-23: User asked for a conventional admin-dashboard UI. `/jobs` is now a shadcn Table (installed with the CLI) with search/status toolbar and a **New job** dialog. `/jobs/[id]` has a two-column layout: chronological activity timeline with the update composer below, a Details side panel, and an **Edit** dialog that stays open on errors to keep unsent input. Storage and Server Actions are unchanged; tests, typecheck, lint and build pass. Visual acceptance is user-run (`docs/job-tracker-checks.md`).

- 2026-10-23: Status set to `resolved` during docs cleanup; every acceptance box was already ticked.
