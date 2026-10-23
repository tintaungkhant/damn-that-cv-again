import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync, mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { openStore } from "../../../lib/storage/store.ts";

// One-time maintenance, explicitly authorized by the user. Stop the app first.
assert.ok(process.argv.includes("--replace-test-data"), "Requires explicit --replace-test-data and a stopped app");
const root = resolve("data");
const source = join(root, "trial-workspaces", "sonnet.sqlite");
const target = join(root, "app.sqlite");
assert.ok(existsSync(source) && existsSync(target));
function digest(db: DatabaseSync) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();
  return createHash("sha256").update(JSON.stringify(tables.map(row => {
    const name = String(row.name);
    assert.match(name, /^[a-z_]+$/);
    return [name, db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()];
  }))).digest("hex");
}
function checkpoint(db: DatabaseSync) {
  assert.equal(db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get()?.busy, 0);
  assert.equal(db.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
}
const candidate = new DatabaseSync(source);
try {
  checkpoint(candidate);
  assert.equal(candidate.prepare("SELECT count(*) AS count FROM chats").get()?.count, 6);
  assert.equal(candidate.prepare("SELECT count(*) AS count FROM messages WHERE status = 'pending'").get()?.count, 0);
} finally { candidate.close(); }
const folder = join(root, "archives");
mkdirSync(folder, { recursive: true });
const archive = join(folder, `before-ticket-09-${Date.now()}.sqlite`);
const current = new DatabaseSync(target);
try {
  checkpoint(current);
  assert.equal(current.prepare("SELECT count(*) AS count FROM messages WHERE status = 'pending'").get()?.count, 0, "A reply is still pending");
  current.prepare("VACUUM INTO ?").run(archive);
  const saved = new DatabaseSync(archive, { readOnly: true });
  try {
    assert.equal(saved.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
    assert.equal(digest(saved), digest(current), "Archive must preserve every row before replacement");
  } finally { saved.close(); }
} finally { current.close(); }
assert.ok(!existsSync(target + "-wal") || statSync(target + "-wal").size === 0, "Uncheckpointed target WAL");
const staged = join(root, "app.trial-install.sqlite");
assert.equal(existsSync(staged), false);
copyFileSync(source, staged);
renameSync(staged, target);
const installed = openStore(target);
try {
  assert.equal(installed.listChats().length, 6);
  assert.equal(installed.getProfileRevisions().length, 3);
  for (const chat of installed.listChats()) if (chat.category === "build") installed.getCvWorkspace(chat.id);
} finally { installed.close(); }
writeFileSync(join(root, "trial-workspaces", "install.json"), JSON.stringify({ archive, target, installedChats: 6 }, null, 2));
console.log(`Trial workspace installed. Verified original data archive: ${archive}`);
