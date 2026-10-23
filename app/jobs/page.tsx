import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { getStore } from "@/lib/db";
import { jobListInput, jobStatuses } from "@/lib/storage/job-input";
import { JobForm } from "@/components/jobs/forms";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemTitle } from "@/components/ui/item";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";

type Query = Promise<Record<string, string | string[] | undefined>>;
export default function JobsPage({ searchParams }: { searchParams: Query }) {
  return <><PageHeader trail={[{ label: "Home", href: "/" }, { label: "Jobs" }]} />
    <div className="flex-1 overflow-y-auto"><div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <div><h1 className="text-2xl font-semibold">Jobs</h1><p className="text-sm text-muted-foreground">Track applications and updates. Saved links are never fetched.</p></div>
      <Card><CardHeader><CardTitle>Create job</CardTitle></CardHeader><CardContent><JobForm /></CardContent></Card>
      <Suspense fallback={<Skeleton className="h-64" />}><Jobs searchParams={searchParams} /></Suspense>
    </div></div></>;
}

async function Jobs({ searchParams }: { searchParams: Query }) {
  await io();
  const query = await searchParams;
  const parsed = jobListInput.safeParse({ search: query.search ?? "", status: query.status || undefined, page: query.page === undefined ? 1 : Number(query.page) });
  if (!parsed.success) return <p role="alert">Invalid search, status, or page. <Link href="/jobs" className="underline">Reset filters</Link></p>;
  const filters = parsed.data;
  const result = getStore().listJobs(filters);
  function pageHref(page: number) {
    const params = new URLSearchParams({ search: filters.search, page: String(page) });
    if (filters.status) params.set("status", filters.status);
    return `/jobs?${params}`;
  }
  return <section className="flex flex-col gap-4" aria-label="Saved jobs">
    <form action="/jobs" className="flex flex-wrap items-end gap-3">
      <Field className="min-w-48 flex-1"><FieldLabel htmlFor="job-search">Search jobs</FieldLabel><Input id="job-search" name="search" defaultValue={filters.search} maxLength={200} /></Field>
      <Field className="w-auto"><FieldLabel htmlFor="job-filter">Status</FieldLabel><NativeSelect id="job-filter" name="status" defaultValue={filters.status ?? ""}><NativeSelectOption value="">All statuses</NativeSelectOption>{jobStatuses.map(status => <NativeSelectOption key={status}>{status}</NativeSelectOption>)}</NativeSelect></Field>
      <Button type="submit" variant="outline">Search</Button>
    </form>
    <p className="text-sm text-muted-foreground">{result.total} jobs · Page {result.page} of {Math.max(1, Math.ceil(result.total / 25))}</p>
    {result.items.length === 0 && <Empty className="border"><EmptyHeader><EmptyTitle>No jobs found</EmptyTitle><EmptyDescription>Create a job above or change your filters.</EmptyDescription></EmptyHeader></Empty>}
    {result.items.map(job => <Item key={job.id} variant="outline"><ItemContent>
      <ItemTitle><Link href={`/jobs/${job.id}`} className="underline">{job.title}</Link><Badge variant="secondary">{job.status}</Badge></ItemTitle>
      <a href={job.url} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-muted-foreground underline">{job.url}</a>
      <p className="text-xs text-muted-foreground">Updated <time dateTime={job.updated_at}>{job.updated_at}</time></p>
    </ItemContent></Item>)}
    <Pagination><PaginationContent>
      {result.page > 1 && <PaginationItem><PaginationPrevious href={pageHref(result.page - 1)} /></PaginationItem>}
      {result.page * 25 < result.total && <PaginationItem><PaginationNext href={pageHref(result.page + 1)} /></PaginationItem>}
    </PaginationContent></Pagination>
  </section>;
}
