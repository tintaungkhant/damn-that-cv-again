import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { PlusIcon } from "lucide-react";
import { getStore } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { chatListInput } from "@/lib/storage/store";
import { DeleteChatButton, NewChatDialog } from "@/components/chats/forms";
import { chatCategories } from "@/components/chats/categories";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { ListPagination } from "@/components/list-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

type Query = Promise<Record<string, string | string[] | undefined>>;

export default function ChatsPage({ searchParams }: { searchParams: Query }) {
  return <Suspense fallback={<><PageHeader trail={[{ label: "Home", href: "/" }, { label: "Chats" }]} /><Skeleton className="m-4 h-64" /></>}>
    <Chats searchParams={searchParams} />
  </Suspense>;
}

async function Chats({ searchParams }: { searchParams: Query }) {
  await io();
  const query = await searchParams;
  const parsed = chatListInput.required({ category: true }).safeParse({ category: query.category, search: query.search ?? "", page: query.page === undefined ? 1 : Number(query.page) });
  if (!parsed.success) return <><PageHeader trail={[{ label: "Home", href: "/" }, { label: "Chats" }]} />
    <p role="alert" className="p-4 sm:p-8">Invalid category, search, or page. Open <Link href="/chats?category=build" className="underline">CV chats</Link> or <Link href="/chats?category=profile" className="underline">Profile chats</Link>, or <Link href="/chats?category=general" className="underline">General chats</Link>.</p></>;
  const filters = parsed.data;
  const result = getStore().listChats(filters);
  const { label, icon: Icon } = chatCategories[filters.category];
  function pageHref(page: number) {
    return `/chats?${new URLSearchParams({ category: filters.category, search: filters.search, page: String(page) })}`;
  }
  return <><PageHeader trail={[{ label: "Home", href: "/" }, { label }]} />
    <div className="flex-1 overflow-y-auto"><div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">{label}</h1>
        <NewChatDialog category={filters.category}><Button><PlusIcon />New chat</Button></NewChatDialog>
      </div>
      <section className="flex flex-col gap-4" aria-label={label}>
        <form action="/chats" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="category" value={filters.category} />
          <Field className="min-w-48 flex-1"><FieldLabel htmlFor="chat-search">Search titles</FieldLabel><Input id="chat-search" name="search" defaultValue={filters.search} maxLength={120} /></Field>
          <Button type="submit" variant="outline">Search</Button>
        </form>
        <p className="text-sm text-muted-foreground">{result.total} chats · Page {result.page} of {Math.max(1, Math.ceil(result.total / 25))}</p>
        {result.items.length === 0 && <Empty className="border"><EmptyHeader><EmptyTitle>No chats found</EmptyTitle></EmptyHeader></Empty>}
        {result.items.map(chat => <Item key={chat.id} variant="outline">
          <ItemMedia variant="icon"><Icon /></ItemMedia>
          <ItemContent>
            <ItemTitle><Link href={`/chats/${chat.id}`} className="underline">{chat.title}</Link></ItemTitle>
            <ItemDescription>Updated <time dateTime={chat.updated_at}>{formatDateTime(chat.updated_at)}</time></ItemDescription>
          </ItemContent>
          <ItemActions><DeleteChatButton id={chat.id} category={chat.category} title={chat.title} /></ItemActions>
        </Item>)}
        <ListPagination page={result.page} total={result.total} href={pageHref} />
      </section>
    </div></div></>;
}
