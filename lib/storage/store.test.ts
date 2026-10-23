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
     console.log(JSON.stringify(store.listChats().map(chat => chat.title).sort()));
     store.close();`,
  ], { encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), ["Career notes", "Platform role"]);
  store = openStore(path);
  try {
    assert.equal(store.userId, user);
    assert.deepEqual(new Set(store.listChats().map(chat => chat.id)), new Set([profile.id, build.id]));
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
    assert.deepEqual(store.listChats(), []);
  } finally { store.close(); }
});


test("a newer database version is refused without overwriting stored data", () => {
  const folder = mkdtempSync(join(tmpdir(), "cv-version-"));
  const path = join(folder, "app.sqlite");
  let store = openStore(path);
  const chat = store.createChat({ category: "profile", title: "Preserve me" });
  store.close();
  const future = new DatabaseSync(path);
  future.exec("PRAGMA user_version = 4");
  future.close();
  try {
    assert.throws(() => openStore(path), /newer/);
    const fixture = new DatabaseSync(path);
    fixture.exec("PRAGMA user_version = 3");
    fixture.close();
    store = openStore(path);
    assert.equal(store.getChat(chat.id)?.title, "Preserve me");
    store.close();
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
