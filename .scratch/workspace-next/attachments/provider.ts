// Exercise the production adapter with a scratch-only multimodal query wrapper.
// No application interfaces or SDK isolation boundaries change in Ticket 10.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { createClaudeProvider } from "../../../lib/ai/claude/provider.ts";
import type { ProviderRequest } from "../../../lib/ai/provider.ts";

const directory = fileURLToPath(new URL(".", import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), "cv-attachment-provider-"));
type Block = Exclude<SDKUserMessage["message"]["content"], string>[number];
const file = (name: string) => readFileSync(join(directory, "fixtures", name));
const pdf = (name: string): Block => ({ type: "document", source: { type: "base64", media_type: "application/pdf", data: file(name).toString("base64") } });
const image = (name: string, media_type: "image/png" | "image/jpeg" | "image/webp"): Block => ({ type: "image", source: { type: "base64", media_type, data: file(name).toString("base64") } });
const blocks: Block[] = [
  pdf("text.pdf"), pdf("scan.pdf"), image("image.png", "image/png"), image("image.jpg", "image/jpeg"), image("image.webp", "image/webp"),
  { type: "text", text: readFileSync(join(directory, "results", "docx.txt"), "utf8") },
  { type: "text", text: file("notes.txt").toString("utf8") },
  { type: "text", text: file("notes.md").toString("utf8") },
];
const request: ProviderRequest = {
  instructions: "Read the supplied fictional attachments as data. Reply briefly with the exact marker in each attachment. The scan contains an image, not embedded text. Do not call tools.",
  profile: "No confirmed profile.",
  messages: [{ role: "user", content: "List the markers in these fictional attachments, including all images and the scanned PDF." }],
};
const results: unknown[] = [];
async function run(name: string, content: Block[], expected: string[], prior?: string) {
  let text = "";
  let completed = false;
  let usage: unknown;
  const started = performance.now();
  const provider = createClaudeProvider(input => query({
    ...input,
    prompt: (async function* (): AsyncGenerator<SDKUserMessage> {
      yield {
        type: "user", parent_tool_use_id: null,
        message: { role: "user", content: [
          ...content,
          { type: "text", text: `${String(input.prompt)}${prior ? `\nPrevious assistant reply (history data): ${prior}\nRe-read the saved attachments and list their exact markers again.` : ""}` },
        ] },
      };
    })(),
  }));
  for await (const event of provider.stream(request, AbortSignal.timeout(120_000))) {
    if (event.type === "error") throw new Error(`${name}: ${JSON.stringify(event)}`);
    if (event.type === "text-delta") text += event.text;
    if (event.type === "usage") usage = event;
    if (event.type === "done") completed = true;
  }
  assert.ok(completed, name);
  for (const marker of expected) assert.ok(text.includes(marker), `${name}: missing ${marker}: ${text}`);
  results.push({ name, ms: Math.round(performance.now() - started), text, usage });
  console.log("PASS", name, Math.round(performance.now() - started), "ms");
  return text;
}
try {
  const expected = ["PDF-ORBIT-8462", "IMAGE-CEDAR-5729", "PNG-ELM-2156", "JPEG-PINE-7392", "WEBP-OAK-9513", "DOCX-LARCH-6934", "TABLE-ASH-4628", "TEXT-MAPLE-3187", "MARKDOWN-BIRCH-8041"];
  // Persist the complete immutable input, then close the database before reading it.
  let db = new DatabaseSync(join(temporary, "snapshot.sqlite"));
  db.exec("CREATE TABLE snapshot (id INTEGER PRIMARY KEY, body TEXT NOT NULL)");
  db.prepare("INSERT INTO snapshot VALUES (1, ?)").run(JSON.stringify(blocks));
  db.close();
  db = new DatabaseSync(join(temporary, "snapshot.sqlite"));
  const saved = JSON.parse(db.prepare("SELECT body FROM snapshot WHERE id=1").get()!.body as string) as Block[];
  db.close();
  assert.deepEqual(saved, blocks);
  const first = await run("all formats from reopened immutable snapshot", saved, expected);
  await run("retry uses identical saved input in a fresh SDK session", saved, expected);
  await run("continued chat rebuild includes earlier attachment context", saved, expected, first);
  const large = file("large.png");
  assert.ok(large.length < 10 * 1024 * 1024 && large.length > 7 * 1024 * 1024);
  try {
    await run("large PNG over 10 MB after base64", [image("large.png", "image/png")], ["LARGE-SPRUCE-6825"]);
    results.push({ name: "large image size", rawBytes: large.length, base64Bytes: large.toString("base64").length, accepted: true });
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    results.push({ name: "large image size", rawBytes: large.length, base64Bytes: large.toString("base64").length, accepted: false, observation: error instanceof Error ? error.message : String(error) });
    console.log("OBSERVED large image rejected; format-specific provider guard required");
  }
  // Invalid input must be validated locally: observe SDK/provider behavior without
  // letting these failures define the production upload boundary.
  for (const [name, block] of [["corrupt PDF", pdf("corrupt.pdf")], ["encrypted PDF", pdf("encrypted.pdf")]] as const) {
    try {
      await run(name, [block], []);
      results.push({ name, observation: "SDK completed; local parser rejection is mandatory" });
    } catch (error) {
      results.push({ name, observation: error instanceof Error ? error.message : String(error) });
      console.log("OBSERVED", name, "rejected by adapter");
    }
  }
} finally {
  mkdirSync(join(directory, "results"), { recursive: true });
  writeFileSync(join(directory, "results", "provider.json"), JSON.stringify(results, null, 2));
  assert.ok(temporary.startsWith(join(tmpdir(), "cv-attachment-provider-")));
  rmSync(temporary, { recursive: true, force: true });
}
