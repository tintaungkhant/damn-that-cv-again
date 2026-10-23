import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openStore } from "./store.ts";

const cv = { schemaVersion: 1, sections: [{ type: "text", title: "Summary", content: { text: "Engineer building queues", evidence: ["p-role"] } }] };
function setup(store: ReturnType<typeof openStore>) {
  const profile = store.createChat({ category: "profile", title: "Career" });
  const turn = store.beginTurn({ chatId: profile.id, content: "I build queues" });
  store.completeTurn(turn.id, "Review", { baseRevision: null, summary: "Career", operations: [{ type: "insert", id: "p-role", afterId: null, content: "## Work\n\nEngineer building queues." }] });
  store.approveProfileProposal(store.getProfileProposals(profile.id)[0].id, null);
  const chat = store.createChat({ category: "build", title: "Platform" });
  store.updateBuildSettings(chat.id, { jobDescription: "Build reliable queue services", targetRole: "Engineer", targetCompany: "ExampleCo", projectLimit: 5 }, 0);
  return { chat, profileRevision: store.getProfileRevisions()[0].id };
}
function draft(store: ReturnType<typeof openStore>, chatId: string, profileRevision: string) {
  const turn = store.beginTurn({ chatId, content: "Draft CV" });
  store.completeTurn(turn.id, "Selected queue work for reliability; alternative: a shorter summary.", undefined, { value: cv, profileRevision });
  return store.getCvWorkspace(chatId).revisions[0];
}

test("drafts save automatically; accept, discard and restore preserve accepted content", () => {
  const store = openStore(":memory:");
  try {
    const { chat, profileRevision } = setup(store);
    const first = draft(store, chat.id, profileRevision);
    assert.equal(first.status, "draft");
    assert.equal(store.getCvWorkspace(chat.id).acceptedId, null);
    store.changeCvRevision({ chatId: chat.id, revisionId: first.id, action: "accept", expectedAcceptedId: null });
    const second = draft(store, chat.id, profileRevision);
    store.changeCvRevision({ chatId: chat.id, revisionId: second.id, action: "discard", expectedAcceptedId: first.id });
    assert.equal(store.getCvWorkspace(chat.id).acceptedId, first.id);
    store.changeCvRevision({ chatId: chat.id, revisionId: second.id, action: "restore", expectedAcceptedId: first.id });
    const workspace = store.getCvWorkspace(chat.id);
    assert.equal(workspace.revisions.length, 3);
    assert.equal(workspace.revisions[0].status, "draft");
    assert.deepEqual(workspace.revisions[0].content, cv);
    assert.equal(workspace.acceptedId, first.id);
    assert.match(workspace.revisions[0].explanation, /Selected queue work/);
  } finally { store.close(); }
});

test("invalid evidence and job context roll back both CV and assistant while preserving accepted revisions", () => {
  const store = openStore(":memory:");
  try {
    const { chat, profileRevision } = setup(store);
    const accepted = draft(store, chat.id, profileRevision);
    store.changeCvRevision({ chatId: chat.id, revisionId: accepted.id, action: "accept", expectedAcceptedId: null });
    for (const evidence of [["p-unknown"], ["p-open-questions"]]) {
      const turn = store.beginTurn({ chatId: chat.id, content: "Bad draft" });
      const bad = { schemaVersion: 1, sections: [{ type: "text", title: "Summary", content: { text: "Unsupported", evidence } }] };
      assert.throws(() => store.completeTurn(turn.id, "Must not save", undefined, { value: bad, profileRevision }), /evidence/);
      assert.equal(store.getMessages(chat.id).at(-1)?.status, "pending");
      store.failTurn(turn.id);
      const retry = store.beginTurn({ chatId: chat.id, retryId: turn.id });
      store.completeTurn(retry.id, "No changes");
    }
    assert.equal(store.getCvWorkspace(chat.id).acceptedId, accepted.id);
    assert.equal(store.getCvWorkspace(chat.id).revisions.length, 1);
    const other = store.createChat({ category: "build", title: "Other" });
    const turn = store.beginTurn({ chatId: other.id, content: "Draft without job" });
    assert.throws(() => store.completeTurn(turn.id, "Bad", undefined, { value: cv, profileRevision }), /job description/);
    store.failTurn(turn.id);
    assert.deepEqual(store.getCvWorkspace(other.id).revisions, []);
    assert.throws(() => store.changeCvRevision({ chatId: other.id, revisionId: accepted.id, action: "restore", expectedAcceptedId: null }), /not found/);
  } finally { store.close(); }
});

