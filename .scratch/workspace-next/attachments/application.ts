// Real application Server Actions against a separate temporary database. Node HTTP only; no browser.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { openStore } from "../../../lib/storage/store.ts";
import { mediaTypes } from "../../../lib/attachments/types.ts";
import type { ChatEvent } from "../../../lib/ai/provider.ts";

const require = createRequire(import.meta.url);
const { encodeReply, createFromReadableStream } = require("next/dist/compiled/react-server-dom-webpack-experimental/client.node.js");
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8"));
const directory = mkdtempSync(join(tmpdir(), "cv-attachment-actions-"));
const origin = "http://localhost:3802";
let server: ReturnType<typeof spawn> | undefined;
let diagnostic = "";
const results: unknown[] = [];
const bytes = (name: string) => readFileSync(new URL(`../../../lib/ai/fixtures/${name}`, import.meta.url));
function form(chatId: string, names: string[], content = "") {
  const data = new FormData(); data.set("chatId", chatId); data.set("content", content);
  for (const name of names) data.append("files", new File([bytes(name)], name, { type: mediaTypes[name.split('.').at(-1) as keyof typeof mediaTypes] }));
  return data;
}
async function action(name: string, args: unknown[]) {
  const entry = Object.entries(manifest.node).find(([, item]) => (item as { exportedName: string }).exportedName === name);
  assert.ok(entry, name);
  const body = await encodeReply(args);
  const headers: Record<string, string> = { "Next-Action": entry[0], Origin: origin };
  if (typeof body === "string") headers["Content-Type"] = "text/plain;charset=UTF-8";
  const response = await fetch(origin, { method: "POST", headers, body, signal: AbortSignal.timeout(180_000) });
  assert.equal(response.status, 200);
  const root = await createFromReadableStream(response.body, { serverConsumerManifest: { moduleMap: {}, serverModuleMap: null, moduleLoading: null } });
  return await root.a;
}
async function reply(data: FormData, markers: string[]) {
  const result = await action("sendChatMessage", [data]);
  assert.ok(!result.error, JSON.stringify(result));
  const reader = (result.stream as ReadableStream<ChatEvent>).getReader();
  let text = "", done = false;
  for (;;) {
    const item = await reader.read(); if (item.done) break;
    const event = item.value;
    assert.notEqual(event.type, "error", JSON.stringify(event));
    if (event.type === "text-delta") text += event.text;
    if (event.type === "done") done = true;
  }
  assert.ok(done);
  for (const marker of markers) assert.ok(text.includes(marker), `Missing ${marker}: ${text}`);
  results.push({ name: "live application reply", markers, matched: true });
}
async function start() {
  diagnostic = "";
  server = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "--port", "3802"], { cwd: directory, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout!.on("data", value => { diagnostic += value; });
  server.stderr!.on("data", value => { diagnostic += value; });
  for (let index = 0; index < 100; index++) {
    if (server.exitCode !== null) throw new Error(diagnostic);
    try { if ((await fetch(origin)).ok) return; } catch { /* Startup can refuse connections. */ }
    await delay(100);
  }
  throw new Error("Isolated startup timed out: " + diagnostic);
}
async function stop() {
  if (!server) return;
  const current = server;
  if (current.exitCode === null) { current.kill(); await new Promise<void>(resolve => current.once("exit", () => resolve())); }
  server = undefined;
}
try {
  symlinkSync(resolve("node_modules"), join(directory, "node_modules"), "junction");
  symlinkSync(resolve(".next"), join(directory, ".next"), "junction");
  copyFileSync("package.json", join(directory, "package.json"));
  copyFileSync("next.config.ts", join(directory, "next.config.ts"));
  mkdirSync(join(directory, "lib/attachments"), { recursive: true });
  copyFileSync("lib/attachments/parser.mjs", join(directory, "lib/attachments/parser.mjs"));
  const store = openStore(join(directory, "data/app.sqlite"));
  const chat = store.createChat({ category: "profile", title: "Synthetic attachment transport" });
  const other = store.createChat({ category: "build", title: "Unrelated" });
  store.close();
  await start();
  for (const invalid of [form(chat.id, ["encrypted.pdf"]), form(chat.id, ["image-only.docx"]), form(chat.id, Array(6).fill("notes.txt"))]) {
    assert.ok((await action("sendChatMessage", [invalid])).error);
  }
  const forged = await action("sendChatMessage", [{ chatId: chat.id, content: "Forged", attachments: [] }]);
  assert.ok(forged.error);
  assert.deepEqual(await action("readChatMessages", [chat.id]), []);
  const markers = ["PDF-ORBIT-8462", "IMAGE-CEDAR-5729", "DOCX-LARCH-6934", "TABLE-ASH-4628", "TEXT-MAPLE-3187", "MARKDOWN-BIRCH-8041"];
  await reply(form(chat.id, ["text.pdf", "scan.pdf", "career.docx", "notes.txt", "notes.md"], "These are fictional parser fixtures. List the exact uppercase marker codes in every attached file, including the scanned PDF. Do not propose profile changes."), markers);
  const saved = await action("readChatMessages", [chat.id]);
  assert.equal(saved.length, 2); assert.equal(saved[0].attachments.length, 5);
  for (const file of saved[0].attachments) {
    assert.equal("bytes" in file, false);
    const download = await action("downloadChatAttachment", [{ chatId: chat.id, attachmentId: file.id }]);
    assert.ok(download.bytes instanceof Uint8Array);
    assert.equal(createHash("sha256").update(download.bytes).digest("hex"), createHash("sha256").update(bytes(file.name)).digest("hex"));
    assert.ok((await action("downloadChatAttachment", [{ chatId: other.id, attachmentId: file.id }])).error);
  }
  await stop(); await start();
  assert.deepEqual(await action("readChatMessages", [chat.id]), saved);
  await reply(form(chat.id, ["image.png", "image.jpg", "image.webp"], "List every marker code from ALL earlier attachments and these three new images. Include PDF scan and DOCX table markers again. Do not propose profile changes."), [...markers, "PNG-ELM-2156", "JPEG-PINE-7392", "WEBP-OAK-9513"]);
  const after = await action("readChatMessages", [chat.id]);
  assert.equal(after.length, 4); assert.equal(after[2].attachments.length, 3);
  assert.deepEqual(await action("readChatMessages", [other.id]), []);
  results.push({ name: "production actions", invalidUploadsAtomic: true, forgedPreparedInputRejected: true, downloads: "SHA-256 identical", crossChatDenied: true, restartReplay: true });
  console.log("PASS production uploads, real Claude markers, downloads, guards and restart replay. Personal database untouched.");
} catch (error) {
  console.error(diagnostic);
  throw error;
} finally {
  await stop();
  mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
  writeFileSync(new URL("./results/application.json", import.meta.url), JSON.stringify(results, null, 2));
  assert.ok(directory.startsWith(join(tmpdir(), "cv-attachment-actions-")));
  rmSync(directory, { recursive: true, force: true });
}
