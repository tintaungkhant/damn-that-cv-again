# 12: Track applied jobs and activity

Status: ready-for-agent

## Goal

Save job applications and review every comment and change in one detail timeline.

## Scope

Implement [job-tracker scope](../spec.md#applied-job-tracker): SQLite migration, validation, versioned field/status writes, append-only activity, duplicate-submission protection, Server Actions, `/jobs` list, `/jobs/[id]` detail, and Jobs sidebar link. Search/filter/pagination run in storage. Use one atomic operation for status plus comment. Reuse existing dependencies; check the shadcn catalog and install missing components with its CLI.

## Acceptance

- [ ] Required URL/title, optional description, six statuses, Applied default, and persistence work.
- [ ] Comment-only, status-only, and combined submissions produce correct immutable events; combined submissions are atomic.
- [ ] Creation and effective field edits retain old/new values; no-ops do not create history.
- [ ] Invalid URLs/statuses, blank submissions, stale writes, repeated submissions, and missing/wrong-owner records have behavior tests.
- [ ] Stable list pagination/search/status filters and activity ordering work across restart.
- [ ] Comments render as plain text; URL never triggers server fetching; build-chat job settings remain independent.
- [ ] Tests, typecheck, lint, build, synchronized docs, and manual scenarios accompany completed chunks.

## Comments

- 2026-10-23: Planned. Jira-like means simple detail editing and activity history, not a board or configurable workflow.
