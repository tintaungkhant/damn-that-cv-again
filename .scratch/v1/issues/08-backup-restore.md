# 08: Backup and restore

Status: needs-triage
Blocked by: 02

## Goal

Full export and restore of application data.

## Scope

- Export all tables with a schema version. No credentials.
- Restore: validate the file, show counts of chats, messages, and revisions, confirm, then replace in one transaction.

## Acceptance

- [ ] A round trip preserves all data and excludes credentials. Replacement requires confirmation (acceptance condition 9).
- [ ] An invalid backup is rejected and existing data is untouched.

## Comments
