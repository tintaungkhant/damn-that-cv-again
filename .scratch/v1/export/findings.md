# Ticket 07: accepted CV JSON export

Implemented Copy JSON and Download JSON under Accepted CV. Both call one validated Server Action. Storage reads only the requested current accepted revision for the owned build chat, then uses the existing strict CV serializer. Drafts, stale accepted IDs, wrong chats, malformed inputs, and extra keys fail. Content is validated before evidence is removed. Selection explanations and provider data are never selected for export.

Reused the existing Zod schema, serializer and installed shadcn Button. Checked the official shadcn Button and block catalogs: https://ui.shadcn.com/docs/components/button and https://ui.shadcn.com/blocks. Native Clipboard, Blob and object URL APIs cover this small browser operation; no package or custom export abstraction is needed. Download URLs are revoked after dispatch. Clipboard failure directs the user to download. No API endpoint, migration, provider call, or credential access was added.

## Verification

- TDD: storage guard test failed before the method existed, then passed after implementation.
- Storage/schema behavior covers draft/current/stale/wrong-chat/deleted-chat guards, strict inputs, evidence removal, unknown metadata rejection, optional fields, custom sections and JSON Blob text.
- Full suite: 51 tests passed. Typecheck, lint, production build and whitespace checks passed.
- Isolated production HTTP Server Action checks passed using synthetic CV data and the installed React Flight decoder. Validated accepted export, draft rejection, custom/optional sections, privacy stripping, strict-input and chat guards, and reopen. Personal database untouched by this probe.
- Manual check required: browser clipboard permission, download behavior and layout. Open a Build CV chat, accept a draft, copy/paste JSON and download the .json file. Compare content, custom sections and omitted fields. New drafts must not replace exported accepted content.

## Inline review

Baseline: cbc5107d371fa9f1c20085b1f08912f710d00530. Main agent reviewed standards and spec separately, following the repository prohibition on subagents.

Standards: no unresolved findings. Existing comments preserved; validated Server Action and existing shadcn components reused; no browser tests.

Spec: no unresolved findings. Both export paths share the server-validated accepted document. Exported JSON excludes evidence and private revision metadata while preserving optional/custom content. No backup/restore or template rendering scope added.

Next.js feedback pass: no verified qualifying friction. One guessed documentation filename was wrong; installed guide discovery resolved it without a framework issue.
