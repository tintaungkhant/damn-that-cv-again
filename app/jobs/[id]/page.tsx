import { Suspense } from "react";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { JobForm } from "@/components/jobs/forms";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<Skeleton className="m-8 h-64" />}><Detail params={params} /></Suspense>;
}
async function Detail({ params }: { params: Promise<{ id: string }> }) {
  await io();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const job = getStore().getJob(id.data);
  if (!job) notFound();
  const { activity, ...fields } = job;
  return <><PageHeader trail={[{ label: "Home", href: "/" }, { label: "Jobs", href: "/jobs" }, { label: job.title }]} />
    <div className="flex-1 overflow-y-auto"><div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <div><h1 className="break-words text-2xl font-semibold">{job.title}</h1><Badge variant="secondary">{job.status}</Badge><p className="mt-2 text-xs text-muted-foreground">Created {job.created_at} · Updated {job.updated_at}</p><a className="break-all text-sm underline" href={job.url} target="_blank" rel="noopener noreferrer">{job.url}</a></div>
      <Card><CardHeader><CardTitle>Job details</CardTitle></CardHeader><CardContent><JobForm key={job.id} job={fields} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Add an update</CardTitle></CardHeader><CardContent><JobForm key={job.id} job={fields} activity /></CardContent></Card>
      <section aria-label="Activity timeline" className="flex flex-col gap-4"><h2 className="text-xl font-semibold">Activity</h2>
        {activity.map(event => <Card key={event.id}><CardHeader><CardTitle>{event.kind === "created" ? "Job created" : event.kind === "fields" ? "Details changed" : "Application update"}</CardTitle><time className="text-xs text-muted-foreground" dateTime={event.created_at}>{event.created_at}</time></CardHeader><CardContent className="flex flex-col gap-3">
          {Object.entries(event.changes).map(([field, change]) => <div key={field} className="min-w-0 text-sm"><p className="font-medium capitalize">{field}</p>{change.old !== null && <div><p className="text-xs text-muted-foreground">Previous</p><p className="whitespace-pre-wrap break-words">{change.old || "(empty)"}</p></div>}<p className="text-xs text-muted-foreground">{change.old === null ? "Initial value" : "New"}</p><p className="whitespace-pre-wrap break-words">{change.new || "(empty)"}</p></div>)}
          {event.comment && <div><p className="text-xs text-muted-foreground">Comment</p><p className="whitespace-pre-wrap break-words text-sm">{event.comment}</p></div>}
        </CardContent></Card>)}
      </section>
    </div></div></>;
}
