// Feasibility probes only. Production validation belongs to Ticket 11.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import mammoth from "mammoth";
import { fileTypeFromBuffer } from "file-type";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp from "sharp";
import yauzl from "yauzl";

const directory = fileURLToPath(new URL(".", import.meta.url));
const file = name => readFileSync(join(directory, "fixtures", name));
const results = [];
async function probe(name, operation) {
  await operation();
  results.push({ name, passed: true });
  console.log("PASS", name);
}

await probe("signature detection distinguishes all binary formats", async () => {
  for (const [name, ext] of [["text.pdf", "pdf"], ["career.docx", "docx"], ["image.png", "png"], ["image.jpg", "jpg"], ["image.webp", "webp"]]) {
    assert.equal((await fileTypeFromBuffer(file(name)))?.ext, ext);
  }
});
await probe("DOCX extracts heading, paragraphs and table cells", async () => {
  const result = await mammoth.extractRawText({ buffer: file("career.docx") });
  assert.match(result.value, /DOCX-LARCH-6934/);
  assert.match(result.value, /TABLE-ASH-4628/);
  assert.match(result.value, /TypeScript/);
  assert.equal(result.messages.length, 0);
  mkdirSync(join(directory, "results"), { recursive: true });
  writeFileSync(join(directory, "results", "docx.txt"), result.value);
});
await probe("image-only DOCX has no usable text; must reject explicitly", async () => {
  const result = await mammoth.extractRawText({ buffer: file("image-only.docx") });
  assert.equal(result.value.trim(), "");
});
await probe("corrupt DOCX rejects", async () => {
  await assert.rejects(() => mammoth.extractRawText({ buffer: file("corrupt.docx") }));
});
await probe("UTF-8 text decodes losslessly; invalid encoding rejects", async () => {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  assert.match(decoder.decode(file("notes.txt")), /TEXT-MAPLE-3187.*ไทย/);
  assert.match(decoder.decode(file("notes.md")), /MARKDOWN-BIRCH-8041/);
  assert.throws(() => decoder.decode(file("invalid.txt")));
});
function pdf(name) {
  return getDocument({ data: new Uint8Array(file(name)), isEvalSupported: false, useSystemFonts: false, stopAtErrors: true, standardFontDataUrl: fileURLToPath(new URL("node_modules/pdfjs-dist/standard_fonts/", import.meta.url)) + "/" });
}
await probe("PDF validates page count; scanned PDF needs native visual handling", async () => {
  for (const [name, expected] of [["text.pdf", "PDF-ORBIT-8462"], ["scan.pdf", ""]]) {
    const task = pdf(name);
    const document = await task.promise;
    try {
      assert.equal(document.numPages, 1);
      const page = await document.getPage(1);
      const content = await page.getTextContent();
      const text = content.items.map(item => item.str ?? "").join(" ");
      if (expected) assert.match(text, new RegExp(expected));
      else assert.equal(text, "");
    } finally { await task.destroy(); }
  }
});
await probe("encrypted and corrupt PDFs reject before provider", async () => {
  for (const name of ["encrypted.pdf", "corrupt.pdf"]) {
    const task = pdf(name);
    try { await assert.rejects(() => task.promise, name === "encrypted.pdf" ? error => error.name === "PasswordException" : undefined); }
    finally { await task.destroy(); }
  }
});
await probe("image formats decode; truncated image rejects", async () => {
  for (const name of ["image.png", "image.jpg", "image.webp"]) {
    const decoded = await sharp(file(name), { failOn: "warning", limitInputPixels: 64_000_000 }).raw().toBuffer({ resolveWithObject: true });
    assert.equal(decoded.info.width, 1000);
    assert.equal(decoded.info.height, 400);
  }
  await assert.rejects(() => sharp(file("corrupt.png"), { failOn: "warning" }).raw().toBuffer());
});
await probe("ZIP directory exposes expansion before DOCX extraction", async () => {
  // yauzl owns ZIP parsing; no archive entries are extracted to the filesystem.
  const size = await new Promise((resolve, reject) => {
    yauzl.fromBuffer(file("expanded.docx"), { lazyEntries: true }, (error, zip) => {
      if (error) return reject(error);
      let total = 0;
      zip.on("error", reject);
      zip.on("entry", entry => { total += entry.uncompressedSize; zip.readEntry(); });
      zip.on("end", () => resolve(total));
      zip.readEntry();
    });
  });
  assert.ok(file("expanded.docx").length < 100_000);
  assert.ok(size > 20 * 1024 * 1024);
});
writeFileSync(join(directory, "results", "parsing.json"), JSON.stringify(results, null, 2));
