import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openStore } from "./store.ts";

test("create saves Applied by default with an immutable creation snapshot and deduplicates retries", () => {
  const store = openStore(":memory:");
  try {
    const input = { operationId: randomUUID(), title: "Engineer", url: "https://example.com/job", description: "Original description" };
    const job = store.createJob(input);
    assert.equal(job.status, "Applied");
    assert.equal(job.version, 0);
    assert.equal(store.createJob(input).id, job.id);
    const detail = store.getJob(job.id)!;
    assert.equal(detail.activity.length, 1);
    assert.deepEqual(detail.activity[0].changes.title, { old: null, new: "Engineer" });
    assert.equal(store.listJobs({}).items.length, 1);
    assert.throws(() => store.createJob({ ...input, title: "Different" }), /already used/);
  } finally { store.close(); }
});

test("validation rejects unsafe links, unknown statuses, blank fields, malformed and missing records", () => {
  const store = openStore(":memory:");
  try {
    const input = { operationId: randomUUID(), title: "Engineer", url: "https://example.com" };
    for (const url of ["javascript:alert(1)", "file:///secret", "ftp://example.com", "example.com", ""]) assert.throws(() => store.createJob({ ...input, url }));
    for (const status of ["Unknown", "applied", null]) assert.throws(() => store.createJob({ ...input, status }));
    assert.throws(() => store.createJob({ ...input, title: "  " }));
    assert.throws(() => store.createJob({ ...input, user_id: "other" }));
    assert.throws(() => store.getJob("bad"));
    const missing = { id: randomUUID(), operationId: randomUUID(), expectedVersion: 0 };
    assert.equal(store.getJob(missing.id), undefined);
    assert.throws(() => store.editJob({ ...input, ...missing }), /not found/);
    assert.throws(() => store.addJobActivity({ ...missing, comment: "Hello" }), /not found/);
    assert.throws(() => store.listJobs({ page: 0 }));
    assert.throws(() => store.listJobs({ status: "Unknown" }));
    for (const status of ["Saved", "Applied", "Interviewing", "Offer", "Rejected", "Withdrawn"]) {
      assert.equal(store.createJob({ ...input, operationId: randomUUID(), status }).status, status);
    }
    assert.equal(store.listJobs({}).total, 6);
  } finally { store.close(); }
});

