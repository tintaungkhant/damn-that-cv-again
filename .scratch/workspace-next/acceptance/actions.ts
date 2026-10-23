// Ticket 14 integrated acceptance. A populated database written by the pre-feature storage code (commit f024bfb, schema v3)
// is migrated by the built app and exercised through real Server Actions with synthetic fixtures.
// Node HTTP only: no browser. The provider is pointed at an empty Claude config and an unroutable API URL, so no Claude call happens.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { isolatedApp } from "./server.ts";
import { openStore } from "../../../lib/storage/store.ts";
import { mediaTypes } from "../../../lib/attachments/types.ts";
import type { ChatEvent } from "../../../lib/ai/provider.ts";

const legacyPath = new URL("./legacy/lib/storage/store.ts", import.meta.url);
assert.ok(existsSync(legacyPath), "Extract pre-feature storage first: git archive f024bfb lib/storage | tar -x -C .scratch/workspace-next/acceptance/legacy");
const { openStore: openLegacyStore } = await import(legacyPath.href);
const require = createRequire(import.meta.url);
const { encodeReply, createFromReadableStream } = require("next/dist/compiled/react-server-dom-webpack-experimental/client.node.js");
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8"));
const app = isolatedApp("cv-acceptance-");
const { database } = app;
const origin = "http://localhost:3802";
// An empty Claude config and an unroutable API URL make every reply fail locally.
const offline = { CLAUDE_CONFIG_DIR: join(app.directory, "claude-empty"), ANTHROPIC_BASE_URL: "http://127.0.0.1:9", CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1" };
const start = () => app.start(3802, offline);
const stop = () => app.stop();
const results: { check: string; passed: true; detail?: unknown }[] = [];
const pass = (check: string, detail?: unknown) => { results.push({ check, passed: true, ...(detail === undefined ? {} : { detail }) }); console.log("PASS", check); };
const bytes = (name: string) => readFileSync(new URL(`../../../lib/ai/fixtures/${name}`, import.meta.url));
const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const basic = (messages: { id: string; role: string; content: string; status: string }[]) => messages.map(({ id, role, content, status }) => ({ id, role, content, status }));
const version = () => { const db = new DatabaseSync(database); try { return Number(db.prepare("PRAGMA user_version").get()!.user_version); } finally { db.close(); } };

function form(chatId: string, names: string[], content = "") {
  const data = new FormData(); data.set("chatId", chatId); data.set("content", content);
  for (const name of names) data.append("files", new File([bytes(name)], name, { type: mediaTypes[name.split(".").at(-1) as keyof typeof mediaTypes] }));
  return data;
}
async function action(name: string, args: unknown[]) {
  const entry = Object.entries(manifest.node).find(([, item]) => (item as { exportedName: string }).exportedName === name);
  assert.ok(entry, name);
  const body = await encodeReply(args);
  const headers: Record<string, string> = { "Next-Action": entry[0], Origin: origin };
  if (typeof body === "string") headers["Content-Type"] = "text/plain;charset=UTF-8";
  const response = await fetch(origin, { method: "POST", headers, body, redirect: "manual", signal: AbortSignal.timeout(120_000) });
  if (response.headers.get("x-action-redirect")) return { redirect: response.headers.get("x-action-redirect") };
  assert.equal(response.status, 200, `${name}: HTTP ${response.status}`);
  const root = await createFromReadableStream(response.body, { serverConsumerManifest: { moduleMap: {}, serverModuleMap: null, moduleLoading: null } });
  return await root.a;
}
async function drain(stream: ReadableStream<ChatEvent>) {
  const events: ChatEvent[] = [];
  const reader = stream.getReader();
  for (;;) { const item = await reader.read(); if (item.done) return events; events.push(item.value); }
}

try {
  // 1. Populate a real v3 database with the pre-feature code: confirmed profile, accepted CV, settings, a failed turn and 120 chats.
  const legacy = openLegacyStore(database);
  const profileChat = legacy.createChat({ category: "profile", title: "Legacy profile" });
  const profileTurn = legacy.beginTurn({ chatId: profileChat.id, content: "Fictional engineer notes" });
  legacy.completeTurn(profileTurn.id, "Review", { baseRevision: null, summary: "Work", operations: [{ type: "insert", id: "p-work", afterId: null, content: "## Work\n\nFictional engineer." }] });
  legacy.approveProfileProposal(legacy.getProfileProposals(profileChat.id)[0].id, null);
  const failedChat = legacy.createChat({ category: "profile", title: "Legacy failed" });
  const failed = legacy.beginTurn({ chatId: failedChat.id, content: "Unanswered question" });
  legacy.failTurn(failed.id);
  const buildChat = legacy.createChat({ category: "build", title: "Oldest needle CV" });
  const settings = { jobDescription: "Fictional queue engineer", targetRole: "Engineer", targetCompany: "Example", projectLimit: 3 };
  legacy.updateBuildSettings(buildChat.id, settings, 0);
  const buildTurn = legacy.beginTurn({ chatId: buildChat.id, content: "Draft" });
  legacy.completeTurn(buildTurn.id, "Engineer matches role.", undefined, { profileRevision: legacy.getProfileRevisions()[0].id, value: { schemaVersion: 1, sections: [{ type: "text", title: "Summary", content: { text: "Engineer", evidence: ["p-work"] } }] } });
  legacy.changeCvRevision({ chatId: buildChat.id, revisionId: legacy.getCvWorkspace(buildChat.id).revisions[0].id, action: "accept", expectedAcceptedId: null });
  for (let index = 1; index < 50; index++) legacy.createChat({ category: "build", title: `Build ${index}` });
  for (let index = 2; index < 70; index++) legacy.createChat({ category: "profile", title: `Profile ${index}` });
  const before = {
    profileMessages: legacy.getMessages(profileChat.id), buildMessages: legacy.getMessages(buildChat.id),
    profile: legacy.getProfileWorkspace(profileChat.id), cv: legacy.getCvWorkspace(buildChat.id), revisions: legacy.getProfileRevisions(),
    chats: legacy.listChats().length,
  };
  legacy.close();
  assert.equal(version(), 3);
  assert.equal(before.chats, 120);
  pass("pre-feature v3 database populated by commit f024bfb storage code", { chats: 120, messages: before.profileMessages.length + before.buildMessages.length });

  // 2. Start the built app on that database.
  await start();
  assert.deepEqual(basic(await action("readChatMessages", [profileChat.id])), basic(before.profileMessages));
  assert.deepEqual(basic(await action("readChatMessages", [buildChat.id])), basic(before.buildMessages));
  assert.equal(version(), 6);
  const legacyRetry = await action("sendChatMessage", [{ chatId: failedChat.id, retryId: failed.id }]);
  assert.equal(legacyRetry.messageId, failed.id);
  await drain(legacyRetry.stream);
  assert.deepEqual(basic(await action("readChatMessages", [failedChat.id])), [{ id: failed.id, role: "user", content: "Unanswered question", status: "failed" }]);
  pass("production app migrates v3 to v6; Server Actions return legacy messages unchanged and a legacy failed turn retries in place");

  // 3. Attachments: invalid uploads save nothing; valid uploads persist before the reply and survive provider failure.
  const count = async (id: string) => (await action("readChatMessages", [id])).length;
  const profileCount = await count(profileChat.id);
  for (const invalid of [form(profileChat.id, ["encrypted.pdf"]), form(profileChat.id, ["image-only.docx"]), form(profileChat.id, Array(6).fill("notes.txt")), form(profileChat.id, ["invalid.txt"])]) {
    assert.ok((await action("sendChatMessage", [invalid])).error);
  }
  assert.ok((await action("sendChatMessage", [{ chatId: profileChat.id, content: "Forged", attachments: [] }])).error);
  assert.equal(await count(profileChat.id), profileCount);
  pass("invalid, oversized-count and forged uploads return structured errors and save nothing");

  const documents = ["text.pdf", "scan.pdf", "career.docx", "notes.txt", "notes.md"];
  const sent = await action("sendChatMessage", [form(profileChat.id, documents, "Synthetic acceptance upload")]);
  assert.ok(!sent.error, JSON.stringify(sent));
  const events = await drain(sent.stream);
  assert.ok(events.some(event => event.type === "error") && !events.some(event => event.type === "done"), JSON.stringify(events));
  const afterFailure = await action("readChatMessages", [profileChat.id]);
  const uploaded = afterFailure.at(-1);
  assert.equal(afterFailure.length, profileCount + 1);
  assert.deepEqual([uploaded.role, uploaded.status, uploaded.content], ["user", "failed", "Synthetic acceptance upload"]);
  assert.deepEqual(uploaded.attachments.map((file: { name: string }) => file.name), documents);
  for (const file of uploaded.attachments) {
    assert.equal("bytes" in file, false);
    const download = await action("downloadChatAttachment", [{ chatId: profileChat.id, attachmentId: file.id }]);
    assert.ok(download.bytes instanceof Uint8Array);
    assert.equal(sha(download.bytes), sha(bytes(file.name)));
    assert.ok((await action("downloadChatAttachment", [{ chatId: buildChat.id, attachmentId: file.id }])).error);
  }
  pass("PDF, scanned PDF, DOCX, TXT and MD persist through a failed reply; Uint8Array downloads are SHA-256 identical; cross-chat download denied", { provider: events.find(event => event.type === "error") });

  const retry = await action("sendChatMessage", [{ chatId: profileChat.id, retryId: uploaded.id }]);
  assert.ok(!retry.error, JSON.stringify(retry));
  assert.equal(retry.messageId, uploaded.id);
  await drain(retry.stream);
  const afterRetry = await action("readChatMessages", [profileChat.id]);
  assert.equal(afterRetry.length, afterFailure.length);
  assert.deepEqual(afterRetry.at(-1).attachments, uploaded.attachments);
  pass("retry reuses the saved message and attachments without another upload or duplicate");

  const images = ["image.png", "image.jpg", "image.webp"];
  const cancelled = await action("sendChatMessage", [form(buildChat.id, images)]);
  assert.ok(!cancelled.error, JSON.stringify(cancelled));
  await action("cancelChatReply", [buildChat.id, cancelled.messageId]);
  await drain(cancelled.stream);
  const afterCancel = (await action("readChatMessages", [buildChat.id])).at(-1);
  assert.deepEqual([afterCancel.id, afterCancel.status, afterCancel.content], [cancelled.messageId, "failed", ""]);
  assert.deepEqual(afterCancel.attachments.map((file: { name: string }) => file.name), images);
  for (const file of afterCancel.attachments) assert.equal(sha((await action("downloadChatAttachment", [{ chatId: buildChat.id, attachmentId: file.id }])).bytes), sha(bytes(file.name)));
  pass("attachment-only PNG/JPEG/WebP message in a build chat survives cancellation with identical downloads");

  // 4. Jobs through Server Actions: validation, default status, duplicate submission, stale writes, atomic status plus comment.
  const operationId = randomUUID();
  const jobInput = { operationId, title: "Fictional platform role", url: "https://example.com/jobs/1", description: "Original description" };
  const created = await action("createJob", [jobInput]);
  assert.ok(created.ok, JSON.stringify(created));
  assert.equal(created.job.status, "Applied");
  assert.equal((await action("createJob", [jobInput])).job.id, created.job.id);
  for (const invalid of [{ ...jobInput, operationId: randomUUID(), url: "ftp://example.com" }, { ...jobInput, operationId: randomUUID(), title: " " }, { ...jobInput, operationId: randomUUID(), status: "Ghosted" }]) {
    assert.equal((await action("createJob", [invalid])).ok, false);
  }
  const edit = { id: created.job.id, operationId: randomUUID(), expectedVersion: 0, title: "Fictional platform role", url: jobInput.url, description: "Changed description" };
  const edited = await action("editJob", [edit]);
  assert.ok(edited.ok, JSON.stringify(edited));
  assert.match((await action("editJob", [{ ...edit, operationId: randomUUID(), description: "Stale" }])).error, /changed|refresh/i);
  const update = { id: created.job.id, operationId: randomUUID(), expectedVersion: edited.job.version, status: "Interviewing", comment: "<b>Plain</b> text" };
  const updated = await action("addJobActivity", [update]);
  assert.ok(updated.ok, JSON.stringify(updated));
  assert.equal((await action("addJobActivity", [update])).job.version, updated.job.version);
  assert.equal((await action("addJobActivity", [{ id: created.job.id, operationId: randomUUID(), expectedVersion: updated.job.version, comment: " " }])).ok, false);
  assert.equal((await action("addJobActivity", [{ id: randomUUID(), operationId: randomUUID(), expectedVersion: 0, comment: "Missing" }])).ok, false);
  pass("job actions validate input, default to Applied, deduplicate repeats, reject stale and blank writes");

  // 5. Restart: messages, attachments and downloads persist; deleting a chat removes only its attachments.
  const savedProfile = await action("readChatMessages", [profileChat.id]);
  const savedBuild = await action("readChatMessages", [buildChat.id]);
  await stop(); await start();
  assert.deepEqual(await action("readChatMessages", [profileChat.id]), savedProfile);
  assert.deepEqual(await action("readChatMessages", [buildChat.id]), savedBuild);
  assert.equal(sha((await action("downloadChatAttachment", [{ chatId: profileChat.id, attachmentId: uploaded.attachments[1].id }])).bytes), sha(bytes("scan.pdf")));
  pass("server restart preserves messages, attachment metadata and original bytes");

  const removal = new FormData(); removal.set("id", profileChat.id); removal.set("confirmed", "true"); removal.set("returnTo", "/chats?category=profile");
  assert.equal((await action("deleteChat", [removal])).redirect?.startsWith("/chats?category=profile"), true);
  for (const file of uploaded.attachments) assert.ok((await action("downloadChatAttachment", [{ chatId: profileChat.id, attachmentId: file.id }])).error);
  assert.equal(sha((await action("downloadChatAttachment", [{ chatId: buildChat.id, attachmentId: afterCancel.attachments[0].id }])).bytes), sha(bytes("image.png")));
  pass("deleting the profile chat through its action removes its attachments and keeps the build chat's files");
  await stop();

  // 6. Storage after the run: legacy documents, bounded lists, job history atomicity.
  const store = openStore(database);
  try {
    assert.deepEqual(store.getProfileRevisions(), before.revisions);
    const cv = store.getCvWorkspace(buildChat.id);
    assert.deepEqual(cv.settings, before.cv.settings);
    assert.equal(cv.acceptedId, before.cv.acceptedId);
    assert.ok(cv.acceptedId);
    assert.deepEqual(cv.revisions, before.cv.revisions);
    pass("confirmed profile history, accepted CV, revisions and build settings survive migration and chat deletion");

    const build = [1, 2, 3].map(page => store.listChats({ category: "build", page }));
    const profile = [1, 2, 3, 4].map(page => store.listChats({ category: "profile", page }));
    assert.deepEqual(build.map(page => [page.total, page.items.length]), [[50, 25], [50, 25], [50, 0]]);
    assert.deepEqual(profile.map(page => [page.total, page.items.length]), [[69, 25], [69, 25], [69, 19], [69, 0]]);
    const ids = [...build, ...profile].flatMap(page => page.items.map(item => item.id));
    assert.equal(new Set(ids).size, 119);
    assert.equal(build[0].items[0].id, buildChat.id, "latest activity first");
    assert.deepEqual(store.listChats({ category: "build", search: "NEEDLE" }).items.map(item => item.id), [buildChat.id]);
    assert.equal(store.listChats({ category: "profile", search: "needle" }).total, 0);
    assert.equal(store.listChats({ category: "build", limit: 5 }).items.length, 5);
    pass("120 migrated chats page in storage at 25 per page with unique stable order, category isolation and case-insensitive search");

    const job = store.getJob(created.job.id)!;
    assert.deepEqual([job.status, job.description, job.version], ["Interviewing", "Changed description", 2]);
    assert.deepEqual(job.activity.map(event => event.kind), ["created", "fields", "activity"]);
    assert.deepEqual(job.activity[1].changes.description, { old: "Original description", new: "Changed description" });
    assert.deepEqual([job.activity[2].changes.status, job.activity[2].comment], [{ old: "Applied", new: "Interviewing" }, "<b>Plain</b> text"]);
    assert.equal(store.listJobs({}).total, 1);
    pass("job history persists one event per effective operation with old/new values; combined status and comment is one event");
  } finally { store.close(); }
  console.log(`PASS all ${results.length} checks. Personal database untouched; no browser or Claude call.`);
} catch (error) {
  console.error(app.diagnostic());
  throw error;
} finally {
  await stop();
  mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
  writeFileSync(new URL("./results/actions.json", import.meta.url), JSON.stringify(results, null, 2));
  app.remove();
}
