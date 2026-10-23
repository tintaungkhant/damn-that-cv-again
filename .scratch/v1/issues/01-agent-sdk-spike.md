# 01: Agent SDK feasibility spike

Status: ready-for-agent

## Goal

Prove that the Claude Agent SDK works on this machine with the local Claude subscription login before any other work starts. This is the go/no-go for the provider approach.

## Scope

A throwaway script outside the app, under `.scratch/v1/spike/`. It must:

- Authenticate with the local Claude Code subscription login only, with no `ANTHROPIC_API_KEY` set.
- Use a custom system prompt, with built-in tools disabled and local settings and `CLAUDE.md` not loaded.
- Register one in-process tool with a zod schema and get the model to call it.
- Stream text with partial messages enabled.
- Report usage from the result message.

## Acceptance

- [ ] A run with no API key in the environment succeeds.
- [ ] Text deltas arrive before the turn completes.
- [ ] The tool call arrives with input that passes the zod schema.
- [ ] Neither the user's personal `CLAUDE.md` nor the built-in tools affect the reply.
- [ ] Time to first token and total latency are recorded for a realistic prompt.
- [ ] Findings are written to `.scratch/v1/spike/findings.md`: SDK version, exact options used, latency, usage, and any blockers.

## Comments
