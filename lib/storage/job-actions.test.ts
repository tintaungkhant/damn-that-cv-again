import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { randomUUID } from "node:crypto";
import { openStore } from "./store.ts";

// Node tests run outside React's server condition and Next's extension resolver.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (specifier === "./storage/store") specifier += ".ts";
  return nextResolve(specifier, context);
} });

test("Server Actions validate raw input, return useful failures, and persist only valid owned mutations", async () => {
  const store = openStore(":memory:");
  const globalStore = globalThis as typeof globalThis & { cvStore?: ReturnType<typeof openStore> };
  globalStore.cvStore = store;
  try {
    const actions = await import("../../app/job-actions.ts");
    const invalid = await actions.createJob({ operationId: randomUUID(), title: "Engineer", url: "javascript:alert(1)" });
    assert.equal(invalid.ok, false);
    assert.equal(store.listJobs({}).total, 0);
    const input = { operationId: randomUUID(), title: "Engineer", url: "https://example.com" };
    const created = await actions.createJob(input);
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error("Expected creation");
    assert.deepEqual(await actions.createJob(input), created);
    const saved = await actions.editJob({ id: created.job.id, operationId: randomUUID(), expectedVersion: 0, title: "Senior", url: input.url, description: "Details" });
    assert.equal(saved.ok, true);
    const stale = await actions.addJobActivity({ id: created.job.id, operationId: randomUUID(), expectedVersion: 0, comment: "Unsent" });
    assert.equal(stale.ok, false);
    if (!stale.ok) assert.match(stale.error, /Refresh/);
    for (const value of [null, {}, { id: created.job.id, operationId: randomUUID(), expectedVersion: 1, status: "Unknown" }, { id: created.job.id, operationId: randomUUID(), expectedVersion: 1, comment: " " }]) {
      assert.equal((await actions.addJobActivity(value)).ok, false);
    }
    const missing = await actions.addJobActivity({ id: randomUUID(), operationId: randomUUID(), expectedVersion: 0, comment: "Missing" });
    assert.equal(missing.ok, false);
    assert.equal(store.getJob(created.job.id)!.activity.length, 2);
  } finally { delete globalStore.cvStore; store.close(); }
});
