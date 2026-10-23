import { createClaudeProvider } from "../../../lib/ai/claude/provider.ts";
const started = performance.now();
for await (const event of createClaudeProvider().stream({ instructions: "Reply in one short sentence.", profile: "No saved profile.", messages: [{ role: "user", content: "Ask me which role I want to apply for." }] }, AbortSignal.timeout(60_000))) {
  console.log(JSON.stringify({ ms: Math.round(performance.now() - started), event }));
}
