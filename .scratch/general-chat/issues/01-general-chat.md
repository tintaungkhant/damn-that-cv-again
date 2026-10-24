# 01: General career chat

Status: ready-for-human

## Goal

Add a third chat category for job-related writing and questions that have no fixed job description or target role, such as a short career summary, a cover letter for a project, or a project proposal. The chat can update the career profile.

## Scope

- Schema v7 rebuilds `chats` so its CHECK constraint allows `general`. Existing data must survive unchanged.
- General chats send the shared profile instructions plus general writing instructions, with no CV tool or build context. Profile edits use the existing `propose_profile_edit` approval flow.
- Navigation, category page, Home card, new-chat dialog, and the chat workspace (profile Changes/Profile/History tabs) support the new category.

## Acceptance

- [x] v6 to v7 migration preserves chats, messages, attachments, proposals, profile history, CV revisions, and build settings, and does not cascade deletes (`lib/storage/store.test.ts`).
- [x] The migration run on a copy of the owner's database left every table identical; a backup exists at `data/archives/app-before-general-chat-2026-10-24.sqlite`.
- [x] General chats list separately, have no CV workspace, stage profile edits that save only after approval, and delete without confirmation while keeping the profile.
- [x] General chat requests carry general instructions and no build context (`lib/ai/chat.test.ts`).
- [ ] User checks the sidebar entry and recent group, `/chats?category=general`, the Home card, the new-chat dialog option, and a general chat's suggestions, placeholder, breadcrumb, badge, and profile workspace.
- [x] Tests, typecheck, lint, and build pass; no agent browser tests run.

## Comments

- 2026-10-24: Implemented. Migration in `lib/storage/store.ts`, instructions in `lib/ai/chat.ts`, shared category labels in `components/chats/categories.ts`. Restart the app server so the running process picks up the v7 migration.
