"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Layout, PanelImperativeHandle } from "react-resizable-panels";
import { useMediaQuery } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { ArrowUpIcon, CheckIcon, CopyIcon, FileTextIcon, PanelRightCloseIcon, PanelRightIcon, PanelRightOpenIcon, RefreshCwIcon, RotateCcwIcon, SparklesIcon, SquareIcon, TriangleAlertIcon, UserRoundIcon } from "lucide-react";
import { sendChatMessage, cancelChatReply, readChatMessages } from "@/app/chat-actions";
import { readCvWorkspace } from "@/app/build-actions";
import { readProfileWorkspace } from "@/app/profile-actions";
import type { Chat, Message } from "@/lib/storage/store";
import type { ChatEvent } from "@/lib/ai/provider";
import { ChatMarkdown } from "./markdown";
import { AttachmentPicker, SavedAttachments } from "./attachments";
import { selectionError } from "@/lib/attachments/types";
import { readWorkspacePreference, workspacePreferenceKey, workspaceSize } from "@/lib/workspace-preference";
import { CvAccepted, CvDraft, CvHistory, JobDetails, type CvWorkspace } from "./cv-review";
import { ConfirmedProfile, ProfileHistory, ProfileProposals, type ProfileWorkspace } from "./profile-review";
import { chatCategories } from "./categories";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message as MessageRow, MessageContent, MessageFooter } from "@/components/ui/message";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { MessageScrollerProvider, MessageScroller, MessageScrollerViewport, MessageScrollerContent, MessageScrollerItem, MessageScrollerButton } from "@/components/ui/message-scroller";

type Usage = Extract<ChatEvent, { type: "usage" }>;
type Tab = "job" | "draft" | "accepted" | "history" | "changes" | "profile";

function storedWorkspace() {
  try { return readWorkspacePreference(localStorage.getItem(workspacePreferenceKey)); }
  catch { return readWorkspacePreference(null); }
}

function initialTab(cv: CvWorkspace | undefined, profile: ProfileWorkspace): Tab {
  if (cv?.revisions.some(item => item.status === "draft")) return "draft";
  if (profile.proposals.some(item => item.status === "pending")) return "changes";
  if (cv) return cv.settings.jobDescription ? (cv.acceptedId ? "accepted" : "job") : "job";
  return "profile";
}

function CopyReply({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon-sm" aria-label={copied ? "Copied" : "Copy reply"} onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }, () => toast.error("Clipboard access failed."))}>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </TooltipTrigger>
    <TooltipContent>{copied ? "Copied" : "Copy"}</TooltipContent>
  </Tooltip>;
}

function UsageCard({ usage }: { usage: Usage }) {
  const rows = [["Input", usage.inputTokens], ["Output", usage.outputTokens], ["Cache read", usage.cacheReadTokens], ["Cache write", usage.cacheWriteTokens]] as const;
  return <HoverCard openDelay={10} closeDelay={100}>
    <HoverCardTrigger asChild><InputGroupButton size="sm" variant="ghost" className="text-muted-foreground">{(usage.inputTokens + usage.outputTokens).toLocaleString()} tokens</InputGroupButton></HoverCardTrigger>
    <HoverCardContent side="top" className="flex w-64 flex-col gap-3">
      <div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">Last reply</span>{usage.model && <span className="truncate text-muted-foreground">{usage.model}</span>}</div>
      <div className="flex flex-col gap-1 text-sm">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className="tabular-nums">{value.toLocaleString()}</span></div>)}</div>
    </HoverCardContent>
  </HoverCard>;
}

