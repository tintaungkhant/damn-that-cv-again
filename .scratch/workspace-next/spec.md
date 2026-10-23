# Workspace next: attachments, applications, and navigation

Status: Planned on 2026-10-23 from the user's requested follow-up to Tickets 01–09. No implementation is included.

Implementation tickets continue at 10 in `issues/`. `docs/product-spec.md` remains the product scope source. Defaults below are implementation starting points, not existing behavior.

## Chat attachments

Both profile and build chats accept PDF, DOCX, UTF-8 text (`.txt`, `.md`), and images (`.png`, `.jpg`, `.jpeg`, `.webp`). Attachments are context for the assistant, not merely downloadable files. Users can select multiple files, remove selections before sending, and send files with optional accompanying text. Show each saved attachment's filename, type, size, and a download action in its message.

Initial limits: five files per message, 10 MiB per file, and 20 MiB combined. Enforce limits and content validation on the server before saving or contacting the provider. Configure the Server Action body limit with transport overhead in mind. Reject unsupported, mismatched, encrypted, corrupt, or unreadable documents with a useful error. Never silently truncate or ignore a file. Treat filenames and extracted content as untrusted input; never execute document content or resolve embedded remote resources.

Ticket 10 verifies the installed SDK's input capabilities, provider limits, and maintained package options. Prefer native PDF/image inputs if the isolated adapter supports them. Use a maintained DOCX extraction package. Text extraction is acceptable only when it preserves usable content; scanned PDFs must use supported native document handling or fail explicitly. Do not imply OCR support without proving it. Record the actual format matrix before Ticket 11 starts. If a promised format cannot be supported within project rules, flag the conflict rather than silently reducing scope.

Persist original bytes, metadata, message ownership, and reproducible provider input. SQLite BLOB storage is the initial preference for transactional consistency; Ticket 10 checks the memory and Server Action transfer costs against the limits. Do not introduce a file service unless evidence requires one. Originals never use user-provided filesystem paths. Attachment storage belongs to the local user and originating chat/message; reject cross-chat IDs. Existing text-only messages remain valid after migration.

Saving a user message and its attachments is atomic. Failed replies preserve the files, and retry reuses the same immutable message and attachment inputs without another upload or duplicate message. Reopening a chat rebuilds context including its attachments. Context overflow is actionable, never hidden truncation. Deleting a chat deletes its attachments without affecting confirmed profile history or accepted documents in other chats. File content cannot approve profile changes or CV revisions; existing approval rules remain.

All upload and download operations use validated Server Actions. No Route Handlers, object-storage URLs, or browser calls to an API endpoint. Implement a bounded serializable download result and browser-created Blob. Verify binary round trips and realistic payload sizes through the installed React/Next.js transport.

## Applied-job tracker

Add **Jobs** (`/jobs`) to primary navigation. Track applications independently of chats. Each job has a required HTTP(S) URL and title, optional plain-text description, a fixed status, creation/update timestamps, and a version used for stale-write detection. URLs are saved links; no fetching, scraping, metadata import, or automatic AI work.

Initial statuses: **Saved**, **Applied**, **Interviewing**, **Offer**, **Rejected**, **Withdrawn**. Default to **Applied**, matching the user's main use case, but allow choosing another status at creation. Allow movement between any statuses without workflow automation. Duplicate URLs are allowed because separate applications may share a posting URL.

The list shows title, clickable URL, status, and last update. Search title, URL, and description; filter by status; sort by latest update with a stable tie-breaker. Use bounded server-side pagination (25 items per page). Provide create and empty states. Details open at `/jobs/[id]` so a job can be reopened directly.

Use a simple Jira-like detail view: editable job fields, status selector, comment composer, and one chronological activity timeline. A user can add a plain-text comment, change status alone, or submit status plus comment together. The combined operation is one atomic event and transaction. A blank comment with no effective change is rejected. Use server timestamps and deterministic ordering.

The timeline records creation, each effective field edit with old/new values, each status transition with old/new status, and each comment. Preserve full previous description values as history. Treat comments as plain text; never render HTML. Events and comments are append-only in this slice: no edit or delete controls. Field/status updates compare the displayed version; stale writes fail with a refresh instruction and preserve unsent input. No-op field updates produce no event. Comment-only submissions do not overwrite job fields. Prevent duplicate events from repeated submission of the same operation.

No boards, drag/drop, custom statuses, reminders, contacts, job attachments, deletion, bulk edits, CV/chat links, or automatic synchronization with build-chat job settings. Existing build-chat settings remain a separate tailoring input. Add those relationships only if requested later.

## Navigation and document panel

Keep primary navigation bounded: Home, Career profile, CV chats, Profile chats, and Jobs. Add category pages at `/chats?category=build` and `/chats?category=profile`. Each page supports title search, stable latest-update sorting, create/open/delete, and server-side pagination at 25 chats per page. Preserve existing direct chat URLs and deletion confirmations. Queries must be bounded in storage, not load every chat and filter in the browser.

Show at most five recent chats per category in the sidebar, with **View all** links. An older active chat remains identifiable through its page title and breadcrumb; do not append unlimited active entries. Category navigation stays accessible when the sidebar collapses. Validate behavior with at least 50 build chats and 70 profile chats, including older search matches and identical timestamps. No virtualization package is needed for bounded lists unless measurements prove otherwise.

Desktop chat workspaces retain the resizable document panel and gain explicit **Hide workspace** / **Show workspace** controls. Hiding it gives conversation the available width. Showing it restores the selected tab and last expanded width. Review actions reveal the relevant tab when collapsed; they do not approve documents. Preserve unsaved job settings and conversation state across hide/show. Persist width and open/closed preference locally across navigation and reload, with safe defaults for absent or invalid values. Below 1024px retain the existing workspace Sheet; desktop preference must not make the mobile sheet inaccessible. Clamp restored width to available space.

Reuse shadcn Sidebar, Input, Select, Table/Item, Pagination, Sheet, and existing Resizable primitives where appropriate. Check the current catalog and install missing primitives with the CLI during implementation. Preserve keyboard access and clear accessible control names.

## Delivery and verification

1. **10**: Attachment provider/transport feasibility and package decision.
2. **11**: Complete attachment persistence, provider context, Server Actions, and composer/message UI.
3. **12**: Complete job storage, history, Server Actions, list, and detail UI.
4. **13**: Bounded chat navigation and collapsible workspace; integrates Jobs navigation after 12.
5. **14**: Integrated behavior checks, documentation, and user-run UI acceptance.

Read relevant installed Next.js guides before code changes. Run behavior tests, typecheck, lint, and build for each coherent implementation chunk. No agent browser or visual tests under `.ai/rules/testing.md`. Supply exact manual scenarios to the user. Commit code, affected documentation, and ticket acceptance updates together. Package research must precede non-trivial parsing or new infrastructure.
