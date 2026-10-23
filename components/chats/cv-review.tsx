"use client";

import { memo, useState, useTransition } from "react";
import { toast } from "sonner";
import { BracesIcon, CheckIcon, ClipboardCopyIcon, DownloadIcon, FileTextIcon, HistoryIcon, MessageSquareTextIcon, SparklesIcon, XIcon } from "lucide-react";
import { changeCvRevision, exportAcceptedCv, saveBuildSettings } from "@/app/build-actions";
import type { openStore } from "@/lib/storage/store";
import type { Cv } from "@/lib/storage/cv";
import type { CvRevision } from "@/lib/storage/build";
import { useHighlightedCode } from "@/hooks/use-highlighted-code";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { CodeBlock, CodeBlockActions, CodeBlockContent, CodeBlockCopyButton, CodeBlockHeader, CodeBlockLine, CodeBlockTitle } from "@/components/ui/code-block";

export type CvWorkspace = ReturnType<ReturnType<typeof openStore>["getCvWorkspace"]>;
type Props = { chatId: string; workspace: CvWorkspace; onChange: (value: CvWorkspace) => void; sending: boolean; onBusyChange: (value: boolean) => void };

function useCvAction(onBusyChange: (value: boolean) => void) {
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<void>) {
    onBusyChange(true);
    startTransition(async () => {
      try { await action(); }
      catch { toast.error("Could not save. A reply may be active or saved details may have changed. Refresh the workspace, review, then retry."); }
      finally { onBusyChange(false); }
    });
  }
  return [pending, run] as const;
}

const CvDocument = memo(function CvDocument({ cv }: { cv: Cv }) {
  const contact = cv.contact;
  return <article className="space-y-5 wrap-break-word text-sm">
    {contact && <header className="space-y-1">
      {contact.name && <h2 className="text-xl font-semibold">{contact.name}</h2>}
      {contact.headline && <p>{contact.headline}</p>}
      <p className="text-muted-foreground">{[contact.email, contact.phone, contact.location].filter(Boolean).join(" · ")}</p>
      {contact.links && <ul className="flex flex-wrap gap-3">{contact.links.map((link, index) => <li key={index}><a className="underline" href={link.url} target="_blank" rel="noreferrer">{link.label ?? link.url}</a></li>)}</ul>}
    </header>}
    {cv.sections.map((section, index) => <section key={index} className="space-y-2">
      <h3 className="border-b pb-1 text-base font-semibold">{section.title}</h3>
      {section.type === "text" && <p className="whitespace-pre-wrap">{section.content.text}</p>}
      {section.type === "list" && <ul className="list-disc space-y-1 pl-5">{section.items.map((item, itemIndex) => <li key={itemIndex} className="whitespace-pre-wrap">{item.text}</li>)}</ul>}
      {section.type === "entries" && section.entries.map((entry, entryIndex) => <div key={entryIndex} className="space-y-2 pb-3">
        <h4 className="font-medium">{entry.heading.text}</h4>
        <p className="text-muted-foreground">{[entry.organization?.text, entry.location?.text, entry.period?.text].filter(Boolean).join(" · ")}</p>
        {entry.description && <p className="whitespace-pre-wrap">{entry.description.text}</p>}
        {entry.highlights && <ul className="list-disc space-y-1 pl-5">{entry.highlights.map((item, itemIndex) => <li key={itemIndex} className="whitespace-pre-wrap">{item.text}</li>)}</ul>}
        {entry.links && <ul className="flex flex-wrap gap-3">{entry.links.map((link, linkIndex) => <li key={linkIndex}><a className="underline" href={link.url} target="_blank" rel="noreferrer">{link.label ?? link.url}</a></li>)}</ul>}
      </div>)}
    </section>)}
  </article>;
});

function JsonBlock({ value }: { value: Cv }) {
  const json = JSON.stringify(value, null, 2);
  const lines = useHighlightedCode(json, "json");
  return <CodeBlock size="sm">
    <CodeBlockHeader><CodeBlockTitle><BracesIcon />Internal CV JSON (includes evidence)</CodeBlockTitle><CodeBlockActions><CodeBlockCopyButton value={json} /></CodeBlockActions></CodeBlockHeader>
    <CodeBlockContent lineNumbers className="max-h-[36rem]">{lines.map((line, index) => <CodeBlockLine key={index}>{line}</CodeBlockLine>)}</CodeBlockContent>
  </CodeBlock>;
}

