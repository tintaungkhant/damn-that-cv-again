"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import { DeleteChatDialog } from "@/components/chats/forms";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

type NavLinkProps = { href: string; tooltip: string; children: React.ReactNode };
function NavButton({ href, tooltip, children, active }: NavLinkProps & { active: boolean }) {
  return <SidebarMenuButton asChild isActive={active} tooltip={tooltip}>
    <Link href={href} aria-current={active ? "page" : undefined}>{children}</Link>
  </SidebarMenuButton>;
}
function ActiveNavButton(props: NavLinkProps) {
  return <NavButton {...props} active={usePathname() === props.href} />;
}
// usePathname suspends while prerendering dynamic chat routes, so the fallback is an inactive link.
export function NavLink(props: NavLinkProps) {
  return <Suspense fallback={<NavButton {...props} active={false} />}><ActiveNavButton {...props} /></Suspense>;
}

export function ChatNavItem({ id, title, category, icon }: { id: string; title: string; category: "profile" | "build"; icon: React.ReactNode }) {
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
