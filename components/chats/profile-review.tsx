"use client";

import { useState, useTransition } from "react";
import { diffLines } from "diff";
import { toast } from "sonner";
import { CheckIcon, HistoryIcon, MessageSquareTextIcon, TriangleAlertIcon, UserRoundIcon } from "lucide-react";
import { ChatMarkdown as Document } from "./markdown";
import { approveProfileEdit, restoreProfile } from "@/app/profile-actions";
import type { openStore } from "@/lib/storage/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CodeBlock, CodeBlockContent, CodeBlockHeader, CodeBlockLine, CodeBlockTitle } from "@/components/ui/code-block";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";

export type ProfileWorkspace = ReturnType<ReturnType<typeof openStore>["getProfileWorkspace"]>;
type Props = { chatId: string | null; workspace: ProfileWorkspace; onChange: (value: ProfileWorkspace) => void; sending: boolean };

const readable = (markdown: string) => markdown.replace(/^<!-- id:p-[a-z0-9-]+ -->\r?\n/gm, "").trim();

function Diff({ before, after }: { before: string; after: string }) {
  const lines = diffLines(readable(before), readable(after)).flatMap(part =>
    part.value.replace(/\n$/, "").split("\n").map(text => ({ text, variant: part.added ? "added" as const : part.removed ? "removed" as const : "default" as const })));
  return <CodeBlock size="sm">
    <CodeBlockHeader><CodeBlockTitle>Line changes</CodeBlockTitle></CodeBlockHeader>
    <CodeBlockContent wrap className="max-h-[32rem]">{lines.map((line, index) => <CodeBlockLine key={index} variant={line.variant}>{line.text}</CodeBlockLine>)}</CodeBlockContent>
  </CodeBlock>;
}

export function ProfileProposals({ chatId, workspace, onChange, onRevise, sending }: Props & { chatId: string; onRevise: (text: string) => void }) {
  const [pending, startTransition] = useTransition();
  const proposals = workspace.proposals.filter(item => item.status === "pending");
  if (proposals.length === 0) return <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon"><CheckIcon /></EmptyMedia>
      <EmptyTitle>Nothing awaiting approval</EmptyTitle>
      <EmptyDescription>When the assistant proposes profile changes, compare them here before anything is saved.</EmptyDescription>
    </EmptyHeader>
  </Empty>;
  return <div className="flex flex-col gap-6">
    {proposals.map(proposal => {
      const preview = proposal.preview;
      return <section key={proposal.id} className="flex flex-col gap-4">
        <Item variant="muted" size="sm">
          <ItemContent>
            <ItemTitle>Proposed changes</ItemTitle>
            <ItemDescription className="line-clamp-none">{proposal.value.summary}</ItemDescription>
          </ItemContent>
          <ItemActions><Badge variant="outline">Not saved</Badge></ItemActions>
        </Item>
        {preview?.conflict ? <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Profile changed in a targeted block</AlertTitle>
          <AlertDescription>Ask the assistant to reconcile this proposal before approval.</AlertDescription>
        </Alert> : <>
          {preview?.revisionId !== proposal.value.baseRevision && <Alert><AlertTitle>Reapplied to the latest profile</AlertTitle><AlertDescription>Unrelated changes are preserved. Review before approval.</AlertDescription></Alert>}
          <Tabs defaultValue="changes">
            <TabsList><TabsTrigger value="changes">Changes</TabsTrigger><TabsTrigger value="after">After approval</TabsTrigger><TabsTrigger value="before">Before</TabsTrigger></TabsList>
            <TabsContent value="changes"><Diff before={preview?.before ?? ""} after={preview?.after ?? ""} /></TabsContent>
            <TabsContent value="after"><Document text={preview?.after ?? ""} /></TabsContent>
            <TabsContent value="before"><Document text={preview?.before ?? ""} /></TabsContent>
          </Tabs>
        </>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending || sending || !preview || preview.conflict} onClick={() => startTransition(async () => {
            try {
              const result = await approveProfileEdit({ chatId, proposalId: proposal.id, revisionId: preview!.revisionId });
              onChange(result.workspace);
              if (result.approved) toast.success("Profile approved and saved.");
              else toast.warning("Profile changed. Review the refreshed comparison, or ask the assistant to reconcile.");
            } catch { toast.error("Could not update the profile. Refresh to check the latest saved state, then retry."); }
          })}><CheckIcon />{pending ? "Saving…" : "Approve whole batch"}</Button>
          <Button variant="outline" disabled={pending || sending} onClick={() => onRevise(`Please ${preview?.conflict ? "reconcile" : "revise"} profile proposal ${proposal.id} against the latest confirmed profile. My requested changes: `)}>
            <MessageSquareTextIcon />{preview?.conflict ? "Ask to reconcile" : "Ask for a revision"}
          </Button>
        </div>
      </section>;
    })}
  </div>;
}

