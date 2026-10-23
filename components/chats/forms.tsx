"use client";

import { useActionState } from "react";
import { createChat, deleteChat } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export function NewChat({ category }: { category: "profile" | "build" }) {
  const [state, action, pending] = useActionState(
    async (_: { error: string } | null, data: FormData) => createChat(data), null,
  );
  return <form action={action} className="space-y-2">
    <input type="hidden" name="category" value={category} />
    <Label htmlFor={`${category}-title`}>New {category === "profile" ? "profile" : "CV"} chat</Label>
    <div className="flex gap-2">
      <Input id={`${category}-title`} name="title" placeholder="Chat title" required maxLength={120} disabled={pending} />
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Create"}</Button>
    </div>
    {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
  </form>;
}

export function DeleteChat({ id, category, title }: { id: string; category: "profile" | "build"; title: string }) {
  const [state, action, pending] = useActionState(
    async (_: { error: string } | null, data: FormData) => deleteChat(data), null,
  );
  const form = <form action={action} className="space-y-2">
    <input type="hidden" name="id" value={id} />
    <input type="hidden" name="confirmed" value={category === "build" ? "true" : "false"} />
    <Button type="submit" variant="destructive" disabled={pending} aria-label={`Delete ${title}`}>
      {pending ? "Deleting…" : "Delete"}
    </Button>
    {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
  </form>;
  if (category === "profile") return form;
  return <AlertDialog>
    <AlertDialogTrigger asChild><Button variant="ghost" aria-label={`Delete ${title}`}>Delete</Button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
        <AlertDialogDescription>This permanently removes this chat, its messages, and all its CV revisions.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>{form}</AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
