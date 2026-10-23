# 11: Attach files to profile and build chats

Status: ready-for-agent
Blocked by: 10 (complete)
Completed: 2026-10-23

## Goal

Send persistent files as assistant context in both chat categories.

## Scope

Implement [attachment scope](../spec.md#chat-attachments) using Ticket 10's verified design. Add backward-compatible storage migration, validated upload/download Server Actions, provider-neutral attachment input, adapter mapping, composer selection/removal, and saved-message attachment downloads. Preserve atomic message saves, immutable retries, explicit document approvals, cancellation, and deletion ownership rules.

## Verified implementation decisions

- Ticket 10 is complete: [findings](../attachments/findings.md). All requested formats have a viable path; application integration is still required.
- Store originals as SQLite BLOBs, with immutable prepared text, preparation version, and relational ownership. Return metadata only in normal chat reads. Reuse saved inputs on retry/reopen; keep SDK types in the isolated Claude adapter.
- Use native async SDK image/document blocks; Mammoth 1.13.0 for DOCX text; file-type 22.2.0 for signatures; PDF.js 6.4.299 for PDF validation; Sharp 0.35.5 for image validation; Yauzl 3.4.0 plus its TypeScript definitions for ZIP inspection. Declare direct application dependencies when implementing; scratch dependencies do not make them production dependencies.
- DOCX is text only. Show the limitation before sending; reject image-only DOCX with PDF/image guidance. Preserve tables' text; never claim embedded images or rendered formatting were analyzed.
- Set the Server Action body limit to `21mb`; enforce five files / 10 MiB each / 20 MiB combined inside the action. Bound filenames to 255 characters and text/metadata to leave multipart headroom. Downloads return a `Uint8Array` and become a browser Blob.
- Apply the spec's extracted-text, ZIP expansion/entry, image dimension/animation, cumulative PDF-page/image, and 30,000,000-byte reconstructed-payload bounds. Parse in a terminable worker with a 15-second deadline and bounded concurrency. Reject instead of truncating. Keep provider context-limit handling.
- Return structured errors for expected validation failures. Framework body parsing can return HTTP 500 before the action runs; add a clear UI transport fallback without assuming every oversized request returns 413.

## Acceptance

- [x] All four format families work with optional message text, survive restart, and reach provider context after reopen and retry.
- [x] Type, signature, encoding, size, count, corrupt/encrypted document, cross-chat access, and context-limit failures are tested.
- [x] DOCX text-only notice, image-only DOCX rejection, ZIP expansion/entry bounds, parser timeout, animation rejection, and cumulative replay limits are covered.
- [x] Failed upload leaves no partial message/files; failed reply retains the saved attachments; retry creates no duplicates.
- [x] Binary downloads match original bytes and deleting a chat removes only its attachments.
- [x] Existing text-only chats, profile approval, CV acceptance, export, and failure behavior still pass.
- [x] Behavior tests, typecheck, lint, build, docs, and user manual-check instructions accompany each completed chunk.

## Comments

- 2026-10-23: Planned; start only after Ticket 10 resolves provider and transport feasibility.
- 2026-10-23: Unblocked by completed Ticket 10. Verified decisions above replace the earlier open provider/storage/package choices. No attachment feature is shipped yet.
- 2026-10-23: Storage slice complete: additive v4 migration, atomic attachment/message persistence, metadata-only reads, scoped binary downloads, immutable retry and cascade deletion. Seven focused storage tests, typecheck, lint, and build pass. UI/provider integration follows; uploads are not exposed yet. Manual acceptance follows the final integration instructions.

- 2026-10-23: Backend slice complete: selected production parser dependencies, single preparation slot, terminable 15-second workers, format/archive/image validation, native Claude mapping, immutable replay and cumulative context guards. Five new service tests plus the adapter mapping test pass; existing chat/provider tests, typecheck, lint and production build pass. User chose existing storage and provider/service test boundaries only. Manual UI scenarios will accompany integration.

- 2026-10-23: Completed integration and inline Standards/Spec review. Composer selection/removal, DOCX notice, attachment-only send, validated actions and saved binary downloads are implemented. All 62 regression tests pass, as do focused final guards, typecheck, lint and build. Real production actions plus two live Claude calls verified all formats, matching download hashes and restart replay in an isolated database. Fixed a Turbopack worker-bundling incompatibility. See [implementation evidence](../attachments/integration.md) and [user manual checks](../../../docs/attachment-checks.md). No browser checks or personal-database replacement occurred; visual acceptance remains user-run.
