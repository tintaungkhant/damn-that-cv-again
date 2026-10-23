import { Suspense } from "react";
import { io } from "next/cache";
import { getStore } from "@/lib/db";
import { ProfileOverview } from "@/components/chats/profile-review";
import { NewChatDialog } from "@/components/chats/forms";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfilePage() {
  return <>
    <PageHeader trail={[{ label: "Home", href: "/" }, { label: "Career profile" }]}>
      <NewChatDialog category="profile"><Button size="sm">Update in a chat</Button></NewChatDialog>
    </PageHeader>
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Career profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">Shared by every chat. Changes are proposed in chats and saved only after your approval.</p>
        </div>
        <Suspense fallback={<div className="flex flex-col gap-3"><Skeleton className="h-8 w-56" /><Skeleton className="h-64" /></div>}>
          <Profile />
        </Suspense>
      </div>
    </div>
  </>;
}

async function Profile() {
  await io();
  return <ProfileOverview initialWorkspace={{ revisions: getStore().getProfileRevisions(), proposals: [] }} />;
}
