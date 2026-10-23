import { z } from "zod";

const blockId = z.string().regex(/^p-[a-z0-9-]{1,64}$/);
const content = z.string().trim().min(1).max(100_000).refine(value => !value.includes("<!-- id:"), "Content must not contain block markers.");
export const profileProposal = z.object({
  baseRevision: z.string().min(1).nullable(),
  summary: z.string().trim().min(1).max(2000),
  operations: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.literal("replace"), id: blockId, content }).strict(),
    z.object({ type: z.literal("insert"), id: blockId, afterId: blockId.nullable(), content }).strict(),
    z.object({ type: z.literal("delete"), id: blockId }).strict(),
  ])).min(1).max(100),
}).strict();
export type ProfileProposal = z.infer<typeof profileProposal>;
export type SavedProposal = { id: string; value: ProfileProposal; status: "pending" | "approved" | "superseded" };
export type ProfileRevision = { id: string; markdown: string };
export const emptyProfile = "<!-- id:p-open-questions -->\n## Open questions\n\nNone.";
type Block = { id: string; content: string };
// This app-specific block protocol has no general Markdown editing dependency.
export function parseProfile(markdown: string): Block[] {
  const parts = markdown.trim().split(/^<!-- id:(p-[a-z0-9-]{1,64}) -->\r?\n/gm);
  if (parts[0] || parts.length < 3) throw new Error("Profile must use stable block markers.");
  const blocks: Block[] = [];
  for (let index = 1; index < parts.length; index += 2) {
    const block = { id: parts[index], content: content.parse(parts[index + 1]) };
    if (blocks.some(item => item.id === block.id)) throw new Error("Duplicate profile block ID.");
    blocks.push(block);
  }
  const questions = blocks.find(item => item.id === "p-open-questions");
  if (!questions || !/^## Open questions(?:\n|$)/.test(questions.content)) throw new Error("Keep the Open questions section.");
  if (blocks.filter(item => /^## Open questions(?:\n|$)/.test(item.content)).length !== 1) throw new Error("Use one Open questions section.");
  return blocks;
}
export function applyProfileOperations(markdown: string, proposal: ProfileProposal, usedIds: Set<string>) {
  const blocks = parseProfile(markdown);
  for (const operation of proposal.operations) {
    const index = blocks.findIndex(block => block.id === operation.id);
    if (operation.type === "insert") {
      if (index !== -1 || usedIds.has(operation.id)) throw new Error("Profile block IDs cannot be reused.");
      const anchor = operation.afterId === null ? -1 : blocks.findIndex(block => block.id === operation.afterId);
      if (operation.afterId !== null && anchor === -1) throw new Error("Insertion anchor not found.");
      blocks.splice(anchor + 1, 0, { id: operation.id, content: operation.content });
      usedIds.add(operation.id);
    } else {
      if (index === -1) throw new Error("Profile block not found.");
      if (operation.type === "replace") blocks[index].content = operation.content;
      else blocks.splice(index, 1);
    }
  }
  const result = blocks.map(block => `<!-- id:${block.id} -->\n${block.content}`).join("\n\n");
  parseProfile(result);
  return result;
}
export function canReapply(base: string, latest: string, proposal: ProfileProposal) {
  const original = new Map(parseProfile(base).map(block => [block.id, block.content]));
  const current = new Map(parseProfile(latest).map(block => [block.id, block.content]));
  const inserted = new Set<string>();
  for (const operation of proposal.operations) {
    const target = operation.type === "insert" ? operation.afterId : operation.id;
    if (target !== null && !inserted.has(target) && (original.get(target) === undefined || original.get(target) !== current.get(target))) return false;
    if (operation.type === "insert") inserted.add(operation.id);
  }
  return true;
}
