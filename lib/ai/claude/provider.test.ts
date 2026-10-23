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
    assert.deepEqual(input.options?.settings, { autoCompactEnabled: false });
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

test("Claude exposes the approved CV tool only for build chats and stages valid CVs", async () => {
  const value = { schemaVersion: 1, sections: [{ type: "list", title: "Skills", items: [{ text: "TypeScript", evidence: ["p-work"] }] }] };
  const provider = createClaudeProvider(input => ({
    close() {},
    async *[Symbol.asyncIterator](): AsyncGenerator<SDKMessage> {
      const server = input.options?.mcpServers?.profile;
      assert.ok(server && "instance" in server);
      assert.ok(input.options?.allowedTools?.includes("mcp__profile__propose_cv"));
      const prompt = JSON.parse(String(input.prompt));
      assert.equal(prompt.build.settings.projectLimit, 3);
      const client = new Client({ name: "test", version: "1" });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await server.instance.connect(serverTransport); await client.connect(clientTransport);
      try {
        const tools = await client.listTools();
        assert.ok(tools.tools.some(item => item.name === "propose_cv"));
        const response = await client.callTool({ name: "propose_cv", arguments: value });
        assert.notEqual(response.isError, true);
      } finally { await client.close(); await server.instance.close(); }
      yield { type: "result", subtype: "success", is_error: false, usage: { input_tokens: 1, output_tokens: 2 } } as SDKMessage;
    },
  }));
  const events = [];
  for await (const event of provider.stream({ ...request, build: { settings: { jobDescription: "Build services", targetRole: "", targetCompany: "", projectLimit: 3 }, draft: null, accepted: null } }, new AbortController().signal)) events.push(event);
  assert.deepEqual(events[0], { type: "proposal", kind: "cv", value });
  assert.equal(events.at(-1)?.type, "done");
});


test("Claude uses the chosen model explicitly and reports the resolved model with token usage", async () => {
  for (const model of [undefined, "haiku"]) {
    let selected: string | undefined;
    const provider = createClaudeProvider(input => {
      selected = input.options?.model;
      return {
        close() {},
        async *[Symbol.asyncIterator](): AsyncGenerator<SDKMessage> {
          yield { type: "result", subtype: "success", is_error: false,
            usage: { input_tokens: 7, output_tokens: 11, cache_read_input_tokens: 13, cache_creation_input_tokens: 17 },
            modelUsage: { "resolved-trial-model": {} } } as unknown as SDKMessage;
        },
      };
    }, model);
    const events = [];
    for await (const event of provider.stream(request, new AbortController().signal)) events.push(event);
    assert.equal(selected, model ?? "sonnet");
    assert.deepEqual(events[0], { type: "usage", inputTokens: 7, outputTokens: 11, cacheReadTokens: 13, cacheWriteTokens: 17, model: "resolved-trial-model" });
  }
});


test("Claude refuses silent compaction instead of returning a shortened-context success", async () => {
  const provider = createClaudeProvider(input => ({
    close() {},
    async *[Symbol.asyncIterator](): AsyncGenerator<SDKMessage> {
      yield { type: "system", subtype: "compact_boundary" } as SDKMessage;
      yield { type: "result", subtype: "success", is_error: false, usage: { input_tokens: 1, output_tokens: 2 } } as SDKMessage;
    },
  }));
  const events = [];
  for await (const event of provider.stream(request, new AbortController().signal)) events.push(event);
  assert.deepEqual(events.map(event => event.type === "error" ? event.code : event.type), ["context-limit"]);
});
