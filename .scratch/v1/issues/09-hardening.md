# 09: Hardening and model choice

Status: claimed
Blocked by: 06, 07

## Goal

Check every acceptance condition end to end and choose the model.

## Scope

- Realistic trial: a full career profile, a long conversation, and a CV export. Evaluate relevance, output validity, latency, and usage.
- Choose the initial model from the trial.
- Leave a complete fictional trial workspace for manual exploration. Archive the existing local test database before replacing it, as explicitly authorized by the user.
- Walk all active acceptance conditions and fix gaps. Condition 9 is retired with Ticket 08.

## Acceptance

- [ ] All acceptance conditions in `docs/product-spec.md` pass.
- [ ] The model choice and trial results are recorded.

## Comments

- Hardening slice: explicitly select the trial model (initial candidate Sonnet); include resolved model in usage events; disable automatic context compaction and reject any compact-boundary event as a context-limit error. Provider tests reproduce the previous silent-compaction behavior and pass after the fix. Live model comparison and manual dataset preparation are in progress.
