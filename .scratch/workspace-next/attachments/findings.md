# Ticket 10: Attachment feasibility

Date: 2026-10-23. Outcome: **go for Ticket 11** with the design and explicit bounds below. These are research probes, not an implemented upload feature. Application source, production dependencies, production configuration, and the personal database are unchanged.

## Environment and method

Node 26.11.1, Bun 1.4.4, Next.js 16.4.2, React 19.3.0, Agent SDK 0.3.309, and the application's pinned `claude-sonnet-5-5`. Read installed Next.js guides `01-app/02-guides/server-actions.md`, `01-app/01-getting-started/07-mutating-data.md`, and `01-app/03-api-reference/05-config/01-next-config-js/serverActions.md` before writing probes.

`provider.ts` calls the existing `createClaudeProvider` with an injected scratch-only `query` wrapper. It replaces the adapter's string prompt with a finite async generator yielding one `SDKUserMessage`, retaining the adapter's custom-system-prompt mechanism, disabled built-in tools, disabled local settings/skills, isolated working directory, MCP configuration, streaming, disabled compaction, subscription-only environment, and cleanup. The probe supplies its own fictional-marker instructions. No API-key or Files API path was introduced. SDK imports outside `lib/ai/claude/` occur only in this research directory, consistent with the original feasibility spike; production isolation remains unchanged.

The generator sends the application context and conversation as text alongside binary content blocks. This avoids queuing historical user messages as separate live SDK turns. Ticket 11 should retain explicit role/message labels and attach each file to its source message in that reconstructed context.

Fixtures are generated from fictional markers. Distinct image markers prevent a text PDF or standalone image from masking a failed scanned-PDF input. No browser automation, visual checks, or personal documents were used.

## Verified format matrix

| Upload | Application preparation | SDK input | Observed result |
| --- | --- | --- | --- |
| Standard PDF | Validate bytes, encryption, and page count | Base64 `document`, `application/pdf` | Exact PDF marker read |
| Scanned PDF | Same validation; no text-extraction fallback | Same native `document` | Marker read from a PDF containing only a raster image; extracted PDF text was empty |
| DOCX | Mammoth `extractRawText({buffer})` | Text block | Heading, paragraph, and table-cell markers read |
| UTF-8 TXT / Markdown | Fatal UTF-8 decoder | Text block | Exact markers read; Thai characters decode without replacement |
| PNG | Validate/decode original | Base64 `image`, `image/png` | Distinct PNG marker read |
| JPEG | Validate/decode original | Base64 `image`, `image/jpeg` | Distinct JPEG marker read |
| WebP | Validate/decode original | Base64 `image`, `image/webp` | Distinct WebP marker read |

Three fresh subscription calls passed: reopened saved input (6,264 ms), identical-input retry (4,650 ms), and continued conversation rebuilt with prior assistant text plus saved attachments (4,820 ms). SQLite was closed and reopened before reading the immutable provider snapshot. Each call found all nine independently known markers. This proves replay feasibility; integrating actual application message statuses, attachment records, and retries remains Ticket 11.

A separate PNG was 10,029,424 raw bytes and 13,372,568 base64 bytes. The pinned SDK path accepted it and read its marker in 7,198 ms. Do not apply the direct Messages API's encoded-image size rule blindly to this subscription adapter or promise identical behavior on another adapter. Provider image processing can resize images; originals must remain unchanged for download.

## Validation and failure behavior

Nine local parsing probes passed:

