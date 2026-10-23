# Ticket 09: hardening, model choice and manual trial

Date: 2026-10-23

## Scope and decision

The user retired Ticket 08; its status is `wontfix`. Product acceptance condition 9 remains numbered for traceability but is explicitly retired. There is no product backup/restore feature. The user separately authorized archiving and replacing their existing development test data with a complete fictional workspace.

Initial model: **claude-sonnet-5-5**, explicitly pinned in `lib/ai/claude/provider.ts`. The app no longer inherits the account's unspecified model default. The optional adapter argument exists for the model trial; there is no product model selector or provider switching.

## Paired realistic-input trial

Both candidates received the same 6,387-character confirmed profile, saved backend job, project limit of three, 48 seeded discussion messages and final generation request. The fictional career covers eight years, three employers, eight projects, education, contacts, skills, metrics with qualifications, and explicit limits on unconfirmed experience. The 48 prior messages are labeled synthetic discussion fixtures, not claimed to be live model replies. The generation, shorter revision, product CV and pending profile proposal were produced live through the real Claude subscription adapter and application chat service.

| Candidate resolved model | First text | Completion | Input | Cache read | Cache write | Output | CV/evidence validation |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| claude-sonnet-5-5 | 19.097 s | 20.545 s | 4 | 10,075 | 12,514 | 2,975 | Passed |
| claude-haiku-5-5 | 22.868 s | 27.757 s | 4 | 10,070 | 16,115 | 6,699 | Passed |

Token counts are the SDK result's reported main-loop usage, including tool turns, with input/cache categories kept separate. They are not subscription charges or a complete account usage measure. First text includes local process startup and any preceding CV tool generation. These are one paired trial, not a general benchmark.

Both generated the relevant dispatch, import and observability projects, preserved ownership boundaries and staging/team-observed metric qualifications, omitted unsupported Kubernetes/Terraform/certification claims, omitted the unknown phone number, and included separate selection explanations and alternatives. Both passed strict schema/evidence checks and accepted-revision export. Sonnet was faster and used fewer output tokens in this trial; its tighter experience section also avoided Haiku's additional product-focused detail in the backend application. Choose Sonnet on this evidence. No model is claimed to guarantee factual truth; manual wording review remains necessary.

The pinned model subsequently completed a shorter backend draft in 16.176 s, a product-role CV in 17.278 s, and a pending profile proposal in 15.498 s. Product output selected accessibility and reporting work, preserved the query benchmark qualification and did not claim certification or business growth. The profile proposal correctly separated vendor matching from Alex's retry/error handling and asked about missing implementation/outcome details.

## Hardening change

The SDK can compact context automatically, contradicting the requirement to surface a limit instead of silently dropping career facts. Added `settings: { autoCompactEnabled: false }` and reject any unexpected `system/compact_boundary` event as a normalized `context-limit` error. The service then preserves the user message and saved documents and offers retry. A provider regression test failed with `usage, done` before this fix and passes afterward. No arbitrary character-based token estimator or history truncation was added.

The provider now includes the resolved model in normalized usage events, allowing the trial to prove which model answered. Provider/model metadata remains outside stored CV content and export. Existing SDK isolation, tools allowlist, neutral working directory, subscription-only credentials and disabled local settings remain intact. Reused installed SDK options, existing Zod/storage/service APIs and native SQLite snapshot/checkpoint facilities; no package is needed for these small operations.

