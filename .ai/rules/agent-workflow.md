Applies to: how AI agents work in this repo.

# Agent workflow rules

- The main agent does all work itself. Do not spawn subagents, background agents, forks, or multi-agent workflows.
- This includes skills that would normally delegate to subagents (for example parallel reviews). Run those steps inline in the main agent instead.
