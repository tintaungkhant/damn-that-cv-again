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

test("build settings, drafts, accepted CV and history cross the React transport", async () => {
  const store = openStore(":memory:");
  try {
    const chat = store.createChat({ category: "build", title: "Platform" });
    await assert.doesNotReject(() => encodeReply(store.getCvWorkspace(chat.id)));
    store.updateBuildSettings(chat.id, { jobDescription: "Queue engineer", targetRole: "", targetCompany: "", projectLimit: 5 }, 0);
    const profileChat = store.createChat({ category: "profile", title: "Career" });
    const profileTurn = store.beginTurn({ chatId: profileChat.id, content: "Engineer" });
    store.completeTurn(profileTurn.id, "Review", { baseRevision: null, summary: "Work", operations: [{ type: "insert", id: "p-work", afterId: null, content: "## Work\n\nEngineer." }] });
    store.approveProfileProposal(store.getProfileProposals(profileChat.id)[0].id, null);
    const turn = store.beginTurn({ chatId: chat.id, content: "Draft" });
    store.completeTurn(turn.id, "Engineer matches role; alternative: shorter summary.", undefined, { profileRevision: store.getProfileRevisions()[0].id, value: { schemaVersion: 1, sections: [{ type: "text", title: "Summary", content: { text: "Engineer", evidence: ["p-work"] } }] } });
    const workspace = store.getCvWorkspace(chat.id);
    await assert.doesNotReject(() => encodeReply(workspace));
    store.changeCvRevision({ chatId: chat.id, revisionId: workspace.revisions[0].id, action: "accept", expectedAcceptedId: null });
    await assert.doesNotReject(() => encodeReply(store.getCvWorkspace(chat.id)));
  } finally { store.close(); }
});
