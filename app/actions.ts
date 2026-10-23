"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db";
import { chatInput } from "@/lib/storage/store";

export async function createChat(formData: FormData) {
  const input = chatInput.safeParse({ category: formData.get("category"), title: formData.get("title") });
  if (!input.success) return { error: "Choose a category and enter a title of 1 to 120 characters." };
  let id: string;
  try {
    id = getStore().createChat(input.data).id;
  } catch {
    return { error: "Could not save your chat. Please try again." };
  }
  revalidatePath("/", "layout");
  redirect(`/chats/${id}`);
}

export async function deleteChat(formData: FormData) {
  const input = z.object({
    id: z.uuid(), confirmed: z.enum(["true", "false"]),
    returnTo: z.enum(["/", "/chats?category=build", "/chats?category=profile"]).default("/"),
  }).safeParse({
    id: formData.get("id"), confirmed: formData.get("confirmed"), returnTo: formData.get("returnTo") ?? undefined,
  });
  if (!input.success) return { error: "Invalid deletion request. Refresh and try again." };
  try {
    getStore().deleteChat(input.data.id, input.data.confirmed === "true");
  } catch {
    return { error: "Could not delete the chat. Confirm build chat deletion or refresh and try again." };
  }
  revalidatePath("/", "layout");
  redirect(input.data.returnTo);
}