test("job details and revision mutations reject stale requests and active replies", () => {
  const store = openStore(":memory:");
  try {
    const { chat, profileRevision } = setup(store);
    const first = draft(store, chat.id, profileRevision);
    const second = draft(store, chat.id, profileRevision);
    const settings = store.getCvWorkspace(chat.id).settings;
    assert.throws(() => store.updateBuildSettings(chat.id, settings, 0), /changed/);
    for (const projectLimit of [-1, 1.5, "5"]) assert.throws(() => store.updateBuildSettings(chat.id, { ...settings, projectLimit }, 1));
    store.changeCvRevision({ chatId: chat.id, revisionId: first.id, action: "accept", expectedAcceptedId: null });
    assert.throws(() => store.changeCvRevision({ chatId: chat.id, revisionId: second.id, action: "accept", expectedAcceptedId: null }), /changed/);
    assert.throws(() => store.changeCvRevision({ chatId: chat.id, revisionId: first.id, action: "discard", expectedAcceptedId: first.id }), /Only a draft/);
    const turn = store.beginTurn({ chatId: chat.id, content: "Thinking" });
    assert.throws(() => store.updateBuildSettings(chat.id, settings, 1), /Wait/);
    assert.throws(() => store.changeCvRevision({ chatId: chat.id, revisionId: second.id, action: "discard", expectedAcceptedId: first.id }), /Wait/);
    store.failTurn(turn.id);
    assert.equal(store.getCvWorkspace(chat.id).acceptedId, first.id);
  } finally { store.close(); }
});

test("v2 migration, reopen, profile changes and chat deletion preserve independent CV history", () => {
  const folder = mkdtempSync(join(tmpdir(), "cv-build-"));
  const path = join(folder, "app.sqlite");
  let store = openStore(path);
  try {
    const { chat, profileRevision } = setup(store);
    const first = draft(store, chat.id, profileRevision);
    store.changeCvRevision({ chatId: chat.id, revisionId: first.id, action: "accept", expectedAcceptedId: null });
    store.close();
    const fixture = new DatabaseSync(path);
    fixture.exec("DROP TABLE job_operations; DROP TABLE job_activity; DROP TABLE jobs; DROP TABLE attachments; DROP TABLE build_context; ALTER TABLE cv_revisions DROP COLUMN profile_revision; ALTER TABLE cv_revisions DROP COLUMN explanation; PRAGMA user_version = 2;");
    fixture.close();
    store = openStore(path);
    let workspace = store.getCvWorkspace(chat.id);
    assert.equal(workspace.acceptedId, first.id);
    assert.deepEqual(workspace.revisions[0].content, cv);
    assert.equal(workspace.settings.projectLimit, 5);
    store.updateBuildSettings(chat.id, { ...workspace.settings, jobDescription: "Queue engineer", projectLimit: 2 }, 0);
    const profileChat = store.listChats().find(item => item.category === "profile")!;
    const turn = store.beginTurn({ chatId: profileChat.id, content: "New wording" });
    store.completeTurn(turn.id, "Review", { baseRevision: profileRevision, summary: "Update", operations: [{ type: "replace", id: "p-role", content: "## Work\n\nSenior engineer building queues." }] });
    store.approveProfileProposal(store.getProfileProposals(profileChat.id)[0].id, profileRevision);
    assert.deepEqual(store.getCvWorkspace(chat.id).revisions[0].content, cv);
    store.close(); store = openStore(path);
    workspace = store.getCvWorkspace(chat.id);
    assert.equal(workspace.settings.projectLimit, 2);
    assert.equal(workspace.settings.jobDescription, "Queue engineer");
    assert.equal(workspace.acceptedId, first.id);
    store.deleteChat(chat.id, true);
    assert.throws(() => store.getCvWorkspace(chat.id), /not found/);
    assert.equal(store.getProfileRevisions().length, 2);
  } finally { store.close(); rmSync(folder, { recursive: true, force: true }); }
});


