import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { ExternalLinkIcon, PlusIcon, SearchIcon } from "lucide-react";
import { getStore } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { jobListInput, jobStatuses } from "@/lib/storage/job-input";
import { JobDialog } from "@/components/jobs/forms";
import { JobStatusBadge } from "@/components/jobs/status-badge";
import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyTitle, EmptyContent } from "@/components/ui/empty";

type Query = Promise<Record<string, string | string[] | undefined>>;
export default function JobsPage({ searchParams }: { searchParams: Query }) {
  return <><PageHeader trail={[{ label: "Home", href: "/" }, { label: "Jobs" }]} />
    <div className="flex-1 overflow-y-auto"><div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <JobDialog><Button><PlusIcon />New job</Button></JobDialog>
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}><Jobs searchParams={searchParams} /></Suspense>
    </div></div></>;
}

async function Jobs({ searchParams }: { searchParams: Query }) {
  await io();
  const query = await searchParams;
  const parsed = jobListInput.safeParse({ search: query.search ?? "", status: query.status || undefined, page: query.page === undefined ? 1 : Number(query.page) });
  if (!parsed.success) return <p role="alert">Invalid search, status, or page. <Link href="/jobs" className="underline">Reset filters</Link></p>;
  const filters = parsed.data;
  const result = getStore().listJobs(filters);
  const filtered = !!filters.search || !!filters.status;
  function pageHref(page: number) {
    const params = new URLSearchParams({ search: filters.search, page: String(page) });
    if (filters.status) params.set("status", filters.status);
    return `/jobs?${params}`;
  }
  return <section className="flex flex-col gap-4" aria-label="Saved jobs">
    <form action="/jobs" className="flex flex-wrap items-center gap-2">
      <InputGroup className="w-full sm:max-w-sm">
        <InputGroupAddon><SearchIcon /></InputGroupAddon>
        <InputGroupInput name="search" aria-label="Search jobs" placeholder="Search title, URL, description" defaultValue={filters.search} maxLength={200} />
      </InputGroup>
      <NativeSelect name="status" aria-label="Status" defaultValue={filters.status ?? ""}><NativeSelectOption value="">All statuses</NativeSelectOption>{jobStatuses.map(status => <NativeSelectOption key={status}>{status}</NativeSelectOption>)}</NativeSelect>
      <Button type="submit" variant="outline">Apply</Button>
      {filtered && <Button variant="ghost" asChild><Link href="/jobs">Reset</Link></Button>}
    </form>
    {result.items.length === 0 ? <Empty className="border">
      <EmptyHeader><EmptyTitle>{filtered ? "No matching jobs" : "No jobs yet"}</EmptyTitle></EmptyHeader>
      {!filtered && <EmptyContent><JobDialog><Button><PlusIcon />New job</Button></JobDialog></EmptyContent>}
    </Empty> : <div className="rounded-lg border">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead className="hidden md:table-cell">Link</TableHead><TableHead className="text-right">Updated</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {result.items.map(job => <TableRow key={job.id}>
            <TableCell className="max-w-64 truncate font-medium"><Link href={`/jobs/${job.id}`} className="hover:underline">{job.title}</Link></TableCell>
            <TableCell><JobStatusBadge status={job.status} /></TableCell>
            <TableCell className="hidden max-w-64 md:table-cell"><a href={job.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-muted-foreground hover:underline"><span className="truncate">{new URL(job.url).host}</span><ExternalLinkIcon className="size-3 shrink-0" /><span className="sr-only">(opens in new tab)</span></a></TableCell>
            <TableCell className="text-right text-muted-foreground"><time dateTime={job.updated_at}>{formatDateTime(job.updated_at)}</time></TableCell>
          </TableRow>)}
        </TableBody>
      </Table>
    </div>}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">{result.total} jobs · Page {result.page} of {Math.max(1, Math.ceil(result.total / 25))}</p>
      <div><ListPagination page={result.page} total={result.total} href={pageHref} /></div>
    </div>
  </section>;
}
