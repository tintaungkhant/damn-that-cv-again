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

Create chats with **New chat** in the sidebar; each chat has its own page at `/chats/<id>`. Reopen or delete chats from the sidebar (**⋯ → Delete chat**). Chats persist across restarts. Deletion asks for confirmation; build chat deletion removes its messages and CV revisions, and deleting a profile chat preserves saved profile history. The confirmed profile and its history also have their own page, **Career profile** (`/profile`). Claude replies stream through Server Actions in both chat categories. Messages survive restarts; failed or interrupted replies offer retry without duplicating the user message. Stop a running reply with **Stop reply**. Career notes become block-based profile proposals through Claude’s `propose_profile_edit` tool. Review the line changes or the before/after comparison in the workspace panel beside chat, then use **Approve whole batch** to save. **Ask for a revision** prepares a message you can edit and send. **History** lets you view and restore a prior profile; restoring adds a revision. Conflicting stale proposals require reconciliation and approval again. Build chats can also propose profile facts. Save a job description, optional target role/company, and a project limit (default five) in the workspace **Job** tab. Prepare a draft request and send it: completed CV proposals save automatically as drafts. Review the readable CV or raw JSON, then accept or discard. The accepted CV remains visible while new drafts are discussed. History restores any revision as a new draft requiring acceptance. Profile or job-detail changes never rewrite saved CVs. Use **Copy JSON** or **Download JSON** under Accepted CV to export the current accepted revision without evidence or selection notes.

Run one app server against this database at a time. On app startup, unfinished requests become failed messages ready for retry. Replies have a five-minute safety timeout.

Claude uses the local Claude subscription login, with API-key variables removed from its child environment. Sign in locally with Claude Code before sending a message. Subscription and context limits produce separate errors.

SQLite initializes and seeds the stable local user on first use. Data lives in `data/app.sqlite`; keep the entire `data/` directory out of Git. Stop the app before manually copying database files, including any WAL files. In-app backup and restore was retired by user decision (Ticket 08). Credentials do not belong in the database.

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

Profile verification: `.scratch/v1/profile/findings.md`. To check the UI manually, paste rough notes into a profile chat. The confirmed profile must stay empty until approval. Compare **Changes**, **Before**, and **After approval**, ask for a revision, approve, reopen, and try **History → Restore this revision** in the chat workspace or on **Career profile**. If another chat changes a targeted block, use the workspace refresh button and **Ask to reconcile**. Profile refresh is explicit; another tab does not update automatically.

## CV contract

Ticket 05 provides the tested CV schema approved by the user on 2026-10-23. Ticket 06 generation uses this contract. Review field definitions in `docs/cv-schema.md` and synthetic examples in `docs/examples/cv/`. `lib/storage/cv.ts` validates internal claims and removes evidence from export JSON; Ticket 07 adds Copy JSON and Download JSON for the current accepted revision. Ticket 06 adds the build workflow without changing that approved contract.

## Build CV verification

Checks and synthetic live evidence: `.scratch/v1/build/findings.md`. Schema, storage, provider, service, and React transport behavior are tested without browser or visual automation. Evidence IDs must reference confirmed profile blocks in the request snapshot; factual wording still needs human review.

To check the UI at http://localhost:3800, open a Build CV chat, paste a job description in the workspace **Job** tab, set optional targets/project count, and save. Click **Prepare draft request**, then send the message. Read the CV and selection notes; switch to **Raw JSON**. Accept the draft, request a revision, discard that new draft, and confirm the accepted CV remains. In **History**, choose a revision and **Restore as a new draft**; review and accept separately. Reopen the chat to check saved job details and history. Use the workspace **Profile** tab to review any newly discovered facts before including them in a CV. Visual and factual review remain manual.

## CV export verification

Open a Build CV chat at http://localhost:3800 and accept a draft. In the workspace **Accepted** tab, use **Copy JSON**, paste into a text editor, and use **Download JSON** to save the same content as a `.json` file. Check custom sections and omitted fields; neither export should contain evidence or selection notes. Generate a new draft and confirm exports still use the accepted CV. Clipboard access failure offers download instead. Browser interactions and visual checks remain manual under `.ai/rules/testing.md`. Server Action transport checks use synthetic data in `.scratch/v1/export/transport.ts`.

## Fictional trial workspace and model

Ticket 08 (in-app backup/restore) is retired. Ticket 09 pins `claude-sonnet-5-5` after a paired realistic-input trial; automatic SDK compaction is disabled, and unexpected compaction produces a context-limit error rather than silently shortening context. Resolved model information stays in usage events, outside CV exports.

A complete fictional Alex Morgan workspace is installed for manual review: six chats, 61 messages, three profile revisions, four CV revisions, two accepted CVs, a shorter draft, discarded history, one pending profile proposal, and one deliberately failed message for retry. The user's previous test database was archived and verified before replacement with explicit authorization. The archive path is recorded locally in `data/trial-workspaces/install.json`; data and archives remain outside Git.

Follow `docs/trial-guide.md` at http://localhost:3800. Trial measurements and the active acceptance audit are in `.scratch/v1/hardening/findings.md`. Automated checks pass; manual UI/editorial acceptance is still open. Initial discussion history is explicitly labeled synthetic; generated CVs and the pending profile proposal came from live Claude calls.


## AI conversation UI

The app uses a shadcn Sidebar shell with separate pages: Home (`/`), a chat page (`/chats/<id>`), and **Career profile** (`/profile`). A chat page shows the conversation beside a resizable workspace panel; below 1024px the workspace opens as a sheet from **Workspace**.

Chat follows the official shadcn AI Elements patterns (https://ui.shadcn.com/docs/ai-elements): Chat (Message Scroller with auto-scroll, Message, Bubble), Prompt Input (Input Group), Suggestion, Message actions (copy with tooltip), Marker for in-progress status and retry, a Confirmation-style Item for pending profile changes and CV drafts, and Context (a Hover Card with the last reply's token usage; no context-window percentage is shown because the limit is not reported). Markdown code fences and raw CV JSON use Code Block with Shiki highlighting; proposed profile edits show a line diff (Code Block lines, computed with `diff`). Notices use Sonner toasts. Components are installed with the shadcn CLI; the existing Server Action transport remains in use. No reasoning, sources, or tool traces are invented.

Manual check at http://localhost:3800: create a chat from the sidebar, choose a starter prompt, and edit before sending. Confirm Enter sends, Shift + Enter adds a newline, and composing text with an IME does not send. Read a long Markdown reply, scroll upward during streaming, and use the return-to-latest button. After a proposal, use the in-thread **Review** item to open the workspace tab. Check narrow screens (sidebar sheet, **Workspace** sheet), resizing the panel, Stop reply, failed-message retry, and the token usage hover card. Proposed profile changes and CV acceptance must still require explicit approval. Browser and visual checks remain user-run under `.ai/rules/testing.md`.
