// Executed only in a terminable Node worker; parsers never run on the request thread.
import { parentPort, workerData } from "node:worker_threads";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import mammoth from "mammoth";
import { fileTypeFromBuffer } from "file-type";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp from "sharp";
import yauzl from "yauzl";

const MiB = 1024 * 1024;
const require = createRequire(import.meta.url);

async function inspectZip(bytes) {
  await new Promise((resolve, reject) => {
    yauzl.fromBuffer(bytes, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error) return reject(error);
      let count = 0, declared = 0, actual = 0;
      const fail = error => { zip.close(); reject(error); };
      zip.on("error", fail);
      zip.on("end", resolve);
      zip.on("entry", entry => {
        declared += entry.uncompressedSize;
        if (++count > 1000 || declared > 20 * MiB) return fail(new Error("DOCX archive exceeds 1,000 entries or 20 MiB expanded data."));
        if (entry.generalPurposeBitFlag & 1) return fail(new Error("Encrypted DOCX entries are not supported."));
        zip.openReadStream(entry, (error, stream) => {
          if (error) return fail(error);
          stream.on("error", fail);
          stream.on("data", chunk => {
            actual += chunk.length;
            if (actual > 20 * MiB) { stream.destroy(); fail(new Error("DOCX expanded data exceeds 20 MiB.")); }
          });
          stream.on("end", () => zip.readEntry());
        });
      });
      zip.readEntry();
    });
  });
}

async function prepare({ bytes: raw, name, mediaType }) {
  const bytes = Buffer.from(raw);
  const extension = name.split(".").at(-1).toLowerCase();
  let text = "", pages = 0;
  if (extension === "docx") await inspectZip(bytes);
  const detected = await fileTypeFromBuffer(bytes);
  if (extension === "txt" || extension === "md") {
    if (detected) throw new Error("File signature does not match UTF-8 text.");
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { throw new Error("Text must use valid UTF-8 encoding."); }
    if (!text.trim() || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) throw new Error("Text is empty or contains binary/control data.");
  } else {
    if (!detected || detected.mime !== mediaType) throw new Error("File signature does not match its extension and type.");
    if (extension === "docx") {
      text = (await mammoth.extractRawText({ buffer: bytes }, { externalFileAccess: false })).value;
      if (!text.trim()) throw new Error("DOCX has no readable text. Export to PDF or attach images separately; DOCX supports text only.");
    } else if (extension === "pdf") {
      const task = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, enableXfa: false, useSystemFonts: false, useWorkerFetch: false, stopAtErrors: true,
        standardFontDataUrl: join(dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts") + "/" });
      try {
        const document = await task.promise;
        pages = document.numPages;
        if (pages < 1 || pages > 100) throw new Error("PDF exceeds 100 pages.");
        for (let number = 1; number <= pages; number++) {
          const page = await document.getPage(number);
          await page.getOperatorList();
          page.cleanup();
        }
      } catch (error) {
        if (error.name === "PasswordException") throw new Error("Encrypted/password-protected PDFs are not supported. Export an unprotected PDF.");
        throw error;
      } finally { await task.destroy(); }
    } else {
      const image = sharp(bytes, { animated: true, failOn: "warning", limitInputPixels: 64_000_000 });
      const metadata = await image.metadata();
      if ((metadata.pages ?? 1) > 1) throw new Error("Animated images are not supported. Upload a still image.");
      if (!metadata.width || !metadata.height || metadata.width > 8000 || metadata.height > 8000 || metadata.width * metadata.height > 64_000_000) throw new Error("Images must fit within 8000 × 8000 and 64 million pixels.");
      await image.raw().toBuffer();
    }
  }
  if (Buffer.byteLength(text, "utf8") > MiB) throw new Error("Extracted text exceeds 1 MiB. Use a smaller document.");
  return { text, pages, preparationVersion: 1 };
}

try { parentPort.postMessage({ value: await prepare(workerData) }); }
catch (error) {
  // Only deliberate validation messages cross the worker boundary; parser diagnostics stay private.
  const message = error instanceof Error ? error.message : "";
  const expected = /^(DOCX (archive|expanded data|has no readable text)|Encrypted|Text (must|is empty)|File signature|PDF exceeds|Animated images|Images must|Extracted text)/.test(message);
  parentPort.postMessage({ error: expected ? message : "File is corrupt or unreadable. Export a fresh copy and try again." });
}