export function ChatWorkspace({ chat, initialMessages, initialProfile, initialCv }: { chat: Chat; initialMessages: Message[]; initialProfile: ProfileWorkspace; initialCv?: CvWorkspace }) {
  const chatId = chat.id;
  const build = chat.category === "build";
  const [cv, setCv] = useState(initialCv);
  const [profile, setProfile] = useState(initialProfile);
  const [messages, setMessages] = useState(initialMessages);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<Usage>();
  const [documentBusy, setDocumentBusy] = useState(false);
  const [tab, setTab] = useState<Tab>(() => initialTab(initialCv, initialProfile));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const wide = useMediaQuery("(min-width: 1024px)", true);
  const [workspaceHandle, setWorkspaceHandle] = useState<PanelImperativeHandle | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  // The group reports its default layout on mount; ignore it until the saved preference is applied.
  const restored = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const active = useRef<string | null>(null);
  const latest = messages.at(-1);
  const needsRetry = latest?.role === "user" && latest.status === "failed";
  const storedPending = latest?.status === "pending";
  const composerDisabled = pending || documentBusy || needsRetry || storedPending;
  const sending = pending || documentBusy || !!storedPending;
  const pendingProposals = profile.proposals.filter(item => item.status === "pending");
  const draft = cv?.revisions.find(item => item.status === "draft");
  const general = chat.category === "general";
  const suggestions = build
    ? ["Draft a CV for the saved job description.", "Explain which experience best matches this role."]
    : general
      ? ["Write a three-sentence summary of my career.", "Write a short cover letter for a freelance project.", "Help me draft a project proposal."]
      : ["Help me organize my career notes.", "What information is missing from my profile?"];

  useEffect(() => {
    restored.current = false;
    if (!wide || !workspaceHandle) return;
    const preference = storedWorkspace();
    restored.current = true;
    if (preference.open) workspaceHandle.resize(`${preference.size}%`);
    else workspaceHandle.collapse();
  }, [wide, workspaceHandle]);
  function saveLayout(layout: Layout) {
    if (!restored.current) return;
    const size = layout.workspace ?? 0;
    setWorkspaceOpen(size > 0);
    try { localStorage.setItem(workspacePreferenceKey, JSON.stringify({ open: size > 0, size: size > 0 ? size : storedWorkspace().size })); } catch { /* Preference is a convenience only. */ }
  }
  function showWorkspace() {
    workspaceHandle?.resize(`${storedWorkspace().size}%`);
  }
  function review(next: Tab) {
    setTab(next);
    if (!wide) setSheetOpen(true);
    else showWorkspace();
  }
  function revise(text: string) {
    setContent(text);
    setSheetOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }
  async function reloadDocuments() {
    setProfile(await readProfileWorkspace(chatId));
    if (build) setCv(await readCvWorkspace(chatId));
  }

  async function stop(messageId: string) {
    try {
      await cancelChatReply(chatId, messageId);
      setMessages(await readChatMessages(chatId));
    } catch {
      setError("Could not stop the reply. Check your connection.");
    }
  }

  function send(retryId?: string) {
    startTransition(async () => {
      setError(""); setPartial(""); setUsage(undefined);
      let finished = false;
      const proposed: ("profile" | "cv")[] = [];
      try {
        const upload = new FormData();
        if (!retryId) {
          const invalid = selectionError(files);
          if (invalid) { setError(invalid); return; }
          upload.set("chatId", chatId); upload.set("content", content);
          for (const file of files) upload.append("files", file);
        }
        const reply = await sendChatMessage(retryId ? { chatId, retryId } : upload);
        if ("error" in reply) { setError(reply.error); return; }
        active.current = reply.messageId;
        if (!retryId) { setContent(""); setFiles([]); }
        setMessages(await readChatMessages(chatId));
        const reader = reply.stream.getReader();
        try {
          for (;;) {
            const { value: event, done } = await reader.read();
            if (done) break;
            if (event.type === "text-delta") setPartial(text => text + event.text);
            if (event.type === "usage") setUsage(event);
            if (event.type === "proposal") proposed.push(event.kind);
            if (event.type === "error") setError(event.message);
            if (event.type === "done") finished = true;
          }
        } finally { reader.releaseLock(); }
        if (!finished) {
          await cancelChatReply(chatId, reply.messageId);
          setError(previous => previous || "Reply interrupted. Retry your saved message.");
        }
      } catch {
        if (active.current) await cancelChatReply(chatId, active.current).catch(() => {});
        setError("Upload or reply connection failed. Check the five-file, 10 MiB each and 20 MiB total limits, or use smaller files. Refresh the chat before resending; retry any saved message to avoid duplicates.");
      } finally {
        active.current = null;
        try { setMessages(await readChatMessages(chatId)); } catch { /* Keep the visible conversation during a connection failure. */ }
        if (finished) {
          setPartial("");
          try { await reloadDocuments(); } catch { setError("Reply saved. Refresh to load the document review."); }
          if (proposed.length > 0) {
            const next = proposed.includes("cv") ? "draft" : "changes";
            setTab(next);
            if (!wide || !workspaceOpen) toast(next === "draft" ? "CV draft ready for review" : "Profile changes need your approval", { action: { label: "Review", onClick: () => review(next) } });
          }
        }
      }
    });
  }

  const tabs: { value: Tab; label: string; count?: number }[] = build
    ? [{ value: "job", label: "Job" }, { value: "draft", label: "Draft", count: draft ? 1 : 0 }, { value: "accepted", label: "Accepted" }, { value: "history", label: "History" }, { value: "changes", label: "Profile", count: pendingProposals.length }]
    : [{ value: "changes", label: "Changes", count: pendingProposals.length }, { value: "profile", label: "Profile" }, { value: "history", label: "History" }];
  const currentProfileId = profile.revisions[0]?.id ?? null;
  const cvProps = cv && { chatId, workspace: cv, onChange: setCv, sending, onBusyChange: setDocumentBusy };

  const workspacePanel = <Tabs value={tab} onValueChange={value => setTab(value as Tab)} className="flex h-full min-h-0 flex-col gap-0">
    <div className="flex items-center gap-2 border-b px-4 py-2">
      <TabsList className="min-w-0 flex-1 justify-start overflow-x-auto">
        {tabs.map(item => <TabsTrigger key={item.value} value={item.value} className="flex-none">{item.label}{!!item.count && <Badge className="h-4 min-w-4 px-1 tabular-nums">{item.count}</Badge>}</TabsTrigger>)}
      </TabsList>
      <Tooltip>
        <TooltipTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Refresh workspace" disabled={refreshing || sending} onClick={() => startRefresh(async () => {
          try { await reloadDocuments(); } catch { toast.error("Could not refresh. Check your connection."); }
        })}>{refreshing ? <Spinner /> : <RefreshCwIcon />}</Button></TooltipTrigger>
        <TooltipContent>Refresh workspace</TooltipContent>
      </Tooltip>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      {cvProps && <>
        <TabsContent value="job" forceMount className="data-[state=inactive]:hidden"><JobDetails {...cvProps} onRevise={revise} /></TabsContent>
        <TabsContent value="draft"><CvDraft {...cvProps} onRevise={revise} currentProfileId={currentProfileId} /></TabsContent>
        <TabsContent value="accepted"><CvAccepted {...cvProps} currentProfileId={currentProfileId} onShowDraft={() => setTab("draft")} /></TabsContent>
        <TabsContent value="history"><CvHistory {...cvProps} currentProfileId={currentProfileId} onRestored={() => setTab("draft")} /></TabsContent>
      </>}
      <TabsContent value="changes"><ProfileProposals chatId={chatId} workspace={profile} onChange={setProfile} onRevise={revise} sending={sending} /></TabsContent>
      {!build && <>
        <TabsContent value="profile"><ConfirmedProfile workspace={profile} /></TabsContent>
        <TabsContent value="history"><ProfileHistory chatId={chatId} workspace={profile} onChange={setProfile} sending={sending} /></TabsContent>
      </>}
    </div>
  </Tabs>;

  const attention = [
    ...(pendingProposals.length > 0 ? [{ key: "changes" as const, icon: <UserRoundIcon />, title: "Profile changes need your approval", description: pendingProposals[0].value.summary, action: "Review changes" }] : []),
    ...(draft ? [{ key: "draft" as const, icon: <FileTextIcon />, title: "CV draft ready for review", description: "Accept it, ask for a revision, or discard it. Nothing is accepted automatically.", action: "Review draft" }] : []),
  ];

  const thread = <MessageScrollerProvider autoScroll>
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        {messages.length === 0 && !pending ? <Empty className="h-full">
          <EmptyHeader>
            <EmptyMedia variant="icon"><SparklesIcon /></EmptyMedia>
            <EmptyTitle>{build ? "Build your next CV" : general ? "Ask anything about your career" : "Start with your story"}</EmptyTitle>
          </EmptyHeader>
          {build && !cv?.settings.jobDescription && <EmptyContent><Button variant="outline" onClick={() => review("job")}>Add job description</Button></EmptyContent>}
        </Empty> : <MessageScroller>
          <MessageScrollerViewport>
            <MessageScrollerContent aria-label="Conversation" aria-busy={pending} className="mx-auto w-full max-w-3xl gap-6 px-4 py-6 sm:px-6">
              {messages.map(message => <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={message.role === "user"}>
                {message.role === "user" ? <MessageRow align="end">
                  <MessageContent>
                    {message.content && <Bubble variant="muted" align="end"><BubbleContent className="whitespace-pre-wrap break-words">{message.content}</BubbleContent></Bubble>}
                    {!!message.attachments?.length && <SavedAttachments chatId={chatId} files={message.attachments} />}
                    {message.status === "failed" && <MessageFooter className="text-xs text-destructive">Reply failed. Your message is saved.</MessageFooter>}
                  </MessageContent>
                </MessageRow> : <MessageRow>
                  <MessageContent>
                    <ChatMarkdown text={message.content} />
                    <MessageFooter><CopyReply text={message.content} /></MessageFooter>
                  </MessageContent>
                </MessageRow>}
              </MessageScrollerItem>)}
              {(partial || pending) && <MessageScrollerItem messageId="active-reply"><MessageRow><MessageContent className="gap-3">
                {partial ? <ChatMarkdown text={partial} /> : <Marker role="status"><MarkerIcon><Spinner /></MarkerIcon><MarkerContent className="shimmer">Working on a reply…</MarkerContent></Marker>}
              </MessageContent></MessageRow></MessageScrollerItem>}
              {!pending && (needsRetry || storedPending) && <MessageScrollerItem messageId="retry">
                <Marker variant="separator">
                  <MarkerContent className="inline-flex items-center gap-2">
                    {storedPending ? "Reply was interrupted" : "Reply did not finish"}
                    <Button size="xs" variant="outline" onClick={() => {
                      if (storedPending) startTransition(() => stop(latest.id));
                      else send(latest.id);
                    }}>{storedPending ? <><SquareIcon />Stop interrupted reply</> : <><RotateCcwIcon />Retry saved message</>}</Button>
                  </MarkerContent>
                </Marker>
              </MessageScrollerItem>}
              {!pending && attention.map(item => <MessageScrollerItem key={item.key} messageId={`attention-${item.key}`}>
                <Item variant="outline" size="sm">
                  <ItemMedia variant="icon">{item.icon}</ItemMedia>
                  <ItemContent><ItemTitle>{item.title}</ItemTitle><ItemDescription>{item.description}</ItemDescription></ItemContent>
                  <ItemActions><Button size="sm" onClick={() => review(item.key)}>{item.action}</Button></ItemActions>
                </Item>
              </MessageScrollerItem>)}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>}
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pb-4 sm:px-6">
        {error && <Alert variant="destructive"><TriangleAlertIcon /><AlertTitle>Reply needs attention</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        {messages.length === 0 && <div className="flex scroll-fade-x scrollbar-none gap-2 overflow-x-auto overscroll-x-contain">
          {suggestions.map(prompt => <Button key={prompt} variant="outline" size="sm" className="shrink-0" disabled={!!composerDisabled} onClick={() => revise(prompt)}>{prompt}</Button>)}
        </div>}
        <AttachmentPicker files={files} onChange={setFiles} disabled={!!composerDisabled} onError={setError} />
        <form ref={formRef} onSubmit={event => { event.preventDefault(); if (!composerDisabled && (content.trim() || files.length)) send(); }}>
          <InputGroup>
            <InputGroupTextarea ref={inputRef} aria-label="Message" value={content} onChange={event => setContent(event.target.value)} maxLength={100000} required={!files.length} disabled={!!composerDisabled}
              placeholder={build ? "Ask for a draft, discuss selections, or request changes…" : general ? "Ask for a summary, letter, proposal, or profile update…" : "Tell me about your experience…"} className="max-h-48 min-h-16 p-3"
              onKeyDown={event => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); formRef.current?.requestSubmit(); }
              }} />
            <InputGroupAddon align="block-end">
              <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"><Kbd>Shift</Kbd>+<Kbd>Enter</Kbd>new line</span>
              <div className="ml-auto flex items-center gap-1">
                {usage && <UsageCard usage={usage} />}
                {pending ? <InputGroupButton variant="outline" size="icon-sm" className="rounded-full" aria-label="Stop reply" disabled={!storedPending} onClick={() => {
                  const id = active.current;
                  if (id) startTransition(() => stop(id));
                }}><SquareIcon /></InputGroupButton> : <InputGroupButton type="submit" variant="default" size="icon-sm" className="rounded-full" aria-label="Send message" disabled={!!composerDisabled || (!content.trim() && !files.length)}><ArrowUpIcon /></InputGroupButton>}
              </div>
            </InputGroupAddon>
          </InputGroup>
        </form>
      </div>
    </div>
  </MessageScrollerProvider>;

  const status = pending ? <span role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Spinner />Replying</span> : null;
  return <>
    <PageHeader trail={[{ label: chatCategories[chat.category].label, href: `/chats?category=${chat.category}` }, { label: chat.title }]}>
      {status}
      <Badge variant="secondary" className="hidden sm:inline-flex">{chatCategories[chat.category].badge}</Badge>
      {!wide && <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}><PanelRightIcon />Workspace{attention.length > 0 && <Badge className="h-4 min-w-4 px-1">{attention.length}</Badge>}</Button>}
      {wide && <Button variant="outline" size="sm" aria-controls="chat-workspace" aria-expanded={workspaceOpen} onClick={() => workspaceOpen ? workspaceHandle?.collapse() : showWorkspace()}>
        {workspaceOpen ? <><PanelRightCloseIcon />Hide workspace</> : <><PanelRightOpenIcon />Show workspace{attention.length > 0 && <Badge className="h-4 min-w-4 px-1">{attention.length}</Badge>}</>}
      </Button>}
    </PageHeader>
    <div className="min-h-0 flex-1">
      {wide ? <ResizablePanelGroup orientation="horizontal" onLayoutChanged={saveLayout}>
        <ResizablePanel id="thread" defaultSize={`${100 - workspaceSize.default}`} minSize={`${100 - workspaceSize.max}`}>{thread}</ResizablePanel>
        <ResizableHandle withHandle />
        {/* Collapsing keeps the panel mounted so unsaved job settings and tab state survive hide/show. */}
        <ResizablePanel id="workspace" panelRef={setWorkspaceHandle} collapsible defaultSize={`${workspaceSize.default}`} minSize={`${workspaceSize.min}`}>
          <aside id="chat-workspace" aria-label={build ? "CV workspace" : "Career profile"} inert={!workspaceOpen} className="h-full bg-muted/20">{workspacePanel}</aside>
        </ResizablePanel>
      </ResizablePanelGroup> : thread}
    </div>
    {!wide && <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b"><SheetTitle>{build ? "CV workspace" : "Career profile"}</SheetTitle><SheetDescription className="sr-only">Review documents for this chat.</SheetDescription></SheetHeader>
        <div className="min-h-0 flex-1">{workspacePanel}</div>
      </SheetContent>
    </Sheet>}
  </>;
}
