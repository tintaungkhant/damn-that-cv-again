"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import { DeleteChatDialog } from "@/components/chats/forms";
import type { ChatCategory } from "@/lib/storage/store";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

type NavLinkProps = { href: string; tooltip: string; children: React.ReactNode };
function NavButton({ href, tooltip, children, active }: NavLinkProps & { active: boolean }) {
  return <SidebarMenuButton asChild isActive={active} tooltip={tooltip}>
    <Link href={href} aria-current={active ? "page" : undefined}>{children}</Link>
  </SidebarMenuButton>;
}
function ActiveNavButton(props: NavLinkProps) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [path, query] = props.href.split("?");
  const active = pathname === path && [...new URLSearchParams(query)].every(([key, value]) => search.get(key) === value);
  return <NavButton {...props} active={active} />;
}
// usePathname and useSearchParams suspend while prerendering dynamic chat routes, so the fallback is an inactive link.
export function NavLink(props: NavLinkProps) {
  return <Suspense fallback={<NavButton {...props} active={false} />}><ActiveNavButton {...props} /></Suspense>;
}

export function ChatNavItem({ id, title, category, icon }: { id: string; title: string; category: ChatCategory; icon: React.ReactNode }) {
  const [deleting, setDeleting] = useState(false);
  return <SidebarMenuItem>
    <NavLink href={`/chats/${id}`} tooltip={title}>{icon}<span>{title}</span></NavLink>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction showOnHover aria-label={`Options for ${title}`}><MoreHorizontalIcon /></SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start">
        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}><Trash2Icon />Delete chat</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <DeleteChatDialog id={id} category={category} title={title} open={deleting} onOpenChange={setDeleting} />
  </SidebarMenuItem>;
}
