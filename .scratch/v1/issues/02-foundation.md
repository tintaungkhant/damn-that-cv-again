# 02: Foundation: SQLite, seeded user, chat CRUD

Status: needs-triage
Blocked by: 01

## Goal

Durable storage and the chat list.

## Scope

- Choose a SQLite library and migration mechanism after checking the runtime (`node:sqlite` vs `better-sqlite3`). Record the choice as an ADR.
- Tables: users, chats (category `profile` or `build`), messages, profile revisions, CV revisions.
- Seed one user with a stable ID.
- Initialize shadcn/ui (check its docs for Next.js 16 and Tailwind v4 support first). Build all UI from its components.
- Chat list UI grouped by category: create, open, delete. Build chat deletion asks for confirmation and removes its messages and CV revisions. Profile chat deletion leaves the saved profile untouched.

## Acceptance

- [ ] Chats in both categories survive an app restart (acceptance condition 1).
- [ ] Deletion follows the category rules (acceptance condition 8).

## Comments
