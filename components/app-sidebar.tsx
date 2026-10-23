import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { BriefcaseBusinessIcon, FileTextIcon, PlusIcon, SparklesIcon, UserRoundIcon } from "lucide-react";
import { getStore } from "@/lib/db";
import { NewChatDialog } from "@/components/chats/forms";
import { ChatNavItem, NavLink } from "@/components/chat-nav";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  return <Sidebar collapsible="icon">
    <SidebarHeader>
      <SidebarMenu><SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild tooltip="Home">
          <Link href="/">
            <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><SparklesIcon className="size-4" /></span>
            <span className="grid flex-1 text-left text-sm leading-tight"><span className="truncate font-medium">CV Builder</span><span className="truncate text-xs text-muted-foreground">Personal workspace</span></span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem></SidebarMenu>
      <SidebarMenu><SidebarMenuItem>
        <NewChatDialog><SidebarMenuButton tooltip="New chat" className="border bg-background shadow-xs"><PlusIcon />New chat</SidebarMenuButton></NewChatDialog>
      </SidebarMenuItem></SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <SidebarMenu><SidebarMenuItem><NavLink href="/profile" tooltip="Career profile"><UserRoundIcon />Career profile</NavLink></SidebarMenuItem></SidebarMenu>
        <SidebarMenu><SidebarMenuItem><NavLink href="/jobs" tooltip="Jobs"><BriefcaseBusinessIcon />Jobs</NavLink></SidebarMenuItem></SidebarMenu>
      </SidebarGroup>
      <Suspense fallback={<SidebarGroup><SidebarMenu>{[0, 1, 2].map(key => <SidebarMenuItem key={key}><Skeleton className="h-8" /></SidebarMenuItem>)}</SidebarMenu></SidebarGroup>}>
        <ChatGroups />
      </Suspense>
    </SidebarContent>
    <SidebarFooter>
      <p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">Saved locally on this computer.</p>
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>;
}

async function ChatGroups() {
  await io();
  const chats = getStore().listChats();
  return (["build", "profile"] as const).map(category => <SidebarGroup key={category} className="group-data-[collapsible=icon]:hidden">
    <SidebarGroupLabel>{category === "build" ? "CV builds" : "Profile chats"}</SidebarGroupLabel>
    <NewChatDialog category={category}><SidebarGroupAction title={category === "build" ? "New Build CV chat" : "New profile chat"}><PlusIcon /><span className="sr-only">New chat</span></SidebarGroupAction></NewChatDialog>
    <SidebarGroupContent>
      <SidebarMenu>
        {chats.filter(chat => chat.category === category).map(chat => <ChatNavItem key={chat.id} id={chat.id} title={chat.title} category={category} icon={category === "build" ? <FileTextIcon /> : <UserRoundIcon />} />)}
        {!chats.some(chat => chat.category === category) && <li className="px-2 py-1 text-xs text-muted-foreground">No chats yet.</li>}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>);
}
