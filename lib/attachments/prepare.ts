import { Worker } from "node:worker_threads";
import { join } from "node:path";
import { mediaTypes, selectionError, type PreparedAttachment } from "./types.ts";

const preparation = globalThis as typeof globalThis & { cvAttachmentBusy?: boolean };

export class UploadError extends Error {}

export async function prepareUpload(form: FormData): Promise<PreparedAttachment[]> {
  const values = form.getAll("files");
  if (values.some(value => !(value instanceof File))) throw new UploadError("Each attachment must be a file.");
  const files = values as File[];
  const error = selectionError(files);
  if (error) throw new UploadError(error);
  if (!files.length) return [];
  if (preparation.cvAttachmentBusy) throw new UploadError("Another upload is being prepared. Wait a moment and try again.");
  preparation.cvAttachmentBusy = true;
  try {
    const prepared: PreparedAttachment[] = [];
    for (const file of files) {
      const extension = file.name.split(".").at(-1)!.toLowerCase() as keyof typeof mediaTypes;
      const mediaType = mediaTypes[extension];
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await new Promise<Pick<PreparedAttachment, "text" | "pages" | "preparationVersion">>((resolve, reject) => {
        // Keep this runtime file outside Next's bundle so native parsers and worker termination work in dev and production.
        const worker = new Worker('const { workerData } = require("node:worker_threads"); import(require("node:url").pathToFileURL(workerData.parserPath).href);', {
          eval: true,
          workerData: { parserPath: join(process.cwd(), "lib", "attachments", "parser.mjs"), name: file.name, mediaType, bytes }, resourceLimits: { maxOldGenerationSizeMb: 256 },
        });
        let settled = false;
        const finish = (error?: Error, value?: Pick<PreparedAttachment, "text" | "pages" | "preparationVersion">) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          void worker.terminate().then(() => error ? reject(error) : resolve(value!), () => reject(new UploadError(`${file.name}: could not stop file preparation.`)));
        };
        const timer = setTimeout(() => finish(new UploadError(`${file.name}: preparation exceeded 15 seconds. Use a smaller file.`)), 15_000);
        worker.once("message", message => finish(message.error ? new UploadError(`${file.name}: ${message.error}`) : undefined, message.value));
        worker.once("error", () => finish(new UploadError(`${file.name}: file preparation failed. Use a smaller file or export a fresh copy.`)));
        worker.once("exit", () => { if (!settled) finish(new UploadError(`${file.name}: file preparation stopped unexpectedly.`)); });
      });
      prepared.push({ name: file.name, mediaType, bytes, ...result });
    }
    return prepared;
  } finally { preparation.cvAttachmentBusy = false; }
}
