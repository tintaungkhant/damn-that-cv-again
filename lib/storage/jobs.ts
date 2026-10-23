import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createJobInput, editJobInput, jobActivityInput, jobListInput, type Job, type JobActivity } from "./job-input.ts";

export function migrateJobs(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE jobs (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
      url TEXT NOT NULL, description TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Saved','Applied','Interviewing','Offer','Rejected','Withdrawn')),
      version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX jobs_user_updated ON jobs(user_id, updated_at DESC, id DESC);
    CREATE TABLE job_activity (
      id INTEGER PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), kind TEXT NOT NULL,
      changes TEXT NOT NULL CHECK(json_valid(changes)), comment TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX job_activity_job ON job_activity(job_id, id);
    CREATE TABLE job_operations (
      operation_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      job_id TEXT NOT NULL REFERENCES jobs(id), request TEXT NOT NULL
    );
    CREATE TRIGGER job_activity_no_update BEFORE UPDATE ON job_activity BEGIN SELECT RAISE(ABORT, 'Activity is immutable'); END;
    CREATE TRIGGER job_activity_no_delete BEFORE DELETE ON job_activity BEGIN SELECT RAISE(ABORT, 'Activity is immutable'); END;
    PRAGMA user_version = 5;
  `);
}

export function jobStore(db: DatabaseSync, userId: string) {
  function getJob(id: string) {
    const job = db.prepare("SELECT id, title, url, description, status, version, created_at, updated_at FROM jobs WHERE id = ? AND user_id = ?").get(z.uuid().parse(id), userId) as Job | undefined;
    if (!job) return undefined;
    const activity = db.prepare("SELECT id, kind, changes, comment, created_at FROM job_activity WHERE job_id = ? ORDER BY id").all(id).map(row => ({ ...row, changes: JSON.parse(String(row.changes)) })) as JobActivity[];
    return { ...job, activity };
  }
  function repeated(operationId: string, request: string) {
    const previous = db.prepare("SELECT job_id, request, user_id FROM job_operations WHERE operation_id = ?").get(operationId);
    if (!previous) return undefined;
    if (previous.user_id !== userId || previous.request !== request) throw new Error("Submission ID already used. Refresh and try again.");
    const job = getJob(String(previous.job_id));
    if (!job) throw new Error("Job not found.");
    return job;
  }
  function transaction<T>(work: () => T): T {
    db.exec("BEGIN IMMEDIATE");
    try { const result = work(); db.exec("COMMIT"); return result; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  function record(operationId: string, jobId: string, request: string, kind: JobActivity["kind"], changes: JobActivity["changes"], comment = "") {
    db.prepare("INSERT INTO job_activity(job_id, kind, changes, comment) VALUES (?, ?, ?, ?)").run(jobId, kind, JSON.stringify(changes), comment);
    db.prepare("INSERT INTO job_operations(operation_id, user_id, job_id, request) VALUES (?, ?, ?, ?)").run(operationId, userId, jobId, request);
  }
  function mutate(value: z.infer<typeof editJobInput> | z.infer<typeof jobActivityInput>, kind: "fields" | "activity") {
    const request = JSON.stringify({ type: kind, ...value });
    return transaction(() => {
      const previous = repeated(value.operationId, request);
      if (previous) return previous;
      const job = getJob(value.id);
      if (!job) throw new Error("Job not found.");
      if (job.version !== value.expectedVersion) throw new Error("Job changed. Refresh before saving; your unsent input is preserved.");
      const changes: JobActivity["changes"] = {};
      if ("title" in value) {
        for (const field of ["title", "url", "description"] as const) {
          if (value[field] !== job[field]) changes[field] = { old: job[field], new: value[field] };
        }
      } else if (value.status && value.status !== job.status) changes.status = { old: job.status, new: value.status };
      const comment = "comment" in value ? value.comment : "";
      if (!Object.keys(changes).length && !comment) {
        if (kind === "activity") throw new Error("Write a comment or change status.");
        db.prepare("INSERT INTO job_operations(operation_id, user_id, job_id, request) VALUES (?, ?, ?, ?)").run(value.operationId, userId, job.id, request);
        return job;
      }
      db.prepare("UPDATE jobs SET title = ?, url = ?, description = ?, status = ?, version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND user_id = ?").run(
        changes.title?.new ?? job.title, changes.url?.new ?? job.url, changes.description?.new ?? job.description, changes.status?.new ?? job.status, job.id, userId,
      );
      record(value.operationId, job.id, request, kind, changes, comment);
      return getJob(job.id)!;
    });
  }
  return {
    getJob,
    editJob(input: unknown) { return mutate(editJobInput.parse(input), "fields"); },
    addJobActivity(input: unknown) { return mutate(jobActivityInput.parse(input), "activity"); },
    createJob(input: unknown): Job {
      const value = createJobInput.parse(input);
      const request = JSON.stringify({ type: "create", ...value });
      return transaction(() => {
        const previous = repeated(value.operationId, request);
        if (previous) return previous;
        const id = randomUUID();
        db.prepare("INSERT INTO jobs(id, user_id, title, url, description, status) VALUES (?, ?, ?, ?, ?, ?)").run(id, userId, value.title, value.url, value.description, value.status);
        const changes = Object.fromEntries((["title", "url", "description", "status"] as const).map(field => [field, { old: null, new: value[field] }]));
        record(value.operationId, id, request, "created", changes);
        return getJob(id)!;
      });
    },
    listJobs(input: unknown) {
      const value = jobListInput.parse(input);
      const where = "user_id = ? AND (? IS NULL OR status = ?) AND (? = '' OR instr(lower(title), lower(?)) > 0 OR instr(lower(url), lower(?)) > 0 OR instr(lower(description), lower(?)) > 0)";
      const args = [userId, value.status ?? null, value.status ?? null, value.search, value.search, value.search, value.search];
      const total = Number(db.prepare(`SELECT count(*) AS total FROM jobs WHERE ${where}`).get(...args)!.total);
      const items = db.prepare(`SELECT id, title, url, description, status, version, created_at, updated_at FROM jobs WHERE ${where} ORDER BY updated_at DESC, id DESC LIMIT 25 OFFSET ?`).all(...args, (value.page - 1) * 25) as Job[];
      return { items: items.map(item => ({ ...item })), total, page: value.page };
    },
  };
}
