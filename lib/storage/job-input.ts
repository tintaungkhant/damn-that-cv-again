import { z } from "zod";

export const jobStatuses = ["Saved", "Applied", "Interviewing", "Offer", "Rejected", "Withdrawn"] as const;
export const jobStatus = z.enum(jobStatuses);
export const jobFields = z.object({
  title: z.string().trim().min(1).max(200),
  url: z.url({ protocol: /^https?$/ }).trim().max(4000),
  description: z.string().max(100_000).default(""),
});
export const createJobInput = jobFields.extend({ operationId: z.uuid(), status: jobStatus.default("Applied") }).strict();
const mutationFields = { id: z.uuid(), operationId: z.uuid(), expectedVersion: z.number().int().nonnegative() };
export const editJobInput = jobFields.extend(mutationFields).strict();
export const jobActivityInput = z.object({ ...mutationFields, status: jobStatus.optional(), comment: z.string().trim().max(100_000).default("") }).strict();
export type Job = z.infer<typeof jobFields> & { id: string; status: z.infer<typeof jobStatus>; version: number; created_at: string; updated_at: string };
export type JobActivity = { id: number; kind: "created" | "fields" | "activity"; changes: Record<string, { old: string | null; new: string }>; comment: string; created_at: string };
export const jobListInput = z.object({ search: z.string().trim().max(200).default(""), status: jobStatus.optional(), page: z.number().int().min(1).max(1_000_000).default(1) }).strict();
