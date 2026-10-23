# CV JSON contract (Ticket 05)

Status: approved by the user on 2026-10-23. Ticket 05 is complete; Ticket 06 generation may use this contract.

The single source of truth is `lib/storage/cv.ts` (`cvSchema`, inferred `Cv`, and `exportCv`). Ticket 05 introduced the contract; Ticket 06 added generation and review, and Ticket 07 added accepted-revision copy/download.

## Approved fields

| Field | Contract |
| --- | --- |
| `schemaVersion` | Required number `1`. Other versions fail validation. |
| `contact` | Optional object. Every field is optional: `name`, `headline`, `email`, `phone`, `location`, `links`. |
| `contact.links`, entry `links` | Optional nonempty array of `{url, label?}`. URLs use HTTP or HTTPS only. |
| `sections` | Required nonempty array, preserving display order. No conventional section is required. |
| section `title` | Required custom nonblank string. Renaming and repeated titles are allowed. |
| section `type: "text"` | Required `content` claim. |
| section `type: "list"` | Required nonempty `items` array of claims. |
| section `type: "entries"` | Required nonempty `entries` array. |
| entry | Required `heading` claim. Optional `organization`, `location`, `period`, `description` claims, `highlights` (nonempty claim array), and `links`. |
| claim | `{text, evidence}` internally. `text` is nonblank; `evidence` is a nonempty array of stable profile block IDs such as `p-role`. |

`period` is free text (for example `2020–2022`, `2024`, or `2023–Present`); no fabricated month or end date is required. Phone numbers use free text for international formatting. Email has format validation. Omit absent optional fields instead of sending empty strings or null. Included text is trimmed. Unknown keys fail at every object boundary. Text is content, not HTML or layout instructions.

Detailed entries deliberately use neutral names: `heading` can be a role, project, degree, certification, or publication. Sections can be omitted, renamed, reordered, or added without a fixed education/projects/skills list. At least one section with content is required; an empty CV is not a draft.

Contact fields and URLs are metadata, outside the claim wrapper. Factual prose belongs in claims, including entry headings and dates. Ticket 06 checks evidence IDs against confirmed blocks in the request profile snapshot, excluding Open questions. Career-editor instructions require support for the exact wording; schema and reference validation cannot establish semantic truth. This schema validates ID syntax and presence; the generation service validates existence, and human review checks factual support.

## Export shape

`exportCv(unknown)` first validates the entire internal document, then returns formatted JSON with every claim's `evidence` removed. Claims remain objects such as `{ "text": "Built retry handling." }`, preserving the same structure at every claim location. It preserves section, entry, and bullet order. Exported JSON does not pass the internal input schema because evidence is intentionally absent; import of exported CV JSON is outside scope.

There are no fields for explanations, job descriptions, chat history, provider metadata, or credentials. Unknown metadata is rejected before export rather than silently accepted. Ticket 07 connects this conversion to Copy JSON and Download JSON under Accepted CV. The Server Action validates chat/revision IDs and rejects drafts, revisions from another chat, and a stale accepted revision. Only CV content is read; selection notes remain outside the document. The browser creates an application/json Blob and downloads a .json file. Clipboard denial shows a message directing the user to download instead.

## Examples

- `docs/examples/cv/minimal.json`: custom text section, no contact, education, projects, or other conventional fields.
- `docs/examples/cv/custom.json`: all three section shapes, custom titles, contact, detailed entries, and an entry with only its heading.

Both files are synthetic internal documents. Their export output removes evidence and changes nothing else.

## Verification and review

Behavior tests at the schema/module boundary cover examples, omitted fields, export, malformed content, evidence, versions, and unknown metadata. No browser or visual checks are needed.

Review baseline: `f0c7b9d1d6ddcfc47b3ee991238ae3ef7b42020d`. Review performed inline following the repository's no-subagent rule. Standards: no outstanding findings. Spec: implementation and examples meet the ticket requirements. The user approved the contract on 2026-10-23; Ticket 05 is resolved.

Reused installed Zod 4.6.7, already required by the ticket and provider stack; no dependency added or handwritten validator. Consulted official API documentation at https://zod.dev/api for strict objects, discriminated unions, email, and protocol-restricted URLs. No Next.js behavior changed and no qualifying framework feedback arose.

Validation result: all 35 behavior tests, TypeScript typecheck, ESLint, production build, and whitespace checks passed. Four schema tests were added. Existing Node module-type warnings are unchanged.
