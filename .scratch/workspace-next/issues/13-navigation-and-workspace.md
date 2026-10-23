# 13: Scale chat navigation and collapse the workspace

Status: ready-for-agent
Blocked by: 12 (complete)

## Goal

Keep navigation usable with 120 chats and let conversation use the full workspace width.

## Scope

Implement [navigation and panel scope](../spec.md#navigation-and-document-panel). Add bounded storage queries and category pages, fixed primary navigation including Jobs, five recent chats per category, search and 25-item pagination. Extend existing Resizable/Sheet UI with desktop hide/show and local width/open preference. Review actions reveal the selected tab. Preserve unsaved form state while collapsed.

## Acceptance

- [ ] Storage tests cover 50 build and 70 profile chats, stable pagination, old search matches, category isolation, and deletion.
- [ ] Sidebar query fetches at most five recent chats per category; full list queries are bounded.
- [ ] Direct chat links and existing create/delete behavior remain compatible.
- [ ] User checks sidebar collapse, category navigation, Jobs access, and older-chat discovery.
- [ ] User checks hide/show, restored width/tab, reload preferences, unsaved fields, review reopening, and mobile Sheet access.
- [ ] Nonvisual behavior tests, typecheck, lint, build, and synchronized docs pass; no agent browser tests run.

## Comments

- 2026-10-23: Planned. Visual acceptance belongs to the user under `.ai/rules/testing.md`.
- 2026-10-23: Ticket 12 implemented Jobs navigation and application tracking. Reuse the existing Jobs sidebar link while bounding chat navigation; do not add a second Jobs entry.