- `file-type` distinguishes PDF, DOCX, PNG, JPEG, and WebP signatures. A signature is a hint, not proof of a valid file. Compare detected type with the extension and any nonempty declared MIME, then parse/decode the allowed format.
- Mammoth extracts useful DOCX text and table cells. Corrupt ZIP/DOCX rejects. An image-only DOCX produces empty text and must be rejected with an instruction to export to PDF or attach the images. DOCX support is explicitly **text only**: show this notice before sending; embedded pictures, formatting, and rendered layout are not analyzed. Never claim otherwise.
- Fatal UTF-8 decoding rejects invalid bytes instead of replacing characters. Reject empty/binary-looking text. Treat text and Markdown as data, not executable instructions or HTML.
- PDF.js validates the text and scanned fixtures as one-page PDFs. Password-protected and corrupt fixtures reject locally. Use the loading task's `destroy()` for cleanup; this installed PDF.js version has no document-proxy `destroy()` method.
- Sharp fully decodes PNG/JPEG/WebP with `failOn: "warning"` and a pixel bound. A truncated PNG rejects. Metadata inspection alone is insufficient.
- Yauzl exposes a 21 MiB expanded ZIP entry whose compressed file is under 100 KB, allowing rejection before Mammoth extraction.

Sending corrupt and encrypted PDFs directly through the scratch wrapper produced the existing adapter's generic provider error, suggesting a login check. Therefore production must reject these files before saving or invoking Claude, with file-specific messages. Also validate complete block sources locally: official SDK docs warn that malformed image sources can become a text placeholder while the session continues. Do not interpret a successful SDK completion as upload validation.

Ticket 11 validation bounds: five files, 10 MiB each, 20 MiB combined original bytes; maximum 100 PDF pages across all attachments replayed in a request; at most 20 standalone image blocks across that request; image dimensions at most 8000 × 8000 and 64 million pixels; reject animations rather than silently use their first frame. Limit expanded DOCX data to 20 MiB and 1,000 ZIP entries per file; reject encrypted entries. Enforce both directory metadata bounds and actual streamed expansion before extraction. Limit extracted text to 1 MiB UTF-8 per file. Never truncate to satisfy a bound.

Perform parsing/decompression in a worker with a 15-second deadline and bounded concurrency (one attachment preparation at a time for this local app). Terminate timed-out work; a `Promise.race` alone cannot interrupt CPU or decompression work. These are implementation requirements, not worker behavior already exercised by this spike. Do not fetch external document relationships, resolve URLs, enable PDF scripting, execute macros, or extract archives to disk.

## Provider request limits and context

