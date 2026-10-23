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


test("profile review, proposal previews and revision history cross the React transport", async () => {
  const store = openStore(":memory:");
  try {
    const chat = store.createChat({ category: "profile", title: "Profile" });
    const turn = store.beginTurn({ chatId: chat.id, content: "Notes" });
    store.completeTurn(turn.id, "Review", { baseRevision: null, summary: "Notes", operations: [{ type: "insert", id: "p-work", afterId: null, content: "## Work\n\nEngineer." }] });
    await assert.doesNotReject(() => encodeReply(store.getProfileWorkspace(chat.id)));
    store.approveProfileProposal(store.getProfileProposals(chat.id)[0].id, null);
    await assert.doesNotReject(() => encodeReply(store.getProfileWorkspace(chat.id)));
    assert.equal(store.getProfileWorkspace(chat.id).revisions.length, 1);
  } finally { store.close(); }
});