test("stable bounded search and status pagination, ownership and history survive reopening", () => {
  const directory = mkdtempSync(join(tmpdir(), "jobs-"));
  const path = join(directory, "app.sqlite");
  let store = openStore(path);
  try {
    const ids: string[] = [];
    for (let i = 0; i < 56; i++) ids.push(store.createJob({ operationId: randomUUID(), title: `Engineer ${i}`, url: `https://example.com/${i}`, description: i === 0 ? "Unique needle %_" : "", status: i % 2 ? "Saved" : "Applied" }).id);
    const owned = ids[0];
    store.close();
    const fixture = new DatabaseSync(path);
    fixture.exec("UPDATE jobs SET updated_at = '2026-01-01T00:00:00.000Z'; INSERT INTO users VALUES ('other', 'Other');");
    fixture.prepare("UPDATE jobs SET user_id = 'other' WHERE id = ?").run(ids[55]);
    fixture.close();
    store = openStore(path);
    const first = store.listJobs({});
    const second = store.listJobs({ page: 2 });
    const third = store.listJobs({ page: 3 });
    assert.equal(first.total, 55);
    assert.deepEqual([first.items.length, second.items.length, third.items.length], [25, 25, 5]);
    assert.deepEqual([...first.items, ...second.items, ...third.items].map(job => job.id), ids.slice(0, 55).sort().reverse());
    assert.equal(store.listJobs({ search: "%_" }).items[0].id, owned);
    assert.equal(store.listJobs({ search: "UNIQUE NEEDLE", status: "Applied" }).total, 1);
    assert.equal(store.listJobs({ search: "UNIQUE NEEDLE", status: "Saved" }).total, 0);
    assert.equal(store.listJobs({ search: "/54" }).total, 1);
    assert.equal(store.listJobs({ search: "Engineer 54" }).total, 1);
    assert.equal(store.getJob(ids[55]), undefined);
    assert.throws(() => store.addJobActivity({ id: ids[55], operationId: randomUUID(), expectedVersion: 0, comment: "Wrong owner" }), /not found/);
    assert.throws(() => store.editJob({ id: ids[55], operationId: randomUUID(), expectedVersion: 0, title: "Wrong", url: "https://example.com" }), /not found/);
    const input = { id: owned, operationId: randomUUID(), expectedVersion: 0, status: "Offer", comment: "Restart comment" };
    store.addJobActivity(input);
    store.close();
    store = openStore(path);
    store.addJobActivity(input);
    assert.equal(store.getJob(owned)!.activity.length, 2);
    assert.equal(store.getJob(owned)!.activity[1].comment, "Restart comment");
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("failed event insert rolls back status, version and submission key together", () => {
  const directory = mkdtempSync(join(tmpdir(), "jobs-atomic-"));
  const path = join(directory, "app.sqlite");
  const store = openStore(path);
  const fixture = new DatabaseSync(path);
  try {
    const job = store.createJob({ operationId: randomUUID(), title: "Engineer", url: "https://example.com" });
    fixture.exec("CREATE TRIGGER fail_event BEFORE INSERT ON job_activity BEGIN SELECT RAISE(ABORT, 'Injected failure'); END;");
    const input = { id: job.id, operationId: randomUUID(), expectedVersion: 0, status: "Offer", comment: "Together" };
    assert.throws(() => store.addJobActivity(input), /Injected failure/);
    assert.equal(store.getJob(job.id)!.status, "Applied");
    assert.equal(store.getJob(job.id)!.version, 0);
    assert.equal(store.getJob(job.id)!.activity.length, 1);
    fixture.exec("DROP TRIGGER fail_event");
    store.addJobActivity(input);
    assert.equal(store.getJob(job.id)!.status, "Offer");
    assert.throws(() => fixture.exec("UPDATE job_activity SET comment = 'edited'"), /immutable/);
    assert.throws(() => fixture.exec("DELETE FROM job_activity"), /immutable/);
  } finally { fixture.close(); store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("field edits and atomic status/comment activity preserve history, reject stale writes, and ignore field no-ops", () => {
  const store = openStore(":memory:");
  try {
    const job = store.createJob({ operationId: randomUUID(), title: "Engineer", url: "https://example.com", description: "Old full description" });
    const fields = { id: job.id, operationId: randomUUID(), expectedVersion: 0, title: "Senior engineer", url: job.url, description: "New full description" };
    store.editJob(fields);
    store.editJob({ ...fields, expectedVersion: 1, operationId: randomUUID() });
    assert.equal(store.getJob(job.id)!.activity.length, 2);
    const activity = { id: job.id, operationId: randomUUID(), expectedVersion: 1, status: "Interviewing", comment: "<script>plain text</script>" };
    store.addJobActivity(activity);
    store.addJobActivity(activity);
    let detail = store.getJob(job.id)!;
    assert.equal(detail.version, 2);
    assert.equal(detail.activity.length, 3);
    assert.deepEqual(detail.activity[1].changes.description, { old: "Old full description", new: "New full description" });
    assert.deepEqual(detail.activity[2].changes.status, { old: "Applied", new: "Interviewing" });
    assert.equal(detail.activity[2].comment, "<script>plain text</script>");
    assert.throws(() => store.addJobActivity({ ...activity, operationId: randomUUID(), status: "Offer" }), /Refresh/);
    assert.throws(() => store.addJobActivity({ ...activity, operationId: randomUUID(), expectedVersion: 2, comment: "  " }), /comment|change/);
    store.addJobActivity({ id: job.id, operationId: randomUUID(), expectedVersion: 2, comment: "Comment only" });
    store.addJobActivity({ id: job.id, operationId: randomUUID(), expectedVersion: 3, status: "Offer" });
    detail = store.getJob(job.id)!;
    assert.equal(detail.title, "Senior engineer");
    assert.deepEqual(detail.activity[3].changes, {});
    assert.equal(detail.activity[4].comment, "");
    assert.equal(detail.status, "Offer");
  } finally { store.close(); }
});
