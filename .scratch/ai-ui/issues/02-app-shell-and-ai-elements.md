# App shell, separate pages, and fuller AI Elements usage

Status: ready-for-human
Type: task

## Scope

Replace the single-page layout with a shadcn Sidebar app shell and separate routes: Home (`/`), chat (`/chats/[id]`), and Career profile (`/profile`). Show each chat beside a resizable workspace panel (a Sheet below 1024px). Use the shadcn AI Elements patterns that fit the existing events: Marker for status and retry, a Confirmation-style Item for pending approvals, Context hover card for token usage, Message copy action, Suggestion row, Code Block for Markdown fences, raw CV JSON, and profile line diffs. Keep the Server Action transport, persistence, cancellation, retry, and explicit approval flows. No storage or provider changes.

## Acceptance

- [x] Check the shadcn component, block, and AI Elements catalogs; install components with the shadcn CLI.
- [x] Sidebar navigation with New chat dialog, per-chat delete confirmation, and Career profile link.
- [x] Chat page with resizable workspace panel and mobile Sheet; in-thread Review items open the matching workspace tab.
- [x] Profile proposals show line changes, after, and before; CV workspace split into Job, Draft, Accepted, History, and Profile tabs.
- [x] Career profile page with history restore (`restoreProfile` accepts a null chat ID).
- [x] Pass typecheck, lint, 53 behavior tests, and production build.
- [ ] User visual acceptance on desktop and narrow screens.

## Comments

2026-10-23: Implemented in `components/app-sidebar.tsx`, `components/chat-nav.tsx`, `components/page-header.tsx`, `components/chats/chat-workspace.tsx` (replaces `conversation.tsx`), `components/chats/cv-review.tsx`, `components/chats/profile-review.tsx`, `components/chats/markdown.tsx`, and `app/chats/[id]/`, `app/profile/`. Chat URLs moved from `/?chat=<id>` to `/chats/<id>`; `.scratch/v1/**` transport scripts updated. Profile chat deletion now also asks for confirmation. Added `diff` for line diffs (the hand-written alternative would be an LCS). `hooks/use-mobile.ts` (CLI-generated) was rewritten on `useSyncExternalStore` to pass lint and to share a `useMediaQuery` helper. shadcn Typeset was not used: it is not a registry item and is copied as a separate CSS file, which conflicts with `.ai/rules/ui.md`. Reasoning, Tool, and Sources patterns are not used because the provider emits no such events; proposal events are not linked to stored messages, so pending work is shown as Review items instead of per-turn traces. Visual acceptance remains user-run.