Primary [PDF documentation](https://platform.claude.com/docs/en/build-with-claude/pdf-support) states a 32 MB request limit and a page limit dependent on context-window size. Use the conservative 100-page application cap instead of assuming this subscription session always has the largest window. PDFs must not require passwords. Native PDF input combines visual and textual understanding, which is why the scanned fixture works.

Primary [vision documentation](https://platform.claude.com/docs/en/build-with-claude/vision) lists JPEG/PNG/WebP support, dimension and request limits, and first-frame behavior for animations. The large-image observation above is specific to the installed Agent SDK, not a direct API limit test.

Bound the entire reconstructed application payload before invoking the SDK: at most **30,000,000 UTF-8 bytes**, including base64, text, profile, conversation, proposals, and CV context. This leaves nominal headroom beneath the documented request cap for the small SDK envelope; it is an application guard, not a measured SDK wire-size guarantee. Also apply cumulative page/image bounds to historical files. Base64 length is `4 * ceil(bytes / 3)`; 20 MiB of binary alone becomes 27,962,028 bytes before JSON/context. Older attachments can make the request exceed the cap even when the newest upload is small. Reject with a clear instruction to start a shorter chat or use smaller documents; never drop older files silently. Keep the existing context-limit error and disabled compaction. A byte cap cannot guarantee token fit, so provider context failures remain possible and must preserve the saved message for retry.

No new OCR engine or filesystem-reading tool is needed. No new provider, URL download, or external file service is needed. The existing string-only adapter must gain typed multimodal application input in Ticket 11; SDK block types stay inside its Claude implementation.

## Server Action and SQLite results

`transport.mjs` builds a minimal isolated production Next.js app twice with installed packages and invokes real Server Actions using React's installed `encodeReply` and Flight decoder from Node. Fixture app files are generated only in a checked temporary directory. It uses a separate SQLite file. No app server is stopped or personal data changed.

| Case | Observation |
| --- | --- |
| Default configuration | A 512 KiB file round-trips; a 1 MiB file plus multipart overhead is rejected |
| `experimental.serverActions.bodySizeLimit: "21mb"` | Two 10 MiB files upload successfully; raw request is 20,972,063 bytes (543 bytes overhead in this fixture) |
| Download | `Uint8Array` arrives as a typed array; a 10 MiB file response is 10,485,983 bytes, with no base64 expansion |
| Integrity | SHA-256 matches originals for every upload and download |
| Five small files | Round-trip succeeds |
| Action validation | Six files, a file over 10 MiB, and combined files over 20 MiB are rejected |
| Framework bound | A 22 MiB payload is rejected by the configured request limit |
| Ownership | Download with another chat ID rejects |
| Persistence | A 10 MiB BLOB downloads with matching hash after stopping and restarting the isolated server |
| Partial state | Rejected requests leave the fixture's three messages/eight files unchanged |

Set **21mb** in production during Ticket 11, while keeping exact per-file and combined validation inside the action. Bound filenames (255 characters), message text, and metadata so overhead cannot consume the 1 MiB margin. Return downloads as `{name, mediaType, bytes: Uint8Array}` through an ownership-checked action; construct the Blob locally. Return only attachment metadata in normal chat reads, and load bytes only for download or provider context. No route or API endpoint is required.

The configured isolated process had a baseline RSS of 102,371,328 bytes (97.6 MiB). At 20 MiB upload, action-return RSS was 214,007,808 bytes (204.1 MiB); observed process high-water RSS was 219,228 KiB (214.1 MiB). Upload plus two 10 MiB downloads took 268 ms locally. This is a feasibility measurement, not a production performance promise: real parsing, provider encoding, SDK child processes, and simultaneous requests add memory. Keep operations bounded; do not prefetch all chat BLOBs.

Choose SQLite BLOBs for original bytes, plus metadata and prepared text where needed, inside the same transaction as the user message. Retain the provider-input preparation version and original type, so retries/reopen reuse immutable inputs rather than re-extracting differently. Use relational message/chat/user ownership and cascade deletion; do not store base64 duplicates in SQLite. Existing documents and revisions must survive the migration. The simple scratch schema only demonstrates feasibility; it does not replace the application's migration or authorization layer.

Framework diagnostic friction was reproduced with both request limits: production returned HTTP **500** with a Flight error digest, while server logs said the body exceeded the limit and contained internal status 413. A well-behaved UI should check limits before upload for immediate feedback, still enforce them server-side, and show an actionable generic transport-size/connection fallback when framework parsing prevents the action from returning a structured validation error. No Next.js workaround or production patch belongs to this ticket.

## Package decision

Primary npm registry/download API and GitHub repository/API snapshots were checked on 2026-10-23. Counts fluctuate; open counts include PRs. All chosen packages ran under Node 26.11.1 in the isolated package workspace and are pinned in its lockfile.

| Package | Version; release | Downloads in last-week API window | Repository evidence | TypeScript | Decision |
| --- | --- | ---: | --- | --- | --- |
| [mammoth](https://github.com/mwilliamson/mammoth.js) | 1.13.0; 2026-09-26 | 6,153,762 | Pushed Oct 16; 60 open; latest open activity Sep 28 | Bundled declarations | Use for DOCX raw text; retain disabled external access |
| [file-type](https://github.com/sindresorhus/file-type) | 22.2.0; 2026-10-14 | 33,619,256 | Pushed Oct 14; no open issues/PRs at check | Bundled via `exports.types` | Use for binary signature detection, then validate content |
| [pdfjs-dist](https://github.com/mozilla/pdf.js) | 6.4.299; 2026-10-03 | 20,450,168 | Pushed Oct 23; 468 open; activity Oct 23 | Bundled declarations | Use legacy Node entry for PDF validation/page count; preserve originals for native provider input |
| [sharp](https://github.com/lovell/sharp) | 0.35.5; 2026-09-27 | 71,400,664 | Pushed Oct 23; 122 open; activity Oct 23 | Bundled declarations | Use for full image decode/dimensions; declare directly if application imports it |
| [yauzl](https://github.com/thejoshwolfe/yauzl) | 3.4.0; 2026-06-07 | 31,488,127 | Pushed Jun 7; 12 open; latest open activity Jun 7 | Separate `@types/yauzl` | Use for bounded DOCX ZIP inspection; add types during implementation |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | 1.17.1; 2021-11-06 | 11,473,039 | Last push Jul 2024; 318 open; user activity Oct 2026 | Bundled declarations | Reject for validation: PDF.js has substantially newer maintenance |
| [word-extractor](https://github.com/morungos/node-word-extractor) | 1.0.4; 2021-07-26 | 548,652 | Last push Jun 2024; 11 open; user activity Oct 2026 | No bundled declaration found | Reject: older release and less suitable than Mammoth for this DOCX scope |

Package research is reproducible with `package-research.py`. API sources are `https://registry.npmjs.org/<package>`, `https://api.npmjs.org/downloads/point/last-week/<package>`, and `https://api.github.com/repos/<owner>/<repo>`. Do not confuse recent user issue comments with maintainer releases.

Existing production dependencies provide Zod, SQLite, and SDK transport, but no application-level DOCX extraction, PDF validation, ZIP bounds, or image content validation. Reuse Node `TextDecoder`, `crypto`, `FormData`, and `node:sqlite`; no wrapper library is needed for those built-ins. Probes handwrite only orchestration and fixture actions; maintained packages own parsing.

Primary references: [SDK streaming input](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode), [Mammoth API/security](https://github.com/mwilliamson/mammoth.js), [file-type limits](https://github.com/sindresorhus/file-type), [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html), [Sharp constructor](https://sharp.pixelplumbing.com/api-constructor/), [Yauzl](https://github.com/thejoshwolfe/yauzl). SDK installed type definitions explicitly allow `AsyncIterable<SDKUserMessage>` and Messages API `text`, `image`, and `document` blocks.

## Reproduce

From the repository root:

```powershell
bun install --cwd .scratch/workspace-next/attachments
# Use bundled Python (load_workspace_dependencies) with Pillow, python-docx, reportlab:
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' .scratch/workspace-next/attachments/fixtures.py
node .scratch/workspace-next/attachments/parsing.mjs
node .scratch/workspace-next/attachments/provider.ts
node .scratch/workspace-next/attachments/transport.mjs
python .scratch/workspace-next/attachments/package-research.py
```

`provider.ts` consumes subscription usage and needs the existing local Claude login. `transport.mjs` needs free port 3802 and compiles temporary apps with `--webpack`; it does not launch a browser. Generated fixtures, dependencies, and raw result JSON stay ignored. The committed source and this findings snapshot preserve the evidence. No UI acceptance is needed for this research-only ticket; Ticket 11 owns the eventual manual upload/download checks.

## Verification and review

- Parsing probes: nine passed. Live provider probes: all required format markers, immutable replay, continued context, and large PNG passed; invalid PDFs produced the observed generic adapter error.
- Production transport probes: both configurations passed, including application combined-size rejection below the framework cap and framework rejection above it.
- Existing full application suite: 53 passed. `bun run typecheck`, `bun run lint`, `bun run build`, and `git diff --check` passed. No production behavior changed, so no new production TDD seam was introduced; the ticket's provider and transport boundaries were exercised with scratch probes.
- Code-review skill applied inline under `.ai/rules/agent-workflow.md`, against task-start commit `f024bfb5c5633d18264f6b89b09a31ce62de89da`. Standards sources: `AGENTS.md`, `.ai/rules/*.md`, issue-tracker conventions, and ADR-0001. Standards: no unresolved findings. Spec (Ticket 10 and attachment scope): no unresolved findings. Review tightened the combined-size probe to distinguish action validation from framework rejection and made marker assertions fail rather than become an exploratory observation.
