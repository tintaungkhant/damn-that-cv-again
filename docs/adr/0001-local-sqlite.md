# ADR-0001: Local SQLite storage and migrations

Date: 2026-10-23
Status: Accepted for Ticket 02

## Context

The personal app needs five durable tables and category-specific deletion. Local runtime checks returned Node 26.11.1, Bun 1.4.4, and SQLite 3.53.4 through `node:sqlite`. Next.js runs on Node; Bun manages packages and launches scripts. Node types now match the required runtime.

## Decision

Use Node's built-in `DatabaseSync` from `node:sqlite`. Store data at `data/app.sqlite`, resolved from the project root, and ignore the entire data directory in Git. Use prepared statements, foreign keys, WAL, and a five-second busy timeout.

Use SQLite's `PRAGMA user_version` for sequential schema versions. Apply the initial schema and stable `local-user` seed inside one `BEGIN IMMEDIATE` transaction. Reopening version 1 is idempotent. Reject unsupported newer versions and roll back failed initialization. Future schema changes must add a new version transition; never edit an already-applied migration to change existing databases.

Messages and CV revisions reference chats with `ON DELETE CASCADE`. Profile revisions belong to the user independently of chats, so deleting either chat category cannot remove the confirmed profile. Build deletion requires an explicit confirmation flag, checked against the stored category.

The CV table stores JSON without defining the content contract. Ticket 05 still owns that contract and user approval. No provider or generation work belongs to this ticket.

## Alternatives and scope

Reviewed `better-sqlite3`, the `sqlite` wrapper's migrations, and Drizzle's node:sqlite support. Better-sqlite3 adds a native addon and separate type package; the sqlite wrapper adds another driver; Drizzle adds schema tooling beyond the current five-table foundation. The built-in driver already passed the local runtime check.

The small version transaction uses SQLite's built-in migration state rather than a general migration framework. Handwritten SQL keeps this single initial migration explicit without introducing an ORM or additional driver. Reconsider a migration package if later migrations require more machinery.

## Consequences and validation

Node >=26.11.1 is required. `bun run dev` and `bun run start` invoke the Node-based Next CLI on port 3800; do not substitute Bun's runtime for Node. Storage tests use real temporary SQLite files and the public storage interface. Browser tests were excluded at the user's request.

Application backup/restore was retired with Ticket 08 by user request on 2026-10-23. Credentials are never written by this storage layer.

## Sources checked

- https://nodejs.org/api/sqlite.html
- https://github.com/WiseLibs/better-sqlite3
- https://github.com/WiseLibs/better-sqlite3/releases
- https://github.com/thelocalbranch/node-sqlite
- https://orm.drizzle.team/docs/get-started/node-sqlite-new
- https://ui.shadcn.com/docs/installation/next
- https://ui.shadcn.com/docs/components
- https://ui.shadcn.com/blocks

The shadcn CLI recognized this installed Next.js project and Tailwind v4, initialized the theme, and installed the UI components. Installed Next.js guides for Server Actions, `use server`, `io`, and `revalidatePath` informed the request-time reads and mutation flow.

## Ticket 04 extension

Schema v2 adds `profile_proposals` and a permanent `profile_block_ids` ledger in a sequential transaction, preserving the v1 tables and history. Proposals reference their source user message and chat, so chat deletion removes unsaved proposals but never confirmed profile revisions. An assistant reply and its validated proposal commit atomically only after provider completion. New pending batches supersede previous pending batches in that chat only after successful completion.

Approval recomputes the preview inside `BEGIN IMMEDIATE` and compares the current revision to the revision the user reviewed. Stale operations can reapply only when each existing target (including insertion anchors) is unchanged. Conflicts require reconciliation and a new approval. Undo appends the historical document as a new revision; it does not delete history or release used block IDs. Revisions use SQLite insertion order to resolve equal timestamps deterministically. Public profile records are plain objects for React transport.

