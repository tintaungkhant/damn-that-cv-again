# 10: Verify attachment input and transport

Status: ready-for-agent
Type: research

## Goal

Prove the attachment path before choosing storage and parsing dependencies.

## Scope

Follow [scope](../spec.md#chat-attachments). Read installed Next.js Server Action/upload documentation and SDK types. Consult primary provider docs and current package maintenance, releases, downloads, issues, and TypeScript support. Test synthetic PDF (including scanned), DOCX, text, and image inputs through the isolated adapter; do not expose personal documents. Prove bounded binary upload/download transport, body limits, and reopen/retry context behavior. Record chosen packages and why existing packages or native APIs do not cover extraction. Keep probes outside production code.

## Acceptance

- [ ] Findings state the verified input matrix, provider limits, error behavior, and package evidence.
- [ ] Upload/download round trips and memory/payload implications support the proposed limits and storage choice.
- [ ] No format is silently ignored or truncated; unsupported requirements are flagged.
- [ ] Ticket 11 and spec reflect the verified decisions and have no unresolved feasibility blocker.

## Comments

- 2026-10-23: Planned. Required formats are PDF, DOCX, text, and images. No implementation yet.
