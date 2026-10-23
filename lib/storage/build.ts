import { z } from "zod";
import { cvSchema, type Cv } from "./cv.ts";
import { parseProfile } from "./profile.ts";

export const buildSettings = z.object({
  jobDescription: z.string().trim().max(100_000),
  targetRole: z.string().trim().max(200),
  targetCompany: z.string().trim().max(200),
  projectLimit: z.number().int().nonnegative(),
}).strict();
export type BuildSettings = z.infer<typeof buildSettings>;
export const defaultBuildSettings: BuildSettings = { jobDescription: "", targetRole: "", targetCompany: "", projectLimit: 5 };
export const cvRevisionAction = z.object({
  chatId: z.uuid(), revisionId: z.string().min(1),
  action: z.enum(["accept", "discard", "restore"]),
  expectedAcceptedId: z.string().min(1).nullable(),
}).strict();
export type CvRevision = { id: string; content: Cv; status: "draft" | "accepted" | "discarded"; profileRevision: string | null; explanation: string };

export function validateCvEvidence(value: unknown, profile: string): Cv {
  const cv = cvSchema.parse(value);
  const ids = new Set(parseProfile(profile).filter(block => block.id !== "p-open-questions").map(block => block.id));
  const claims = cv.sections.flatMap(section => {
    if (section.type === "text") return [section.content];
    if (section.type === "list") return section.items;
    return section.entries.flatMap(entry => [entry.heading, entry.organization, entry.location, entry.period, entry.description, ...(entry.highlights ?? [])].filter(item => item !== undefined));
  });
  if (claims.some(claim => claim.evidence.some(id => !ids.has(id)))) throw new Error("CV evidence must reference confirmed facts, not open questions.");
  return cv;
}
