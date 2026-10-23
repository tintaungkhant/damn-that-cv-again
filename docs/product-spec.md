# Personal AI CV Builder

Status: Agreed product scope. The feasibility spike on Claude subscription authentication, streaming, and tool calls passed on 2026-10-23 (see `.scratch/v1/spike/findings.md`). Ticket 02 foundation is implemented: local SQLite storage, a seeded user, and chat create/open/delete on port 3800. Ticket 03 adds plain-text streaming chat, persistence, cancellation, and retry through the isolated Claude provider. Ticket 04 adds validated profile proposals, explicit whole-batch approval, shared profile history and undo, and stale-revision reconciliation. Ticket 05 defines the approved CV contract. Ticket 06 implements saved job details, tailored CV drafts, explicit acceptance, discard, history, restoration, readable/JSON views, and selection notes. Ticket 07 adds validated copy/download JSON export for the current accepted CV.

## Purpose

Build a personal, local application that maintains career history through conversation and generates CV content tailored to a job description. The user has many projects; the assistant selects relevant evidence instead of including everything.

The application exports CV JSON. The user supplies that JSON to Claude externally to fill a separately maintained HTML/CSS template. This application does not render CV pages or PDFs in version one.

## Local operation and storage

- Run locally without application authentication. The application is for personal use and is not distributed.
- Seed one local user with a stable ID for future ownership support.
- Use SQLite for durable storage across restarts.
- Store career history as Markdown with stable block IDs (see Profile format), not a structured career database.
- Store users, chats, messages, profile revisions, and CV revisions as separate records.
- Keep credentials outside SQLite, exported CVs.
- The browser reaches the server only through Server Actions. The application has no API endpoints (no Route Handlers) and the browser does not `fetch` its own server. See `.ai/rules/server-actions.md`.

## Chats

Allow unlimited chats in two categories, with no product-imposed chat count limit. Users can create, reopen, continue, and delete chats.

### Profile chats

All profile chats share one confirmed career profile. Start by accepting pasted rough notes. The assistant organizes them into Markdown and asks about consequential gaps.

Profile edits are proposals. Show a before/after comparison and approve the entire batch before saving. Users can ask the assistant to revise a proposal before approval. Individual change checkboxes are outside the initial scope.

Save each accepted profile as a revision. Preserve previous revisions for undo. Check the proposal's base revision when saving: if another chat changed the profile, reconcile with the latest version instead of silently overwriting it (see Profile format).

Unresolved contradictions leave disputed facts unchanged and are recorded in the profile's open questions section. The assistant may continue unrelated work. Deleting a profile chat does not delete facts already saved to the shared profile.

### Profile format

The profile is Markdown. Each entry (a role, project, education item, or similar unit) carries a stable block ID as an HTML comment, for example `<!-- id:p-042 -->`. Block IDs never change once assigned and are not reused after deletion. Undo appends a new revision containing a historical document; it does not erase history. A permanent ID ledger prevents new insert operations from reusing historical IDs.

A profile proposal is a list of operations against a named base revision:

- `replace` a block's content by ID
- `insert` a new block at a stated position
- `delete` a block by ID

The assistant never rewrites the whole profile. When the base revision is stale, the operations are reapplied to the latest revision if every targeted block is unchanged since the base. Otherwise the review shows a conflict and **Ask to reconcile** prepares a request to the assistant. Sending it produces a fresh proposal against the latest revision, requiring approval again. If the confirmed revision changes after a comparison was displayed, approval refreshes the comparison and requires another click.

The profile includes an `## Open questions` section listing unresolved contradictions and missing consequential facts. Every chat sees it as part of the profile.

### Build CV chats

Each chat keeps its own job description, target role/company where supplied, discussion, drafts, and revisions. Accept pasted text initially.

Use the confirmed profile to select relevant projects, prioritize skills and experience, and tailor wording. Explain selection decisions and alternatives in the application. Default to up to five relevant projects; project count and length preferences can vary per application.

Ask about consequential gaps, but do not block a useful draft because optional information is absent. Build chats may propose newly discovered profile facts through the same explicit profile approval flow.

Save generated CV drafts automatically. Acceptance marks a revision ready for export. Keep the last accepted revision available while discussing a new proposal; discarding a proposal must not replace the accepted CV. Preserve revision history and allow restoration of an earlier version.

