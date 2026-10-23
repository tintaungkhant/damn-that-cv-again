import { test } from "node:test";
import assert from "node:assert/strict";
import { createClaudeProvider } from "./provider.ts";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
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


test("Claude profile tool validates a whole batch and emits it only after successful completion", async () => {
  const value = { baseRevision: null, summary: "Initial notes", operations: [{ type: "insert", id: "p-role", afterId: null, content: "## Work\n\nEngineer." }] };
  const provider = createClaudeProvider(input => ({
    close() {},
    async *[Symbol.asyncIterator](): AsyncGenerator<SDKMessage> {
      const server = input.options?.mcpServers?.profile;
      assert.ok(server && "instance" in server);
      assert.deepEqual(input.options?.allowedTools, ["mcp__profile__propose_profile_edit"]);
      const client = new Client({ name: "test", version: "1" });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await server.instance.connect(serverTransport);
      await client.connect(clientTransport);
      try {
        const response = await client.callTool({ name: "propose_profile_edit", arguments: value });
        assert.notEqual(response.isError, true);
      } finally { await client.close(); await server.instance.close(); }
      yield { type: "result", subtype: "success", is_error: false, usage: { input_tokens: 1, output_tokens: 2 } } as SDKMessage;
    },
  }));
  const events = [];
  for await (const event of provider.stream({ ...request, profileRevision: null }, new AbortController().signal)) events.push(event);
  assert.deepEqual(events.map(event => event.type), ["proposal", "usage", "done"]);
  assert.deepEqual(events[0], { type: "proposal", kind: "profile", value });
});