export function ConfirmedProfile({ workspace }: { workspace: ProfileWorkspace }) {
  const current = workspace.revisions[0];
  if (!current) return <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon"><UserRoundIcon /></EmptyMedia>
      <EmptyTitle>No confirmed profile yet</EmptyTitle>
      <EmptyDescription>Paste rough career notes into a profile chat to get a first proposal.</EmptyDescription>
    </EmptyHeader>
  </Empty>;
  return <Document text={current.markdown} />;
}

export function ProfileHistory({ chatId, workspace, onChange, sending }: Props) {
  const [pending, startTransition] = useTransition();
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const current = workspace.revisions[0];
  const selected = workspace.revisions.find(item => item.id === selectedId);
  if (!current) return <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon"><HistoryIcon /></EmptyMedia>
      <EmptyTitle>No history yet</EmptyTitle>
      <EmptyDescription>Approved profiles appear here. Restoring one adds a new revision.</EmptyDescription>
    </EmptyHeader>
  </Empty>;
  return <div className="flex flex-col gap-4">
    <ItemGroup className="gap-2">
      {workspace.revisions.map((revision, index) => <Item key={revision.id} size="sm" variant={selectedId === revision.id ? "muted" : "outline"} asChild>
        <button type="button" onClick={() => setSelectedId(revision.id)} aria-pressed={selectedId === revision.id}>
          <ItemContent><ItemTitle>Revision {workspace.revisions.length - index}</ItemTitle></ItemContent>
          {index === 0 && <ItemActions><Badge variant="secondary">Current</Badge></ItemActions>}
        </button>
      </Item>)}
    </ItemGroup>
    {selected && <div className="flex flex-col gap-3 border-t pt-4">
      {selected.id !== current.id && <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <AlertDialogTrigger asChild><Button variant="outline" className="self-start" disabled={pending || sending}><HistoryIcon />Restore this revision</Button></AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Restore this profile?</AlertDialogTitle><AlertDialogDescription>This makes the selected profile current. All revisions stay in history.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><Button disabled={pending} onClick={() => startTransition(async () => {
            try {
              const result = await restoreProfile({ chatId, revisionId: selected.id, expectedRevision: current.id });
              onChange(result.workspace);
              setRestoreOpen(false);
              if (result.restored) { setSelectedId(null); toast.success("Profile restored. History preserved."); }
              else toast.warning("Profile changed. Review the latest revision before restoring.");
            } catch { toast.error("Could not restore the profile. Refresh and retry."); }
          })}>{pending ? "Restoring…" : "Confirm restore"}</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>}
      <Document text={selected.markdown} />
    </div>}
  </div>;
}

export function ProfileOverview({ initialWorkspace }: { initialWorkspace: ProfileWorkspace }) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  return <Tabs defaultValue="profile">
    <TabsList><TabsTrigger value="profile">Confirmed profile</TabsTrigger><TabsTrigger value="history">History ({workspace.revisions.length})</TabsTrigger></TabsList>
    <TabsContent value="profile" className="pt-4"><ConfirmedProfile workspace={workspace} /></TabsContent>
    <TabsContent value="history" className="pt-4"><ProfileHistory chatId={null} workspace={workspace} onChange={setWorkspace} sending={false} /></TabsContent>
  </Tabs>;
}