Existing CV revisions remain unchanged when the profile changes. Refresh them only on request. Each revision records the profile snapshot it used. Restore appends a new draft copied from history and requires explicit acceptance; it never replaces the accepted CV automatically. Job settings use a version check, and CV mutations compare the accepted revision the user reviewed. Settings and CV mutations wait until active replies finish. Deleting a build chat removes its job details, messages, and CV revisions after confirmation.

## Assistant behavior

Act as a career editor with judgment, not an assistant that agrees automatically.

- Ask for context when dates, claims, ownership, or experience are ambiguous or conflicting.
- Do not treat unusual career combinations as contradictions automatically. For example, ask whether a doctor's coding experience was professional, academic, or personal.
- Challenge choices that weaken the application, explaining the tradeoff.
- Ask for contributions and measurable results where useful.
- Never invent metrics, qualifications, responsibilities, or experience.
- Suggest wording while preserving the meaning of confirmed facts.
- Link each CV claim to the profile block IDs that support it; do not export those links.
- Avoid unnecessary confirmation for discussion and routine draft work. Profile saves and acceptance of a CV revision remain explicit actions.

## Context and persistence

SQLite owns application history and documents independently of provider sessions.

Each new message uses the latest confirmed profile, including in reopened chats. Unsaved discussions remain in their original chat. Requests include instructions, the current profile, active chat history, the current CV draft where relevant, and the new message. Do not include every chat's history.

Begin with full context rather than retrieval, embeddings, or a vector database. Measure input usage and detect provider context limits. If a request exceeds limits, surface an actionable error rather than silently dropping career facts. More elaborate context management is deferred until needed.

### Streaming and failure handling

Assistant replies stream to the browser as they are generated. A Server Action returns a stream of typed events: text deltas, proposals, usage, errors, and completion.

- The user's message is saved before the provider request starts.
- The assistant message and any proposals are saved only when the request completes successfully.
- A failed or interrupted request marks the user's message as failed and offers retry. Existing documents are untouched.
- Partial streamed output is never saved as a profile proposal or treated as a valid CV revision.
- Proposals that fail schema validation are rejected; the user sees a validation error and can retry.
- Subscription rate limits, context limits, and validation failures each produce a distinct, actionable error.

## CV JSON export

Use a versioned, validated JSON contract with flexible content. Define it as a single zod schema, used for assistant output validation, storage validation, and export. Agree on its exact field definitions before implementing generation.

- Support optional contact fields and an ordered collection of sections.
- Support common section shapes: text, lists, and detailed entries.
- Allow custom section titles, optional fields, and sections to be added, omitted, renamed, and reordered.
- Do not require education, projects, soft skills, or another fixed list of sections.
- Validate the structure of included content without forcing irrelevant fields.
- Export CV content only. Exclude chat history, selection explanations, internal evidence references, credentials, and provider metadata.
- Export only the current accepted revision; reject stale revision requests instead of silently exporting a different CV.
- Allow copying JSON and downloading a JSON file. A Server Action returns the JSON, and the browser builds the download file.

## Interface

Build the interface with shadcn/ui components on Tailwind CSS.

Show a chat list organized by category. Display the active conversation beside the relevant document.

Profile chats show career Markdown and proposed changes beside the conversation. **Ask for a revision** prepares an editable message; it does not send automatically. Profile refresh is explicit, and profiles also refresh after a successful reply or document action. Another tab does not update automatically. Build chats show saved job-description/target/project-limit fields, an always-visible accepted CV, and draft/history review. Each revision has readable and raw JSON tabs. **Prepare draft request** fills the editable composer; **Send message** runs generation. Selection notes are stored outside CV JSON. Workspace refresh is explicit and also follows completed replies and document actions. This readable document view is not a designed CV template or paginated preview.

## Provider

Use Claude through the Claude Agent SDK on the local server, authenticated with the user's local Claude subscription login. There is no API-key path. The SDK manages the Claude Code process; browser code does not launch the CLI or access credentials.

Subscription use carries a known risk: Anthropic does not permit third-party products to offer claude.ai login. This application is a personal tool run by the subscription owner on their own machine and is never distributed. The provider layer stays isolated so authentication can change without touching the rest of the application.

### Provider layer

