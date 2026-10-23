import assert from "node:assert/strict";
import { openStore } from "../../../lib/storage/store.ts";
import { createChatService } from "../../../lib/ai/chat.ts";
import { createClaudeProvider } from "../../../lib/ai/claude/provider.ts";
const store = openStore(":memory:");
const chat = store.createChat({ category: "profile", title: "Synthetic profile check" });
const service = createChatService(store, createClaudeProvider());
async function send(content: string) {
  const reader = service.send({ chatId: chat.id, content }).stream.getReader();
  const events = [];
  for (;;) {
    const item = await reader.read(); if (item.done) break;
    assert.notEqual(item.value.type, "error", JSON.stringify(item.value));
    events.push(item.value.type);
  }
  assert.equal(events.at(-1), "done");
  return events;
}
try {
  const firstEvents = await send("Synthetic test notes: Alex Example was a backend engineer at Example Co from 2020 to 2022. Built an internal TypeScript queue. No metrics supplied. Organize into a first profile proposal, including open questions if needed. Use the profile tool now.");
  assert.ok(firstEvents.includes("proposal"));
  assert.equal(store.getProfileRevisions().length, 0);
  const initial = store.getProfileProposals(chat.id)[0];
  store.approveProfileProposal(initial.id, null);
  const confirmed = store.getProfileRevisions()[0];
  const roleOperation = initial.value.operations.find(item => item.type === "insert" && /2020/.test(item.content));
  assert.ok(roleOperation);
  await send("I am uncertain whether the start date was 2020 or 2021. This is an unresolved contradiction. Keep the confirmed fact unchanged, record this exact question under Open questions, and propose the batch now. Do not change the date in the existing experience block.");
  const disputed = store.getProfileProposals(chat.id)[0];
  const preview = store.previewProfileProposal(disputed.id);
  assert.equal(preview.conflict, false);
  assert.match(preview.after!, /2021/);
  assert.equal(disputed.value.operations.some(item => item.id === roleOperation.id), false);
  assert.ok(disputed.value.operations.some(item => item.id === "p-open-questions"));
  assert.equal(store.getProfileRevisions()[0].markdown, confirmed.markdown);
  store.approveProfileProposal(disputed.id, confirmed.id);
  const latest = store.getProfileRevisions()[0];
  store.restoreProfileRevision(confirmed.id, latest.id);
  assert.equal(store.getProfileRevisions().length, 3);
  assert.equal(store.getProfileRevisions()[0].markdown, confirmed.markdown);
  console.log("Live subscription: rough notes, approval, disputed fact, Open questions and undo passed on synthetic in-memory data.");
} finally { store.close(); }
