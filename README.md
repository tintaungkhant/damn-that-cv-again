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

Create, reopen, and delete profile or build CV chats. Chats persist across restarts. Build chat deletion asks for confirmation and removes its messages and CV revisions. Deleting a profile chat preserves saved profile history. Messaging and AI generation are later tickets.

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

Tests cover real SQLite persistence, input validation, deletion confirmation, dependent records, and preservation of shared profile history. No browser test suite is included.
