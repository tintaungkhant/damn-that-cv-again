import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { openStore } from "../../../lib/storage/store.ts";
import { createChatService } from "../../../lib/ai/chat.ts";
import { createClaudeProvider } from "../../../lib/ai/claude/provider.ts";
import { blocks, productJob, backendJob } from "./fixture.ts";
import type { ChatEvent } from "../../../lib/ai/provider.ts";

const store = openStore("data/trial-workspaces/sonnet.sqlite");
assert.equal(store.listChats().length, 2, "Run only once on the completed Sonnet candidate");
const service = createChatService(store, createClaudeProvider());
const timings: unknown[] = [];
async function send(chatId: string, content: string) {
  const start = performance.now();
  let firstTextMs: number | null = null;
  let usage: Extract<ChatEvent, { type: "usage" }> | undefined;
  for await (const event of service.send({ chatId, content }).stream) {
    assert.notEqual(event.type, "error", JSON.stringify(event));
    if (event.type === "text-delta" && firstTextMs === null) firstTextMs = Math.round(performance.now() - start);
    if (event.type === "usage") usage = event;
  }
  timings.push({ chatId, firstTextMs, totalMs: Math.round(performance.now() - start), usage });
  writeFileSync("data/trial-workspaces/preparation-results.json", JSON.stringify(timings, null, 2));
  console.log(JSON.stringify(timings.at(-1)));
}
try {
  const backend = store.listChats().find(chat => chat.category === "build")!;
  const accepted = store.getCvWorkspace(backend.id).acceptedId!;
  await send(backend.id, "Create a shorter replacement draft with propose_cv for the saved job. Keep exactly two relevant projects, queue recovery and CSV import. Keep their metric qualifications. Omit education and languages; use a concise custom contribution section. Do not accept it or change the profile. Explain the tradeoff versus the accepted three-project CV.");
  let workspace = store.getCvWorkspace(backend.id);
  assert.equal(workspace.acceptedId, accepted);
  assert.equal(workspace.revisions[0].status, "draft");
  store.changeCvRevision({ chatId: backend.id, revisionId: accepted, action: "restore", expectedAcceptedId: accepted });
  workspace = store.getCvWorkspace(backend.id);
  store.changeCvRevision({ chatId: backend.id, revisionId: workspace.revisions[0].id, action: "discard", expectedAcceptedId: accepted });

  const career = store.listChats().find(chat => chat.category === "profile")!;
  const original = store.getProfileRevisions()[0];
  const edit = store.beginTurn({ chatId: career.id, content: "[Synthetic history fixture] Add the confirmed fictional detail: the onboarding guide includes a local database setup checklist." });
  store.completeTurn(edit.id, "[Synthetic history fixture] This trial setup approved the detail, then restored the previous profile to demonstrate append-only undo.", {
    baseRevision: original.id, summary: "Demo onboarding detail",
    operations: [{ type: "replace", id: "p-onboarding", content: blocks.find(([id]) => id === "p-onboarding")![1] + " The guide includes a local database setup checklist." }],
  });
  store.approveProfileProposal(store.getProfileProposals(career.id).find(item => item.status === "pending")!.id, original.id);
  store.restoreProfileRevision(original.id, store.getProfileRevisions()[0].id);
  assert.equal(store.getProfileRevisions().length, 3);
  assert.equal(store.getProfileRevisions()[0].markdown, original.markdown);
  assert.equal(store.getCvWorkspace(backend.id).acceptedId, accepted);

  const product = store.createChat({ category: "build", title: "DEMO · Product engineer · accepted CV" });
  store.updateBuildSettings(product.id, { jobDescription: productJob, targetRole: "Product Engineer", targetCompany: "Meadow Desk (fictional)", projectLimit: 2 }, 0);
  await send(product.id, "Create a complete tailored CV with propose_cv for this product role. Choose exactly two relevant projects: accessible operations console and reporting query improvement. Lead with React/product work. Keep the query benchmark qualified; do not claim certification or growth. Optional fields can be omitted. Explain selections and a backend alternative. Do not change the profile.");
  const productCv = store.getCvWorkspace(product.id).revisions[0];
  assert.ok(productCv);
  assert.match(JSON.stringify(productCv.content), /keyboard|accessib/i);
  store.changeCvRevision({ chatId: product.id, revisionId: productCv.id, action: "accept", expectedAcceptedId: null });
  writeFileSync("data/trial-workspaces/product-export.json", store.exportAcceptedCv({ chatId: product.id, revisionId: productCv.id }));

  const pending = store.createChat({ category: "profile", title: "DEMO · New facts · review before approval" });
  await send(pending.id, "FICTIONAL TRIAL UPDATE: Alex also wrote the error-handling and retry code for a vendor address-validation API integration at Riverlight in 2026. The vendor owned address matching, and Alex did not create the matching algorithm. No speed or accuracy metric is confirmed. Please propose one new profile project block with propose_profile_edit. Do not save facts automatically or invent numbers. Briefly explain what needs review.");
  assert.ok(store.getProfileProposals(pending.id).some(item => item.status === "pending"));
  assert.equal(store.getProfileRevisions().length, 3);

  const retry = store.createChat({ category: "profile", title: "DEMO · Retry a saved message" });
  const failed = store.beginTurn({ chatId: retry.id, content: "This is a fictional trial. Give three concise suggestions for improving Alex's CV using the confirmed profile. Do not change the profile yet. (This saved message was deliberately marked failed by the trial setup so I can try Retry saved message.)" });
  store.failTurn(failed.id);
  const blank = store.createChat({ category: "build", title: "DEMO · Try a fresh CV · no projects" });
  store.updateBuildSettings(blank.id, { jobDescription: backendJob, targetRole: "Senior Backend Engineer", targetCompany: "Harbor Parcel (fictional)", projectLimit: 0 }, 0);
  const index = store.listChats().map(chat => ({ id: chat.id, title: chat.title, category: chat.category, messages: store.getMessages(chat.id).length,
    ...(chat.category === "build" ? { cvRevisions: store.getCvWorkspace(chat.id).revisions.length, acceptedId: store.getCvWorkspace(chat.id).acceptedId } : {}) }));
  writeFileSync("data/trial-workspaces/workspace.json", JSON.stringify(index, null, 2));
  console.log("Prepared six fictional chats, three profile revisions, accepted CVs, a replacement draft, discarded history, pending approval and retry.");
} finally { store.close(); }
