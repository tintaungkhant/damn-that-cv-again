import { z } from "zod";

export const MiB = 1024 * 1024;
export const attachmentAccept = ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp";
export const mediaTypes = {
  pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain", md: "text/markdown", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
} as const;
export const preparedAttachment = z.object({
  name: z.string().min(1).max(255).refine(name => !/[\x00-\x1f\x7f/\\]/.test(name), "Invalid filename."),
  mediaType: z.enum(Object.values(mediaTypes)),
  bytes: z.instanceof(Uint8Array).refine(bytes => bytes.length > 0 && bytes.length <= 10 * MiB, "Files must be between 1 byte and 10 MiB."),
  text: z.string().refine(text => Buffer.byteLength(text, "utf8") <= MiB, "Extracted text exceeds 1 MiB."),
  pages: z.number().int().min(0).max(100),
  preparationVersion: z.literal(1),
}).strict();
export type PreparedAttachment = z.infer<typeof preparedAttachment>;
export type AttachmentMetadata = { id: string; name: string; mediaType: string; size: number };

export function selectionError(files: readonly { name: string; size: number; type: string }[]): string | undefined {
  if (files.length > 5) return "Attach at most five files per message.";
  if (files.reduce((sum, file) => sum + file.size, 0) > 20 * MiB) return "Combined files exceed 20 MiB. Select smaller files.";
  for (const file of files) {
    if (!file.name || file.name.length > 255 || /[\x00-\x1f\x7f/\\]/.test(file.name)) return "Use a filename of 1–255 characters without path separators or control characters.";
    if (!file.size || file.size > 10 * MiB) return `${file.name}: files must be between 1 byte and 10 MiB.`;
    const extension = file.name.split(".").at(-1)?.toLowerCase();
    if (!extension || !(extension in mediaTypes)) return `${file.name}: use PDF, DOCX, UTF-8 TXT/MD, PNG, JPEG, or WebP.`;
    const expected = mediaTypes[extension as keyof typeof mediaTypes];
    if (file.type && file.type !== expected && !(extension === "md" && file.type === "text/plain")) return `${file.name}: declared type does not match its extension.`;
  }
}
