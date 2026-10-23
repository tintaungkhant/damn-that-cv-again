"use server";

import { z } from "zod";
import { getStore } from "@/lib/db";
import { createChatService } from "@/lib/ai/chat";
import { createClaudeProvider } from "@/lib/ai/claude/provider";
import { ContextLimitError } from "@/lib/ai/provider";

const globalChat = globalThis as typeof globalThis & { cvChat?: ReturnType<typeof createChatService> };
function service() {
  return globalChat.cvChat ??= createChatService(getStore(), createClaudeProvider());
}
export async function sendChatMessage(input: unknown) {
  if (input instanceof FormData) return service().upload(input);
  // Only retry IDs or legacy text input cross this boundary. Prepared files are never trusted from a client.
  const parsed = z.union([
    z.object({ chatId: z.uuid(), retryId: z.uuid() }).strict(),
    z.object({ chatId: z.uuid(), content: z.string().trim().min(1).max(100_000) }).strict(),
  ]).safeParse(input);
  if (!parsed.success) return { error: "Invalid message. Select files in the composer or retry a saved message." };
  try { return service().send(parsed.data); }
  catch (error) { return { error: error instanceof ContextLimitError ? error.message : "Could not start the reply. Refresh this chat and retry the latest saved message." }; }
}
export async function cancelChatReply(chatId: string, messageId: string) {
  service().cancel(z.uuid().parse(chatId), z.uuid().parse(messageId));
}
export async function readChatMessages(chatId: string) {
  const id = z.uuid().parse(chatId);
  if (!getStore().getChat(id)) throw new Error("Chat not found.");
  return getStore().getMessages(id);
}

export async function downloadChatAttachment(input: unknown) {
  const parsed = z.object({ chatId: z.uuid(), attachmentId: z.uuid() }).strict().safeParse(input);
  if (!parsed.success) return { error: "Invalid attachment reference. Refresh this chat." };
  try { return getStore().downloadAttachment(parsed.data.chatId, parsed.data.attachmentId); }
  catch { return { error: "Attachment not found in this chat. Refresh and try again." }; }
}
