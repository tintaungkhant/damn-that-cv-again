import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { openStore } from "../../../lib/storage/store.ts";
const require = createRequire(import.meta.url);
const { createFromReadableStream } = require("next/dist/compiled/react-server-dom-webpack-experimental/client.node.js");
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8"));
const actionId = Object.entries(manifest.node).find(([, item]) => item.exportedName === "sendChatMessage")[0];
const store = openStore("data/app.sqlite");
const chat = store.createChat({ category: "profile", title: "Temporary interruption verification" });
let abort = new AbortController();
const invoke = async input => {
  const response = await fetch("http://localhost:3800/", { method: "POST", headers: { "Next-Action": actionId, "Content-Type": "text/plain;charset=UTF-8", Origin: "http://localhost:3800" }, body: JSON.stringify([input]), signal: abort.signal });
  const root = await createFromReadableStream(response.body, { serverConsumerManifest: { moduleMap: {}, serverModuleMap: null, moduleLoading: null } });
  return await root.a;
};
try {
  const reply = await invoke({ chatId: chat.id, content: "Give me five short paragraphs on writing career notes, starting with a short introduction." });
  const reader = reply.stream.getReader();
  while ((await reader.read()).value?.type !== "text-delta") {}
  abort.abort();
  await reader.read().catch(() => {});
  for (let count = 0; count < 50 && store.getMessages(chat.id)[0].status === "pending"; count++) await delay(100);
  assert.equal(store.getMessages(chat.id).length, 1);
  assert.equal(store.getMessages(chat.id)[0].status, "failed");
  const messageId = store.getMessages(chat.id)[0].id;
  abort = new AbortController();
  const retry = await invoke({ chatId: chat.id, retryId: messageId });
  const retryReader = retry.stream.getReader();
  let completed = false;
  for (;;) {
    const result = await retryReader.read();
    if (result.done) break;
    assert.notEqual(result.value.type, "error", JSON.stringify(result.value));
    if (result.value.type === "done") completed = true;
  }
  assert.ok(completed);
  assert.equal(store.getMessages(chat.id).length, 2);
  assert.equal(store.getMessages(chat.id)[0].id, messageId);
  assert.ok(store.getMessages(chat.id).every(message => message.status === "complete"));
  console.log("HTTP disconnect preserved one failed user message; retry completed without duplication.");
} finally { store.deleteChat(chat.id, false); store.close(); }
