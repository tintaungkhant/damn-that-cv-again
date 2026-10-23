"use server";

import { z } from "zod";
import { getStore } from "@/lib/db";

export async function readProfileWorkspace(chatId: string) {
  return getStore().getProfileWorkspace(z.uuid().parse(chatId));
}
export async function approveProfileEdit(input: unknown) {
  const { chatId, proposalId, revisionId } = z.object({ chatId: z.uuid(), proposalId: z.uuid(), revisionId: z.string().min(1).nullable() }).strict().parse(input);
  const store = getStore();
  if (!store.getProfileProposals(chatId).some(item => item.id === proposalId && item.status === "pending")) throw new Error("Pending proposal not found in this chat.");
  const result = store.approveProfileProposal(proposalId, revisionId);
  return { approved: result.approved, workspace: store.getProfileWorkspace(chatId) };
}
export async function restoreProfile(input: unknown) {
  const { chatId, revisionId, expectedRevision } = z.object({ chatId: z.uuid(), revisionId: z.string().min(1), expectedRevision: z.string().min(1) }).strict().parse(input);
  const store = getStore();
  if (!store.getChat(chatId)) throw new Error("Chat not found.");
  try {
    store.restoreProfileRevision(revisionId, expectedRevision);
    return { restored: true, workspace: store.getProfileWorkspace(chatId) };
  } catch {
    return { restored: false, workspace: store.getProfileWorkspace(chatId) };
  }
}
