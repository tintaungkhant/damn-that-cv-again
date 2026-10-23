# 10: Verify attachment input and transport

Status: ready-for-agent
Type: research
Completed: 2026-10-23

## Goal

Prove the attachment path before choosing storage and parsing dependencies.

## Scope

Follow [scope](../spec.md#chat-attachments). Read installed Next.js Server Action/upload documentation and SDK types. Consult primary provider docs and current package maintenance, releases, downloads, issues, and TypeScript support. Test synthetic PDF (including scanned), DOCX, text, and image inputs through the isolated adapter; do not expose personal documents. Prove bounded binary upload/download transport, body limits, and reopen/retry context behavior. Record chosen packages and why existing packages or native APIs do not cover extraction. Keep probes outside production code.

## Acceptance

- [x] Findings state the verified input matrix, provider limits, error behavior, and package evidence.
- [x] Upload/download round trips and memory/payload implications support the proposed limits and storage choice.
- [x] No format is silently ignored or truncated; unsupported requirements are flagged.
- [x] Ticket 11 and spec reflect the verified decisions and have no unresolved feasibility blocker.

## Comments

- 2026-10-23: Planned. Required formats are PDF, DOCX, text, and images. No implementation yet.
- 2026-10-23: Completed. [Findings, package evidence, and reproduction](../attachments/findings.md). Distinct markers passed for native text/scanned PDFs, three image formats, DOCX text/table cells, and UTF-8 TXT/Markdown through the existing adapter with a scratch-only async-input wrapper. Reopened/retried/rebuilt context passed. Production Server Action probes verified 20 MiB uploads, byte-identical typed-array downloads, SQLite BLOB restart persistence, ownership rejection, and limit enforcement. DOCX is explicitly text-only; image-only DOCX must reject. Full suite: 53 passed; typecheck, lint, and production build passed. Production features remain Ticket 11.
