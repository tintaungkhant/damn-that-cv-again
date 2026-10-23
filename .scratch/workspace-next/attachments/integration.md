# Ticket 11: integrated chat attachments

Date: 2026-10-23. Ticket 11 implementation complete; user-run visual acceptance remains manual. Jobs and navigation/panel changes remain Tickets 12–13.

## Delivered behavior

Both profile and Build CV chats accept PDF (including scans), DOCX, UTF-8 TXT/MD, and PNG/JPEG/WebP. The shadcn Attachment component was installed through the CLI after checking the component/block catalog; selection, removal, notices, and saved-file downloads compose it with existing Input/Button primitives. Files can be sent without text. DOCX is explicitly text only before sending and in saved metadata; image-only DOCX rejects with PDF/image guidance.

Additive SQLite v4 stores original BLOBs, source-message ownership, immutable prepared text, page counts, and preparation version. Message/files save in one transaction. Normal reads are metadata-only. Scoped downloads return original bytes as `Uint8Array`; the browser creates a Blob. Reopen/retry reuse saved inputs; cancellation or provider errors retain the source message/files without duplicate uploads. Deleting a chat cascades through its files and preserves unrelated chats, confirmed profiles, and accepted documents.

All browser transport remains Server Actions. The action accepts raw `FormData` or a strictly validated retry/legacy text request; it never accepts client-provided prepared snapshots. Expected validation failures return structured errors. Selection/composer input survives rejection. Transport fallback explains file limits and refresh/retry precautions because framework body parsing may fail before the action runs.

## Bounds and parser execution

The researched direct production dependencies are file-type 22.2.0, Mammoth 1.13.0, PDF.js 6.4.299, Sharp 0.35.5 and Yauzl 3.4.0, with Yauzl types. Ticket 10's [maintenance/package evidence](findings.md#package-decision) precedes implementation. Existing Zod, SQLite and Node primitives cover validation, transactions and workers; no new orchestration framework is warranted.

Five files, 10 MiB each, 20 MiB combined; 255-character safe filenames; bounded message text; Server Action body limit 21 MiB. Signatures must match the extension and any declared MIME (Markdown also permits plain text). Text must decode strictly as UTF-8 and contain readable nonbinary content. PDF.js validates pages/operators and rejects both password-required encryption and encryption with an empty opening password. Sharp fully decodes images, checks dimensions/pixels, and rejects animation. ZIP entries are inspected before Mammoth, with metadata and actual streamed expansion bounded. DOCX external-file access is disabled; parsers never extract archives to paths or execute document code.

One preparation upload runs per app process. Other uploads receive an actionable retry message instead of creating an unbounded parsing queue. Each file runs in a terminable worker with a 15-second deadline and 256 MiB JS old-generation limit. Format limits remain 1 MiB extracted text, 20 MiB/1,000 ZIP entries, 8000 × 8000/64 million image pixels; the heap limit does not bound every native allocation. Context guards include all replayed files, with at most 100 PDF pages, 20 image blocks, and 30,000,000 UTF-8 serialized application bytes. The neutral-request preflight is conservative; the Claude block payload is also checked. Provider token limits remain separately actionable. Nothing is silently dropped or truncated.

Claude SDK types stay inside `lib/ai/claude/`. Multimodal requests use one finite async user input with explicit source-message role/index and filename labels, preserving history without enqueuing old messages as live turns. PDFs/images use native blocks; DOCX/text use prepared text. Existing approval/evidence, subscription-only environment, isolated cwd, disabled local tools/settings/compaction, usage, cancellation and cleanup behavior remain.

## Verification

The user chose **existing storage and provider/service boundaries only** for TDD; no separate parser/UI test boundary was added. Tests exercise real preparation through the chat service, real SQLite through its public interface, and the Claude adapter's SDK boundary. New red/green slices cover persistence/replay, native mapping, and rejection of encrypted PDFs that open without a password. Fixtures are fictional and committed; `lib/ai/fixtures/generate.py` documents regeneration. PDF Git attributes preserve offsets/signatures across Windows checkouts.

- Full regression suite: **62 passed**. The first full run exposed two legacy migration fixtures that reset schema versions without removing the new v4 table; corrected those fixtures, verified their focused tests, and reran the full suite successfully.
- Storage: atomic save and rejection, original bytes after reopen, metadata-only reads, cross-chat denial, immutable retry, cascade isolation, v3 upgrade; existing v1/v2 upgrade tests preserve profile/CV history.
- Service/provider: every format in both chat categories, optional text, restart/retry, continuation replay, failed/cancelled replies, corrupt/encrypted files, signatures/MIME, UTF-8, count/size/text bounds, image-only DOCX, ZIP entry/expanded/lying-size/encryption guards, animation/dimensions, worker timeout and slot release, cumulative pages/images/base64 context. The page-limit history fixture uses a prepared snapshot through storage; new files still run actual validation.
- `bun run typecheck`, `bun run lint`, and production `bun run build` pass. Focused tests cover the final extension-validation and encrypted-DOCX review changes.
- No browser, visual or rendered-markup tests. Manual instructions: [attachment checks](../../../docs/attachment-checks.md).

### Real production Server Actions and Claude

After building, run `node .scratch/workspace-next/attachments/application.ts` with free port 3802 and the local subscription login. This starts the actual built app against a temporary SQLite database, links installed dependencies/build output, and copies the runtime parser. It does not change the personal database or use a browser. It consumes subscription usage.

The production check passed: invalid uploads and forged prepared inputs save nothing; five original files download with matching SHA-256; cross-chat downloads reject; normal reads contain no BLOBs; server restart preserves messages/files. Two live Claude replies found the independently known PDF, scanned-image, DOCX heading/table, TXT, and Markdown markers. After server restart, a continuation with PNG/JPEG/WebP found all nine markers across old and new files. Service tests independently cover immutable retry and cancellation without live-provider variability.

### Framework friction and workaround

Initial production testing caught Turbopack bundling the Node parser worker and rewriting its internal `require.resolve()` into a numeric module ID. Valid PDF parsing then failed although direct Node tests passed. Inspection of emitted code established the rewrite. A fixed Node worker loader now imports the application-owned runtime parser path outside bundling; production actions and live PDF replay then passed. No user filenames enter the path or evaluated loader text. The parser file is included in output tracing. The supported local runtime retains the complete checkout and installed dependencies; standalone packaging was not added.

## Review

Code-review skill applied inline because `.ai/rules/agent-workflow.md` forbids subagents. Fixed task-start baseline: `1fb9dbe43c47beb92d6b78d1a376178e609664ab`; review includes the committed storage/backend slices and final integration diff. Standards sources: `AGENTS.md`, every `.ai/rules/*.md`, ADR-0001, local issue/triage conventions, and the skill's smell baseline. Spec source: Ticket 11 and the workspace attachment scope.

**Standards:** no unresolved findings. Existing shadcn primitives, maintained parser packages, Server Actions, additive migration, and agreed behavior test boundaries are retained.

**Spec:** no unresolved findings. Review tightened encrypted-PDF handling, prototype-name extension rejection, legacy migration fixtures, and Windows PDF fixture preservation. User visual acceptance is explicitly pending; [manual checklist](../../../docs/attachment-checks.md) covers both categories, DOCX notice, download, failure/retry, approval and screen sizes.
