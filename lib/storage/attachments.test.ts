import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "./store.ts";

test("attachments save atomically with a message, survive reopen and retry, and remain scoped to their chat", () => {
  const folder = mkdtempSync(join(tmpdir(), "cv-attachments-"));
  const path = join(folder, "app.sqlite");
  let store = openStore(path);
  try {
    const chat = store.createChat({ category: "profile", title: "Files" });
    const other = store.createChat({ category: "build", title: "Other" });
    const attachment = { name: "notes.txt", mediaType: "text/plain", bytes: new TextEncoder().encode("Career ไทย"), text: "Career ไทย", pages: 0, preparationVersion: 1 };
    const turn = store.beginTurn({ chatId: chat.id, content: "", attachments: [attachment] });
    const saved = store.getMessages(chat.id)[0].attachments![0];
    assert.equal(saved.name, "notes.txt");
    assert.equal(saved.size, attachment.bytes.length);
    assert.equal("bytes" in saved, false);
    assert.equal("text" in saved, false);
    store.close(); store = openStore(path);
    store.recoverInterruptedTurns();
    assert.deepEqual(store.downloadAttachment(chat.id, saved.id).bytes, attachment.bytes);
    assert.throws(() => store.downloadAttachment(other.id, saved.id), /not found/i);
    assert.equal(store.beginTurn({ chatId: chat.id, retryId: turn.id }).id, turn.id);
    assert.equal(store.getMessages(chat.id)[0].attachments!.length, 1);
    assert.equal(store.getMessageAttachments(chat.id, turn.id)[0].text, "Career ไทย");
    store.completeTurn(turn.id, "Read.");
    assert.throws(() => store.beginTurn({ chatId: other.id, content: "Bad", attachments: [attachment, { ...attachment, preparationVersion: 99 }] }));
    assert.deepEqual(store.getMessages(other.id), []);
    const keep = store.beginTurn({ chatId: other.id, content: "Keep", attachments: [attachment] });
    const keptId = store.getMessages(other.id)[0].attachments![0].id;
    store.deleteChat(chat.id, false);
    assert.throws(() => store.downloadAttachment(chat.id, saved.id), /not found/i);
    assert.deepEqual(store.downloadAttachment(other.id, keptId).bytes, attachment.bytes);
    store.failTurn(keep.id);
  } finally { store.close(); rmSync(folder, { recursive: true, force: true }); }
});

test("v3 text chats and confirmed documents survive the additive v4 migration", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const folder = mkdtempSync(join(tmpdir(), "cv-migration-"));
  const path = join(folder, "app.sqlite");
  let store = openStore(path);
  const chat = store.createChat({ category: "profile", title: "Existing" });
  const turn = store.beginTurn({ chatId: chat.id, content: "Engineer" });
  store.completeTurn(turn.id, "Review", { baseRevision: null, summary: "Work", operations: [{ type: "insert", id: "p-work", afterId: null, content: "Engineer" }] });
  store.approveProfileProposal(store.getProfileProposals(chat.id)[0].id, null);
  const before = store.getProfileWorkspace(chat.id);
  const messages = store.getMessages(chat.id);
  store.close();
  const legacy = new DatabaseSync(path);
  legacy.exec("DROP TABLE attachments; PRAGMA user_version = 3");
  legacy.close();
  try {
    store = openStore(path);
    assert.deepEqual(store.getMessages(chat.id), messages);
    assert.deepEqual(store.getProfileWorkspace(chat.id), before);
    store.close(); store = openStore(path);
    assert.deepEqual(store.getMessages(chat.id), messages);
  } finally { store.close(); rmSync(folder, { recursive: true, force: true }); }
});
