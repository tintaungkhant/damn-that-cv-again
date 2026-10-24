import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { openStore } from "./store.ts";

const directory = mkdtempSync(join(tmpdir(), "cv-storage-"));
afterEach(() => rmSync(directory, { recursive: true, force: true }));

test("both chat categories and stable local user survive reopening storage", () => {
  const path = join(directory, "app.sqlite");
  let store = openStore(path);
  const profile = store.createChat({ category: "profile", title: "Career notes" });
  const build = store.createChat({ category: "build", title: "Platform role" });
  const user = store.userId;
  store.close();
  const child = spawnSync(process.execPath, ["--input-type=module", "-e",
    `import { openStore } from ${JSON.stringify(new URL("./store.ts", import.meta.url).href)};
     const store = openStore(${JSON.stringify(path)});
     console.log(JSON.stringify(store.listChats({}).items.map(chat => chat.title).sort()));
     store.close();`,
  ], { encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), ["Career notes", "Platform role"]);
  store = openStore(path);
  try {
    assert.equal(store.userId, user);
    assert.deepEqual(new Set(store.listChats({}).items.map(chat => chat.id)), new Set([profile.id, build.id]));
    assert.equal(store.getChat(profile.id)?.title, "Career notes");
    assert.equal(store.getChat(build.id)?.category, "build");
  } finally {
    store.close();
  }
});

test("build deletion requires confirmation and preserves unrelated chats", () => {
  const store = openStore(":memory:");
  try {
    const build = store.createChat({ category: "build", title: "Delete me" });
    const other = store.createChat({ category: "build", title: "Keep me" });
    assert.throws(() => store.deleteChat(build.id, false), /confirmation/i);
    assert.equal(store.getChat(build.id)?.title, "Delete me");
    store.deleteChat(build.id, true);
    assert.equal(store.getChat(build.id), undefined);
    assert.equal(store.getChat(other.id)?.title, "Keep me");
  } finally { store.close(); }
});


test("deletion removes build messages and CVs but preserves shared profile history", () => {
  const folder = mkdtempSync(join(tmpdir(), "cv-deletion-"));
  const path = join(folder, "app.sqlite");
  let store = openStore(path);
  const build = store.createChat({ category: "build", title: "Application" });
  const profile = store.createChat({ category: "profile", title: "Career" });
  const other = store.createChat({ category: "build", title: "Other application" });
  store.close();
  const fixture = new DatabaseSync(path);
  fixture.prepare("INSERT INTO messages(id, chat_id, role, content, status) VALUES (?, ?, 'user', 'Notes', 'complete')").run("build-message", build.id);
  fixture.prepare("INSERT INTO messages(id, chat_id, role, content, status) VALUES (?, ?, 'user', 'Career notes', 'complete')").run("profile-message", profile.id);
  fixture.prepare("INSERT INTO cv_revisions(id, chat_id, content, status) VALUES (?, ?, '{}', 'draft')").run("build-cv", build.id);
  fixture.prepare("INSERT INTO cv_revisions(id, chat_id, content, status) VALUES (?, ?, '{}', 'accepted')").run("other-cv", other.id);
  fixture.exec("INSERT INTO profile_revisions(id, user_id, markdown) VALUES ('profile-v1', 'local-user', 'Confirmed career')");
  fixture.close();
  store = openStore(path);
  try {
    assert.equal(store.getMessages(build.id).length, 1);
    assert.equal(store.getCvRevisions(build.id).length, 1);
    store.deleteChat(build.id, true);
    store.deleteChat(profile.id, false);
    store.close();
    store = openStore(path);
    assert.deepEqual(store.getMessages(build.id), []);
    assert.deepEqual(store.getMessages(profile.id), []);
    assert.deepEqual(store.getCvRevisions(build.id), []);
    assert.equal(store.getCvRevisions(other.id)[0].id, "other-cv");
    assert.equal(store.getProfileRevisions()[0].markdown, "Confirmed career");
  } finally { store.close(); rmSync(folder, { recursive: true, force: true }); }
});

test("invalid chat inputs and malformed IDs cannot mutate storage", () => {
  const store = openStore(":memory:");
  try {
    for (const input of [
      { category: "other", title: "Title" }, { category: "profile", title: "   " },
      { category: "build", title: "x".repeat(121) }, { category: "profile", title: 123 },
    ]) assert.throws(() => store.createChat(input));
    assert.throws(() => store.deleteChat("bad-id", true));
    assert.deepEqual(store.listChats({}).items, []);
  } finally { store.close(); }
});


