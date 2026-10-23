# 08: Backup and restore

Status: wontfix
Blocked by: 02

## Goal

Full export and restore of application data.

## Original scope (retired)

- Export all tables with a schema version. No credentials. A Server Action returns the backup, and the browser builds the download file. No API endpoint (`.ai/rules/server-actions.md`).
- Restore: upload the file as form data to a Server Action, validate the file, show counts of chats, messages, and revisions, confirm, then replace in one transaction.

## Acceptance

- [ ] A round trip preserves all data and excludes credentials. Replacement requires confirmation (acceptance condition 9).
- [ ] An invalid backup is rejected and existing data is untouched.

## Comments

- Deprecated by user request on 2026-10-23. Built-in application backup/restore is removed from version-one scope. Ticket 09 no longer depends on this ticket. CV JSON export remains available.
