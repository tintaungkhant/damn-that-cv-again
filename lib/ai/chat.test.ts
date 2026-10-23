import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../storage/store.ts";
import { createChatService } from "./chat.ts";
import type { ChatProvider } from "./provider.ts";

test("chat streams before completion and saves only a completed assistant", async () => {
  const store = openStore(":memory:");
  const chat = store.createChat({ category: "profile", title: "Career" });
  let finish!: () => void;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  const provider: ChatProvider = { async *stream(request) {
    assert.deepEqual(request.messages, [{ role: "user", content: "I build software" }]);
    assert.equal(store.getMessages(chat.id)[0].status, "pending");
    yield { type: "text-delta", text: "Tell me" };
    await gate;
    yield { type: "text-delta", text: " more." };
    yield { type: "done" };
  }};
  try {
    const reply = createChatService(store, provider).send({ chatId: chat.id, content: "I build software" });
    const reader = reply.stream.getReader();
    assert.deepEqual((await reader.read()).value, { type: "text-delta", text: "Tell me" });
    assert.equal(store.getMessages(chat.id).length, 1);
    finish();
    while (!(await reader.read()).done) {}
    assert.equal(store.getMessages(chat.id)[1].content, "Tell me more.");
  } finally { finish(); store.close(); }
});

test("cancelling a partial reply preserves the user message and retry succeeds", async () => {
  const store = openStore(":memory:");
  const chat = store.createChat({ category: "profile", title: "Career" });
  let attempts = 0;
  const provider: ChatProvider = { async *stream(_request, signal) {
    attempts++;
    yield { type: "text-delta", text: attempts === 1 ? "Partial" : "Complete" };
    if (attempts === 1) await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
    yield { type: "done" };
  }};
  try {
    const service = createChatService(store, provider);
    const first = service.send({ chatId: chat.id, content: "Hello" });
    const reader = first.stream.getReader();
    await reader.read();
    await reader.cancel();
    assert.equal(store.getMessages(chat.id)[0].status, "failed");
    const retry = service.send({ chatId: chat.id, retryId: first.messageId });
    const retryReader = retry.stream.getReader();
    while (!(await retryReader.read()).done) {}
    assert.deepEqual(store.getMessages(chat.id).map(message => message.content), ["Hello", "Complete"]);
    assert.equal(store.getMessages(chat.id)[0].status, "complete");
  } finally { store.close(); }
});

for (const failure of ["throw", "missing-done", "rate-limit", "context-limit", "proposal"] as const) {
  test(`${failure} never saves a partial assistant and leaves retry available`, async () => {
    const store = openStore(":memory:");
    const chat = store.createChat({ category: "profile", title: "Career" });
    const provider: ChatProvider = { async *stream() {
      yield { type: "text-delta", text: "Unsaved" };
      if (failure === "throw") throw new Error("Private provider failure");
      if (failure === "rate-limit" || failure === "context-limit") yield { type: "error", code: failure, message: "Actionable failure" };
      if (failure === "proposal") yield { type: "proposal", kind: "profile", value: {} };
    }};
    try {
      const reply = createChatService(store, provider).send({ chatId: chat.id, content: "Hello" });
      const events = [];
      const reader = reply.stream.getReader();
      for (;;) { const result = await reader.read(); if (result.done) break; events.push(result.value); }
      assert.equal(events.at(-1)?.type, "error");
      assert.equal(store.getMessages(chat.id).length, 1);
      assert.equal(store.getMessages(chat.id)[0].status, "failed");
      assert.equal(store.beginTurn({ chatId: chat.id, retryId: reply.messageId }).id, reply.messageId);
    } finally { store.close(); }
  });
}