Sources: installed `@anthropic-ai/claude-agent-sdk/sdk.d.ts` (`Options.settings`, `Settings.autoCompactEnabled`, `SDKCompactBoundaryMessage`, result usage and modelUsage); [official model configuration](https://code.claude.com/docs/en/model-config) for aliases versus exact model names. Exact resolved names came from live SDK results. Installed Next.js Server Actions guide was read before changes.

## Acceptance audit

| Condition | Evidence and result | Manual review remaining |
| --- | --- | --- |
| 1. Multiple chats and restart persistence | Real-file/process storage tests; installed six trial chats, restarted production and reopened all five populated conversations through HTTP/React transport without server errors. | Navigate between chats and reload. |
| 2. Explicit profile approval, history and stale detection | Profile storage/service tests cover approval, conflict, renewed review, undo and ID preservation. Trial has three revisions and one live pending proposal; facts remain unapproved. | Inspect Before/After, approve or revise, inspect History. |
| 3. Latest profile and active-chat-only context | Service tests cover refreshed profile and unrelated-chat exclusion. Backend and product chats retain separate jobs and CVs. | Continue either application after a profile change. |
| 4. Tailored factual CV and explanation | Live paired model trial plus product trial, strict evidence validation and wording review described above. | Review relevance and wording against fictional profile. |
| 5. Draft independence, accepted preservation | Storage/service tests; live shorter draft left unaccepted, restored copy discarded, original accepted unchanged across profile history edits/undo. | Compare Accepted CV, Draft review and History. |
| 6. Optional/custom JSON export | Schema/storage tests plus isolated production export Server Action probe passed; custom section and omitted fields preserved, evidence/private metadata excluded. | Clipboard permission and actual download click. |
| 7. Failure persistence and retry | Service/provider tests; real production HTTP disconnect left one failed user message, retry completed without duplication. | Use the deliberately failed demo chat's retry button. |
| 8. Category-specific deletion | Real storage tests cover build confirmation, cascading messages/CVs/settings, and preservation of shared profile history. | Try deletion confirmation on a disposable chat. |
| 9. Backup and restore | Retired by user decision; not counted as an active condition. | None. |
| 10. Provider isolation | Source scan: SDK imports only in `lib/ai/claude/` for application code/tests. No API routes or browser server fetches added. | None. |
| 11. Streaming, interruption and no partial documents | Service/provider tests and real production HTTP disconnect/retry probe passed with pinned Sonnet; no partial assistant/proposals saved. | Check incremental text and Stop reply. |

Final automated checks: **53 tests passed**, typecheck, lint, production build, whitespace validation, isolated export Server Action transport, production populated-chat reopen, and live disconnect/retry all passed. The full suite ran once at the end. Browser/visual tests were not run, following `.ai/rules/testing.md`; user review is still open and must not be reported as already passed.

## Installed workspace and archive

Six chats, 61 messages, three confirmed profile revisions, four CV revisions (two accepted, one draft, one discarded), and one pending profile proposal. Every career fact is fictional. Backend history includes 48 seeded messages; later generation is live. An empty build chat has saved settings with project limit zero, and a profile chat contains a deliberately failed user message for retry.

`install.ts --replace-test-data` was run only after stopping the verified project server and after the user's explicit approval. It checkpoints SQLite, creates a `VACUUM INTO` archive, verifies integrity and an all-table row digest against the original database, then installs the checkpointed trial database. The archive is under ignored `data/archives/`; the exact path is in ignored `data/trial-workspaces/install.json`. No old career data or credentials were printed or committed. Trial databases, exports and raw measurements remain in ignored `data/trial-workspaces/`. This is one-time maintenance, not a product backup feature.

Preparation commands, run once from the repo root: `node .scratch/v1/hardening/trial.ts`, then `node .scratch/v1/hardening/prepare.ts`. Installation requires a stopped app and the explicit replacement flag; do not rerun against user-modified data. The trial scripts refuse existing initial candidate files. See `docs/trial-guide.md` for manual exploration.

## Inline code review

Baseline: `8f242316f7806e7a3127e68da687212c28c2681a`. Main-agent review only, as required by `.ai/rules/agent-workflow.md`.

Standards: no unresolved findings. Validated existing boundaries, no new dependency or API endpoint, comments preserved, behavior-only tests. Fixture/preparation code stays outside production modules. Archive/replacement requires an explicit flag and verifies preservation before replacement.

Spec: automated acceptance checks pass; model choice and realistic-input evidence recorded; Ticket 08 retired consistently. Remaining human acceptance is explicit rather than falsely checked off. No extra product feature or model selector added.

Next.js feedback pass: no verified qualifying friction in this task. Existing Node module-type warnings are unrelated to Next.js.