test("export requires the current accepted CV and excludes private revision data", () => {
  const store = openStore(":memory:");
  try {
    const { chat, profileRevision } = setup(store);
    const first = draft(store, chat.id, profileRevision);
    assert.throws(() => store.exportAcceptedCv({ chatId: chat.id, revisionId: first.id }), /accepted/);
    store.changeCvRevision({ chatId: chat.id, revisionId: first.id, action: "accept", expectedAcceptedId: null });
    const second = draft(store, chat.id, profileRevision);
    assert.deepEqual(JSON.parse(store.exportAcceptedCv({ chatId: chat.id, revisionId: first.id })), {
      schemaVersion: 1, sections: [{ type: "text", title: "Summary", content: { text: "Engineer building queues" } }],
    });
    assert.throws(() => store.exportAcceptedCv({ chatId: chat.id, revisionId: second.id }), /accepted/);
    store.changeCvRevision({ chatId: chat.id, revisionId: second.id, action: "accept", expectedAcceptedId: first.id });
    assert.throws(() => store.exportAcceptedCv({ chatId: chat.id, revisionId: first.id }), /accepted/);
    const other = store.createChat({ category: "build", title: "Other" });
    assert.throws(() => store.exportAcceptedCv({ chatId: other.id, revisionId: second.id }), /accepted/);
    assert.throws(() => store.exportAcceptedCv({ chatId: chat.id, revisionId: second.id, credentials: "secret" }));
    assert.throws(() => store.exportAcceptedCv({ chatId: "bad", revisionId: second.id }));
    store.deleteChat(chat.id, true);
    assert.throws(() => store.exportAcceptedCv({ chatId: chat.id, revisionId: second.id }), /not found/);
  } finally { store.close(); }
});


test("accepted export preserves optional and custom sections for copy and JSON files", async () => {
  const store = openStore(":memory:");
  try {
    const { chat, profileRevision } = setup(store);
    const content = JSON.parse(readFileSync(new URL("../../docs/examples/cv/custom.json", import.meta.url), "utf8"),
      (key, value) => key === "evidence" ? ["p-role"] : value);
    const turn = store.beginTurn({ chatId: chat.id, content: "Custom CV" });
    store.completeTurn(turn.id, "Private selection notes", undefined, { value: content, profileRevision });
    const revision = store.getCvWorkspace(chat.id).revisions[0];
    store.changeCvRevision({ chatId: chat.id, revisionId: revision.id, action: "accept", expectedAcceptedId: null });
    const json = store.exportAcceptedCv({ chatId: chat.id, revisionId: revision.id });
    const file = new Blob([json], { type: "application/json" });
    assert.equal(await file.text(), json);
    const result = JSON.parse(json);
    assert.deepEqual(result.sections.map((section: { title: string }) => section.title), ["About", "Selected tools", "Selected contributions"]);
    assert.equal(result.contact.email, "alex@example.com");
    assert.deepEqual(result.sections[2].entries[1], { heading: { text: "Independent research" } });
    assert.deepEqual(result.sections[2].entries[0].period, { text: "2020–2022" });
    assert.equal(/evidence|Private selection notes|profileRevision|explanation/.test(json), false);
  } finally { store.close(); }
});
