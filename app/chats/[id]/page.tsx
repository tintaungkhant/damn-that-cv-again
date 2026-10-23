import { Suspense } from "react";
import { notFound } from "next/navigation";
import { io } from "next/cache";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { ChatWorkspace } from "@/components/chats/chat-workspace";
import { PageHeader } from "@/components/page-header";
import { Spinner } from "@/components/ui/spinner";

export async function generateMetadata({ params }: PageProps<"/chats/[id]">) {
  const parsed = z.uuid().safeParse((await params).id);
  const chat = parsed.success ? getStore().getChat(parsed.data) : undefined;
  return { title: chat ? `${chat.title} · CV Builder` : "Chat not found · CV Builder" };
}

export default function ChatPage({ params }: PageProps<"/chats/[id]">) {
  return <Suspense fallback={<>
    <PageHeader trail={[{ label: "Home", href: "/" }, { label: "Loading…" }]} />
    <div role="status" className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner />Loading chat…</div>
  </>}>
    {params.then(({ id }) => <Chat id={id} />)}
  </Suspense>;
}

async function Chat({ id }: { id: string }) {
  await io();
  const parsed = z.uuid().safeParse(id);
  const store = getStore();
  const chat = parsed.success ? store.getChat(parsed.data) : undefined;
  if (!chat) notFound();
  return <ChatWorkspace
    key={chat.id}
    chat={{ ...chat }}
    initialMessages={store.getMessages(chat.id)}
    initialProfile={store.getProfileWorkspace(chat.id)}
    initialCv={chat.category === "build" ? store.getCvWorkspace(chat.id) : undefined}
  />;
}
