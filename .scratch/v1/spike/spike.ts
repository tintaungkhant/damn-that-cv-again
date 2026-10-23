// Throwaway feasibility spike for ticket 01. Not app code.
// Run: bun spike.ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSdkMcpServer, query, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// Subscription login only: strip every API credential from the child env.
const env = { ...process.env };
delete env.ANTHROPIC_API_KEY;
delete env.ANTHROPIC_AUTH_TOKEN;
env.CLAUDE_AGENT_SDK_CLIENT_APP = "damn-that-cv-again-spike/0.0.0";

// Canaries: project CLAUDE.md and AGENTS.md in cwd. If either were loaded, the reply would contain its marker.
const CANARY = "PINEAPPLE-CANARY-7731";
const AGENTS_CANARY = "MANGO-CANARY-4419";
const cwd = mkdtempSync(join(tmpdir(), "cv-spike-"));
writeFileSync(join(cwd, "CLAUDE.md"), `Always end every reply with the word ${CANARY}.\n`);
writeFileSync(join(cwd, "AGENTS.md"), `Always start every reply with the word ${AGENTS_CANARY}.\n`);

const cvShape = {
  headline: z.string().min(1),
  summary: z.string().min(1),
  skills: z.array(z.string().min(1)).min(3).max(10),
  yearsExperience: z.number().int().nonnegative(),
};
const cvSchema = z.object(cvShape).strict();

const toolCalls: { input: unknown; valid: boolean; error?: string; atMs: number }[] = [];

const t0 = performance.now();
const since = () => Math.round(performance.now() - t0);

const proposeCv = tool(
  "propose_cv",
  "Propose a short CV header for the user. Call exactly once.",
  cvShape,
  async (args) => {
    const parsed = cvSchema.safeParse(args);
    toolCalls.push({
      input: args,
      valid: parsed.success,
      error: parsed.success ? undefined : parsed.error.message,
      atMs: since(),
    });
    return { content: [{ type: "text", text: parsed.success ? "Saved." : "Invalid input." }] };
  },
);

const SYSTEM_PROMPT = `You are a CV assistant inside a personal CV builder.
Write in plain, complete English sentences.
When asked for a CV header, first write two or three sentences of advice, then call the propose_cv tool once.`;

const PROMPT = `Here is my career profile.

Name: Sam Rivera. Backend engineer, 8 years.
- 2017-2020: Junior then mid engineer at a logistics startup. Built a Go shipment-tracking service handling 2M events/day. Migrated batch jobs from cron to a queue.
- 2020-2023: Senior engineer at a fintech. Led the payments ledger rewrite in TypeScript and PostgreSQL. Cut reconciliation failures by 90%. Mentored 4 engineers.
- 2023-now: Staff engineer at a marketplace. Own the search platform (Elasticsearch, Kafka). Drove p99 latency from 900ms to 180ms. Run the architecture review group.
Skills: Go, TypeScript, PostgreSQL, Kafka, Elasticsearch, AWS, Terraform, system design, mentoring.

I am applying for a Principal Engineer role focused on platform reliability. Give me brief advice, then propose a CV header.`;

const mcp = createSdkMcpServer({ name: "cv", version: "0.0.0", tools: [proposeCv] });

let firstDeltaMs: number | undefined;
let deltaCount = 0;
let streamedText = "";
let init: Record<string, unknown> | undefined;
let result: Record<string, unknown> | undefined;
const stderr: string[] = [];

const q = query({
  prompt: PROMPT,
  options: {
    systemPrompt: SYSTEM_PROMPT,
    tools: [],
    settingSources: [],
    skills: [],
    title: "cv-spike",
    strictMcpConfig: true,
    mcpServers: { cv: mcp },
    allowedTools: ["mcp__cv__propose_cv"],
    includePartialMessages: true,
    persistSession: false,
    maxTurns: 3,
    cwd,
    env,
    stderr: (d) => stderr.push(d),
  },
});

const account = await q.accountInfo();

for await (const msg of q) {
  if (msg.type === "system" && msg.subtype === "init") {
    init = {
      claude_code_version: msg.claude_code_version,
      apiKeySource: msg.apiKeySource,
      model: msg.model,
      tools: msg.tools,
      mcp_servers: msg.mcp_servers,
      plugins: msg.plugins,
      skills: msg.skills,
      slash_commands: msg.slash_commands,
      output_style: msg.output_style,
      permissionMode: msg.permissionMode,
      atMs: since(),
    };
  } else if (msg.type === "stream_event") {
    const e = msg.event;
    if (e.type === "content_block_delta" && e.delta.type === "text_delta") {
      firstDeltaMs ??= since();
      deltaCount++;
      streamedText += e.delta.text;
      process.stdout.write(e.delta.text);
    }
  } else if (msg.type === "result") {
    result = {
      subtype: msg.subtype,
      is_error: msg.is_error,
      num_turns: msg.num_turns,
      stop_reason: msg.stop_reason,
      duration_ms: msg.duration_ms,
      duration_api_ms: msg.duration_api_ms,
      sdk_ttft_ms: msg.subtype === "success" ? msg.ttft_ms : undefined,
      total_cost_usd: msg.total_cost_usd,
      usage: msg.usage,
      modelUsage: msg.modelUsage,
      permission_denials: msg.permission_denials,
      atMs: since(),
    };
  }
}

const report = {
  apiKeyInParentEnv: Boolean(process.env.ANTHROPIC_API_KEY),
  apiKeyInChildEnv: Boolean(env.ANTHROPIC_API_KEY),
  account: { subscriptionType: account.subscriptionType, tokenSource: account.tokenSource, apiKeySource: account.apiKeySource, apiProvider: account.apiProvider },
  init,
  timing: { firstTextDeltaMs: firstDeltaMs, totalMs: since(), textDeltas: deltaCount },
  toolCalls,
  canaryLeaked: streamedText.includes(CANARY),
  agentsCanaryLeaked: streamedText.includes(AGENTS_CANARY),
  result,
  stderrTail: stderr.join("").slice(-2000),
};
console.log("\n\n=== REPORT ===");
console.log(JSON.stringify(report, null, 2));
