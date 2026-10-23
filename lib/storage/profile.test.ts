import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openStore } from "./store.ts";

const first = { baseRevision: null, summary: "Organize rough notes", operations: [
  { type: "insert", id: "p-role", afterId: null, content: "## Experience\n\nEngineer at Acme. Dates unknown." },
] };
function propose(store: ReturnType<typeof openStore>, chatId: string, value: unknown) {
  const turn = store.beginTurn({ chatId, content: "Please organize my notes" });
  store.completeTurn(turn.id, "Review these changes.", value);
  return store.getProfileProposals(chatId)[0];
}
test("rough notes become a durable profile only after whole-batch approval; undo preserves history", () => {
  const store = openStore(":memory:");
  try {
    const chat = store.createChat({ category: "profile", title: "Career" });
    const proposal = propose(store, chat.id, first);
    assert.deepEqual(store.getProfileRevisions(), []);
    const preview = store.previewProfileProposal(proposal.id);
    assert.equal(preview.conflict, false);
    assert.match(preview.after!, /<!-- id:p-role -->\n## Experience/);
    const saved = store.approveProfileProposal(proposal.id, preview.revisionId);
    assert.equal(saved.approved, true);
    const original = store.getProfileRevisions()[0];
    assert.match(original.markdown, /## Open questions/);
    const next = propose(store, chat.id, { baseRevision: original.id, summary: "Clarify role", operations: [
      { type: "replace", id: "p-role", content: "## Experience\n\nSenior engineer at Acme." },
    ] });
    store.approveProfileProposal(next.id, original.id);
    const current = store.getProfileRevisions()[0];
    store.restoreProfileRevision(original.id, current.id);
    assert.equal(store.getProfileRevisions().length, 3);
    assert.equal(store.getProfileRevisions()[0].markdown, original.markdown);
    store.deleteChat(chat.id, false);
    assert.equal(store.getProfileRevisions().length, 3);
  } finally { store.close(); }
});

test("stale proposals reapply unrelated edits but block changed targets and require renewed review", () => {
  const store = openStore(":memory:");
  try {
    const a = store.createChat({ category: "profile", title: "A" });
    const b = store.createChat({ category: "profile", title: "B" });
    const initial = propose(store, a.id, first);
    store.approveProfileProposal(initial.id, null);
    const base = store.getProfileRevisions()[0].id;
    const role = propose(store, a.id, { baseRevision: base, summary: "Role", operations: [{ type: "replace", id: "p-role", content: "## Experience\n\nEngineer at Acme, 2020." }] });
    const questions = propose(store, b.id, { baseRevision: base, summary: "Disputed date", operations: [{ type: "replace", id: "p-open-questions", content: "## Open questions\n\nWas the start date 2020 or 2021? Keep the confirmed date unchanged." }] });
    store.approveProfileProposal(questions.id, base);
    assert.equal(store.approveProfileProposal(role.id, base).approved, false);
    const preview = store.previewProfileProposal(role.id);
    assert.equal(preview.conflict, false);
    assert.match(preview.after!, /Was the start date 2020 or 2021/);
    const conflict = propose(store, b.id, { baseRevision: base, summary: "Another role edit", operations: [{ type: "replace", id: "p-role", content: "## Experience\n\nDifferent role." }] });
    store.approveProfileProposal(role.id, preview.revisionId);
    assert.equal(store.previewProfileProposal(conflict.id).conflict, true);
    assert.equal(store.approveProfileProposal(conflict.id, store.getProfileRevisions()[0].id).approved, false);
    assert.equal(store.getProfileRevisions().length, 3);
  } finally { store.close(); }
});

test("invalid batches roll back the assistant reply and never remove required questions or reuse deleted IDs", () => {
  const store = openStore(":memory:");
  try {
    const chat = store.createChat({ category: "profile", title: "Career" });
    const initial = propose(store, chat.id, first);
    store.approveProfileProposal(initial.id, null);
    const base = store.getProfileRevisions()[0].id;
    const turn = store.beginTurn({ chatId: chat.id, content: "Remove questions" });
    assert.throws(() => store.completeTurn(turn.id, "Unsafe", { baseRevision: base, summary: "Remove questions", operations: [{ type: "delete", id: "p-open-questions" }] }), /Open questions/);
    assert.equal(store.getMessages(chat.id).at(-1)?.status, "pending");
    assert.equal(store.getProfileProposals(chat.id).length, 1);
    store.completeTurn(turn.id, "Kept the questions.");
    const deletion = propose(store, chat.id, { baseRevision: base, summary: "Delete role", operations: [{ type: "delete", id: "p-role" }] });
    store.approveProfileProposal(deletion.id, base);
    const latest = store.getProfileRevisions()[0].id;
    const next = store.beginTurn({ chatId: chat.id, content: "Reuse role ID" });
    assert.throws(() => store.completeTurn(next.id, "Invalid", { ...first, baseRevision: latest }), /reused/);
    assert.equal(store.getProfileRevisions().length, 2);
    assert.throws(() => store.restoreProfileRevision(base, base), /changed/);
  } finally { store.close(); }
});


test("v1 migration preserves chats and profiles; proposal approval survives restart and reserves historical block IDs", () => {
  const directory = mkdtempSync(join(tmpdir(), "cv-profile-migration-"));
  const path = join(directory, "app.sqlite");
  let store = openStore(path);
  const chat = store.createChat({ category: "profile", title: "Preserved chat" });
  const turn = store.beginTurn({ chatId: chat.id, content: "Preserved notes" });
  store.completeTurn(turn.id, "Preserved reply");
  store.close();
  const old = new DatabaseSync(path);
  old.exec("DROP TABLE attachments; DROP TABLE build_context; ALTER TABLE cv_revisions DROP COLUMN profile_revision; ALTER TABLE cv_revisions DROP COLUMN explanation; DROP TABLE profile_proposals; DROP TABLE profile_block_ids; PRAGMA user_version = 1;");
  old.prepare("INSERT INTO profile_revisions(id, user_id, markdown) VALUES ('legacy', 'local-user', ?)").run("<!-- id:p-old -->\n## Old role\n\nEngineer.\n\n<!-- id:p-open-questions -->\n## Open questions\n\nNone.");
  old.close();
  try {
    store = openStore(path);
    assert.equal(store.getMessages(chat.id).length, 2);
    assert.equal(store.getProfileRevisions()[0].id, "legacy");
    const proposal = propose(store, chat.id, { baseRevision: "legacy", summary: "Remove old role", operations: [{ type: "delete", id: "p-old" }] });
    store.close();
    store = openStore(path);
    assert.equal(store.getProfileProposals(chat.id)[0].id, proposal.id);
    store.approveProfileProposal(proposal.id, "legacy");
    store.close();
    store = openStore(path);
    assert.equal(store.getProfileRevisions().length, 2);
    assert.equal(store.getProfileProposals(chat.id)[0].status, "approved");
    const next = store.beginTurn({ chatId: chat.id, content: "Reuse old ID" });
    assert.throws(() => store.completeTurn(next.id, "Invalid", { ...first, baseRevision: store.getProfileRevisions()[0].id, operations: [{ type: "insert", id: "p-old", afterId: null, content: "Other role" }] }), /reused/);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});


test("IDs inserted then deleted in an approved batch are never reused", () => {
  const store = openStore(":memory:");
  try {
    const chat = store.createChat({ category: "profile", title: "Career" });
    const temporary = propose(store, chat.id, { baseRevision: null, summary: "Record open questions", operations: [
      { type: "insert", id: "p-temporary", afterId: null, content: "Temporary note" },
      { type: "delete", id: "p-temporary" },
      { type: "replace", id: "p-open-questions", content: "## Open questions\n\nWhich roles are relevant?" },
    ] });
    store.approveProfileProposal(temporary.id, null);
    const turn = store.beginTurn({ chatId: chat.id, content: "Reuse ID" });
    assert.throws(() => store.completeTurn(turn.id, "Invalid", { ...first, baseRevision: store.getProfileRevisions()[0].id, operations: [{ type: "insert", id: "p-temporary", afterId: null, content: "Different fact" }] }), /reused/);
  } finally { store.close(); }
});


test("an in-flight stale insertion collision remains reviewable for reconciliation", () => {
  const store = openStore(":memory:");
  try {
    const a = store.createChat({ category: "profile", title: "A" });
    const b = store.createChat({ category: "profile", title: "B" });
    const pending = store.beginTurn({ chatId: b.id, content: "Concurrent notes" });
    const original = propose(store, a.id, first);
    store.approveProfileProposal(original.id, null);
    store.completeTurn(pending.id, "Review stale proposal", first);
    const stale = store.getProfileProposals(b.id)[0];
    assert.equal(stale.status, "pending");
    assert.equal(store.previewProfileProposal(stale.id).conflict, true);
    assert.equal(store.getProfileRevisions().length, 1);
  } finally { store.close(); }
});
