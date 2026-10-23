import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { openStore } from "../../../lib/storage/store.ts";
const require = createRequire(import.meta.url);
const { createFromReadableStream } = require("next/dist/compiled/react-server-dom-webpack-experimental/client.node.js");
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8"));
const entry = Object.entries(manifest.node).find(([, item]) => item.exportedName === "sendChatMessage");
assert.ok(entry);
const store = openStore("data/app.sqlite");
const chat = store.createChat({ category: "profile", title: "Temporary streaming verification" });
const started = performance.now();
try {
  const response = await fetch("http://localhost:3800/", { method: "POST", headers: { "Next-Action": entry[0], "Content-Type": "text/plain;charset=UTF-8", Origin: "http://localhost:3800" }, body: JSON.stringify([{ chatId: chat.id, content: "Reply with one short question about my career." }]) });
  assert.equal(response.status, 200);
  const root = await createFromReadableStream(response.body, { serverConsumerManifest: { moduleMap: {}, serverModuleMap: null, moduleLoading: null } });
  const reply = await root.a;
  const reader = reply.stream.getReader();
  let firstMs, doneMs;
  for (;;) {
    const result = await reader.read();
    if (result.done) break;
    assert.notEqual(result.value.type, "error", JSON.stringify(result.value));
    if (result.value.type === "text-delta" && firstMs === undefined) firstMs = Math.round(performance.now() - started);
    if (result.value.type === "done") doneMs = Math.round(performance.now() - started);
  }
  assert.ok(firstMs !== undefined && doneMs !== undefined && firstMs <= doneMs);
  assert.equal(store.getMessages(chat.id).length, 2);
  assert.ok(store.getMessages(chat.id).every(message => message.status === "complete"));
  console.log(JSON.stringify({ status: response.status, firstMs, doneMs, savedMessages: 2 }));
} finally { store.deleteChat(chat.id, false); store.close(); }
