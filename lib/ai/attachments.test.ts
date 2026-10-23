import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../storage/store.ts";
import { createChatService } from "./chat.ts";
import type { ChatProvider, ProviderRequest } from "./provider.ts";
import { mediaTypes } from "../attachments/types.ts";

function upload(chatId: string, names: string[], content = "") {
  const form = new FormData();
  form.set("chatId", chatId); form.set("content", content);
  for (const name of names) form.append("files", new File([readFileSync(new URL(`./fixtures/${name}`, import.meta.url))], name, { type: mediaTypes[name.split('.').at(-1) as keyof typeof mediaTypes] }));
  return form;
}
async function consume(reply: { stream: ReadableStream }) {
  const reader = reply.stream.getReader();
  const events = [];
  for (;;) { const item = await reader.read(); if (item.done) return events; events.push(item.value); }
}

test("all attachment formats reach provider context after restart and immutable retry in either chat category", async () => {
  for (const category of ["profile", "build"] as const) {
    const folder = mkdtempSync(join(tmpdir(), "cv-replay-"));
    const path = join(folder, "app.sqlite");
    let store = openStore(path);
    const chat = store.createChat({ category, title: "Files" });
    const requests: ProviderRequest[] = [];
    const provider: ChatProvider = { async *stream(request) {
      requests.push(request);
      if (requests.length === 1) { yield { type: "error", code: "provider", message: "Offline" }; return; }
      yield { type: "text-delta", text: "Read the files." }; yield { type: "done" };
    }};
    try {
      let service = createChatService(store, provider);
      const first = await service.upload(upload(chat.id, ["text.pdf", "scan.pdf", "career.docx", "notes.txt", "notes.md"]));
      assert.ok(!("error" in first), JSON.stringify(first));
      await consume(first);
      const saved = store.getMessages(chat.id)[0];
      assert.equal(saved.attachments!.length, 5);
      assert.equal(saved.status, "failed");
      store.close(); store = openStore(path); service = createChatService(store, provider);
      await consume(service.send({ chatId: chat.id, retryId: saved.id }));
      assert.deepEqual(requests[1], requests[0]);
      assert.match(requests[1].messages[0].attachments![2].text, /TABLE-ASH-4628/);
      const next = await service.upload(upload(chat.id, ["image.png", "image.jpg", "image.webp"], "Continue"));
      assert.ok(!("error" in next), JSON.stringify(next));
      await consume(next);
      assert.equal(requests[2].messages[0].attachments!.length, 5);
      assert.equal(requests[2].messages.at(-1)!.attachments!.length, 3);
      assert.deepEqual(store.getMessages(chat.id).map(item => item.role), ["user", "assistant", "user", "assistant"]);
      assert.equal(store.getProfileRevisions().length, 0);
    } finally { store.close(); rmSync(folder, { recursive: true, force: true }); }
  }
});

test("uploads reject invalid files and fields before saving or contacting the provider", async () => {
  const store = openStore(":memory:");
  const chat = store.createChat({ category: "profile", title: "Validation" });
  let calls = 0;
  const service = createChatService(store, { async *stream() { calls++; yield { type: "done" }; } });
  try {
    for (const [name, pattern] of [
      ["corrupt.pdf", /corrupt|signature/i], ["encrypted.pdf", /Encrypted/i],
      ["corrupt.docx", /corrupt/i], ["corrupt.png", /corrupt/i], ["invalid.txt", /UTF-8/i],
      ["image-only.docx", /PDF or attach images.*text only/i],
    ] as const) {
      const result = await service.upload(upload(chat.id, [name]));
      assert.ok("error" in result && pattern.test(result.error), `${name}: ${JSON.stringify(result)}`);
    }
    const cases: [File[], RegExp][] = [
      [Array.from({ length: 6 }, () => new File(["notes"], "notes.txt")), /five/],
      [[new File([new Uint8Array(10 * 1024 * 1024 + 1)], "huge.txt")], /10 MiB/],
      [[8, 8, 5].map(size => new File([new Uint8Array(size * 1024 * 1024)], "notes.txt")), /20 MiB/],
      [[new File([""], "empty.txt")], /1 byte/],
      [[new File(["notes"], "notes.exe")], /use PDF/],
      [[new File(["notes"], "notes.txt", { type: "image/png" })], /declared type/],
      [[new File([readFileSync(new URL("./fixtures/image.png", import.meta.url))], "fake.pdf")], /signature/],
      [[new File(["a\0b"], "binary.txt")], /binary/],
      [[new File([" "] , "empty.md")], /empty/],
      [[new File(["x"], "a".repeat(256) + ".txt")], /filename/],
    ];
    for (const [files, pattern] of cases) {
      const form = upload(chat.id, [], "Still atomic");
      for (const file of files) form.append("files", file);
      const result = await service.upload(form);
      assert.ok("error" in result && pattern.test(result.error), JSON.stringify(result));
    }
    const corruptSecond = await service.upload(upload(chat.id, ["notes.txt", "corrupt.pdf"]));
    assert.ok("error" in corruptSecond);
    const malformed = upload(chat.id, []); malformed.append("files", "not a file");
    assert.ok("error" in await service.upload(malformed));
    const forged = upload(chat.id, []); forged.set("attachments", "forged prepared input");
    assert.ok("error" in await service.upload(forged));
    assert.ok("error" in await service.upload(upload("bad-id", ["notes.txt"])));
    assert.ok("error" in await service.upload(upload(chat.id, [])));
    assert.equal(calls, 0);
    assert.deepEqual(store.getMessages(chat.id), []);
  } finally { store.close(); }
});

