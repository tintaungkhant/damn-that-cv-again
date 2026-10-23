# Job tracker checks

Ticket 12 adds `/jobs`, direct `/jobs/<id>` details, and the Jobs sidebar link. The list is a table (title, status, link host, updated) with search, status filter, and pagination; **New job** opens a dialog. The detail page shows the activity timeline with an update composer below it, a Details panel (status, dates, description), and **Edit** in a dialog. It stores links without requesting their contents. Build-chat tailoring settings remain independent.

## Automated evidence

`lib/storage/jobs.test.ts` exercises the public storage interface with real SQLite databases: six statuses and Applied default, creation snapshots, effective field changes and no-ops, comment-only and status-only updates, atomic combined activity, stale-write rejection, durable duplicate protection, validation, wrong ownership, stable 25-row pagination with equal timestamps, literal search, restart, and additive v4 migration. An injected database failure verifies rollback; database triggers protect activity from update and deletion. Migration checks preserve existing attachments, chats, and independent build settings.

`lib/storage/job-actions.test.ts` calls the actual exported Server Actions against real SQLite. It checks malformed raw input, unsafe URLs, successful creation/editing, repeat submissions, stale errors, blank activity, unknown status, and missing records. Node resolution hooks supply the server-only environment marker and extension resolution; application modules are not mocked.

## User-run checks

No agent browser or visual checks are allowed by `.ai/rules/testing.md`. Run `bun run dev`, open `http://localhost:3800/jobs`, and check these scenarios:

1. Check Jobs navigation in expanded and collapsed sidebar modes. Use **New job** to create an application with a title and HTTP(S) URL. Leave description empty and status at Applied. Confirm its direct detail URL, creation event, and initial values. Reopen after a server restart.
2. Create another application with the same URL and a different status. Duplicate URLs should work. Try an invalid URL and a blank title; saving must fail. Links open externally only when clicked.
3. Use **Edit** to change title, URL, and a multiline description; the dialog closes with a saved notice. On a stale-write error the dialog stays open with your input. Check complete previous/new values in one detail event. Save unchanged fields; no new event should appear.
4. Post a comment alone, change status alone, then submit both together. Check one chronological event for each submission; the combined event must contain both changes. Confirm the selected status stays current after saving.
5. Enter `<script>alert(1)</script>` and `<b>hello</b>` in a comment. They must appear literally as text. No comment or event has edit/delete controls.
6. Open one job in two tabs. Save a field or status change in the first. Attempt a write from the older second tab. It must reject with a refresh instruction and keep unsent fields/comment. Use **Refresh saved job (keep input)**, reconcile your input, then save again.
7. Search using a title, URL fragment, and description fragment. Filter by every status. With more than 25 matching applications, check next/previous links retain search and filter values. An empty result must explain how to continue.
8. Repeat a submission quickly; check only one event appears. If a transport error occurs, retry unchanged input before making another edit. The submission key remains stable for that retry.
9. Open a build chat and verify its Job tab settings do not change when tracker jobs change. Check keyboard focus, labels, narrow-screen wrapping, timeline readability, and pending/error notices.

Input limits: title 200 characters, URL 4,000, description/comment 100,000 each, search 200. Pagination accepts positive integer pages up to 1,000,000. Existing job links do not trigger scraping or AI calls.

## Review

Review baseline: `1ba1e5a48fb1084f67112836ad36d679205669bf`. Standards and spec review run inline, as required by `.ai/rules/agent-workflow.md`. Visual acceptance remains user-run.

### Standards

No remaining findings. Reviewed AGENTS.md, all six `.ai/rules/` files, ADR-0001, installed Next.js guidance, and the code-review skill's smell baseline. Used existing shadcn FieldSet and Empty components during review. No extra agent, browser automation, API route, or new runtime dependency was introduced.

### Spec

No remaining findings against Ticket 12 and the workspace spec's applied-job tracker section. Review corrected status-selection behavior after refresh, preserved the original operation/version on uncertain retries, and keyed forms by job ID so navigating between jobs cannot reuse another job's input state. Manual scenarios cover unsent-input preservation, literal comments, and display behavior.

Standards: 0 remaining findings. Spec: 0 remaining findings. All 69 behavior tests pass; typecheck, lint and production build pass. Final UI-only review corrections receive typecheck/lint/build checks; visuals remain user-run.
