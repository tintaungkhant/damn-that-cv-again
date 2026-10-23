import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export default function ChatNotFound() {
  return <>
    <PageHeader trail={[{ label: "Home", href: "/" }, { label: "Chat unavailable" }]} />
    <Empty className="flex-1">
      <EmptyHeader><EmptyTitle>Chat unavailable</EmptyTitle><EmptyDescription>This chat was deleted or the link is wrong.</EmptyDescription></EmptyHeader>
      <EmptyContent><Button asChild><Link href="/">Back to home</Link></Button></EmptyContent>
    </Empty>
  </>;
}
