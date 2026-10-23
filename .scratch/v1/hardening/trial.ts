import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openStore } from "../../../lib/storage/store.ts";
import { createChatService } from "../../../lib/ai/chat.ts";
import { createClaudeProvider } from "../../../lib/ai/claude/provider.ts";
import type { ChatEvent } from "../../../lib/ai/provider.ts";
import { seedCareer, seedDiscussion, backendJob } from "./fixture.ts";

const directory = join(process.cwd(), "data", "trial-workspaces");
mkdirSync(directory, { recursive: true });
const results: unknown[] = [];
for (const model of ["sonnet", "haiku"]) {
  const path = join(directory, `${model}.sqlite`);
  assert.equal(existsSync(path), false, "Refusing to overwrite an existing trial database");
  const store = openStore(path);
  try {
    seedCareer(store);
    const chat = store.createChat({ category: "build", title: `DEMO · Backend application · ${model} trial` });
    store.updateBuildSettings(chat.id, { jobDescription: backendJob, targetRole: "Senior Backend Engineer", targetCompany: "Harbor Parcel (fictional)", projectLimit: 3 }, 0);
    seedDiscussion(store, chat.id);
    const service = createChatService(store, createClaudeProvider(undefined, model));
    const started = performance.now();
    let firstTextMs: number | null = null;
    let usage: Extract<ChatEvent, { type: "usage" }> | undefined;
    let error: Extract<ChatEvent, { type: "error" }> | undefined;
    const { stream } = service.send({ chatId: chat.id, content: "Create the complete tailored CV draft now with propose_cv, using the confirmed profile and saved job. Include three relevant projects, preserve exact ownership and benchmark qualifications, omit unconfirmed skills, and use a custom section title where useful. Do not block on missing optional fields. Explain your selection and at least one alternative in the reply. Do not change the profile." });
    for await (const event of stream) {
      if (event.type === "text-delta" && firstTextMs === null) firstTextMs = Math.round(performance.now() - started);
      if (event.type === "usage") usage = event;
      if (event.type === "error") error = event;
    }
    const totalMs = Math.round(performance.now() - started);
    const workspace = store.getCvWorkspace(chat.id);
    const revision = workspace.revisions[0];
    if (!error) {
      assert.ok(revision, "No CV draft generated");
      assert.equal(workspace.acceptedId, null);
      assert.match(JSON.stringify(revision.content), /dispatch|idempoten|retr/i);
      assert.doesNotMatch(JSON.stringify(revision.content), /Kubernetes|Terraform|certified|99\.99/);
      assert.ok(revision.explanation.trim());
      store.changeCvRevision({ chatId: chat.id, revisionId: revision.id, action: "accept", expectedAcceptedId: null });
      const json = store.exportAcceptedCv({ chatId: chat.id, revisionId: revision.id });
      assert.doesNotMatch(json, /"evidence"|"explanation"|"profileRevision"/);
      writeFileSync(join(directory, `${model}-export.json`), json);
      writeFileSync(join(directory, `${model}-selection.txt`), revision.explanation);
    }
    const result = { model, chatId: chat.id, profileCharacters: store.getProfileRevisions()[0].markdown.length,
      messageCount: store.getMessages(chat.id).length, firstTextMs, totalMs, usage, error, cvValid: !!revision && !error };
    results.push(result);
    writeFileSync(join(directory, "results.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(result));
  } finally { store.close(); }
}
