# Job tracker checks

Ticket 12 adds `/jobs`, direct `/jobs/<id>` details, and the Jobs sidebar link. It stores links without requesting their contents. Build-chat tailoring settings remain independent.

## Automated evidence

`lib/storage/jobs.test.ts` exercises the public storage interface with real SQLite databases: six statuses and Applied default, creation snapshots, effective field changes and no-ops, comment-only and status-only updates, atomic combined activity, stale-write rejection, durable duplicate protection, validation, wrong ownership, stable 25-row pagination with equal timestamps, literal search, restart, and additive v4 migration. An injected database failure verifies rollback; database triggers protect activity from update and deletion. Migration checks preserve existing attachments, chats, and independent build settings.

`lib/storage/job-actions.test.ts` calls the actual exported Server Actions against real SQLite. It checks malformed raw input, unsafe URLs, successful creation/editing, repeat submissions, stale errors, blank activity, unknown status, and missing records. Node resolution hooks supply the server-only environment marker and extension resolution; application modules are not mocked.

## User-run checks

No agent browser or visual checks are allowed by `.ai/rules/testing.md`. Run `bun run dev`, open `http://localhost:3800/jobs`, and check these scenarios:

1. Check Jobs navigation in expanded and collapsed sidebar modes. Create an application with a title and HTTP(S) URL. Leave description empty and status at Applied. Confirm its direct detail URL, creation event, and initial values. Reopen after a server restart.
2. Create another application with the same URL and a different status. Duplicate URLs should work. Try an invalid URL and a blank title; saving must fail. Links open externally only when clicked.
3. Edit title, URL, and a multiline description. Check complete previous/new values in one detail event. Save unchanged fields; no new event should appear.
4. Post a comment alone, change status alone, then submit both together. Check one chronological event for each submission; the combined event must contain both changes. Confirm the selected status stays current after saving.
5. Enter `<script>alert(1)</script>` and `<b>hello</b>` in a comment. They must appear literally as text. No comment or event has edit/delete controls.
6. Open one job in two tabs. Save a field or status change in the first. Attempt a write from the older second tab. It must reject with a refresh instruction and keep unsent fields/comment. Use **Refresh saved job (keep input)**, reconcile your input, then save again.
7. Search using a title, URL fragment, and description fragment. Filter by every status. With more than 25 matching applications, check next/previous links retain search and filter values. An empty result must explain how to continue.
8. Repeat a submission quickly; check only one event appears. If a transport error occurs, retry unchanged input before making another edit. The submission key remains stable for that retry.
9. Open a build chat and verify its Job tab settings do not change when tracker jobs change. Check keyboard focus, labels, narrow-screen wrapping, timeline readability, and pending/error notices.

Input limits: title 200 characters, URL 4,000, description/comment 100,000 each, search 200. Pagination accepts positive integer pages up to 1,000,000. Existing job links do not trigger scraping or AI calls.

## Review

Review baseline: `1ba1e5a48fb1084f67112836ad36d679205669bf`. Standards and spec review run inline, as required by `.ai/rules/agent-workflow.md`. Visual acceptance remains user-run.