function RevisionDocument({ revision, currentProfileId }: { revision: CvRevision; currentProfileId: string | null }) {
  return <div className="flex flex-col gap-4">
    {revision.profileRevision !== currentProfileId && <Alert><AlertDescription>Career notes changed since this CV. This saved revision stays unchanged. Ask for a refreshed draft if needed.</AlertDescription></Alert>}
    <Tabs defaultValue="readable"><TabsList><TabsTrigger value="readable">Readable CV</TabsTrigger><TabsTrigger value="json">Raw JSON</TabsTrigger></TabsList>
      <TabsContent value="readable" className="rounded-lg border p-4 sm:p-6"><CvDocument cv={revision.content} /></TabsContent>
      <TabsContent value="json"><JsonBlock value={revision.content} /></TabsContent>
    </Tabs>
    {revision.explanation && <section className="space-y-1 rounded-lg bg-muted/50 p-4"><h4 className="text-sm font-medium">Selection notes and alternatives</h4><p className="whitespace-pre-wrap text-sm text-muted-foreground">{revision.explanation}</p></section>}
  </div>;
}

export function JobDetails({ chatId, workspace, onChange, sending, onBusyChange, onRevise }: Props & { onRevise: (text: string) => void }) {
  const [pending, run] = useCvAction(onBusyChange);
  const disabled = pending || sending;
  return <div className="flex flex-col gap-6">
    <form key={workspace.version} onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      run(async () => {
        onChange(await saveBuildSettings({ chatId, expectedVersion: workspace.version, settings: {
          jobDescription: data.get("jobDescription"), targetRole: data.get("targetRole"), targetCompany: data.get("targetCompany"), projectLimit: Number(data.get("projectLimit")),
        } }));
        toast.success("Job details saved. Existing CV revisions stay unchanged.");
      });
    }}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`job-${chatId}`}>Job description</FieldLabel>
          <Textarea id={`job-${chatId}`} name="jobDescription" defaultValue={workspace.settings.jobDescription} maxLength={100000} disabled={disabled} placeholder="Paste the job description here" className="max-h-80 min-h-40" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field><FieldLabel htmlFor={`role-${chatId}`}>Target role <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Input id={`role-${chatId}`} name="targetRole" defaultValue={workspace.settings.targetRole} maxLength={200} disabled={disabled} /></Field>
          <Field><FieldLabel htmlFor={`company-${chatId}`}>Company <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Input id={`company-${chatId}`} name="targetCompany" defaultValue={workspace.settings.targetCompany} maxLength={200} disabled={disabled} /></Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`projects-${chatId}`}>Maximum relevant projects</FieldLabel>
          <Input id={`projects-${chatId}`} name="projectLimit" type="number" min={0} step={1} required defaultValue={workspace.settings.projectLimit} disabled={disabled} className="w-24" />
          <FieldDescription>Default: up to five. Use zero to omit projects.</FieldDescription>
        </Field>
        <Field orientation="horizontal"><Button type="submit" disabled={disabled}>{pending ? "Saving…" : "Save job details"}</Button></Field>
      </FieldGroup>
    </form>
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>Ready for a draft?</ItemTitle>
      </ItemContent>
      <ItemActions><Button variant="secondary" disabled={disabled || !workspace.settings.jobDescription} onClick={() => onRevise("Create a tailored CV draft for the saved job description and preferences using the latest confirmed career profile. Explain your selections and alternatives.")}><SparklesIcon />Prepare draft request</Button></ItemActions>
    </Item>
  </div>;
}

export function CvDraft({ chatId, workspace, onChange, sending, onBusyChange, onRevise, currentProfileId }: Props & { onRevise: (text: string) => void; currentProfileId: string | null }) {
  const [pending, run] = useCvAction(onBusyChange);
  const draft = workspace.revisions.find(item => item.status === "draft");
  if (!draft) return <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon"><FileTextIcon /></EmptyMedia>
      <EmptyTitle>No draft awaiting review</EmptyTitle>
    </EmptyHeader>
  </Empty>;
  function change(action: "accept" | "discard") {
    run(async () => {
      onChange(await changeCvRevision({ chatId, revisionId: draft!.id, action, expectedAcceptedId: workspace.acceptedId }));
      toast.success(action === "accept" ? "CV accepted. Ready for export." : "Draft discarded. Accepted CV preserved.");
    });
  }
  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap gap-2">
      <Button disabled={pending || sending} onClick={() => change("accept")}><CheckIcon />Accept this CV</Button>
      <Button variant="outline" disabled={pending || sending} onClick={() => onRevise(`Revise CV draft ${draft.id} using the latest confirmed profile. My requested changes: `)}><MessageSquareTextIcon />Ask for a revision</Button>
      <Button variant="ghost" disabled={pending || sending} onClick={() => change("discard")}><XIcon />Discard draft</Button>
    </div>
    <RevisionDocument key={draft.id} revision={draft} currentProfileId={currentProfileId} />
  </div>;
}

