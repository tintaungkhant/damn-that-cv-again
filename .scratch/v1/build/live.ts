import assert from "node:assert/strict";
import { openStore } from "../../../lib/storage/store.ts";
import { createChatService } from "../../../lib/ai/chat.ts";
import { createClaudeProvider } from "../../../lib/ai/claude/provider.ts";
const store = openStore(":memory:");
const profileChat = store.createChat({ category: "profile", title: "Synthetic career" });
const profileTurn = store.beginTurn({ chatId: profileChat.id, content: "Synthetic confirmed notes" });
store.completeTurn(profileTurn.id, "Review", { baseRevision: null, summary: "Synthetic profile", operations: [
  { type: "insert", id: "p-role", afterId: null, content: "## Experience\n\nAlex Example was a backend engineer at ExampleCo from 2020 to 2022. Used TypeScript. No metrics or Kubernetes experience confirmed." },
  { type: "insert", id: "p-queue", afterId: "p-role", content: "## Queue project\n\nBuilt an internal TypeScript queue with retry handling at ExampleCo. Individual contribution: backend implementation. No measurable outcome confirmed." },
  { type: "insert", id: "p-animation", afterId: "p-queue", content: "## Animation project\n\nCreated a personal animation demo. No professional frontend role confirmed." },
] });
store.approveProfileProposal(store.getProfileProposals(profileChat.id)[0].id, null);
const originalProfile = store.getProfileRevisions()[0];
const chat = store.createChat({ category: "build", title: "Synthetic queue role" });
store.updateBuildSettings(chat.id, { jobDescription: "Backend engineer for reliable TypeScript queue services. Kubernetes is a nice-to-have; do not invent experience.", targetRole: "Backend engineer", targetCompany: "SyntheticCo", projectLimit: 1 }, 0);
const service = createChatService(store, createClaudeProvider());
async function send(content: string) {
  const reader = service.send({ chatId: chat.id, content }).stream.getReader();
  let proposed = false;
  for (;;) {
    const item = await reader.read(); if (item.done) break;
    assert.notEqual(item.value.type, "error", JSON.stringify(item.value));
    if (item.value.type === "proposal" && item.value.kind === "cv") proposed = true;
  }
  assert.ok(proposed, "No CV tool proposal");
}
try {
  await send("Create a complete tailored CV draft now with propose_cv, using the confirmed profile and saved job details. Include the most relevant project. Do not block on missing metrics or optional fields. Explain selections and one alternative in your reply. Do not propose profile changes.");
  const first = store.getCvWorkspace(chat.id).revisions[0];
  assert.equal(first.status, "draft");
  assert.equal(store.getCvWorkspace(chat.id).acceptedId, null);
  const narrative = JSON.stringify(first.content);
  assert.match(narrative, /queue|retry/i);
  assert.doesNotMatch(narrative, /\d+\s*%/);
  assert.doesNotMatch(narrative, /Kubernetes/i);
  assert.match(first.explanation, /select|relevan|prioriti|alternative|omit/i);
  store.changeCvRevision({ chatId: chat.id, revisionId: first.id, action: "accept", expectedAcceptedId: null });
  console.log("Live generation: tailored draft, evidence validation, explanation and explicit acceptance passed.");
  await send("Create a shorter replacement draft with propose_cv. Keep facts unchanged. Focus on queue work and omit animation. Explain the selection and one alternative. Do not accept anything or change the career profile.");
  let workspace = store.getCvWorkspace(chat.id);
  assert.equal(workspace.revisions.length, 2);
  assert.equal(workspace.acceptedId, first.id);
  store.changeCvRevision({ chatId: chat.id, revisionId: workspace.revisions[0].id, action: "discard", expectedAcceptedId: first.id });
  store.changeCvRevision({ chatId: chat.id, revisionId: first.id, action: "restore", expectedAcceptedId: first.id });
  workspace = store.getCvWorkspace(chat.id);
  assert.equal(workspace.acceptedId, first.id);
  assert.deepEqual(workspace.revisions[0].content, first.content);
  assert.equal(store.getProfileRevisions()[0].markdown, originalProfile.markdown);
  console.log("Live revision: second draft, accepted CV preservation, discard, restore and unchanged profile passed. Synthetic in-memory data only.");
} finally { store.close(); }
