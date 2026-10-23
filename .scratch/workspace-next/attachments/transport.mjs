// Real production Next.js Server Action transport. Node HTTP driver; no browser.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(import.meta.url);
const { encodeReply, createFromReadableStream } = require("next/dist/compiled/react-server-dom-webpack-experimental/client.node.js");
const directory = fileURLToPath(new URL(".", import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), "cv-attachment-transport-"));
const next = resolve("node_modules/next/dist/bin/next");
const origin = "http://localhost:3802";
const MiB = 1024 * 1024;
let server;
let diagnostic = "";
let manifest;
const results = [];

function execute(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [next, ...args], { cwd: temporary, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", data => { output += data; });
    child.stderr.on("data", data => { output += data; });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve(output) : reject(new Error(output)));
  });
}
async function start() {
  diagnostic = "";
  manifest = JSON.parse(readFileSync(join(temporary, ".next/server/server-reference-manifest.json"), "utf8"));
  server = spawn(process.execPath, [next, "start", "--port", "3802"], { cwd: temporary, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", data => { diagnostic += data; });
  server.stderr.on("data", data => { diagnostic += data; });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(diagnostic);
    try { if ((await fetch(origin)).ok) return; } catch { /* Startup can refuse connections. */ }
    await delay(100);
  }
  throw new Error("Probe startup timed out: " + diagnostic);
}
async function stop() {
  if (!server) return;
  const current = server;
  if (current.exitCode === null) {
    current.kill();
    await new Promise(resolve => current.once("exit", resolve));
  }
  server = undefined;
}
async function action(name, args) {
  const entry = Object.entries(manifest.node).find(([, item]) => item.exportedName === name);
  assert.ok(entry, name);
  const body = await encodeReply(args);
  const headers = { "Next-Action": entry[0], Origin: origin };
  if (typeof body === "string") headers["Content-Type"] = "text/plain;charset=UTF-8";
  const measuredRequest = new Request(origin, { method: "POST", headers, body });
  const requestBytes = (await measuredRequest.clone().arrayBuffer()).byteLength;
  const response = await fetch(measuredRequest);
  if (!response.ok) throw new Error(`${response.status}: ${(await response.text()).slice(0, 180)}`);
  let responseBytes = 0;
  const measured = response.body.pipeThrough(new TransformStream({ transform(chunk, controller) { responseBytes += chunk.byteLength; controller.enqueue(chunk); } }));
  const root = await createFromReadableStream(measured, { serverConsumerManifest: { moduleMap: {}, serverModuleMap: null, moduleLoading: null } });
  const value = await root.a;
  return { value, requestBytes, responseBytes };
}
function input(sizes) {
  const data = new FormData();
  data.set("chat", "synthetic-chat");
  const hashes = [];
  for (const [index, size] of sizes.entries()) {
    const bytes = Buffer.alloc(size, 0x41 + index);
    data.append("files", new File([bytes], `synthetic-${index}.bin`, { type: "application/octet-stream" }));
    hashes.push(createHash("sha256").update(bytes).digest("hex"));
  }
  return { data, hashes };
}
async function roundtrip(sizes) {
  const { data, hashes } = input(sizes);
  const started = performance.now();
  const uploaded = await action("upload", [data]);
  assert.equal(uploaded.value.attachments.length, sizes.length);
  for (const [index, file] of uploaded.value.attachments.entries()) {
    assert.equal(file.sha256, hashes[index]);
    const downloaded = await action("download", [{ id: file.id, chat: "synthetic-chat" }]);
    assert.ok(downloaded.value.bytes instanceof Uint8Array);
    assert.equal(downloaded.value.bytes.length, sizes[index]);
    assert.equal(createHash("sha256").update(downloaded.value.bytes).digest("hex"), hashes[index]);
    assert.equal(downloaded.value.name, file.name);
    if (index === 0) results.push({ name: "typed-array download", size: sizes[index], responseBytes: downloaded.responseBytes, memory: downloaded.value.memory });
  }
  results.push({ name: "multipart upload", sizes, requestBytes: uploaded.requestBytes, ms: Math.round(performance.now() - started), memory: uploaded.value.memory, maxRssKiB: uploaded.value.maxRssKiB });
  console.log("PASS binary roundtrip", sizes, "request bytes", uploaded.requestBytes);
  return uploaded.value;
}
try {
  symlinkSync(resolve("node_modules"), join(temporary, "node_modules"), "junction");
  mkdirSync(join(temporary, "app"));
  writeFileSync(join(temporary, "package.json"), JSON.stringify({ private: true, dependencies: { next: "16.4.2", react: "19.3.0", "react-dom": "19.3.0" } }));
  writeFileSync(join(temporary, "app/actions.ts"), readFileSync(join(directory, "actions.ts.fixture")));
  writeFileSync(join(temporary, "app/layout.tsx"), 'export default function Layout({children}:{children:React.ReactNode}) { return <html><body>{children}</body></html>; }');
  // Keep action references reachable without interacting with or checking markup.
  writeFileSync(join(temporary, "app/client.tsx"), '"use client"; import {upload,download,counts} from "./actions"; export default function Probe() { return <form action={async () => {await counts(); await upload(new FormData()); await download({id:"probe",chat:"probe"});}} />; }');
  writeFileSync(join(temporary, "app/page.tsx"), 'import Probe from "./client"; export default function Page() { return <Probe/>; }');
  for (const configured of [false, true]) {
    writeFileSync(join(temporary, "next.config.mjs"), `export default {experimental: {${configured ? 'serverActions: {bodySizeLimit: "21mb"}' : ""}}};`);
    await execute(["build", "--webpack"]);
    console.log("Built isolated probe", configured ? "21 MiB" : "default 1 MiB");
    await start();
    if (!configured) {
      await roundtrip([512 * 1024]);
      let rejectedStatus;
      await assert.rejects(() => action("upload", [input([MiB]).data]), error => { rejectedStatus = error.message.split(":")[0]; return /^(413|500):/.test(error.message); });
      assert.match(diagnostic, /Body exceeded 1\s?MB limit/i);
      results.push({ name: "default framework limit", atMiB: 1, rejected: true, observedHttpStatus: rejectedStatus });
      console.log("PASS default limit rejects 1 MiB file plus multipart overhead");
    } else {
      const baseline = await action("counts", []);
      results.push({ name: "baseline memory", ...baseline.value });
      const largest = await roundtrip([10 * MiB, 10 * MiB]);
      await roundtrip([100, 101, 102, 103, 104]);
      const before = (await action("counts", [])).value;
      for (const sizes of [[10 * MiB + 1], [7 * MiB, 7 * MiB, 6 * MiB + 1], [1, 1, 1, 1, 1, 1]]) {
        await assert.rejects(() => action("upload", [input(sizes).data]));
      }
      assert.match(diagnostic, /Combined files exceed 20 MiB/);
      await assert.rejects(() => action("upload", [input([10 * MiB, 10 * MiB, 2 * MiB]).data]), /(?:413|500):/);
      assert.match(diagnostic, /Body exceeded 21mb limit/i);
      await assert.rejects(() => action("download", [{ id: largest.attachments[0].id, chat: "other-chat" }]));
      const after = (await action("counts", [])).value;
      assert.equal(before.messages, after.messages);
      assert.equal(before.files, after.files);
      results.push({ name: "validation and framework limits preserve rows", before: { messages: before.messages, files: before.files }, after: { messages: after.messages, files: after.files } });
      await stop();
      await start();
      const reopened = await action("download", [{ id: largest.attachments[0].id, chat: "synthetic-chat" }]);
      assert.equal(createHash("sha256").update(reopened.value.bytes).digest("hex"), largest.attachments[0].sha256);
      results.push({ name: "SQLite BLOB survives server restart", passed: true });
      console.log("PASS action limits, cross-chat rejection, no partial rows, and server restart");
    }
    await stop();
  }
} finally {
  await stop();
  mkdirSync(join(directory, "results"), { recursive: true });
  writeFileSync(join(directory, "results", "transport.json"), JSON.stringify(results, null, 2));
  assert.ok(temporary.startsWith(join(tmpdir(), "cv-attachment-transport-")));
  rmSync(temporary, { recursive: true, force: true });
}
