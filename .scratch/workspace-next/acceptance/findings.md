# Ticket 14: integrated acceptance evidence

Date: 2026-10-23. Baseline commit: `2b2ad5a`. Automated acceptance passed. Manual UI acceptance is pending and user-run: see `docs/workspace-acceptance.md`.

## Spec audit

Each requirement in `.scratch/workspace-next/spec.md` maps to evidence below. The automated checks found no defects in the shipped behavior. One script fixture was wrong at first: it tried to send a new message after a failed message. The store correctly rejects that until the failed message is retried, so the fixture was corrected.

| Spec area | Evidence |
| --- | --- |
| Attachment formats, validation, bounds, replay | `lib/ai/attachments.test.ts`, `lib/ai/claude/provider.test.ts`, production check below |
| Atomic message and file saves, retry, cancel, deletion ownership | `lib/storage/attachments.test.ts`, production check below |
| Binary transport (`Uint8Array` download, multipart upload) | Production check below; Ticket 10 `attachments/findings.md` |
| Job fields, statuses, history, stale writes, duplicate submissions, atomic status plus comment | `lib/storage/jobs.test.ts`, `lib/storage/job-actions.test.ts`, production check below |
| Bounded chat lists, 50 + 70 chats, search, ties | `lib/storage/store.test.ts`, production check below |
| Panel preference defaults and clamping | `lib/workspace-preference.test.ts` |
| Migrations v3 → v6 keep existing data | `lib/storage/attachments.test.ts`, `jobs.test.ts`, `store.test.ts`, production check below |
| Visual behavior on both screen sizes | User-run: `docs/workspace-acceptance.md` |

## Production Server Action check

`actions.ts` runs the built app from a temporary directory with its own database. It uses real Server Actions over HTTP, with React's installed `encodeReply` and Flight decoder. It uses synthetic fixtures only.

- **Pre-feature database:** the script runs the storage code from commit `f024bfb` (schema v3, before Ticket 11). That code writes a populated database: a confirmed profile, an accepted CV with build settings, a failed turn, and 120 chats (50 build, 70 profile).
- **No Claude call:** the provider gets an empty Claude config directory and an unroutable API URL. Every reply fails locally with the login error. This tests failure, retry, and cancellation without using the subscription.
- **No browser, no personal data:** `data/app.sqlite` is never opened.

Results, all passed (raw output in the ignored `results/actions.json`):

1. The v3 database is written by the pre-feature code.
2. The production app migrates v3 to v6. Server Actions return legacy messages unchanged. A legacy failed turn retries in place.
3. Invalid uploads return structured errors and save nothing. These include an encrypted PDF, an image-only DOCX, invalid UTF-8, six files, and a forged prepared-attachment payload.
4. PDF, scanned PDF, DOCX, TXT, and MD files persist when the reply fails. Downloads are `Uint8Array` values with SHA-256 identical to the originals. Cross-chat downloads are denied. Normal reads have no bytes.
5. Retry reuses the saved message and attachments. No new message or file is created.
6. An attachment-only PNG/JPEG/WebP message in a build chat survives cancellation. Its downloads are identical to the originals.
7. Job actions validate input and default to Applied. They return the same job for a repeated submission and reject stale, blank, and missing-record writes.
8. A server restart keeps messages, attachment metadata, and original bytes.
9. Deleting a profile chat through `deleteChat` removes its attachments. The build chat's files remain.
10. Confirmed profile history, the accepted CV, CV revisions, and build settings survive migration and the chat deletion.
11. The 120 migrated chats page in storage at 25 per page. Order is unique and stable, categories stay separate, and search is case-insensitive.
12. Job history has one event per effective operation, with old and new values. Status plus comment is a single event.

Reproduce from the repository root after `bun run build` (needs free port 3802):

```sh
mkdir -p .scratch/workspace-next/acceptance/legacy
git archive f024bfb lib/storage | tar -x -C .scratch/workspace-next/acceptance/legacy
node .scratch/workspace-next/acceptance/actions.ts
```

`workspace.ts` uses the same isolated setup (`server.ts`). It serves a synthetic workspace at port 3801 for the manual checklist. A smoke run seeded the workspace and returned HTTP 200 for a category page. It was then stopped, and its temporary data was removed.

## Regression gates

- `bun run test`: 73 passed, 0 failed.
- `bun run typecheck`, `bun run lint`, `bun run build`: passed.

This ticket changed no application code, so it adds no new unit tests. No TDD seam applies.

## Not verified by the agent

Layout, focus, keyboard use, both screen sizes, and real Claude replies to attachments in the browser are user-run. Ticket 11 recorded live Claude replies that used every format after a restart (`attachments/integration.md`). This ticket made no new live call.
