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
import { Textarea } from "@/components/ui/textarea";

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
  const active = useRef<string | null>(null);
  const latest = messages.at(-1);
  const needsRetry = latest?.role === "user" && latest.status === "failed";
  const storedPending = latest?.status === "pending";

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

  return <div className="grid items-start gap-6 lg:grid-cols-2"><div className="min-w-0 space-y-4">
    {messages.length === 0 && <p className="text-sm text-muted-foreground">{initialCv ? "Save a job description beside chat, then ask for a tailored draft." : "Paste career notes or ask for advice to start."}</p>}
    {messages.map(message => <MessageRow key={message.id} align={message.role === "user" ? "end" : "start"}>
      <MessageContent>
        <MessageHeader>{message.role === "user" ? "You" : "Assistant"}</MessageHeader>
        <Bubble><BubbleContent className="whitespace-pre-wrap break-words">{message.content}</BubbleContent></Bubble>
        {message.status !== "complete" && <MessageFooter>{message.status === "failed" ? "Reply failed. Your message is saved." : "Waiting for reply…"}</MessageFooter>}
      </MessageContent>
    </MessageRow>)}
    {partial && <MessageRow><MessageContent>
      <MessageHeader>Assistant · {pending ? "replying" : "incomplete"}</MessageHeader>
      <Bubble><BubbleContent aria-live="polite" className="whitespace-pre-wrap break-words">{partial}</BubbleContent></Bubble>
    </MessageContent></MessageRow>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {usage && <p className="text-xs text-muted-foreground">Tokens: {usage.inputTokens} input · {usage.outputTokens} output · {usage.cacheReadTokens} cache read · {usage.cacheWriteTokens} cache write</p>}
    {(needsRetry || storedPending) && !pending && <Button variant="secondary" onClick={() => {
      if (storedPending) startTransition(() => stop(latest.id));
      else send(latest.id);
    }}>{storedPending ? "Stop interrupted reply" : "Retry saved message"}</Button>}
    <form className="space-y-2" onSubmit={event => { event.preventDefault(); if (!pending && !documentBusy && !needsRetry && !storedPending && content.trim()) send(); }}>
      <Label htmlFor={`message-${chatId}`}>Message</Label>
      <Textarea id={`message-${chatId}`} value={content} onChange={event => setContent(event.target.value)} maxLength={100000} required disabled={pending || documentBusy || needsRetry || storedPending} placeholder={initialCv ? "Ask for a draft, discuss selections, or request changes…" : "Tell me about your experience…"} />
      <Button type="submit" disabled={pending || documentBusy || needsRetry || storedPending || !content.trim()}>{pending ? "Replying…" : "Send message"}</Button>
      {pending && <Button type="button" variant="outline" onClick={() => {
        const id = active.current;
        if (id) startTransition(() => stop(id));
      }}>Stop reply</Button>}
    </form>
  </div><div className="min-w-0">{cv ? <Tabs defaultValue="cv"><TabsList><TabsTrigger value="cv">CV workspace</TabsTrigger><TabsTrigger value="profile">Career profile ({profile.proposals.filter(item => item.status === "pending").length} pending)</TabsTrigger></TabsList>
    <TabsContent value="cv"><CvReview chatId={chatId} workspace={cv} onChange={setCv} onRevise={setContent} sending={pending || documentBusy || !!storedPending} onBusyChange={setDocumentBusy} currentProfileId={profile.revisions[0]?.id ?? null} /></TabsContent>
    <TabsContent value="profile"><ProfileReview chatId={chatId} workspace={profile} onChange={setProfile} onRevise={setContent} sending={pending || documentBusy || !!storedPending} /></TabsContent>
  </Tabs> : <ProfileReview chatId={chatId} workspace={profile} onChange={setProfile} onRevise={setContent} sending={pending || !!storedPending} />}</div></div>;
}
