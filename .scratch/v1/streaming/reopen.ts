import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { openStore } from "../../../lib/storage/store.ts";
const require = createRequire(import.meta.url);
const { createFromReadableStream } = require("next/dist/compiled/react-server-dom-webpack-experimental/client.node.js");
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8"));
const actionId = Object.entries(manifest.node).find(([, item]) => item.exportedName === "readChatMessages")[0];
const store = openStore("data/app.sqlite");
try {
  const chats = store.listChats().filter(chat => store.getMessages(chat.id).length > 0);
  assert.ok(chats.length > 0, "Need a saved conversation for the reload check.");
  for (const chat of chats) {
    const response = await fetch(`http://localhost:3800/chats/${chat.id}`, { headers: { RSC: "1" } });
    assert.equal(response.status, 200);
    const flight = await response.text();
    assert.ok(!/^[0-9a-f]+:E\{/m.test(flight), "Reopening a saved conversation must not return a React server error.");
    const actionResponse = await fetch("http://localhost:3800/", {
      method: "POST", headers: { "Next-Action": actionId, "Content-Type": "text/plain;charset=UTF-8", Origin: "http://localhost:3800" }, body: JSON.stringify([chat.id]),
    });
    assert.equal(actionResponse.status, 200);
    const root = await createFromReadableStream(actionResponse.body, { serverConsumerManifest: { moduleMap: {}, serverModuleMap: null, moduleLoading: null } });
    const messages = await root.a;
    assert.equal(messages.length, store.getMessages(chat.id).length);
  }
  console.log(`Reopened ${chats.length} saved conversation(s) without React server errors.`);
} finally { store.close(); }
