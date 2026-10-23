# 07: CV JSON export

Status: resolved
Blocked by: 06

## Goal

Get an accepted CV out of the app.

## Scope

- Copy JSON and download a `.json` file for an accepted revision. A Server Action returns the export JSON, and the browser builds the download file. No API endpoint (`.ai/rules/server-actions.md`).
- Export validates against the schema and strips evidence references, explanations, and provider metadata.

## Acceptance

- [x] Optional and custom sections export as valid JSON through copy and download (acceptance condition 6).

## Comments

- Storage slice: `exportAcceptedCv` validates input, selects only the current accepted revision in its build chat, and reuses the approved evidence-free serializer. Storage tests cover stale/draft/wrong-chat rejection and custom/optional content. Server Action added; UI follows.

- Completed 2026-10-23: Copy JSON and Download JSON export only the current accepted revision through a validated Server Action. Evidence and private metadata excluded. Verification and manual checks: [export findings](../export/findings.md).
