import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { openStore } from "./store.ts";
const require = createRequire(import.meta.url);
const { encodeReply } = require("next/dist/compiled/react-server-dom-webpack-experimental/client.node.js");

test("saved conversations cross the React transport before and after a reply", async () => {
  const store = openStore(":memory:");
  try {
    const chat = store.createChat({ category: "profile", title: "Career" });
    const turn = store.beginTurn({ chatId: chat.id, content: "My career notes" });
    await assert.doesNotReject(() => encodeReply(store.getMessages(chat.id)));
    store.completeTurn(turn.id, "Tell me more.");
    await assert.doesNotReject(() => encodeReply(store.getMessages(chat.id)));
    assert.deepEqual(store.getMessages(chat.id).map(message => message.content), ["My career notes", "Tell me more."]);
  } finally { store.close(); }
});
