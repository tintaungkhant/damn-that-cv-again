import { z } from "zod";

const text = z.string().trim().min(1);
const claim = z.object({
  text,
  evidence: z.array(z.string().regex(/^p-[a-z0-9-]{1,64}$/)).min(1),
}).strict();
const link = z.object({ label: text.optional(), url: z.url({ protocol: /^https?$/ }) }).strict();

// Proposed Ticket 05 contract; generation remains blocked on user approval.
export const cvSchema = z.object({
  schemaVersion: z.literal(1),
  contact: z.object({
    name: text.optional(),
    headline: text.optional(),
    email: z.email().optional(),
    phone: text.optional(),
    location: text.optional(),
    links: z.array(link).min(1).optional(),
  }).strict().optional(),
  sections: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.literal("text"), title: text, content: claim }).strict(),
    z.object({ type: z.literal("list"), title: text, items: z.array(claim).min(1) }).strict(),
    z.object({
      type: z.literal("entries"),
      title: text,
      entries: z.array(z.object({
        heading: claim,
        organization: claim.optional(),
        location: claim.optional(),
        period: claim.optional(),
        description: claim.optional(),
        highlights: z.array(claim).min(1).optional(),
        links: z.array(link).min(1).optional(),
      }).strict()).min(1),
    }).strict(),
  ])).min(1),
}).strict();
export type Cv = z.infer<typeof cvSchema>;

export function exportCv(value: unknown): string {
  return JSON.stringify(cvSchema.parse(value), (key, content) => key === "evidence" ? undefined : content, 2);
}
