"use client";

import { memo, useState, useTransition } from "react";
import { changeCvRevision, readCvWorkspace, saveBuildSettings } from "@/app/build-actions";
import type { openStore } from "@/lib/storage/store";
import type { Cv } from "@/lib/storage/cv";
import type { CvRevision } from "@/lib/storage/build";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type CvWorkspace = ReturnType<ReturnType<typeof openStore>["getCvWorkspace"]>;
const CvDocument = memo(function CvDocument({ cv }: { cv: Cv }) {
  const contact = cv.contact;
  return <article className="space-y-5 wrap-break-word text-sm">
    {contact && <header className="space-y-1">
      {contact.name && <h2 className="text-xl font-semibold">{contact.name}</h2>}
      {contact.headline && <p>{contact.headline}</p>}
      <p>{[contact.email, contact.phone, contact.location].filter(Boolean).join(" · ")}</p>
      {contact.links && <ul className="flex flex-wrap gap-3">{contact.links.map((link, index) => <li key={index}><a className="underline" href={link.url} target="_blank" rel="noreferrer">{link.label ?? link.url}</a></li>)}</ul>}
    </header>}
    {cv.sections.map((section, index) => <section key={index} className="space-y-2">
      <h3 className="text-lg font-semibold">{section.title}</h3>
      {section.type === "text" && <p className="whitespace-pre-wrap">{section.content.text}</p>}
      {section.type === "list" && <ul className="list-disc space-y-1 pl-5">{section.items.map((item, itemIndex) => <li key={itemIndex} className="whitespace-pre-wrap">{item.text}</li>)}</ul>}
      {section.type === "entries" && section.entries.map((entry, entryIndex) => <div key={entryIndex} className="space-y-2 pb-3">
        <h4 className="font-medium">{entry.heading.text}</h4>
        <p>{[entry.organization?.text, entry.location?.text, entry.period?.text].filter(Boolean).join(" · ")}</p>
        {entry.description && <p className="whitespace-pre-wrap">{entry.description.text}</p>}
        {entry.highlights && <ul className="list-disc space-y-1 pl-5">{entry.highlights.map((item, itemIndex) => <li key={itemIndex} className="whitespace-pre-wrap">{item.text}</li>)}</ul>}
        {entry.links && <ul className="flex flex-wrap gap-3">{entry.links.map((link, linkIndex) => <li key={linkIndex}><a className="underline" href={link.url} target="_blank" rel="noreferrer">{link.label ?? link.url}</a></li>)}</ul>}
      </div>)}
    </section>)}
  </article>;
});
function RevisionDocument({ revision, currentProfileId }: { revision: CvRevision; currentProfileId: string | null }) {
  return <div className="space-y-3">
    {revision.profileRevision !== currentProfileId && <p className="text-sm text-muted-foreground">Career notes changed since this CV. This saved revision stays unchanged. Ask for a refreshed draft if needed.</p>}
    <Tabs defaultValue="readable"><TabsList><TabsTrigger value="readable">Readable CV</TabsTrigger><TabsTrigger value="json">Raw JSON</TabsTrigger></TabsList>
      <TabsContent value="readable"><CvDocument cv={revision.content} /></TabsContent>
      <TabsContent value="json"><pre className="max-h-[600px] overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(revision.content, null, 2)}</pre></TabsContent>
    </Tabs>
    {revision.explanation && <section className="space-y-1 border-t pt-3"><h4 className="font-medium">Selection notes and alternatives</h4><p className="whitespace-pre-wrap text-sm text-muted-foreground">{revision.explanation}</p></section>}
  </div>;
}
export function CvReview({ chatId, workspace, onChange, onRevise, sending, onBusyChange, currentProfileId }: {
  chatId: string; workspace: CvWorkspace; onChange: (value: CvWorkspace) => void; onRevise: (text: string) => void;
  sending: boolean; onBusyChange: (value: boolean) => void; currentProfileId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const accepted = workspace.revisions.find(item => item.id === workspace.acceptedId);
  const draft = workspace.revisions.find(item => item.status === "draft");
  const selected = workspace.revisions.find(item => item.id === selectedId);
  function run(action: () => Promise<void>) {
    onBusyChange(true);
    startTransition(async () => {
      setNotice("");
      try { await action(); }
      catch { setNotice("Could not save. A reply may be active or saved details may have changed. Refresh CV workspace, review, then retry."); }
      finally { onBusyChange(false); }
    });
  }
  function change(revisionId: string, action: "accept" | "discard" | "restore") {
    run(async () => {
      onChange(await changeCvRevision({ chatId, revisionId, action, expectedAcceptedId: workspace.acceptedId }));
      setNotice(action === "accept" ? "CV accepted. Ready for export." : action === "discard" ? "Draft discarded. Accepted CV preserved." : "Revision restored as a draft. Review and accept when ready.");
    });
  }
  return <Card className="min-w-0">
    <CardHeader><CardTitle>Build your CV</CardTitle><CardDescription>Save the opportunity, then ask for a tailored draft. Acceptance is always your choice.</CardDescription></CardHeader>
    <CardContent className="space-y-6">
      <Button variant="outline" disabled={pending || sending} onClick={() => run(async () => { onChange(await readCvWorkspace(chatId)); })}>Refresh CV workspace</Button>
      {notice && <p role="status" className="text-sm">{notice}</p>}
      <form key={workspace.version} className="space-y-3" onSubmit={event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(async () => {
          onChange(await saveBuildSettings({ chatId, expectedVersion: workspace.version, settings: {
            jobDescription: data.get("jobDescription"), targetRole: data.get("targetRole"), targetCompany: data.get("targetCompany"), projectLimit: Number(data.get("projectLimit")),
          } }));
          setNotice("Job details saved. Existing CV revisions stay unchanged.");
        });
      }}>
        <div className="space-y-1"><Label htmlFor={`job-${chatId}`}>Job description</Label><Textarea id={`job-${chatId}`} name="jobDescription" defaultValue={workspace.settings.jobDescription} maxLength={100000} disabled={pending || sending} placeholder="Paste the job description here" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor={`role-${chatId}`}>Target role (optional)</Label><Input id={`role-${chatId}`} name="targetRole" defaultValue={workspace.settings.targetRole} maxLength={200} disabled={pending || sending} /></div>
          <div className="space-y-1"><Label htmlFor={`company-${chatId}`}>Company (optional)</Label><Input id={`company-${chatId}`} name="targetCompany" defaultValue={workspace.settings.targetCompany} maxLength={200} disabled={pending || sending} /></div>
        </div>
        <div className="space-y-1"><Label htmlFor={`projects-${chatId}`}>Maximum relevant projects</Label><Input id={`projects-${chatId}`} name="projectLimit" type="number" min={0} step={1} required defaultValue={workspace.settings.projectLimit} disabled={pending || sending} /><p className="text-xs text-muted-foreground">Default: up to five. Use zero to omit projects.</p></div>
        <Button type="submit" disabled={pending || sending}>Save job details</Button>
      </form>
      <div className="space-y-2"><Button variant="secondary" disabled={pending || sending || !workspace.settings.jobDescription} onClick={() => onRevise("Create a tailored CV draft for the saved job description and preferences using the latest confirmed career profile. Explain your selections and alternatives.")}>Prepare draft request</Button><p className="text-xs text-muted-foreground">Prepares an editable chat message. Press Send message to generate.</p></div>
      <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Accepted CV</h3>
        {accepted ? <RevisionDocument revision={accepted} currentProfileId={currentProfileId} /> : <p className="text-sm text-muted-foreground">No accepted CV yet. Review a draft and choose Accept this CV.</p>}
      </section>
      <Tabs defaultValue="draft"><TabsList><TabsTrigger value="draft">Draft review</TabsTrigger><TabsTrigger value="history">History ({workspace.revisions.length})</TabsTrigger></TabsList>
        <TabsContent value="draft" className="space-y-3">
          {draft ? <><RevisionDocument key={draft.id} revision={draft} currentProfileId={currentProfileId} />
            <div className="flex flex-wrap gap-2"><Button disabled={pending || sending} onClick={() => change(draft.id, "accept")}>Accept this CV</Button>
              <Button variant="outline" disabled={pending || sending} onClick={() => change(draft.id, "discard")}>Discard draft</Button>
              <Button variant="outline" disabled={pending || sending} onClick={() => onRevise(`Revise CV draft ${draft.id} using the latest confirmed profile. My requested changes: `)}>Ask for a revision</Button></div>
          </> : <p className="text-sm text-muted-foreground">No draft awaiting review. Save job details, then send a draft request.</p>}
        </TabsContent>
        <TabsContent value="history" className="space-y-3">
          <div className="flex flex-wrap gap-2">{workspace.revisions.map((revision, index) => <Button key={revision.id} size="sm" variant={selectedId === revision.id ? "secondary" : "outline"} onClick={() => setSelectedId(revision.id)}>Revision {workspace.revisions.length - index} · {revision.status}{revision.id === workspace.acceptedId ? " (current)" : ""}</Button>)}</div>
          {selected && <><RevisionDocument key={selected.id} revision={selected} currentProfileId={currentProfileId} /><Button variant="outline" disabled={pending || sending} onClick={() => change(selected.id, "restore")}>Restore as a new draft</Button></>}
          {workspace.revisions.length === 0 && <p className="text-sm text-muted-foreground">Completed CV drafts will appear here.</p>}
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>;
}
