import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { ChevronRightIcon, FileTextIcon, UserRoundIcon } from "lucide-react";
import { getStore } from "@/lib/db";
import { NewChatDialog } from "@/components/chats/forms";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export default function Home() {
  return <>
    <PageHeader trail={[{ label: "Home" }]} />
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-4 sm:p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your career, in focus</h1>
          <p className="mt-1 text-sm text-muted-foreground">Build one confirmed career profile, then tailor a CV for each opportunity.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>1. Confirm your profile</CardTitle>
              <CardDescription>Paste rough career notes. The assistant proposes changes and you approve what gets saved.</CardDescription>
              <CardAction><UserRoundIcon className="size-5 text-muted-foreground" /></CardAction>
            </CardHeader>
            <CardFooter className="mt-auto gap-2">
              <NewChatDialog category="profile"><Button>Start profile chat</Button></NewChatDialog>
              <Button variant="ghost" asChild><Link href="/profile">View profile</Link></Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>2. Tailor a CV</CardTitle>
              <CardDescription>Save a job description and get a draft built only from confirmed facts. Accept it when it reads right.</CardDescription>
              <CardAction><FileTextIcon className="size-5 text-muted-foreground" /></CardAction>
            </CardHeader>
            <CardFooter className="mt-auto">
              <NewChatDialog category="build"><Button variant="outline">Start Build CV chat</Button></NewChatDialog>
            </CardFooter>
          </Card>
        </div>
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Recent chats</h2>
          <Suspense fallback={<div className="flex flex-col gap-2">{[0, 1, 2].map(key => <Skeleton key={key} className="h-16" />)}</div>}>
            <RecentChats />
          </Suspense>
        </section>
      </div>
    </div>
  </>;
}

async function RecentChats() {
  await io();
  const chats = getStore().listChats({ limit: 8 }).items;
  if (chats.length === 0) return <Empty className="border border-dashed">
    <EmptyHeader><EmptyTitle>No chats yet</EmptyTitle><EmptyDescription>Start with a profile chat so later CVs have confirmed facts to draw on.</EmptyDescription></EmptyHeader>
  </Empty>;
  return <ItemGroup>
    {chats.map(chat => <Item key={chat.id} variant="outline" asChild>
      <Link href={`/chats/${chat.id}`}>
        <ItemMedia variant="icon">{chat.category === "build" ? <FileTextIcon /> : <UserRoundIcon />}</ItemMedia>
        <ItemContent>
          <ItemTitle>{chat.title}</ItemTitle>
          <ItemDescription>Started {new Date(chat.created_at).toLocaleDateString("en", { dateStyle: "medium" })}</ItemDescription>
        </ItemContent>
        <ItemActions><Badge variant="secondary">{chat.category === "build" ? "Build CV" : "Profile"}</Badge><ChevronRightIcon className="size-4" /></ItemActions>
      </Link>
    </Item>)}
  </ItemGroup>;
}
