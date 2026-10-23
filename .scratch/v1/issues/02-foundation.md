# 02: Foundation: SQLite, seeded user, chat CRUD

Status: resolved
Blocked by: 01

## Goal

Durable storage and the chat list.

## Scope

- Choose a SQLite library and migration mechanism after checking the runtime (`node:sqlite` vs `better-sqlite3`). Record the choice as an ADR.
- Tables: users, chats (category `profile` or `build`), messages, profile revisions, CV revisions.
- Seed one user with a stable ID.
- Initialize shadcn/ui (check its docs for Next.js 16 and Tailwind v4 support first). Build all UI from its components.
- Chat list UI grouped by category: create, open, delete. Reads happen in Server Components; create and delete are Server Actions. No API endpoints (`.ai/rules/server-actions.md`). Build chat deletion asks for confirmation and removes its messages and CV revisions. Profile chat deletion leaves the saved profile untouched.

## Acceptance

- [x] Chats in both categories survive an app restart (acceptance condition 1).
- [x] Deletion follows the category rules (acceptance condition 8).

## Comments

Implemented 2026-10-23. Storage, initial migration, and stable seed live in `lib/storage/store.ts`; the server-only connection is in `lib/db.ts`. ADR: `docs/adr/0001-local-sqlite.md`. Category-grouped UI and validated Server Actions live in `app/page.tsx`, `app/actions.ts`, and `components/chats/forms.tsx`. shadcn components were installed with its CLI. Development and production serve on port 3800 as requested.

The user approved storage tests only. Real SQLite tests cover reopening in another Node process, deletion confirmation, dependent records, shared profile preservation, input validation, and newer-version refusal. Typechecking, lint, and production build passed. An HTTP smoke check returned 200 at localhost:3800. No browser interaction tests were run.

Ticket 01 is complete based on its checked acceptance and spike evidence. Ticket 05 still owns the exact CV JSON contract; this foundation stores opaque JSON only. Messaging and provider integration remain Ticket 03.
