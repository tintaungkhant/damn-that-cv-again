# 05: CV JSON schema

Status: ready-for-human
Blocked by: 01

## Goal

Agree on the exact flexible CV contract before generation is built.

## Scope

- One versioned zod schema: optional contact fields and an ordered list of sections. Section shapes: text, list, detailed entries. Custom titles, optional fields, no required section list.
- An internal-only field for evidence block IDs per claim, stripped on export.
- Example JSON documents covering custom and omitted sections.

Ready for human because the user must agree on the field definitions.

## Acceptance

- [ ] The user approves the schema.
- [x] The examples validate, including a document with irrelevant fields missing.

## Comments

2026-10-23: Proposed contract implemented in `lib/storage/cv.ts`, behavior tests in `lib/storage/cv.test.ts`, and validating examples in `docs/examples/cv/`. Field definitions and decisions for approval are in `docs/cv-schema.md`. Evidence removal is tested as a module operation; Ticket 07 still owns copy/download. User approval is outstanding; retain ready-for-human and keep Ticket 06 blocked.
