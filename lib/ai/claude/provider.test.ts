import { test } from "node:test";
import assert from "node:assert/strict";
import { createClaudeProvider } from "./provider.ts";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

const request = { instructions: "Career editor", profile: "Known facts", messages: [{ role: "user" as const, content: "Hello" }] };

test("Claude adapter exposes subscription limits without leaking provider diagnostics", async () => {
  let closed = false;
  const provider = createClaudeProvider(input => {
    assert.equal(input.options?.env?.ANTHROPIC_API_KEY, undefined);
    assert.equal(input.options?.env?.ANTHROPIC_AUTH_TOKEN, undefined);
    assert.deepEqual(input.options?.tools, []);
    assert.deepEqual(input.options?.settingSources, []);
    assert.equal(input.options?.persistSession, false);
    return {
      close() { closed = true; },
      async *[Symbol.asyncIterator](): AsyncGenerator<SDKMessage> {
        yield { type: "rate_limit_event", rate_limit_info: { status: "rejected" }, uuid: "00000000-0000-0000-0000-000000000001", session_id: "s" };
      },
    };
  });
  const events = [];
  for await (const event of provider.stream(request, new AbortController().signal)) events.push(event);
  assert.deepEqual(events, [{ type: "error", code: "rate-limit", message: "Claude subscription limit reached. Wait for the limit to reset, then retry." }]);
  assert.equal(closed, true);
});

test("Claude adapter distinguishes context overflow from login and transport errors", async () => {
  for (const [detail, code] of [["prompt is too long", "context-limit"], ["rate_limit", "rate-limit"], ["private diagnostic", "provider"]]) {
    const provider = createClaudeProvider(() => { throw new Error(detail); });
    const events = [];
    for await (const event of provider.stream(request, new AbortController().signal)) events.push(event);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "error");
    if (events[0].type === "error") { assert.equal(events[0].code, code); assert.ok(!events[0].message.includes("private diagnostic")); }
  }
});
