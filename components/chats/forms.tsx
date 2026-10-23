"use client";

import { useActionState } from "react";
import { createChat, deleteChat } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@/components/ui/field";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

type Category = "profile" | "build";
const categories = {
  profile: { title: "Career profile chat", description: "Turn rough notes into a confirmed, shared career profile." },
  build: { title: "Build CV chat", description: "Tailor a CV to one job description." },
};

export function NewChatDialog({ category = "profile", children }: { category?: Category; children: React.ReactNode }) {
  const [state, action, pending] = useActionState(
    async (_: { error: string } | null, data: FormData) => createChat(data), null,
  );
  return <Dialog>
    <DialogTrigger asChild>{children}</DialogTrigger>
    <DialogContent>
      <form action={action} className="grid gap-6">
        <DialogHeader>
          <DialogTitle>New chat</DialogTitle>
          <DialogDescription>Choose what this conversation is for. You can keep as many chats as you like.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <FieldSet>
            <FieldLegend variant="label">Purpose</FieldLegend>
            <RadioGroup name="category" defaultValue={category} disabled={pending}>
              {(["profile", "build"] as const).map(value => <FieldLabel key={value} htmlFor={`new-chat-${value}`}>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>{categories[value].title}</FieldTitle>
                    <FieldDescription>{categories[value].description}</FieldDescription>
                  </FieldContent>
                  <RadioGroupItem value={value} id={`new-chat-${value}`} />
                </Field>
              </FieldLabel>)}
            </RadioGroup>
          </FieldSet>
          <Field data-invalid={!!state?.error || undefined}>
            <FieldLabel htmlFor="new-chat-title">Title</FieldLabel>
            <Input id="new-chat-title" name="title" placeholder="For example: Senior designer at Acme" required maxLength={120} disabled={pending} aria-invalid={!!state?.error || undefined} />
            {state?.error && <FieldError>{state.error}</FieldError>}
          </Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline" disabled={pending}>Cancel</Button></DialogClose>
          <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create chat"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

export function DeleteChatDialog({ id, category, title, open, onOpenChange }: {
  id: string; category: Category; title: string; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const [state, action, pending] = useActionState(
    async (_: { error: string } | null, data: FormData) => deleteChat(data), null,
  );
  return <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
        <AlertDialogDescription>{category === "build"
          ? "This permanently removes this chat, its messages, and all its CV revisions."
          : "This permanently removes this chat and its messages. Your saved career profile and its history stay."}</AlertDialogDescription>
      </AlertDialogHeader>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="confirmed" value={category === "build" ? "true" : "false"} />
          <Button type="submit" variant="destructive" disabled={pending}>{pending ? "Deleting…" : "Delete chat"}</Button>
        </form>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
