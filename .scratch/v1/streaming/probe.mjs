import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createFromReadableStream } = require("next/dist/compiled/react-server-dom-webpack-experimental/client.node.js");
const manifest = JSON.parse(readFileSync(".next/dev/server/app/transport-probe/page/server-reference-manifest.json", "utf8"));
const id = Object.entries(manifest.node).find(([, value]) => value.exportedName === "probeStream")[0];
const start = performance.now();
const response = await fetch("http://localhost:3801/transport-probe", { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Origin: "http://localhost:3801" }, body: "[]" });
const root = await createFromReadableStream(response.body, { serverConsumerManifest: { moduleMap: {}, serverModuleMap: null, moduleLoading: null } });
console.log("root ms", Math.round(performance.now() - start));
const stream = await root.a;
console.log("return", stream?.constructor.name);
for await (const event of stream) console.log("event", event, "ms", Math.round(performance.now() - start));

// Exercise Next's installed queue and Server Action reducer in Node, not a browser.
const Module = require("node:module");
const originalLoad = Module._load;
Module._load = function(name, ...args) {
  if (name === "react-server-dom-webpack/client") {
    const client = require("next/dist/compiled/react-server-dom-webpack-experimental/client.node.js");
    return { ...client, createFromFetch: (response, options) => client.createFromFetch(response, { ...options, serverConsumerManifest: { moduleMap: {}, serverModuleMap: null, moduleLoading: null } }) };
  }
  return originalLoad.call(this, name, ...args);
};
const { createMutableActionQueue } = require("next/dist/client/components/app-router-instance.js");
const { serverActionReducer } = require("next/dist/client/components/router-reducer/reducers/server-action-reducer.js");
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, options) => nativeFetch(new URL(url, "http://localhost:3801"), { ...options, headers: { ...options.headers, Origin: "http://localhost:3801" } });
globalThis.window = { location: new URL("http://localhost:3801/transport-probe") };
const queue = createMutableActionQueue({ canonicalUrl: "/transport-probe", tree: ["", {}], nextUrl: null, previousNextUrl: null });
queue.action = serverActionReducer;
const invoke = name => new Promise((resolve, reject) => queue.dispatch({ type: "server-action", actionId: Object.entries(manifest.node).find(([, value]) => value.exportedName === name)[0], actionArgs: [], resolve, reject }, () => {}));
const queuedStart = performance.now();
const streaming = invoke("probeStream");
const ping = invoke("probePing");
const queuedStream = await streaming;
console.log("queued ping", await ping, "ms", Math.round(performance.now() - queuedStart));
const queuedReader = queuedStream.getReader();
while (!(await queuedReader.read()).done) {}
console.log("queued stream completed ms", Math.round(performance.now() - queuedStart));
