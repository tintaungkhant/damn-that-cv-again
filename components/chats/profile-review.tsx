"use client";

import { memo, useState, useTransition } from "react";
import Markdown from "react-markdown";
import { approveProfileEdit, readProfileWorkspace, restoreProfile } from "@/app/profile-actions";
import type { openStore } from "@/lib/storage/store";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";

export type ProfileWorkspace = ReturnType<ReturnType<typeof openStore>["getProfileWorkspace"]>;
const Document = memo(function Document({ text }: { text: string }) {
  return <div className="space-y-3 wrap-break-word text-sm [&_h1]:text-xl [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-medium [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:whitespace-pre-wrap [&_a]:underline [&_pre]:overflow-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-3">
    <Markdown skipHtml disallowedElements={["img"]}>{text}</Markdown>
  </div>;
});
export function ProfileReview({ chatId, workspace, onChange, onRevise, sending }: {
  chatId: string; workspace: ProfileWorkspace; onChange: (value: ProfileWorkspace) => void; onRevise: (text: string) => void; sending: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState("");
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState<string | null>(null);
  const current = workspace.revisions[0];
  const selected = workspace.revisions.find(item => item.id === selectedRevision);
  const proposals = workspace.proposals.filter(item => item.status === "pending");
  function run(action: () => Promise<void>) {
    startTransition(async () => {
      setNotice("");
      try { await action(); } catch { setNotice("Could not update the profile. Refresh to check the latest saved state, then retry."); }
    });
  }
  return <Card className="min-w-0">
    <CardHeader><CardTitle>Career profile</CardTitle><CardDescription>Shared across chats. Changes save only after your approval.</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      <Button variant="outline" disabled={pending} onClick={() => run(async () => { onChange(await readProfileWorkspace(chatId)); })}>Refresh profile</Button>
      {notice && <p role="status" className="text-sm text-destructive">{notice}</p>}
      <Tabs defaultValue="confirmed">
        <TabsList><TabsTrigger value="confirmed">Confirmed</TabsTrigger><TabsTrigger value="history">History ({workspace.revisions.length})</TabsTrigger></TabsList>
        <TabsContent value="confirmed">{current ? <Document text={current.markdown} /> : <p className="text-sm text-muted-foreground">No confirmed profile. Paste rough career notes into chat to get a proposal.</p>}</TabsContent>
        <TabsContent value="history" className="space-y-3">
          {workspace.revisions.length === 0 && <p className="text-sm text-muted-foreground">Approved profiles will appear here.</p>}
          <div className="flex flex-wrap gap-2">{workspace.revisions.map((revision, index) => <Button key={revision.id} size="sm" variant={selected?.id === revision.id ? "secondary" : "outline"} onClick={() => setSelectedRevision(revision.id)}>Revision {workspace.revisions.length - index}{index === 0 ? " (current)" : ""}</Button>)}</div>
          {selected && <><Document text={selected.markdown} />{selected.id !== current?.id && <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
            <AlertDialogTrigger asChild><Button variant="outline" disabled={pending || sending}>Restore this revision</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Restore this profile?</AlertDialogTitle><AlertDialogDescription>This makes the selected profile current. All revisions stay in history.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><Button disabled={pending} onClick={() => run(async () => {
                const result = await restoreProfile({ chatId, revisionId: selected.id, expectedRevision: current.id });
                onChange(result.workspace);
                if (result.restored) setRestoreOpen(false);
                setNotice(result.restored ? "Profile restored. History preserved." : "Profile changed. Review the latest revision before restoring.");
              })}>{pending ? "Restoring…" : "Confirm restore"}</Button></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>}</>}
        </TabsContent>
      </Tabs>
      {proposals.map(proposal => <Card key={proposal.id}>
        <CardHeader><CardTitle>Proposed changes</CardTitle><CardDescription>{proposal.value.summary}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {proposal.preview?.conflict ? <p role="alert" className="text-sm text-destructive">The profile changed in a targeted block. Ask the assistant to reconcile this proposal before approval.</p> : <>
            {proposal.preview?.revisionId !== proposal.value.baseRevision && <p className="text-sm text-muted-foreground">Reapplied to the latest profile. Unrelated changes are preserved. Review before approval.</p>}
            <div className="grid gap-4 xl:grid-cols-2"><section className="min-w-0"><h3 className="font-medium">Before</h3><Document text={proposal.preview?.before ?? ""} /></section><section className="min-w-0"><h3 className="font-medium">After approval</h3><Document text={proposal.preview?.after ?? ""} /></section></div>
          </>}
          <div className="flex flex-wrap gap-2"><Button disabled={pending || sending || !proposal.preview || proposal.preview.conflict} onClick={() => run(async () => {
            const result = await approveProfileEdit({ chatId, proposalId: proposal.id, revisionId: proposal.preview!.revisionId });
            onChange(result.workspace);
            setNotice(result.approved ? "Profile approved and saved." : "Profile changed. Review the refreshed comparison, or ask the assistant to reconcile.");
          })}>{pending ? "Saving…" : "Approve whole batch"}</Button>
          <Button variant="outline" disabled={pending || sending} onClick={() => onRevise(`Please ${proposal.preview?.conflict ? "reconcile" : "revise"} profile proposal ${proposal.id} against the latest confirmed profile. My requested changes: `)}>{proposal.preview?.conflict ? "Ask to reconcile" : "Ask for a revision"}</Button></div>
        </CardContent>
      </Card>)}
    </CardContent>
  </Card>;
}
