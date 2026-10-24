import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { ChevronRightIcon, FileTextIcon, MessageCircleIcon, UserRoundIcon } from "lucide-react";
import { getStore } from "@/lib/db";
import { NewChatDialog } from "@/components/chats/forms";
import { chatCategories } from "@/components/chats/categories";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardAction, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export default function Home() {
  return <>
    <PageHeader trail={[{ label: "Home" }]} />
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-4 sm:p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your career, in focus</h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>1. Confirm your profile</CardTitle>
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
              <CardAction><FileTextIcon className="size-5 text-muted-foreground" /></CardAction>
            </CardHeader>
            <CardFooter className="mt-auto">
              <NewChatDialog category="build"><Button variant="outline">Start Build CV chat</Button></NewChatDialog>
            </CardFooter>
          </Card>
          <Card className="sm:col-span-2">
            <CardHeader>
              <CardTitle>Ask anything about your career</CardTitle>
              <CardAction><MessageCircleIcon className="size-5 text-muted-foreground" /></CardAction>
            </CardHeader>
            <CardFooter className="mt-auto">
              <NewChatDialog category="general"><Button variant="outline">Start general chat</Button></NewChatDialog>
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
    <EmptyHeader><EmptyTitle>No chats yet</EmptyTitle></EmptyHeader>
  </Empty>;
  return <ItemGroup>
    {chats.map(chat => { const { badge, icon: Icon } = chatCategories[chat.category]; return <Item key={chat.id} variant="outline" asChild>
      <Link href={`/chats/${chat.id}`}>
        <ItemMedia variant="icon"><Icon /></ItemMedia>
        <ItemContent>
          <ItemTitle>{chat.title}</ItemTitle>
          <ItemDescription>Started {new Date(chat.created_at).toLocaleDateString("en", { dateStyle: "medium" })}</ItemDescription>
        </ItemContent>
        <ItemActions><Badge variant="secondary">{badge}</Badge><ChevronRightIcon className="size-4" /></ItemActions>
      </Link>
    </Item>; })}
  </ItemGroup>;
}