- Application code depends only on a provider interface in `lib/ai/`. Only `lib/ai/claude/` imports the Agent SDK.
- Application code supplies instructions, profile, messages, and the current draft. The provider returns a stream of normalized events: text, proposed profile edits, proposed CVs, usage, and errors.
- Provider session IDs are optional adapter metadata, not the source of truth. Context is rebuilt from SQLite for every request.

### Claude request shape

Each user message makes one Agent SDK `query()` call:

- A custom system prompt replaces the Claude Code default.
- Built-in Claude Code tools are disabled.
- Local Claude Code settings and `CLAUDE.md` files are not loaded.
- Two in-process tools, `propose_profile_edit` and `propose_cv`, carry structured proposals. Their zod input schemas are the proposal and CV contracts. Ticket 04 enables `propose_profile_edit`. Ticket 06 enables `propose_cv` with the approved CV schema only for build chats; successful completion saves a draft, and acceptance remains explicit.
- Partial messages are enabled so text streams.

## Backup and restore

Retired from version one by the user on 2026-10-23 (Ticket 08, wontfix). CV JSON export remains supported. There is no built-in application backup or restore. A one-time local database archive for replacing development test data is maintenance, not a product feature.

## Version-one exclusions

No application authentication, template generation, HTML/CSS CV rendering, PDF output, document uploads, URL imports, job scraping, application tracking, vector search, provider selection, provider switching, API-key authentication, or additional provider adapters. Image and document capabilities were discussed as provider capabilities, not approved scope additions.

## Delivery order

0. Feasibility spike: verify subscription login, streaming, and a custom tool call through the Agent SDK on the local machine; measure latency. Go/no-go for the provider approach.
1. Foundation: SQLite, migrations, seeded user, chat create/list/delete.
2. Streaming chat through the provider layer, with persistence and retry.
3. Profile chats: block format, proposals, comparison, approval, revisions, undo, stale-revision handling.
4. Build CV chats: job description, CV proposals, drafts, acceptance, history, restoration, selection explanations.
5. CV JSON export.
6. Backup and restore: retired (Ticket 08).
7. Hardening against the acceptance conditions.

## Acceptance conditions

1. A seeded user can create multiple chats in either category and reopen them after restarting the app.
2. A profile proposal changes shared career notes only after approval, preserves history, and detects stale revisions.
3. New messages use the latest confirmed profile without importing unrelated chat discussions.
4. A build chat can tailor CV content to a pasted job description and explain its selections without fabricating facts.
5. Generated drafts persist independently of acceptance; accepted CVs survive profile changes and discarded proposals.
6. Optional and custom sections export as valid JSON through copy and download.
7. Request failures preserve messages and saved documents and support retry.
8. Chat deletion follows the category-specific rules and requires confirmation for build chat deletion.
9. Retired: application backup and restore removed from scope by user decision on 2026-10-23.
10. Agent SDK usage stays inside `lib/ai/claude/`, so a different provider or authentication method can replace it without migrating application history.
11. Assistant replies stream to the browser, and interrupted streams never produce saved proposals or CV revisions.

## Remaining implementation decisions

- Resolved: the spike confirmed that the installed Agent SDK supports subscription login, partial-message streaming, in-process tools, and disabling built-in tools and local settings. See `.scratch/v1/spike/findings.md`.
- Resolved: the installed Next.js/React transport returns a `ReadableStream` incrementally and releases the action queue before that stream closes. HTTP and installed-dispatcher probes are recorded in `.scratch/v1/streaming/findings.md`; browser checks are excluded by the testing rule.
- Resolved: the user approved the flexible CV schema in `docs/cv-schema.md` and `lib/storage/cv.ts` on 2026-10-23 (Ticket 05). Validating examples and evidence-free export conversion are implemented; Ticket 06 generation can use this contract. Profile proposal operations are defined in `lib/storage/profile.ts`: a named base revision, summary, and strict replace/insert/delete operations. Inserts name a new ID and an `afterId` (null means first). The reserved `p-open-questions` block always holds `## Open questions`.
- Resolved: Node `node:sqlite` with transactional `PRAGMA user_version` migrations; see `docs/adr/0001-local-sqlite.md`.
- Choose the initial Claude model after the spike and a realistic-input trial (career profile, long conversation, CV export), evaluating relevance, output validity, latency, and reported usage.

These details must preserve the agreed scope. No application implementation is included in this specification change.

