import { Suspense } from "react";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { ExternalLinkIcon, PencilIcon } from "lucide-react";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import type { JobActivity } from "@/lib/storage/job-input";
import { JobDialog, JobForm } from "@/components/jobs/forms";
import { JobStatusBadge } from "@/components/jobs/status-badge";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const eventTitles: Record<JobActivity["kind"], string> = { created: "Job created", fields: "Details changed", activity: "Application update" };

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
    <div className="flex-1 overflow-y-auto"><div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h1 className="break-words text-2xl font-semibold">{job.title}</h1><JobStatusBadge status={job.status} /></div>
          <a className="mt-1 inline-flex max-w-full items-center gap-1 text-sm text-muted-foreground hover:underline" href={job.url} target="_blank" rel="noopener noreferrer"><span className="truncate">{job.url}</span><ExternalLinkIcon className="size-3 shrink-0" /><span className="sr-only">(opens in new tab)</span></a>
        </div>
        <JobDialog key={job.id} job={fields}><Button variant="outline"><PencilIcon />Edit</Button></JobDialog>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-label="Activity timeline" className="flex flex-col gap-3">
            <h2 className="font-semibold">Activity</h2>
            <ol className="flex flex-col">
              {activity.map(event => <li key={event.id} className="relative border-l pb-6 pl-6 last:pb-0">
                <span aria-hidden className="absolute top-1.5 -left-1.5 size-3 rounded-full border-2 border-background bg-muted-foreground" />
                <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-medium">{eventTitles[event.kind]}</p><time className="text-xs text-muted-foreground" dateTime={event.created_at}>{formatDateTime(event.created_at)}</time></div>
                {event.comment && <p className="mt-2 whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-3 text-sm">{event.comment}</p>}
                {Object.entries(event.changes).length > 0 && <dl className="mt-2 flex flex-col gap-2 text-sm">
                  {Object.entries(event.changes).map(([field, change]) => <div key={field} className="min-w-0">
                    <dt className="text-xs font-medium capitalize text-muted-foreground">{field}</dt>
                    <dd className="flex flex-col gap-1">
                      {change.old !== null && <p className="whitespace-pre-wrap break-words text-muted-foreground line-through">{change.old || "(empty)"}</p>}
                      <p className="whitespace-pre-wrap break-words">{change.new || "(empty)"}</p>
                    </dd>
                  </div>)}
                </dl>}
              </li>)}
            </ol>
          </section>
          <Card><CardHeader><CardTitle>Add an update</CardTitle></CardHeader><CardContent><JobForm key={job.id} job={fields} activity /></CardContent></Card>
        </div>
        <Card className="h-fit"><CardHeader><CardTitle>Details</CardTitle></CardHeader><CardContent>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Status</dt><dd><JobStatusBadge status={job.status} /></dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Created</dt><dd><time dateTime={job.created_at}>{formatDateTime(job.created_at)}</time></dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Updated</dt><dd><time dateTime={job.updated_at}>{formatDateTime(job.updated_at)}</time></dd></div>
            <Separator />
            <div><dt className="mb-1 text-muted-foreground">Description</dt><dd className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words">{job.description || <span className="text-muted-foreground">No description.</span>}</dd></div>
          </dl>
        </CardContent></Card>
      </div>
    </div></div></>;
}
