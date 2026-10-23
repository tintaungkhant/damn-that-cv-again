"use server";

import { z } from "zod";
import { getStore } from "../lib/db.ts";
import { createJobInput, editJobInput, jobActivityInput, type Job } from "../lib/storage/job-input.ts";

type Result = { ok: true; job: Job } | { ok: false; error: string };
function failure(error: unknown): Result {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues.map(issue => `${issue.path.join(".") || "Input"}: ${issue.message}`).join("; ") };
  return { ok: false, error: error instanceof Error ? error.message : "Could not save. Try again." };
}

export async function createJob(input: unknown): Promise<Result> {
  try { return { ok: true, job: getStore().createJob(createJobInput.parse(input)) }; }
  catch (error) { return failure(error); }
}
export async function editJob(input: unknown): Promise<Result> {
  try { return { ok: true, job: getStore().editJob(editJobInput.parse(input)) }; }
  catch (error) { return failure(error); }
}
export async function addJobActivity(input: unknown): Promise<Result> {
  try { return { ok: true, job: getStore().addJobActivity(jobActivityInput.parse(input)) }; }
  catch (error) { return failure(error); }
}