test("upload safety bounds reject expanded/oversized archives, animations, unreadable DOCX and oversized extracted text", async () => {
  const store = openStore(":memory:");
  const chat = store.createChat({ category: "profile", title: "Safety" });
  const service = createChatService(store, { async *stream() { assert.fail("Invalid files must not reach provider"); } });
  try {
    for (const [name, pattern] of [
      ["expanded.docx", /20 MiB/], ["entries.docx", /1,000/], ["lying-size.docx", /corrupt/],
      ["animated.webp", /Animated/], ["wide.png", /8000/], ["too-many-pages.pdf", /100 pages/], ["xml-corrupt.docx", /corrupt/],
    ] as const) {
      const result = await service.upload(upload(chat.id, [name]));
      assert.ok("error" in result && pattern.test(result.error), `${name}: ${JSON.stringify(result)}`);
    }
    const form = upload(chat.id, []);
    form.append("files", new File(["x".repeat(1024 * 1024 + 1)], "long.txt"));
    const result = await service.upload(form);
    assert.ok("error" in result && /Extracted text exceeds/.test(result.error), JSON.stringify(result));
    assert.deepEqual(store.getMessages(chat.id), []);
  } finally { store.close(); }
});

test("a timed-out preparation terminates and releases the single-upload slot without partial storage", async t => {
  const store = openStore(":memory:");
  const chat = store.createChat({ category: "profile", title: "Deadline" });
  const service = createChatService(store, { async *stream() { yield { type: "text-delta", text: "Read." }; yield { type: "done" }; } });
  try {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const pending = service.upload(upload(chat.id, ["career.docx"]));
    const busy = await service.upload(upload(chat.id, ["notes.txt"]));
    assert.ok("error" in busy && /Another upload/.test(busy.error));
    // File.arrayBuffer resolves before the next event-loop turn; the worker's real CPU work cannot block this deadline.
    await new Promise<void>(resolve => setImmediate(resolve));
    t.mock.timers.tick(15_000);
    const result = await pending;
    assert.ok("error" in result && /15 seconds/.test(result.error), JSON.stringify(result));
    assert.deepEqual(store.getMessages(chat.id), []);
    t.mock.timers.reset();
    const next = await service.upload(upload(chat.id, ["notes.txt"]));
    assert.ok(!("error" in next), JSON.stringify(next));
    await consume(next);
    assert.equal(store.getMessages(chat.id).length, 2);
  } finally { t.mock.timers.reset(); store.close(); }
});

test("reconstructed history enforces cumulative pages, images and encoded bytes before saving another message", async () => {
  const sharp = (await import("sharp")).default;
  for (const limit of ["pages", "images", "bytes"] as const) {
    const store = openStore(":memory:");
    const chat = store.createChat({ category: "profile", title: limit });
    let calls = 0;
    const service = createChatService(store, { async *stream() { calls++; yield { type: "text-delta", text: "Read." }; yield { type: "done" }; } });
    try {
      if (limit === "pages") {
        // Seed an immutable historical snapshot at the public storage seam, then exercise real new-file preparation.
        const bytes = new Uint8Array(readFileSync(new URL("./fixtures/text.pdf", import.meta.url)));
        const file = { name: "history.pdf", mediaType: "application/pdf" as const, bytes, pages: 100, text: "", preparationVersion: 1 as const };
        const turn = store.beginTurn({ chatId: chat.id, content: "Earlier PDF", attachments: [file] });
        store.completeTurn(turn.id, "Earlier answer");
      } else if (limit === "images") {
        for (let index = 0; index < 4; index++) {
          const turn = await service.upload(upload(chat.id, Array(5).fill("image.png")));
          assert.ok(!("error" in turn), JSON.stringify(turn)); await consume(turn);
        }
      } else {
        const bytes = await sharp({ create: { width: 2000, height: 1300, channels: 3, background: "white" } }).png({ compressionLevel: 0 }).toBuffer();
        assert.ok(bytes.length > 7 * 1024 * 1024 && bytes.length < 10 * 1024 * 1024);
        const form = upload(chat.id, []);
        form.append("files", new File([new Uint8Array(bytes)], "large.png"));
        form.append("files", new File([new Uint8Array(bytes)], "large.png"));
        const turn = await service.upload(form);
        assert.ok(!("error" in turn), JSON.stringify(turn)); await consume(turn);
      }
      const before = store.getMessages(chat.id);
      const count = calls;
      const next = limit === "pages" ? upload(chat.id, ["text.pdf"]) : limit === "images" ? upload(chat.id, ["image.png"]) : (() => {
        const form = upload(chat.id, []);
        const previous = store.getMessageAttachments(chat.id, before[0].id)[0];
        // Replay a validated original instead of uploading arbitrary binary as an image.
        form.append("files", new File([new Uint8Array(previous.bytes)], "large.png"));
        return form;
      })();
      const result = await service.upload(next);
      assert.ok("error" in result && /shorter chat/.test(result.error), `${limit}: ${JSON.stringify(result)}`);
      assert.equal(calls, count);
      assert.deepEqual(store.getMessages(chat.id), before);
    } finally { store.close(); }
  }
});
