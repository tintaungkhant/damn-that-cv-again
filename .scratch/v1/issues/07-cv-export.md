# 07: CV JSON export

Status: needs-triage
Blocked by: 06

## Goal

Get an accepted CV out of the app.

## Scope

- Copy JSON and download a `.json` file for an accepted revision. A Server Action returns the export JSON, and the browser builds the download file. No API endpoint (`.ai/rules/server-actions.md`).
- Export validates against the schema and strips evidence references, explanations, and provider metadata.

## Acceptance

- [ ] Optional and custom sections export as valid JSON through copy and download (acceptance condition 6).

## Comments
