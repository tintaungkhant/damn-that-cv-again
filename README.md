# Personal AI CV Builder

A local workspace for career notes and tailored CV conversations.

## Requirements and startup

Use Node 26.11.1 or newer and Bun 1.4.4. Run commands from the repository root:

```sh
bun install
bun run dev
```

Open http://localhost:3800. Both development and production use port 3800.

For production:

```sh
bun run build
bun run start
```

## Current functionality

Create, reopen, and delete profile or build CV chats. Chats persist across restarts. Build chat deletion asks for confirmation and removes its messages and CV revisions. Deleting a profile chat preserves saved profile history. Plain-text Claude replies stream through Server Actions in both chat categories. Messages survive restarts; failed or interrupted replies offer retry without duplicating the user message. Stop a running reply with **Stop reply**. Career notes become block-based profile proposals through Claude’s `propose_profile_edit` tool. Review the before/after comparison beside chat, then use **Approve whole batch** to save. **Ask for a revision** prepares a message you can edit and send. **History** lets you view and restore a prior profile; restoring adds a revision. Conflicting stale proposals require reconciliation and approval again. Build chats can also propose profile facts; structured CV generation remains Ticket 06.

Run one app server against this database at a time. On app startup, unfinished requests become failed messages ready for retry. Replies have a five-minute safety timeout.

Claude uses the local Claude subscription login, with API-key variables removed from its child environment. Sign in locally with Claude Code before sending a message. Subscription and context limits produce separate errors.

SQLite initializes and seeds the stable local user on first use. Data lives in `data/app.sqlite`; keep the entire `data/` directory out of Git. Stop the app before manually copying database files, including any WAL files. In-app backup and restore will arrive in Ticket 08. Credentials do not belong in the database.

Storage and migration decisions: `docs/adr/0001-local-sqlite.md`.
Product scope: `docs/product-spec.md`. Tickets: `.scratch/v1/issues/`.

## Checks

```sh
bun run test
bun run typecheck
bun run lint
bun run build
```

Tests cover real SQLite persistence, validation, deletion, chat context, streaming, failure, cancellation, retry, profile proposals, approval, stale revisions, undo, stable block IDs, React transport, and provider error normalization. No browser or visual tests are run, following `.ai/rules/testing.md`.

Transport feasibility and live Server Action checks: `.scratch/v1/streaming/findings.md`. For a visual check, open a chat at http://localhost:3800, send career notes, and check incremental text, Stop reply, and Retry saved message.

Profile verification: `.scratch/v1/profile/findings.md`. To check the UI manually, paste rough notes into a profile chat. The confirmed profile must stay empty until approval. Compare **Before** and **After approval**, ask for a revision, approve, reopen, and try **History → Restore this revision**. If another chat changes a targeted block, refresh the profile and use **Ask to reconcile**. Profile refresh is explicit; another tab does not update automatically.

## Proposed CV contract

Ticket 05 has a tested schema proposal, awaiting user approval before Ticket 06 generation. Review field definitions in `docs/cv-schema.md` and synthetic examples in `docs/examples/cv/`. `lib/storage/cv.ts` validates internal claims and removes evidence from export JSON; copy/download UI remains Ticket 07. No application behavior changes yet.