## Ticket 06 extension

Schema v3 adds per-build-chat settings, a settings version, and an explicit accepted-revision pointer in `build_context`. CV revisions retain their source profile revision and the accompanying selection explanation separately from CV JSON. Existing tables and documents migrate in place; the latest previously accepted revision initializes the pointer.

Successful replies save assistant text, profile proposals, and CV drafts in one transaction. Every CV claim must reference a confirmed block in its request's profile snapshot; Open questions cannot support claims. Snapshot references preserve evidence context if the shared profile later changes. This validates references, not semantic truth; career-editor instructions and manual realistic-input checks cover factual wording.

Acceptance changes only the explicit pointer and marks the selected draft accepted. Discard applies only to drafts. Restore appends a draft from history and requires a separate acceptance. Accepted history is never overwritten. Revision mutations compare the accepted pointer reviewed by the user and reject active replies; settings use an optimistic version check. Deleting a build chat cascades to its settings and CVs.

## Ticket 11 extension: attachment persistence

Schema v4 adds `attachments`, owned by a source message with cascade deletion. Originals are BLOBs; immutable prepared text, page counts, and preparation version accompany them. Normal message reads return only plain metadata. Download and provider-input reads join through the owning chat and local user. A message and its attachments commit in one transaction; retry changes only the original message status.

This is an additive local migration. Existing text messages, profile proposals/history, and CV data remain unchanged. Mixed old/new writers are not supported: older binaries reject v4 rather than opening it incorrectly. Rollback means restore a pre-upgrade database copy with the previous binary; do not lower `user_version` or drop attachment records on a database used by the new application. The app does not provide automated backup/restore.

File preparation runs outside the Next bundle in a terminable Node worker, one upload at a time, with maintained format parsers and the limits in the workspace spec. A fixed loader imports the application-owned parser path at runtime; filenames never become paths. This avoids Turbopack rewriting parser-internal `require.resolve()` into a numeric module ID. The supported local runtime retains the full checkout and installed dependencies. Server Actions validate raw files, never client-provided prepared snapshots. Claude-specific block types remain in its adapter.

## Ticket 12 extension: job applications

Schema v5 adds independently owned jobs, append-only activity, and durable submission keys. Existing chat settings remain separate. Reuse the existing Node SQLite driver and Zod: prepared queries and transactions already provide the required storage behavior without another ORM or migration package. The application-specific history and optimistic version rules use direct SQL.

Creation records a full initial snapshot. Effective edits retain complete old/new values. Status plus comment commits as one event with the job version and submission key; failed writes roll back all three. Keys bind to the normalized operation payload and owner, so identical retries succeed without another event while mismatched reuse fails. Field no-ops record a submission key but no activity or version change. Comment-only writes preserve fields and increment the version. SQLite timestamps and integer event IDs give deterministic chronological activity; lists use updated timestamp and ID with 25-row pagination.

Migration is additive and preserves v4 data. Older binaries reject v5. Rollback requires a pre-upgrade database copy and the prior binary; never lower the schema version on a database used by the new application.

## Ticket 13 extension: bounded chat navigation

Schema v6 adds `chats.updated_at` and an index on owner, category, update time, and ID. Creating a chat and saving a user message set it; migration backfills each chat from its latest message, or its creation time when it has none. SQLite cannot add a column with a non-constant default, so the column defaults to an empty string and the migration fills it in the same transaction. Chat lists order by update time then ID, search titles case-insensitively in SQL, and return at most 25 rows per page; the sidebar asks for five per category.

Migration is additive and preserves v5 data. Older binaries reject v6. Rollback requires a pre-upgrade database copy and the prior binary.

Ticket 14 verified the chain end to end: a populated v3 database written by the pre-feature storage code migrates to v6 in the built app with messages, profile history, CVs, and build settings unchanged (`.scratch/workspace-next/acceptance/findings.md`).
