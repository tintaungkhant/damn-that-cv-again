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
const directory = mkdtempSync(join(tmpdir(), "cv-export-actions-"));
symlinkSync(resolve("node_modules"), join(directory, "node_modules"), "junction");
symlinkSync(resolve(".next"), join(directory, ".next"), "junction");
writeFileSync(join(directory, "package.json"), readFileSync("package.json"));
writeFileSync(join(directory, "next.config.ts"), readFileSync("next.config.ts"));
const store = openStore(join(directory, "data/app.sqlite"));
const profile = store.createChat({ category: "profile", title: "Synthetic career" });
const turn = store.beginTurn({ chatId: profile.id, content: "Synthetic notes" });
store.completeTurn(turn.id, "Review", { baseRevision: null, summary: "Synthetic role", operations: [{ type: "insert", id: "p-work", afterId: null, content: "## Work\n\nAlex Example was a backend engineer at ExampleCo from 2020 to 2022. Built TypeScript queue retry handling. No metrics supplied." }] });
store.approveProfileProposal(store.getProfileProposals(profile.id)[0].id, null);
const chat = store.createChat({ category: "build", title: "Isolated build verification" });
const other = store.createChat({ category: "build", title: "Other application" });
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
  const settings = { jobDescription: "TypeScript backend engineer building reliable queues", targetRole: "Backend engineer", targetCompany: "ExampleCo", projectLimit: 1 };
  const initial = await action("readCvWorkspace", [chat.id]);
  assert.equal(initial.version, 0);
  assert.equal(initial.settings.projectLimit, 5);
  await assert.rejects(() => action("saveBuildSettings", [{ chatId: profile.id, settings, expectedVersion: 0 }]));
  await assert.rejects(() => action("saveBuildSettings", [{ chatId: chat.id, settings: { ...settings, extra: true }, expectedVersion: 0 }]));
  const saved = await action("saveBuildSettings", [{ chatId: chat.id, settings, expectedVersion: 0 }]);
  assert.equal(saved.settings.jobDescription, settings.jobDescription);
  await assert.rejects(() => action("saveBuildSettings", [{ chatId: chat.id, settings, expectedVersion: 0 }]));
  const draftTurn = store.beginTurn({ chatId: chat.id, content: "Synthetic CV" });
  const content = JSON.parse(readFileSync("docs/examples/cv/custom.json", "utf8"), (key, value) => key === "evidence" ? ["p-work"] : value);
  store.completeTurn(draftTurn.id, "Private selection notes", undefined, { value: content, profileRevision: store.getProfileRevisions()[0].id });
  const review = await action("readCvWorkspace", [chat.id]);
  assert.equal(review.revisions.length, 1);
  assert.equal(review.acceptedId, null);
  const first = review.revisions[0];
  await assert.rejects(() => action("changeCvRevision", [{ chatId: other.id, revisionId: first.id, action: "accept", expectedAcceptedId: null }]));
  await assert.rejects(() => action("changeCvRevision", [{ chatId: chat.id, revisionId: first.id, action: "accept", expectedAcceptedId: null, extra: true }]));
  await assert.rejects(() => action("exportAcceptedCv", [{ chatId: chat.id, revisionId: first.id }]));
  const accepted = await action("changeCvRevision", [{ chatId: chat.id, revisionId: first.id, action: "accept", expectedAcceptedId: null }]);
  assert.equal(accepted.acceptedId, first.id);
  const json = await action("exportAcceptedCv", [{ chatId: chat.id, revisionId: first.id }]);
  const exported = JSON.parse(json);
  assert.deepEqual(exported.sections.map((section: { title: string }) => section.title), ["About", "Selected tools", "Selected contributions"]);
  assert.deepEqual(exported.sections[2].entries[1], { heading: { text: "Independent research" } });
  assert.equal(/evidence|Private selection notes|profileRevision/.test(json), false);
  await assert.rejects(() => action("exportAcceptedCv", [{ chatId: other.id, revisionId: first.id }]));
  await assert.rejects(() => action("exportAcceptedCv", [{ chatId: chat.id, revisionId: first.id, extra: true }]));

  await assert.rejects(() => action("changeCvRevision", [{ chatId: chat.id, revisionId: first.id, action: "discard", expectedAcceptedId: first.id }]));
  await assert.rejects(() => action("changeCvRevision", [{ chatId: chat.id, revisionId: first.id, action: "restore", expectedAcceptedId: null }]));
  const restored = await action("changeCvRevision", [{ chatId: chat.id, revisionId: first.id, action: "restore", expectedAcceptedId: first.id }]);
  assert.equal(restored.revisions.length, 2);
  assert.equal(restored.revisions[0].status, "draft");
  assert.deepEqual(restored.revisions[0].content, first.content);
  const discarded = await action("changeCvRevision", [{ chatId: chat.id, revisionId: restored.revisions[0].id, action: "discard", expectedAcceptedId: first.id }]);
  assert.equal(discarded.acceptedId, first.id);
  assert.equal(discarded.revisions[0].status, "discarded");
  const reopened = await fetch(`http://localhost:3801/chats/${chat.id}`, { headers: { RSC: "1" } });
  assert.equal(reopened.status, 200);
  assert.doesNotMatch(await reopened.text(), /^[0-9a-f]+:E{/m);
  assert.equal((await action("readChatMessages", [chat.id])).length, 2);
  assert.equal((await action("readCvWorkspace", [other.id])).revisions.length, 0);
  console.log("Isolated export Server Action: draft rejection, accepted custom/optional content, evidence/privacy stripping, input/chat guards and reopen passed. Personal database untouched.");
} finally {
  server.kill();
  await new Promise<void>(resolve => { if (server.exitCode !== null) resolve(); else server.once("exit", () => resolve()); });
  store.close();
  assert.ok(directory.startsWith(join(tmpdir(), "cv-export-actions-")));
  rmSync(directory, { recursive: true, force: true });
}