test("a newer database version is refused without overwriting stored data", () => {
  const folder = mkdtempSync(join(tmpdir(), "cv-version-"));
  const path = join(folder, "app.sqlite");
  let store = openStore(path);
  const chat = store.createChat({ category: "profile", title: "Preserve me" });
  store.close();
  const future = new DatabaseSync(path);
  future.exec("PRAGMA user_version = 8");
  future.close();
  try {
    assert.throws(() => openStore(path), /newer/);
    const fixture = new DatabaseSync(path);
    fixture.exec("PRAGMA user_version = 7");
    fixture.close();
    store = openStore(path);
    assert.equal(store.getChat(chat.id)?.title, "Preserve me");
    store.close();
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test("bounded chat lists page, search, isolate categories and follow latest activity with stable ties", () => {
  const store = openStore(":memory:");
  try {
    const build = Array.from({ length: 50 }, (_, index) => store.createChat({ category: "build", title: `Build ${index}${index === 2 ? " Kubernetes" : ""}` }));
    const profile = Array.from({ length: 70 }, (_, index) => store.createChat({ category: "profile", title: `Profile ${index}${index === 1 ? " kubernetes" : ""}` }));

    const firstBuild = store.listChats({ category: "build" });
    assert.equal(firstBuild.total, 50);
    assert.equal(firstBuild.items.length, 25);
    assert.ok(firstBuild.items.every(chat => chat.category === "build"));
    const allBuild = [...firstBuild.items, ...store.listChats({ category: "build", page: 2 }).items, ...store.listChats({ category: "build", page: 3 }).items];
    assert.equal(new Set(allBuild.map(chat => chat.id)).size, 50);
    assert.deepEqual(store.listChats({ category: "build" }).items.map(chat => chat.id), firstBuild.items.map(chat => chat.id));

    const profilePages = [1, 2, 3].map(page => store.listChats({ category: "profile", page }));
    assert.deepEqual(profilePages.map(page => page.items.length), [25, 25, 20]);
    assert.equal(profilePages[0].total, 70);

    assert.deepEqual(store.listChats({ category: "build", search: "KUBERNETES" }).items.map(chat => chat.id), [build[2].id]);
    assert.deepEqual(store.listChats({ category: "profile", search: "kubernetes" }).items.map(chat => chat.id), [profile[1].id]);
    assert.equal(store.listChats({ search: "kubernetes" }).total, 2);

    const recent = store.listChats({ category: "profile", limit: 5 });
    assert.equal(recent.items.length, 5);
    assert.equal(recent.total, 70);
    store.beginTurn({ chatId: profile[0].id, content: "Old chat, new activity" });
    assert.equal(store.listChats({ category: "profile", limit: 5 }).items[0].id, profile[0].id);
    assert.equal(store.listChats({ category: "build", limit: 5 }).items.some(chat => chat.id === profile[0].id), false);

    store.deleteChat(build[2].id, true);
    assert.equal(store.listChats({ category: "build" }).total, 49);
    assert.equal(store.listChats({ category: "build", search: "kubernetes" }).total, 0);
    assert.equal(store.listChats({ category: "profile" }).total, 70);

    for (const input of [{ category: "other" }, { page: 0 }, { limit: 26 }, { search: "x".repeat(121) }, { extra: true }]) assert.throws(() => store.listChats(input));
  } finally { store.close(); }
});

test("v5 migration backfills chat activity from the latest message and keeps quiet chats at creation time", () => {
  const folder = mkdtempSync(join(tmpdir(), "cv-activity-"));
  const path = join(folder, "app.sqlite");
  let store = openStore(path);
  const quiet = store.createChat({ category: "build", title: "Quiet" });
  const active = store.createChat({ category: "build", title: "Active" });
  store.beginTurn({ chatId: active.id, content: "Hello" });
  store.close();
  const legacy = new DatabaseSync(path);
  legacy.exec("DROP INDEX chats_user_updated; ALTER TABLE chats DROP COLUMN updated_at; UPDATE chats SET created_at = '2020-01-01T00:00:00.000Z'; UPDATE chats SET created_at = '2021-01-01T00:00:00.000Z' WHERE title = 'Quiet'; UPDATE messages SET created_at = '2022-01-01T00:00:00.000Z'; PRAGMA user_version = 5");
  legacy.close();
  store = openStore(path);
  try {
    assert.deepEqual(store.listChats({ category: "build" }).items.map(chat => [chat.title, chat.updated_at]), [
      ["Active", "2022-01-01T00:00:00.000Z"], ["Quiet", "2021-01-01T00:00:00.000Z"],
    ]);
    assert.equal(store.getChat(quiet.id)?.title, "Quiet");
  } finally { store.close(); rmSync(folder, { recursive: true, force: true }); }
});

test("general chats keep the profile approval flow without CV settings and delete without confirmation", () => {
  const store = openStore(":memory:");
  try {
    const chat = store.createChat({ category: "general", title: "Project letter" });
    assert.equal(store.listChats({ category: "general" }).total, 1);
    assert.equal(store.listChats({ category: "profile" }).total, 0);
    assert.throws(() => store.getCvWorkspace(chat.id), /Build chat not found/);
    const turn = store.beginTurn({ chatId: chat.id, content: "I also led the Acme migration." });
    store.completeTurn(turn.id, "Review this addition.", { baseRevision: null, summary: "Add Acme", operations: [{ type: "insert", id: "p-acme", afterId: null, content: "## Experience\n\nLed the Acme migration." }] });
    const [proposal] = store.getProfileProposals(chat.id);
    assert.deepEqual(store.getProfileRevisions(), []);
    assert.equal(store.approveProfileProposal(proposal.id, null).approved, true);
    store.deleteChat(chat.id, false);
    assert.equal(store.getChat(chat.id), undefined);
    assert.match(store.getProfileRevisions()[0].markdown, /Acme migration/);
  } finally { store.close(); }
});

test("v6 migration rebuilds chats for general chats without losing or cascading saved data", () => {
  const folder = mkdtempSync(join(tmpdir(), "cv-general-"));
  const path = join(folder, "app.sqlite");
  let store = openStore(path);
  const build = store.createChat({ category: "build", title: "Platform role" });
  const profile = store.createChat({ category: "profile", title: "Notes" });
  const turn = store.beginTurn({ chatId: profile.id, content: "Notes", attachments: [{ name: "notes.txt", mediaType: "text/plain", bytes: new TextEncoder().encode("Engineer"), text: "Engineer", pages: 1, preparationVersion: 1 }] });
  store.completeTurn(turn.id, "Review.", { baseRevision: null, summary: "Notes", operations: [{ type: "insert", id: "p-work", afterId: null, content: "## Work\n\nEngineer." }] });
  store.approveProfileProposal(store.getProfileProposals(profile.id)[0].id, null);
  store.updateBuildSettings(build.id, { jobDescription: "Run platforms", targetRole: "", targetCompany: "", projectLimit: 5 }, 0);
  store.close();
  const legacy = new DatabaseSync(path);
  legacy.exec(`PRAGMA foreign_keys = OFF; BEGIN;
    CREATE TABLE chats_v6 (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), category TEXT NOT NULL CHECK(category IN ('profile', 'build')),
      title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 120), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT '');
    INSERT INTO chats_v6 SELECT id, user_id, category, title, created_at, updated_at FROM chats;
    DROP TABLE chats; ALTER TABLE chats_v6 RENAME TO chats;
    CREATE INDEX chats_user ON chats(user_id, created_at); CREATE INDEX chats_user_updated ON chats(user_id, category, updated_at DESC, id DESC);
    PRAGMA user_version = 6; COMMIT;`);
  assert.throws(() => legacy.prepare("INSERT INTO chats(id, user_id, category, title) VALUES ('x', 'local-user', 'general', 'x')").run());
  legacy.close();
  store = openStore(path);
  try {
    assert.deepEqual(store.getMessages(profile.id).map(message => [message.content, message.attachments?.length]), [["Notes", 1], ["Review.", undefined]]);
    assert.equal(store.getProfileProposals(profile.id)[0].status, "approved");
    assert.equal(store.getCvWorkspace(build.id).settings.jobDescription, "Run platforms");
    assert.equal(store.getProfileRevisions().length, 1);
    const general = store.createChat({ category: "general", title: "Proposal" });
    assert.equal(store.listChats({}).total, 3);
    // Foreign keys are back on: deleting a chat still cascades to its messages.
    store.deleteChat(profile.id, false);
    assert.deepEqual(store.getMessages(profile.id), []);
    assert.equal(store.getChat(general.id)?.category, "general");
  } finally { store.close(); rmSync(folder, { recursive: true, force: true }); }
});
