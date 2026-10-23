"use client";

import { CvReview, type CvWorkspace } from "./cv-review";
import { readCvWorkspace } from "@/app/build-actions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProfileReview, type ProfileWorkspace } from "./profile-review";
import { readProfileWorkspace } from "@/app/profile-actions";
import { useRef, useState, useTransition } from "react";
import { sendChatMessage, cancelChatReply, readChatMessages } from "@/app/chat-actions";
import type { Message } from "@/lib/storage/store";
import type { ChatEvent } from "@/lib/ai/provider";
import { Button } from "@/components/ui/button";
import { Message as MessageRow, MessageContent, MessageHeader, MessageFooter } from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Label } from "@/components/ui/label";
import { ArrowUpIcon, SquareIcon, SparklesIcon, ChevronDownIcon } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { MessageScrollerProvider, MessageScroller, MessageScrollerViewport, MessageScrollerContent, MessageScrollerItem, MessageScrollerButton } from "@/components/ui/message-scroller";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import { ChatMarkdown } from "./markdown";

export function Conversation({ chatId, initialMessages, initialProfile, initialCv }: { chatId: string; initialMessages: Message[]; initialProfile: ProfileWorkspace; initialCv?: CvWorkspace }) {
  const [cv, setCv] = useState(initialCv);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const [messages, setMessages] = useState(initialMessages);
  const [content, setContent] = useState("");
  const [partial, setPartial] = useState("");
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<Extract<ChatEvent, { type: "usage" }>>();
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const active = useRef<string | null>(null);
  const latest = messages.at(-1);
  const needsRetry = latest?.role === "user" && latest.status === "failed";
  const storedPending = latest?.status === "pending";

  const composerDisabled = pending || documentBusy || needsRetry || storedPending;
  const suggestions = initialCv
    ? ["Draft a CV for the saved job description.", "Explain which experience best matches this role."]
    : ["Help me organize my career notes.", "What information is missing from my profile?"];

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
      try {
        const reply = await sendChatMessage(retryId ? { chatId, retryId } : { chatId, content });
        active.current = reply.messageId;
        if (!retryId) setContent("");
        setMessages(await readChatMessages(chatId));
        const reader = reply.stream.getReader();
        try {
          for (;;) {
            const { value: event, done } = await reader.read();
            if (done) break;
            if (event.type === "text-delta") setPartial(text => text + event.text);
            if (event.type === "usage") setUsage(event);
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
        setError("Could not finish the reply. Your saved messages remain available; retry when connected.");
      } finally {
        active.current = null;
        try { setMessages(await readChatMessages(chatId)); } catch { /* Keep the visible conversation during a connection failure. */ }
        if (finished) {
          setPartial("");
          try { setProfile(await readProfileWorkspace(chatId)); if (initialCv) setCv(await readCvWorkspace(chatId)); } catch { setError("Reply saved. Refresh to load the document review."); }
        }
      }
    });
  }

  return <div className="grid items-start gap-6 lg:grid-cols-2"><div className="min-w-0 overflow-hidden rounded-xl border bg-card">
    <MessageScrollerProvider key={chatId}>
      <div className="flex h-[min(48rem,85dvh)] min-h-96 flex-col">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div><h2 className="text-sm font-semibold">{initialCv ? "CV assistant" : "Career assistant"}</h2><p className="text-xs text-muted-foreground">{initialCv ? "Tailor your experience to the next opportunity." : "Turn career notes into a confirmed profile."}</p></div>
          <span role="status" className="flex items-center gap-2 text-xs text-muted-foreground">{pending ? <><Spinner aria-hidden="true" />Replying</> : "Ready"}</span>
        </div>
        <div className="min-h-0 flex-1">
          <MessageScroller>
            <MessageScrollerViewport>
              <MessageScrollerContent aria-label="Conversation" aria-busy={pending} className="gap-6 p-4 sm:p-6">
                {messages.length === 0 && <Empty className="my-auto"><EmptyHeader>
                  <EmptyMedia variant="icon"><SparklesIcon /></EmptyMedia>
                  <EmptyTitle>{initialCv ? "Build your next CV" : "Start with your story"}</EmptyTitle>
                  <EmptyDescription>{initialCv ? "Save a job description beside chat, then ask for a tailored draft." : "Paste rough career notes. Review proposed changes before saving them to your shared profile."}</EmptyDescription>
                </EmptyHeader></Empty>}
                {messages.map(message => <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={message.role === "user"}>
                  <MessageRow align={message.role === "user" ? "end" : "start"}>
                    <MessageContent>
                      <MessageHeader>{message.role === "user" ? "You" : "Assistant"}</MessageHeader>
                      {message.role === "user" ? <Bubble variant="muted" align="end"><BubbleContent className="whitespace-pre-wrap break-words">{message.content}</BubbleContent></Bubble> : <ChatMarkdown text={message.content} />}
                      {message.status !== "complete" && <MessageFooter>{message.status === "failed" ? "Reply failed. Your message is saved." : pending ? "Reply in progress…" : "Reply interrupted. Stop it below to retry."}</MessageFooter>}
                    </MessageContent>
                  </MessageRow>
                </MessageScrollerItem>)}
                {(partial || pending) && <MessageScrollerItem messageId="active-reply"><MessageRow><MessageContent>
                  <MessageHeader>Assistant · {pending ? "replying" : "incomplete"}</MessageHeader>
                  {partial ? <ChatMarkdown text={partial} /> : <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner aria-hidden="true" />Preparing your reply…</div>}
                </MessageContent></MessageRow></MessageScrollerItem>}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </div>
        <div className="space-y-3 border-t p-4">
          {error && <Alert variant="destructive"><AlertTitle>Reply needs attention</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {usage && <Collapsible><CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="text-muted-foreground">Reply token usage<ChevronDownIcon /></Button></CollapsibleTrigger><CollapsibleContent className="px-3 text-xs text-muted-foreground">Tokens: {usage.inputTokens} input · {usage.outputTokens} output · {usage.cacheReadTokens} cache read · {usage.cacheWriteTokens} cache write</CollapsibleContent></Collapsible>}
          {(needsRetry || storedPending) && !pending && <Button variant="secondary" onClick={() => {
            if (storedPending) startTransition(() => stop(latest.id));
            else send(latest.id);
          }}>{storedPending ? "Stop interrupted reply" : "Retry saved message"}</Button>}
          {messages.length === 0 && <div className="flex gap-2 overflow-x-auto pb-1">{suggestions.map(prompt => <Button key={prompt} variant="outline" size="sm" className="shrink-0" disabled={!!composerDisabled} onClick={() => { setContent(prompt); document.getElementById(`message-${chatId}`)?.focus(); }}>{prompt}</Button>)}</div>}
          <form ref={formRef} className="space-y-2" onSubmit={event => { event.preventDefault(); if (!composerDisabled && content.trim()) send(); }}>
            <Label htmlFor={`message-${chatId}`} className="sr-only">Message</Label>
            <InputGroup>
              <InputGroupTextarea id={`message-${chatId}`} value={content} onChange={event => setContent(event.target.value)} maxLength={100000} required disabled={!!composerDisabled} placeholder={initialCv ? "Ask for a draft, discuss selections, or request changes…" : "Tell me about your experience…"} className="max-h-48 min-h-24" onKeyDown={event => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); formRef.current?.requestSubmit(); }
              }} />
              <InputGroupAddon align="block-end">
                <span className="text-xs text-muted-foreground">Shift + Enter for a new line</span>
                {pending ? <InputGroupButton className="ml-auto" variant="outline" size="sm" disabled={!storedPending} onClick={() => {
                  const id = active.current;
                  if (id) startTransition(() => stop(id));
                }}><SquareIcon />Stop reply</InputGroupButton> : <InputGroupButton type="submit" className="ml-auto" variant="default" size="sm" disabled={!!composerDisabled || !content.trim()}><ArrowUpIcon />Send message</InputGroupButton>}
              </InputGroupAddon>
            </InputGroup>
          </form>
        </div>
      </div>
    </MessageScrollerProvider>
  </div><div className="min-w-0">{cv ? <Tabs defaultValue="cv"><TabsList><TabsTrigger value="cv">CV workspace</TabsTrigger><TabsTrigger value="profile">Career profile ({profile.proposals.filter(item => item.status === "pending").length} pending)</TabsTrigger></TabsList>
    <TabsContent value="cv"><CvReview chatId={chatId} workspace={cv} onChange={setCv} onRevise={setContent} sending={pending || documentBusy || !!storedPending} onBusyChange={setDocumentBusy} currentProfileId={profile.revisions[0]?.id ?? null} /></TabsContent>
    <TabsContent value="profile"><ProfileReview chatId={chatId} workspace={profile} onChange={setProfile} onRevise={setContent} sending={pending || documentBusy || !!storedPending} /></TabsContent>
  </Tabs> : <ProfileReview chatId={chatId} workspace={profile} onChange={setProfile} onRevise={setContent} sending={pending || !!storedPending} />}</div></div>;
}
