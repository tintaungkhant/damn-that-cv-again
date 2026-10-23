# 01: Agent SDK feasibility spike

Status: resolved

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

- [x] A run with no API key in the environment succeeds.
- [x] Text deltas arrive before the turn completes.
- [x] The tool call arrives with input that passes the zod schema.
- [x] Neither the user's personal `CLAUDE.md` nor the built-in tools affect the reply.
- [x] Time to first token and total latency are recorded for a realistic prompt.
- [x] Findings are written to `.scratch/v1/spike/findings.md`: SDK version, exact options used, latency, usage, and any blockers.

## Comments

Spike done on 2026-10-23. Verdict: go. Script and findings are in `.scratch/v1/spike/` (`spike.ts`, `findings.md`). Two runs with no API key passed every acceptance check. First text delta came at about 2.4 to 3.2 s and the full turn took about 12.5 to 13.4 s on `claude-opus-5-5`.

- 2026-10-23: Status set to `resolved` during docs cleanup; every acceptance box was already ticked.