test("stop action marks failure immediately even while the provider is waiting", async () => {
  const store = openStore(":memory:");
  const chat = store.createChat({ category: "build", title: "Role" });
  const provider: ChatProvider = { async *stream(_request, signal) {
    yield { type: "text-delta", text: "Partial" };
    await new Promise<void>(resolve => {
      if (signal.aborted) resolve();
      else signal.addEventListener("abort", () => resolve(), { once: true });
    });
    yield { type: "done" };
  }};
  try {
    const service = createChatService(store, provider);
    const reply = service.send({ chatId: chat.id, content: "Help" });
    const reader = reply.stream.getReader();
    await reader.read();
    service.cancel(chat.id, reply.messageId);
    assert.equal(store.getMessages(chat.id)[0].status, "failed");
    const result = await reader.read();
    assert.equal(result.value?.type, "error");
    assert.equal((await reader.read()).done, true);
    assert.equal(store.getMessages(chat.id).length, 1);
  } finally { store.close(); }
});


test("each request rebuilds current profile and only its active chat history", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cv-context-"));
  const path = join(directory, "app.sqlite");
  const store = openStore(path);
  const fixtures = new DatabaseSync(path);
  const chat = store.createChat({ category: "profile", title: "Active" });
  const other = store.createChat({ category: "profile", title: "Unrelated" });
  const unrelated = store.beginTurn({ chatId: other.id, content: "Unrelated confidential notes" });
  store.completeTurn(unrelated.id, "Unrelated response");
  fixtures.prepare("INSERT INTO profile_revisions(id, user_id, markdown, created_at) VALUES (?, ?, ?, ?)").run("old", store.userId, "Original profile", "2026-01-01");
  const requests: { profile: string; messages: { role: string; content: string }[] }[] = [];
  const provider: ChatProvider = { async *stream(request) {
    requests.push(request);
    yield { type: "text-delta", text: "Answer" };
    yield { type: "done" };
  }};
  try {
    const service = createChatService(store, provider);
    let reply = service.send({ chatId: chat.id, content: "First question" });
    let reader = reply.stream.getReader();
    while (!(await reader.read()).done) {}
    fixtures.prepare("INSERT INTO profile_revisions(id, user_id, markdown, created_at) VALUES (?, ?, ?, ?)").run("new", store.userId, "Updated confirmed profile", "2026-02-01");
    reply = service.send({ chatId: chat.id, content: "Second question" });
    reader = reply.stream.getReader();
    while (!(await reader.read()).done) {}
    assert.equal(requests[0].profile, "Original profile");
    assert.equal(requests[1].profile, "Updated confirmed profile");
    assert.deepEqual(requests[1].messages, [
      { role: "user", content: "First question" },
      { role: "assistant", content: "Answer" },
      { role: "user", content: "Second question" },
    ]);
  } finally { fixtures.close(); store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("an old stream disconnect cannot fail a newer retry of the same message", async () => {
  const store = openStore(":memory:");
  const chat = store.createChat({ category: "profile", title: "Career" });
  let attempt = 0;
  let releaseOld!: () => void;
  let releaseRetry!: () => void;
  const oldGate = new Promise<void>(resolve => { releaseOld = resolve; });
  const retryGate = new Promise<void>(resolve => { releaseRetry = resolve; });
  const provider: ChatProvider = { async *stream() {
    const current = ++attempt;
    yield { type: "text-delta", text: current === 1 ? "Partial" : "Complete" };
    await (current === 1 ? oldGate : retryGate);
    yield { type: "done" };
  }};
  try {
    const service = createChatService(store, provider);
    const first = service.send({ chatId: chat.id, content: "Hello" });
    const oldReader = first.stream.getReader();
    await oldReader.read();
    service.cancel(chat.id, first.messageId);
    const retry = service.send({ chatId: chat.id, retryId: first.messageId });
    const retryReader = retry.stream.getReader();
    await retryReader.read();
    await oldReader.cancel();
    releaseOld();
    releaseRetry();
    while (!(await retryReader.read()).done) {}
    assert.deepEqual(store.getMessages(chat.id).map(message => message.content), ["Hello", "Complete"]);
  } finally { releaseOld(); releaseRetry(); store.close(); }
});
