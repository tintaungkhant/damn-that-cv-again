"use server";

import { z } from "zod";
import { getStore } from "@/lib/db";
import { createChatService } from "@/lib/ai/chat";
import { createClaudeProvider } from "@/lib/ai/claude/provider";

const globalChat = globalThis as typeof globalThis & { cvChat?: ReturnType<typeof createChatService> };
function service() {
  return globalChat.cvChat ??= createChatService(getStore(), createClaudeProvider());
}
export async function sendChatMessage(input: unknown) {
  return service().send(input);
}
export async function cancelChatReply(chatId: string, messageId: string) {
  service().cancel(z.uuid().parse(chatId), z.uuid().parse(messageId));
}
export async function readChatMessages(chatId: string) {
  const id = z.uuid().parse(chatId);
  if (!getStore().getChat(id)) throw new Error("Chat not found.");
  return getStore().getMessages(id);
}
