# Damn! That CV Again

A local workspace for keeping your career history up to date through conversation and producing CVs tailored to each job. Claude runs through your local Claude subscription login. All data stays in a SQLite file on your machine.

## Requirements and startup

Use Node 26.11.1 or newer and Bun 1.4.4. Sign in to Claude Code locally before sending a message. Run commands from the repository root:

```sh
bun install
bun run dev
```

Open http://localhost:3800. For production, run `bun run build` and then `bun run start` (same port).

Run only one app server against the database at a time. Keep the full checkout and installed `node_modules`: file preparation runs `lib/attachments/parser.mjs` in a separate Node worker.

## Using the app

### Navigation

The sidebar links to Home, **Career profile**, **CV chats**, **Profile chats**, and **Jobs**. Each chat category shows its five most recently active chats, then **View all**. The category pages (`/chats?category=build` and `/chats?category=profile`) search titles and show 25 chats per page. Create chats with **New chat**. Delete them from the sidebar (**⋯ → Delete chat**) or from a category page. Deletion asks for confirmation.

A chat page shows the conversation beside a resizable workspace panel. On wide screens, **Hide workspace** gives the conversation the full width, and **Show workspace** restores the last tab and width. Below 1024px the workspace opens as a sheet from **Workspace**.

### Profile chats

Paste rough career notes. Claude proposes block-based edits to your one shared career profile. Review the line changes or the before/after comparison, then use **Approve whole batch** to save. Nothing is saved without approval. **Ask for a revision** prepares a message you can edit. **History** shows earlier profiles; restoring one adds a new revision. If another chat changed a targeted block, use **Ask to reconcile**. The confirmed profile and its history also appear on **Career profile** (`/profile`).

### CV chats

In the workspace **Job** tab, save a job description, an optional target role and company, and a project limit (default five). Use **Prepare draft request**, then send the message. A completed CV saves as a draft. Review it as a readable CV or raw JSON, then accept or discard it. The accepted CV stays visible while you discuss new drafts. **History** restores any revision as a new draft that needs acceptance. Profile or job changes never rewrite saved CVs. CV chats can also propose new profile facts, which go through the same approval. Use **Copy JSON** or **Download JSON** under Accepted CV to export the accepted revision without internal evidence or selection notes. The CV format is described in `docs/cv-schema.md`.

### Attachments

Both chat categories accept PDF (including scans), DOCX, UTF-8 TXT/MD, and PNG/JPEG/WebP files as context for Claude. Use **Attach files**, remove files before sending if needed, and send with or without text. Saved files show their name, type, size, and a download control. Reopening a chat or retrying a message reuses the saved files. DOCX is text only: embedded images and layout are not analyzed.

Limits: five files per message, 10 MiB each, 20 MiB combined. Files that break a limit, or a chat whose history grows too large, are rejected with an error. Nothing is silently dropped or shortened. Deleting a chat deletes its files. Exact limits: `docs/attachment-checks.md`.

### Jobs

**Jobs** (`/jobs`) is a table of your applications with search, a status filter, and 25 rows per page. **New job** saves a title, an HTTP(S) link, an optional description, and a status (default **Applied**). Each job has its own page with an activity timeline. You can edit fields, change among six statuses, and add plain-text comments. Every change is kept in the history. A status change plus a comment saves as one event. Links are stored only; the app never fetches them. CV chat job settings are separate from tracked jobs.

### Replies and failures

Replies stream as they are written. Use **Stop reply** to stop one. A failed or interrupted reply keeps your message and offers **Retry saved message** without duplicating it. Unfinished replies become failed messages when the app restarts. Replies time out after five minutes. Subscription limits and context limits show separate errors.

## Data

The database is `data/app.sqlite`. It is created, with a stable local user, on first start. Keep the whole `data/` directory out of Git. Stop the app before copying database files, including the `-wal` and `-shm` files. To start from an empty workspace, stop the app and delete `data/app.sqlite*`. There is no in-app backup or restore. Credentials never go in the database.

Storage and migration decisions: `docs/adr/0001-local-sqlite.md`.

## Checks

```sh
bun run test
bun run typecheck
bun run lint
bun run build
```

Tests cover storage, migrations, validation, chat streaming, failure, retry, profile proposals, CV drafts, export, attachments, jobs, chat lists, the workspace panel preference, React transport, and provider errors. Following `.ai/rules/testing.md`, no browser or visual tests run. Visual checks are manual:

- `docs/workspace-acceptance.md`: the full checklist for wide and narrow screens. `node .scratch/workspace-next/acceptance/workspace.ts` serves a disposable 120-chat workspace at http://localhost:3801 without touching `data/app.sqlite`.
- `docs/attachment-checks.md`, `docs/job-tracker-checks.md`, `docs/navigation-checks.md`: detailed checks for each feature.

## Project docs

- Product scope, including deferred features: `docs/product-spec.md`
- Agent rules: `AGENTS.md` and `.ai/rules/`
- Specs, tickets, and verification evidence: `.scratch/v1/`, `.scratch/ai-ui/`, `.scratch/workspace-next/`
