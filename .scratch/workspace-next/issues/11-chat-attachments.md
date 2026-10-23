# 11: Attach files to profile and build chats

Status: ready-for-agent
Blocked by: 10

## Goal

Send persistent files as assistant context in both chat categories.

## Scope

Implement [attachment scope](../spec.md#chat-attachments) using Ticket 10's verified design. Add backward-compatible storage migration, validated upload/download Server Actions, provider-neutral attachment input, adapter mapping, composer selection/removal, and saved-message attachment downloads. Preserve atomic message saves, immutable retries, explicit document approvals, cancellation, and deletion ownership rules.

## Acceptance

- [ ] All four format families work with optional message text, survive restart, and reach provider context after reopen and retry.
- [ ] Type, signature, encoding, size, count, corrupt/encrypted document, cross-chat access, and context-limit failures are tested.
- [ ] Failed upload leaves no partial message/files; failed reply retains the saved attachments; retry creates no duplicates.
- [ ] Binary downloads match original bytes and deleting a chat removes only its attachments.
- [ ] Existing text-only chats, profile approval, CV acceptance, export, and failure behavior still pass.
- [ ] Behavior tests, typecheck, lint, build, docs, and user manual-check instructions accompany each completed chunk.

## Comments

- 2026-10-23: Planned; start only after Ticket 10 resolves provider and transport feasibility.
