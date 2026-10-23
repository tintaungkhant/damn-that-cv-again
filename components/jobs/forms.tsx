"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createJob, editJob, addJobActivity } from "@/app/job-actions";
import { jobStatuses, type Job } from "@/lib/storage/job-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldSet } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function StatusOptions() {
  return jobStatuses.map(status => <NativeSelectOption key={status} value={status}>{status}</NativeSelectOption>);
}

export function JobForm({ job, activity = false, onSaved }: { job?: Job; activity?: boolean; onSaved?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [version, setVersion] = useState(job?.version ?? 0);
  const operation = useRef<{ fingerprint: string; id: string; expectedVersion: number } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // A refresh updates the version without resetting uncontrolled, unsent fields.
  const expectedVersion = Math.max(version, job?.version ?? 0);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");
    const payload = activity
      ? { id: job!.id, expectedVersion, status: text("status"), comment: text("comment") }
      : { ...(job ? { id: job.id, expectedVersion } : { status: text("status") }), title: text("title"), url: text("url"), description: text("description") };
    const fingerprint = JSON.stringify({ ...payload, expectedVersion: undefined });
    if (operation.current?.fingerprint !== fingerprint) operation.current = { fingerprint, id: crypto.randomUUID(), expectedVersion };
    const input = { ...payload, ...(job ? { expectedVersion: operation.current.expectedVersion } : {}), operationId: operation.current.id };
    setError("");
    setNotice("");
    startTransition(async () => {
      try {
        const result = await (activity ? addJobActivity(input) : job ? editJob(input) : createJob(input));
        if (!result.ok) { operation.current = null; setError(result.error); return; }
        operation.current = null;
        setVersion(result.job.version);
        if (!job) { router.push(`/jobs/${result.job.id}`); router.refresh(); return; }
        if (activity && formRef.current) {
          (formRef.current.elements.namedItem("comment") as HTMLTextAreaElement).value = "";
          setSelectedStatus(null);
        }
        setNotice("Saved.");
        router.refresh();
        onSaved?.();
      } catch { setError("Could not confirm the save. Retry unchanged input to avoid duplicates."); }
    });
  }
  return <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4">
    <FieldSet disabled={pending} className="min-w-0">
      {!activity && <>
        <Field><FieldLabel htmlFor={job ? "edit-title" : "new-title"}>Title</FieldLabel><Input id={job ? "edit-title" : "new-title"} name="title" required maxLength={200} defaultValue={job?.title} /></Field>
        <Field><FieldLabel htmlFor={job ? "edit-url" : "new-url"}>Job URL</FieldLabel><Input id={job ? "edit-url" : "new-url"} name="url" type="url" required maxLength={4000} defaultValue={job?.url} placeholder="https://…" /></Field>
        <Field><FieldLabel htmlFor={job ? "edit-description" : "new-description"}>Description (optional)</FieldLabel><Textarea id={job ? "edit-description" : "new-description"} name="description" maxLength={100_000} defaultValue={job?.description} /></Field>
      </>}
      {(activity || !job) && <Field><FieldLabel htmlFor={activity ? "activity-status" : "new-status"}>Status</FieldLabel><NativeSelect id={activity ? "activity-status" : "new-status"} name="status" value={selectedStatus ?? job?.status ?? "Applied"} onChange={event => setSelectedStatus(event.target.value)}><StatusOptions /></NativeSelect></Field>}
      {activity && <Field><FieldLabel htmlFor="job-comment">Comment (optional when changing status)</FieldLabel><Textarea id="job-comment" name="comment" maxLength={100_000} placeholder="Add a plain-text update" /></Field>}
      <Button type="submit" className="self-start">{pending ? "Saving…" : activity ? "Post update" : job ? "Save fields" : "Create job"}</Button>
    </FieldSet>
    {error && <div role="alert" className="text-sm text-destructive"><p>{error}</p><Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => router.refresh()}>Refresh saved job (keep input)</Button></div>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
  </form>;
}

// Edit stays open on errors so unsent input survives stale-write refreshes.
export function JobDialog({ job, children }: { job?: Job; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>{children}</DialogTrigger>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{job ? "Edit job" : "New job"}</DialogTitle>
        <DialogDescription>{job ? "Changes are recorded in the activity history." : "Saved links are never fetched."}</DialogDescription>
      </DialogHeader>
      <JobForm job={job} onSaved={() => { setOpen(false); toast.success("Job saved."); }} />
    </DialogContent>
  </Dialog>;
}
