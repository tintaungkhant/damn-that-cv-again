import type { Job } from "@/lib/storage/job-input";
import { Badge } from "@/components/ui/badge";

const variants = { Saved: "outline", Applied: "secondary", Interviewing: "secondary", Offer: "default", Rejected: "destructive", Withdrawn: "outline" } as const;

export function JobStatusBadge({ status }: { status: Job["status"] }) {
  return <Badge variant={variants[status]}>{status}</Badge>;
}
