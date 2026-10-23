import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { openStore } from "../../../lib/storage/store.ts";
const require = createRequire(import.meta.url);
const { createFromReadableStream } = require("next/dist/compiled/react-server-dom-webpack-experimental/client.node.js");
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8"));
const directory = mkdtempSync(join(tmpdir(), "cv-profile-actions-"));
symlinkSync(resolve("node_modules"), join(directory, "node_modules"), "junction");
symlinkSync(resolve(".next"), join(directory, ".next"), "junction");
writeFileSync(join(directory, "package.json"), readFileSync("package.json"));
writeFileSync(join(directory, "next.config.ts"), readFileSync("next.config.ts"));
const store = openStore(join(directory, "data/app.sqlite"));
const chat = store.createChat({ category: "profile", title: "Isolated HTTP verification" });
const other = store.createChat({ category: "profile", title: "Other chat" });
const server = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "--port", "3801"], { cwd: directory, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
let diagnostic = "";
server.stdout.on("data", value => { diagnostic += value; });
server.stderr.on("data", value => { diagnostic += value; });
async function action(name: string, args: unknown[]) {
  const entry = Object.entries(manifest.node).find(([, item]) => (item as { exportedName: string }).exportedName === name);
  assert.ok(entry, name);
  const response = await fetch("http://localhost:3801/", { method: "POST", headers: { "Next-Action": entry[0], "Content-Type": "text/plain;charset=UTF-8", Origin: "http://localhost:3801" }, body: JSON.stringify(args) });
  assert.equal(response.status, 200);
  const root = await createFromReadableStream(response.body, { serverConsumerManifest: { moduleMap: {}, serverModuleMap: null, moduleLoading: null } });
  return await root.a;
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { const response = await fetch("http://localhost:3801/"); if (response.ok) { ready = true; break; } } catch {}
    if (server.exitCode !== null) throw new Error("Isolated server exited: " + diagnostic);
    await delay(100);
  }
  assert.ok(ready, "Isolated server did not start: " + diagnostic);
  const reply = await action("sendChatMessage", [{ chatId: chat.id, content: "Synthetic test notes: Alex Example worked as a backend engineer at Example Co from 2020 to 2022 using TypeScript. Organize these notes into the first profile proposal with the profile tool. Keep the explanation short." }]);
  const reader = reply.stream.getReader();
  let proposalEvent = false;
  for (;;) {
    const item = await reader.read(); if (item.done) break;
    assert.notEqual(item.value.type, "error", JSON.stringify(item.value));
    if (item.value.type === "proposal") proposalEvent = true;
  }
  assert.equal(proposalEvent, true);
  const review = await action("readProfileWorkspace", [chat.id]);
  assert.equal(review.revisions.length, 0);
  assert.equal(review.proposals.length, 1);
  const proposal = review.proposals[0];
  assert.equal(proposal.preview.conflict, false);
  await assert.rejects(() => action("approveProfileEdit", [{ chatId: other.id, proposalId: proposal.id, revisionId: null }]));
  await assert.rejects(() => action("approveProfileEdit", [{ chatId: chat.id, proposalId: proposal.id, revisionId: null, untrusted: true }]));
  const approved = await action("approveProfileEdit", [{ chatId: chat.id, proposalId: proposal.id, revisionId: null }]);
  assert.equal(approved.approved, true);
  assert.equal(approved.workspace.revisions.length, 1);
  const initial = approved.workspace.revisions[0];
  const turn = store.beginTurn({ chatId: chat.id, content: "Record a question" });
  store.completeTurn(turn.id, "Review the question.", { baseRevision: initial.id, summary: "Ask about impact", operations: [{ type: "replace", id: "p-open-questions", content: "## Open questions\n\nWhat was the impact?" }] });
  const question = store.getProfileProposals(chat.id)[0];
  const changed = await action("approveProfileEdit", [{ chatId: chat.id, proposalId: question.id, revisionId: initial.id }]);
  assert.equal(changed.approved, true);
  const stale = await action("restoreProfile", [{ chatId: chat.id, revisionId: initial.id, expectedRevision: initial.id }]);
  assert.equal(stale.restored, false);
  const restored = await action("restoreProfile", [{ chatId: chat.id, revisionId: initial.id, expectedRevision: changed.workspace.revisions[0].id }]);
  assert.equal(restored.restored, true);
  assert.equal(restored.workspace.revisions.length, 3);
  assert.equal(restored.workspace.revisions[0].markdown, initial.markdown);
  const reopened = await fetch(`http://localhost:3801/?chat=${chat.id}`, { headers: { RSC: "1" } });
  assert.equal(reopened.status, 200);
  assert.doesNotMatch(await reopened.text(), /^[0-9a-f]+:E\{/m);
  assert.equal((await action("readChatMessages", [chat.id])).length, 4);
  console.log("Isolated HTTP Server Actions: live proposal stream, read/reopen, approval, input/chat validation, stale restore and undo passed. Personal database untouched.");
} finally {
  server.kill();
  await new Promise<void>(resolve => { if (server.exitCode !== null) resolve(); else server.once("exit", () => resolve()); });
  store.close();
  rmSync(directory, { recursive: true, force: true });
}
