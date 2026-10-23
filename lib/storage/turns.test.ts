import { test } from "node:test";
import assert from "node:assert/strict";
import { openStore } from "./store.ts";

test("a failed turn retries the same user message and commits its assistant atomically", () => {
  const store = openStore(":memory:");
  try {
    const chat = store.createChat({ category: "profile", title: "Notes" });
    const turn = store.beginTurn({ chatId: chat.id, content: "My first role" });
    assert.equal(store.getMessages(chat.id)[0].status, "pending");
    assert.throws(() => store.beginTurn({ chatId: chat.id, content: "Another" }), /progress/);
    store.failTurn(turn.id);
    assert.equal(store.getMessages(chat.id)[0].status, "failed");
    const retry = store.beginTurn({ chatId: chat.id, retryId: turn.id });
    assert.equal(retry.id, turn.id);
    store.completeTurn(retry.id, "Tell me about it.");
    assert.deepEqual(store.getMessages(chat.id).map(({ role, content, status }) => ({ role, content, status })), [
      { role: "user", content: "My first role", status: "complete" },
      { role: "assistant", content: "Tell me about it.", status: "complete" },
    ]);
    assert.throws(() => store.beginTurn({ chatId: chat.id, retryId: turn.id }));
  } finally { store.close(); }
});

test("restart recovery fails interrupted turns without saving partial replies", () => {
  const store = openStore(":memory:");
  try {
    const chat = store.createChat({ category: "build", title: "Role" });
    const turn = store.beginTurn({ chatId: chat.id, content: "Help me" });
    store.recoverInterruptedTurns();
    assert.equal(store.getMessages(chat.id)[0].status, "failed");
    assert.throws(() => store.completeTurn(turn.id, "Late reply"));
    assert.equal(store.getMessages(chat.id).length, 1);
    assert.equal(store.beginTurn({ chatId: chat.id, retryId: turn.id }).id, turn.id);
  } finally { store.close(); }
});
