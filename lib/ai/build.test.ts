import test from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../storage/store.ts";
import { createChatService } from "./chat.ts";
import type { ChatProvider } from "./provider.ts";
const cv = { schemaVersion: 1, sections: [{ type: "list", title: "Strengths", items: [{ text: "Queue services", evidence: ["p-work"] }] }] };
function setup() {
  const store = openStore(":memory:");
  const profile = store.createChat({ category: "profile", title: "Career" });
  const turn = store.beginTurn({ chatId: profile.id, content: "Engineer building queues" });
  store.completeTurn(turn.id, "Review", { baseRevision: null, summary: "Work", operations: [{ type: "insert", id: "p-work", afterId: null, content: "## Work\n\nEngineer building queues." }] });
  store.approveProfileProposal(store.getProfileProposals(profile.id)[0].id, null);
  const chat = store.createChat({ category: "build", title: "Platform" });
  store.updateBuildSettings(chat.id, { jobDescription: "Build reliable queues", targetRole: "Platform engineer", targetCompany: "ExampleCo", projectLimit: 2 }, 0);
  return { store, chat };
}
async function drain(stream: ReadableStream) {
  const reader = stream.getReader(); const events = [];
  for (;;) { const next = await reader.read(); if (next.done) return events; events.push(next.value); }
}

test("build requests include job details and active CVs; a complete proposal saves a draft without acceptance", async () => {
  const { store, chat } = setup();
  let calls = 0;
  const provider: ChatProvider = { async *stream(request) {
    assert.equal(request.build?.settings.projectLimit, 2);
    assert.equal(request.build?.settings.targetRole, "Platform engineer");
    assert.equal(request.build?.settings.jobDescription, "Build reliable queues");
    assert.ok(!request.messages.some(item => item.content === "Engineer building queues"));
    if (calls++ === 0) {
      assert.equal(request.build?.accepted, null);
      yield { type: "text-delta", text: "Selected queue work for reliability. Alternative: emphasize operations." };
      yield { type: "proposal", kind: "cv", value: cv };
    } else {
      assert.deepEqual(request.build?.accepted?.content, cv);
      yield { type: "text-delta", text: "Accepted CV stays unchanged." };
    }
    yield { type: "done" };
  }};
  try {
    const service = createChatService(store, provider);
    const events = await drain(service.send({ chatId: chat.id, content: "Draft for this job" }).stream);
    assert.equal(events.at(-1)?.type, "done");
    const workspace = store.getCvWorkspace(chat.id);
    assert.equal(workspace.revisions.length, 1);
    assert.equal(workspace.acceptedId, null);
    store.changeCvRevision({ chatId: chat.id, revisionId: workspace.revisions[0].id, action: "accept", expectedAcceptedId: null });
    await drain(service.send({ chatId: chat.id, content: "Discuss alternatives" }).stream);
    assert.equal(store.getCvWorkspace(chat.id).revisions.length, 1);
  } finally { store.close(); }
});

for (const failure of ["interrupted", "invalid-evidence", "missing-explanation", "duplicate-cv", "profile-chat"] as const) {
  test(`${failure} never commits a CV or partial profile proposal`, async () => {
    const { store, chat } = setup();
    const active = failure === "profile-chat" ? store.createChat({ category: "profile", title: "Not a build" }) : chat;
    const beforeProfile = store.getProfileRevisions()[0];
    const provider: ChatProvider = { async *stream(request) {
      yield { type: "proposal", kind: "profile", value: { baseRevision: request.profileRevision, summary: "New notes", operations: [{ type: "insert", id: "p-other", afterId: null, content: "## Other\n\nUnapproved fact." }] } };
      if (failure !== "missing-explanation") yield { type: "text-delta", text: "Selection explanation" };
      const value = failure === "invalid-evidence" ? { schemaVersion: 1, sections: [{ type: "text", title: "Summary", content: { text: "Unapproved fact", evidence: ["p-other"] } }] } : cv;
      yield { type: "proposal", kind: "cv", value };
      if (failure === "interrupted") throw new Error("Disconnected");
      if (failure === "duplicate-cv") yield { type: "proposal", kind: "cv", value };
      yield { type: "done" };
    }};
    try {
      const events = await drain(createChatService(store, provider).send({ chatId: active.id, content: "Generate" }).stream);
      assert.equal(events.at(-1)?.type, "error");
      assert.equal(store.getMessages(active.id).at(-1)?.status, "failed");
      assert.equal(store.getProfileProposals(active.id).length, 0);
      assert.equal(store.getCvWorkspace(chat.id).revisions.length, 0);
      assert.equal(store.getProfileRevisions()[0].id, beforeProfile.id);
    } finally { store.close(); }
  });
}

test("a CV uses its request's profile snapshot even if another chat updates the profile mid-reply", async () => {
  const { store, chat } = setup();
  const original = store.getProfileRevisions()[0];
  const provider: ChatProvider = { async *stream() {
    const profileChat = store.listChats({}).items.find(item => item.category === "profile")!;
    const turn = store.beginTurn({ chatId: profileChat.id, content: "Remove obsolete work" });
    store.completeTurn(turn.id, "Review", { baseRevision: original.id, summary: "Remove", operations: [{ type: "delete", id: "p-work" }] });
    store.approveProfileProposal(store.getProfileProposals(profileChat.id)[0].id, original.id);
    yield { type: "text-delta", text: "Queue work fits this job; alternative is to omit the summary." };
    yield { type: "proposal", kind: "cv", value: cv };
    yield { type: "done" };
  }};
  try {
    const events = await drain(createChatService(store, provider).send({ chatId: chat.id, content: "Generate" }).stream);
    assert.equal(events.at(-1)?.type, "done");
    assert.equal(store.getCvWorkspace(chat.id).revisions[0].profileRevision, original.id);
    assert.deepEqual(store.getCvWorkspace(chat.id).revisions[0].content, cv);
    assert.notEqual(store.getProfileRevisions()[0].id, original.id);
  } finally { store.close(); }
});

test("a failed CV request can be corrected through saved job details and retried without duplicating its message", async () => {
  const { store, chat } = setup();
  const provider: ChatProvider = { async *stream() {
    yield { type: "text-delta", text: "Queue work matches this role; alternative: concise summary." };
    yield { type: "proposal", kind: "cv", value: cv };
    yield { type: "done" };
  }};
  try {
    store.updateBuildSettings(chat.id, { jobDescription: "", targetRole: "", targetCompany: "", projectLimit: 5 }, 1);
    const service = createChatService(store, provider);
    const first = service.send({ chatId: chat.id, content: "Generate for saved job" });
    const failed = await drain(first.stream);
    assert.equal(failed.at(-1)?.type, "error");
    store.updateBuildSettings(chat.id, { jobDescription: "TypeScript queue engineer", targetRole: "", targetCompany: "", projectLimit: 1 }, 2);
    const retried = await drain(service.send({ chatId: chat.id, retryId: first.messageId }).stream);
    assert.equal(retried.at(-1)?.type, "done");
    assert.equal(store.getMessages(chat.id).length, 2);
    assert.equal(store.getCvWorkspace(chat.id).revisions.length, 1);
  } finally { store.close(); }
});
