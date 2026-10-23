# Agent SDK spike: findings

Date: 2026-10-23. Machine: Windows 11 Pro, Bun 1.4.4, Node 26.11.1.

## Verdict

**Go.** The Agent SDK works with the local Claude subscription login. Streaming, a custom in-process tool with a zod schema, and usage reporting all work. No blockers.

## Versions

- `@anthropic-ai/claude-agent-sdk` 0.3.309
- Claude Code reported by the SDK `init` message: 2.1.309
- `zod` 4.6.7
- Default model chosen by the SDK: `claude-opus-5-5` (no `model` option passed)

## How to run

```sh
cd .scratch/v1/spike
bun install
bun spike.ts
```

## Exact options used

```ts
query({
  prompt: PROMPT, // a realistic career profile plus a request for advice and a CV header
  options: {
    systemPrompt: SYSTEM_PROMPT, // custom string, replaces the Claude Code default
    tools: [], // disables all built-in tools
    settingSources: [], // no user, project or local settings, so no CLAUDE.md
    skills: [],
    title: "cv-spike", // skips the automatic title-generation model call
    strictMcpConfig: true, // ignore any MCP config on disk
    mcpServers: { cv: createSdkMcpServer({ name: "cv", version: "0.0.0", tools: [proposeCv] }) },
    allowedTools: ["mcp__cv__propose_cv"], // auto-approve the one tool
    includePartialMessages: true,
    persistSession: false,
    maxTurns: 3,
    cwd, // temp dir holding canary CLAUDE.md and AGENTS.md files
    env, // process.env with ANTHROPIC_API_KEY and ANTHROPIC_AUTH_TOKEN removed
  },
});
```

The tool is `tool("propose_cv", ..., zodRawShape, handler)`. The handler validates its input again with `z.object(shape).strict().safeParse`.

## Acceptance results

| Check | Result |
| --- | --- |
| Run with no API key | Pass. `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` unset in parent and child. `init.apiKeySource` is `none`. `accountInfo()` reports `subscriptionType: "Claude Team"`, `apiProvider: "firstParty"`. |
| Text deltas before turn completes | Pass. 102 to 109 `text_delta` stream events arrived, the first at about 2.4 to 3.2 s and the result at about 12.5 s. |
| Tool call input passes the zod schema | Pass. One `propose_cv` call per run, and `safeParse` succeeded each time. |
| No personal `CLAUDE.md` or built-in tool effect | Pass. `init.tools` is only `mcp__cv__propose_cv`. The `CLAUDE.md` and `AGENTS.md` canary markers did not appear in the reply. User-level plugins and hooks (for example a SessionStart hook that forces a terse reply style) did not load, and the reply used normal prose. There is no `~/.claude/CLAUDE.md` on this machine, so the user-level check relies on user settings not loading. |
| Latency recorded | See below. |

## Latency and usage

Realistic prompt: an 8-year career profile (about 250 words) and a request for advice plus a CV header. Each run had 2 turns: text and a tool call, then a closing text after the tool result.

| Run | Process start to `init` | First text delta | SDK `ttft_ms` | Total | Cost (list, USD) |
| --- | --- | --- | --- | --- | --- |
| 1 | 1.9 s | 3.2 s | 1.6 s | 13.4 s | 0.040 |
| 2 | n/a | 2.4 s | 1.9 s | 12.7 s | 0.031 |

The first-delta times are measured from just before `query()`, so they include spawning the Claude Code process.

Run 2 usage for `claude-opus-5-5`: 4 input tokens, 3,135 cache-read tokens, 1,283 cache-write tokens, 1,028 output tokens.

`result.usage` carries `input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, `output_tokens` and `output_tokens_details.thinking_tokens`. `result.modelUsage` breaks the same numbers down per model and includes `contextWindow` (1,000,000) and `maxOutputTokens` (128,000). `total_cost_usd` is a list-price estimate, not a subscription charge.

## Observations for the provider layer

- Without `title`, the SDK makes an extra `claude-haiku-5-5` call (about 1.5K input tokens) to generate a session title, even with `persistSession: false`. Set `title` to avoid it.
- `env` replaces the child environment entirely. Spread `process.env` and delete the API-key variables.
- `init` still lists built-in plugins (`cc-plugin-sec-default`, `cc-plugin-agents-md`, `cc-plugin-telemetry`, `cc-plugin-plugin-authoring`) and 22 built-in skills, even with `settingSources: []` and `skills: []`. No `Skill` tool is exposed, so the model cannot run them, and the `AGENTS.md` canary in `cwd` was not loaded. It is not proven whether the skill listing takes up prompt tokens. If context size matters later, check this again.
- The app's real `cwd` will be the repo root, which has an `AGENTS.md`. The canary shows it is not loaded with these options, but set `cwd` to a neutral directory anyway to be safe.
- Text streams in two parts, one before and one after the tool call. The app should build the reply from the stream events, not from `result.result`.
- The tool handler returns a `CallToolResult`. The model then writes a closing message, which adds about 4 s. Later tickets can decide whether to stop after the proposal tool call.

## Blockers

None.
