"use server";

import { z } from "zod";
import { getStore } from "@/lib/db";
import { buildSettings, cvRevisionAction } from "@/lib/storage/build";

export async function readCvWorkspace(chatId: string) {
  return getStore().getCvWorkspace(z.uuid().parse(chatId));
}
export async function saveBuildSettings(input: unknown) {
  const parsed = z.object({ chatId: z.uuid(), settings: buildSettings, expectedVersion: z.number().int().nonnegative() }).strict().parse(input);
  const store = getStore();
  store.updateBuildSettings(parsed.chatId, parsed.settings, parsed.expectedVersion);
  return store.getCvWorkspace(parsed.chatId);
}
export async function changeCvRevision(input: unknown) {
  const parsed = cvRevisionAction.parse(input);
  const store = getStore();
  store.changeCvRevision(parsed);
  return store.getCvWorkspace(parsed.chatId);
}
