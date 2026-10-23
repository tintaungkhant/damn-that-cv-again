Applies to: how AI agents work in this repo.

# Agent workflow rules

- The main agent does all work itself. Do not spawn subagents, background agents, forks, or multi-agent workflows.
- This includes skills that would normally delegate to subagents (for example parallel reviews). Run those steps inline in the main agent instead.

## Breaking a rule

- Rules are strong defaults, not absolute. Follow them unless a project requirement cannot be met without breaking one.
- When that happens, stop and flag it to the user before you break the rule. Name the rule, the requirement, and the smallest exception that would work. Wait for approval.
- Record each approved exception in the affected ticket.

## Commits

- Commit each completed chunk of work as you go. Do not wait for the whole feature or ticket.
- A chunk is a coherent step that typechecks and passes its tests, for example a rule change, a migration, or one working slice of UI.
- Include the related doc, spec, and ticket updates in the same commit as the change (see `docs-sync.md`).
