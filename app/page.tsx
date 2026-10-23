import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { Conversation } from "@/components/chats/conversation";
import { NewChat, DeleteChat } from "@/components/chats/forms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Search = Promise<{ chat?: string | string[] }>;
export default function Home({ searchParams }: { searchParams: Search }) {
  return <Suspense fallback={<p className="p-8 text-muted-foreground">Loading your chats…</p>}>
    <Workspace searchParams={searchParams} />
  </Suspense>;
}

async function Workspace({ searchParams }: { searchParams: Search }) {
  await io();
  const params = await searchParams;
  const store = getStore();
  const chats = store.listChats();
  const selectedId = z.uuid().safeParse(params.chat);
  const active = selectedId.success ? store.getChat(selectedId.data) : undefined;
  return <main className="mx-auto w-full max-w-[1800px] space-y-8 p-4 sm:p-8">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-semibold tracking-tight">Your career, in focus</h1>
        <p className="mt-1 text-sm text-muted-foreground">Career notes and tailored CVs, together.</p></div>
      <Badge variant="secondary">Personal workspace</Badge>
    </header>
    <div className="grid gap-6 md:grid-cols-[340px_1fr]">
      <aside aria-label="Chats" className="space-y-6">
        {(["profile", "build"] as const).map(category => <Card key={category}>
          <CardHeader><CardTitle>{category === "profile" ? "Profile chats" : "Build CV chats"}</CardTitle>
            <CardDescription>{category === "profile" ? "Keep your career history together." : "One conversation for each opportunity."}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <NewChat category={category} /><Separator />
            <ul className="space-y-2">
              {chats.filter(chat => chat.category === category).map(chat => <li key={chat.id} className="flex items-center gap-1">
                <Button asChild variant={active?.id === chat.id ? "secondary" : "ghost"} className="min-w-0 flex-1 justify-start">
                  <Link href={`/?chat=${chat.id}`} aria-current={active?.id === chat.id ? "page" : undefined}><span className="truncate">{chat.title}</span></Link>
                </Button>
                <DeleteChat id={chat.id} category={category} title={chat.title} />
              </li>)}
            </ul>
            {!chats.some(chat => chat.category === category) && <p className="text-sm text-muted-foreground">No chats yet.</p>}
          </CardContent>
        </Card>)}
      </aside>
      <section aria-label="Active chat" className="min-w-0">
        <Card className="min-h-96">
          <CardHeader><CardTitle>{active?.title ?? (params.chat ? "Chat unavailable" : "A place for your next chapter")}</CardTitle>
            <CardDescription>{active ? (active.category === "profile" ? "Profile chat" : "Build CV chat") : "Create a chat or open one from your list."}</CardDescription></CardHeader>
          <CardContent className="space-y-6">
            {active && <>
              <Conversation key={active.id} chatId={active.id} initialMessages={store.getMessages(active.id)} initialProfile={store.getProfileWorkspace(active.id)} initialCv={active.category === "build" ? store.getCvWorkspace(active.id) : undefined} />
            </>}
          </CardContent>
        </Card>
      </section>
    </div>
  </main>;
}
