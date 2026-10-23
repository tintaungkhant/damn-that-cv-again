"use client";

import { useRef, useTransition } from "react";
import { DownloadIcon, FileIcon, PaperclipIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { downloadChatAttachment } from "@/app/chat-actions";
import { attachmentAccept, selectionError, type AttachmentMetadata } from "@/lib/attachments/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Attachment, AttachmentActions, AttachmentAction, AttachmentContent, AttachmentDescription, AttachmentGroup, AttachmentMedia, AttachmentTitle } from "@/components/ui/attachment";

function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MiB` : `${Math.max(1, Math.ceil(bytes / 1024))} KiB`;
}

export function AttachmentPicker({ files, onChange, disabled, onError }: { files: File[]; onChange: (files: File[]) => void; disabled: boolean; onError: (error: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="flex min-w-0 flex-col gap-2">
    <div className="flex flex-wrap items-center gap-2">
      <Input ref={input} type="file" multiple accept={attachmentAccept} className="sr-only" aria-label="Select chat attachments" disabled={disabled} onChange={event => {
        const next = [...files, ...Array.from(event.target.files ?? [])];
        event.target.value = "";
        const error = selectionError(next);
        if (error) onError(error);
        else { onChange(next); onError(""); }
      }} />
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => input.current?.click()}><PaperclipIcon />Attach files</Button>
      <span className="text-xs text-muted-foreground">PDF, DOCX, TXT/MD, PNG, JPEG, WebP · 5 files · 10 MiB each · 20 MiB total</span>
    </div>
    {files.length > 0 && <AttachmentGroup aria-label="Selected attachments">{files.map((file, index) => <Attachment key={`${index}-${file.name}`} size="sm" state="idle">
      <AttachmentMedia><FileIcon /></AttachmentMedia>
      <AttachmentContent><AttachmentTitle title={file.name}>{file.name}</AttachmentTitle><AttachmentDescription>{sizeLabel(file.size)}</AttachmentDescription></AttachmentContent>
      <AttachmentActions><AttachmentAction type="button" aria-label={`Remove ${file.name}`} disabled={disabled} onClick={() => onChange(files.filter((_, current) => current !== index))}><XIcon /></AttachmentAction></AttachmentActions>
    </Attachment>)}</AttachmentGroup>}
    {files.some(file => /\.docx$/i.test(file.name)) && <p role="note" className="text-xs text-muted-foreground">DOCX is text only. Embedded images and rendered layout are not analyzed. Export to PDF or attach images separately when those matter.</p>}
  </div>;
}

export function SavedAttachments({ chatId, files }: { chatId: string; files: AttachmentMetadata[] }) {
  const [pending, startTransition] = useTransition();
  return <AttachmentGroup aria-label="Saved attachments">{files.map(file => <Attachment key={file.id} size="sm">
    <AttachmentMedia><FileIcon /></AttachmentMedia>
    <AttachmentContent><AttachmentTitle title={file.name}>{file.name}</AttachmentTitle><AttachmentDescription>{file.mediaType} · {sizeLabel(file.size)}{file.mediaType.includes("wordprocessingml") ? " · Text only" : ""}</AttachmentDescription></AttachmentContent>
    <AttachmentActions><AttachmentAction aria-label={`Download ${file.name}`} disabled={pending} onClick={() => startTransition(async () => {
      try {
        const result = await downloadChatAttachment({ chatId, attachmentId: file.id });
        if ("error" in result) { toast.error(result.error); return; }
        const url = URL.createObjectURL(new Blob([new Uint8Array(result.bytes)], { type: result.mediaType }));
        const link = document.createElement("a");
        link.href = url; link.download = result.name; document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch { toast.error("Could not download the attachment. Check your connection and retry."); }
    })}>{pending ? <Spinner /> : <DownloadIcon />}</AttachmentAction></AttachmentActions>
  </Attachment>)}</AttachmentGroup>;
}
