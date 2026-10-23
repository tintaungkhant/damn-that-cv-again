# 09: Hardening and model choice

Status: ready-for-human
Blocked by: 06, 07

## Goal

Check every acceptance condition end to end and choose the model.

## Scope

- Realistic trial: a full career profile, a long conversation, and a CV export. Evaluate relevance, output validity, latency, and usage.
- Choose the initial model from the trial.
- Leave a complete fictional trial workspace for manual exploration. Archive the existing local test database before replacing it, as explicitly authorized by the user.
- Walk all active acceptance conditions and fix gaps. Condition 9 is retired with Ticket 08.

## Acceptance

- [x] All acceptance conditions in `docs/product-spec.md` pass.
- [x] The model choice and trial results are recorded.
- [x] All automated behavior/transport acceptance checks pass; a complete fictional workspace is installed.

## Comments

- Hardening slice: explicitly select the trial model (initial candidate Sonnet); include resolved model in usage events; disable automatic context compaction and reject any compact-boundary event as a context-limit error. Provider tests reproduce the previous silent-compaction behavior and pass after the fix. Live model comparison and manual dataset preparation are in progress.

- 2026-10-23: Automated work completed and committed. Chose pinned `claude-sonnet-5-5` from paired Sonnet/Haiku trials, fixed silent SDK context compaction, passed 53 tests and production transport/reopen/disconnect/retry checks. The user explicitly authorized replacing test data after a verified local database archive. Six fictional chats, 61 messages, three profile revisions, four CV revisions and a pending proposal are installed on port 3800.
- Manual acceptance remains open by design: the user asked to explore the trial workspace, and `.ai/rules/testing.md` prohibits agent browser/visual testing. The first acceptance box stays unchecked until layout, clipboard/download interactions and editorial quality are reviewed. [Trial guide](../../../docs/trial-guide.md); [results and acceptance audit](../hardening/findings.md).

- 2026-10-23: User confirmed Tickets 01–09 done and requested the next increment. This closes the pending user acceptance above; no agent browser verification was performed. Ticket 08 remains retired. Follow-up planning: `.scratch/workspace-next/spec.md`.