export function CvAccepted({ chatId, workspace, sending, onBusyChange, currentProfileId, onShowDraft }: Omit<Props, "onChange"> & { currentProfileId: string | null; onShowDraft: () => void }) {
  const [pending, run] = useCvAction(onBusyChange);
  const accepted = workspace.revisions.find(item => item.id === workspace.acceptedId);
  if (!accepted) return <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon"><CheckIcon /></EmptyMedia>
      <EmptyTitle>No accepted CV yet</EmptyTitle>
    </EmptyHeader>
    {workspace.revisions.some(item => item.status === "draft") && <EmptyContent><Button variant="outline" onClick={onShowDraft}>Review draft</Button></EmptyContent>}
  </Empty>;
  function exportJson(mode: "copy" | "download") {
    run(async () => {
      let json: string;
      try { json = await exportAcceptedCv({ chatId, revisionId: accepted!.id }); }
      catch { toast.error("Could not export. Refresh the workspace and check the accepted CV before retrying."); return; }
      if (mode === "copy") {
        try {
          await navigator.clipboard.writeText(json);
          toast.success("Accepted CV JSON copied. Evidence and selection notes excluded.");
        } catch {
          toast.error("Clipboard access failed. Use Download JSON instead.");
        }
      } else {
        const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `cv-${accepted!.id}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success("Accepted CV JSON download requested. Evidence and selection notes excluded.");
      }
    });
  }
  return <div className="flex flex-col gap-4">
    <Item variant="muted" size="sm">
      <ItemContent>
        <ItemTitle>Export accepted CV</ItemTitle>
      </ItemContent>
      <ItemActions>
        <Button size="sm" variant="outline" disabled={pending || sending} onClick={() => exportJson("copy")}><ClipboardCopyIcon />Copy JSON</Button>
        <Button size="sm" variant="outline" disabled={pending || sending} onClick={() => exportJson("download")}><DownloadIcon />Download JSON</Button>
      </ItemActions>
    </Item>
    <RevisionDocument revision={accepted} currentProfileId={currentProfileId} />
  </div>;
}

export function CvHistory({ chatId, workspace, onChange, sending, onBusyChange, currentProfileId, onRestored }: Props & { currentProfileId: string | null; onRestored: () => void }) {
  const [pending, run] = useCvAction(onBusyChange);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = workspace.revisions.find(item => item.id === selectedId);
  if (workspace.revisions.length === 0) return <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon"><HistoryIcon /></EmptyMedia>
      <EmptyTitle>No revisions yet</EmptyTitle>
    </EmptyHeader>
  </Empty>;
  return <div className="flex flex-col gap-4">
    <ItemGroup className="gap-2">
      {workspace.revisions.map((revision, index) => <Item key={revision.id} size="sm" variant={selectedId === revision.id ? "muted" : "outline"} asChild>
        <button type="button" onClick={() => setSelectedId(revision.id)} aria-pressed={selectedId === revision.id}>
          <ItemContent><ItemTitle>Revision {workspace.revisions.length - index}</ItemTitle></ItemContent>
          <ItemActions>
            {revision.id === workspace.acceptedId && <Badge>Current</Badge>}
            <Badge variant={revision.status === "draft" ? "secondary" : "outline"} className="capitalize">{revision.status}</Badge>
          </ItemActions>
        </button>
      </Item>)}
    </ItemGroup>
    {selected && <div className="flex flex-col gap-4 border-t pt-4">
      <Button variant="outline" className="self-start" disabled={pending || sending} onClick={() => run(async () => {
        onChange(await changeCvRevision({ chatId, revisionId: selected.id, action: "restore", expectedAcceptedId: workspace.acceptedId }));
        toast.success("Revision restored as a draft. Review and accept when ready.");
        setSelectedId(null);
        onRestored();
      })}><HistoryIcon />Restore as a new draft</Button>
      <RevisionDocument key={selected.id} revision={selected} currentProfileId={currentProfileId} />
    </div>}
  </div>;
}
