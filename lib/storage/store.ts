import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { profileProposal, emptyProfile, applyProfileOperations, canReapply, parseProfile, type SavedProposal, type ProfileRevision } from "./profile.ts";

export const chatInput = z.object({
  category: z.enum(["profile", "build"]),
  title: z.string().trim().min(1).max(120),
});
const chatId = z.uuid();
export type Message = { id: string; role: "user" | "assistant"; content: string; status: "pending" | "complete" | "failed" };
export const turnInput = z.union([
  z.object({ chatId: z.uuid(), content: z.string().trim().min(1).max(100_000) }).strict(),
  z.object({ chatId: z.uuid(), retryId: z.uuid() }).strict(),
]);
export type Chat = { id: string; category: "profile" | "build"; title: string; created_at: string };

export function openStore(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    db.exec("BEGIN IMMEDIATE");
    const version = db.prepare("PRAGMA user_version").get()?.user_version;
    if (version === 0) {
      db.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL);
        CREATE TABLE chats (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id),
          category TEXT NOT NULL CHECK(category IN ('profile', 'build')),
          title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 120),
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );
        CREATE INDEX chats_user ON chats(user_id, created_at);
        CREATE TABLE messages (
          id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
          content TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('pending', 'complete', 'failed')),
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );
        CREATE INDEX messages_chat ON messages(chat_id);
        CREATE TABLE profile_revisions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id),
          markdown TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );
        CREATE INDEX profile_revisions_user ON profile_revisions(user_id);
        CREATE TABLE cv_revisions (
          id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
          content TEXT NOT NULL CHECK(json_valid(content)),
          status TEXT NOT NULL CHECK(status IN ('draft', 'accepted', 'discarded')),
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );
        CREATE INDEX cv_revisions_chat ON cv_revisions(chat_id);
        PRAGMA user_version = 1;
      `);
    } else if (version !== 1 && version !== 2) {
      throw new Error("Database version is newer than this app supports.");
    }
    if (version === 0 || version === 1) {
      db.exec(`
        CREATE TABLE profile_proposals (
          id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
          message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
          value TEXT NOT NULL CHECK(json_valid(value)),
          status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'superseded'))
        );
        CREATE INDEX profile_proposals_chat ON profile_proposals(chat_id);
        CREATE TABLE profile_block_ids (id TEXT PRIMARY KEY);
        PRAGMA user_version = 2;
      `);
      for (const row of db.prepare("SELECT markdown FROM profile_revisions").all()) {
        for (const match of String(row.markdown).matchAll(/^<!-- id:(p-[a-z0-9-]{1,64}) -->/gm)) {
          db.prepare("INSERT OR IGNORE INTO profile_block_ids(id) VALUES (?)").run(match[1]);
        }
      }
    }
    db.prepare("INSERT OR IGNORE INTO users(id, name) VALUES (?, ?)").run("local-user", "Local user");
    db.exec("COMMIT");
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    db.close();
    throw error;
  }
  const userId = "local-user";
  return {
    userId,
    close() { db.close(); },
    listChats(): Chat[] {
      return db.prepare("SELECT id, category, title, created_at FROM chats WHERE user_id = ? ORDER BY created_at DESC, id DESC").all(userId) as Chat[];
    },
    getChat(id: string): Chat | undefined {
      return db.prepare("SELECT id, category, title, created_at FROM chats WHERE id = ? AND user_id = ?").get(chatId.parse(id), userId) as Chat | undefined;
    },
    deleteChat(id: string, confirmed: boolean) {
      const chat = this.getChat(id);
      if (!chat) throw new Error("Chat not found.");
      if (chat.category === "build" && confirmed !== true) throw new Error("Build chat deletion requires confirmation.");
      db.prepare("DELETE FROM chats WHERE id = ? AND user_id = ?").run(chat.id, userId);
    },
    getMessages(id: string): Message[] {
      return db.prepare("SELECT id, role, content, status FROM messages WHERE chat_id = ? AND chat_id IN (SELECT id FROM chats WHERE user_id = ?) ORDER BY rowid").all(chatId.parse(id), userId).map(row => ({ ...row })) as Message[];
    },
    beginTurn(input: unknown): Message {
      const parsed = turnInput.parse(input);
      db.exec("BEGIN IMMEDIATE");
      try {
        if (!this.getChat(parsed.chatId)) throw new Error("Chat not found.");
        const messages = this.getMessages(parsed.chatId);
        if (messages.some(message => message.status === "pending")) throw new Error("A reply is already in progress.");
        let id: string;
        if ("retryId" in parsed) {
          const previous = messages.at(-1);
          if (!previous || previous.id !== parsed.retryId || previous.role !== "user" || previous.status !== "failed") {
            throw new Error("Only the latest failed message can be retried.");
          }
          id = previous.id;
          db.prepare("UPDATE messages SET status = 'pending' WHERE id = ?").run(id);
        } else {
          if (messages.at(-1)?.status === "failed") throw new Error("Retry the failed message before sending another.");
          id = randomUUID();
          db.prepare("INSERT INTO messages(id, chat_id, role, content, status) VALUES (?, ?, 'user', ?, 'pending')").run(id, parsed.chatId, parsed.content);
        }
        db.exec("COMMIT");
        return this.getMessages(parsed.chatId).find(message => message.id === id)!;
      } catch (error) { if (db.isTransaction) db.exec("ROLLBACK"); throw error; }
    },
    failTurn(id: string) {
      db.prepare("UPDATE messages SET status = 'failed' WHERE id = ? AND role = 'user' AND status = 'pending' AND chat_id IN (SELECT id FROM chats WHERE user_id = ?)").run(chatId.parse(id), userId);
    },
    recoverInterruptedTurns() {
      db.prepare("UPDATE messages SET status = 'failed' WHERE status = 'pending' AND chat_id IN (SELECT id FROM chats WHERE user_id = ?)").run(userId);
    },
    completeTurn(id: string, content: string, proposal?: unknown) {
      const text = z.string().trim().min(1).parse(content);
      db.exec("BEGIN IMMEDIATE");
      try {
        const pending = db.prepare("SELECT chat_id FROM messages WHERE id = ? AND role = 'user' AND status = 'pending' AND chat_id IN (SELECT id FROM chats WHERE user_id = ?)").get(chatId.parse(id), userId);
        if (!pending) throw new Error("This request is no longer active.");
        db.prepare("INSERT INTO messages(id, chat_id, role, content, status) VALUES (?, ?, 'assistant', ?, 'complete')").run(randomUUID(), pending.chat_id, text);
        if (proposal !== undefined) {
          const value = profileProposal.parse(proposal);
          const base = value.baseRevision === null ? emptyProfile : this.getProfileRevisions().find(row => row.id === value.baseRevision)?.markdown;
          if (!base) throw new Error("Proposal base revision not found.");
          const stale = (this.getProfileRevisions()[0]?.id ?? null) !== value.baseRevision;
          const usedIds = stale ? parseProfile(base).map(block => block.id) : this.getProfileBlockIds();
          applyProfileOperations(base, value, new Set(usedIds));
          db.prepare("UPDATE profile_proposals SET status = 'superseded' WHERE chat_id = ? AND status = 'pending'").run(pending.chat_id);
          db.prepare("INSERT INTO profile_proposals(id, chat_id, message_id, value, status) VALUES (?, ?, ?, ?, 'pending')").run(randomUUID(), pending.chat_id, id, JSON.stringify(value));
        }
        db.prepare("UPDATE messages SET status = 'complete' WHERE id = ?").run(id);
        db.exec("COMMIT");
      } catch (error) { if (db.isTransaction) db.exec("ROLLBACK"); throw error; }
    },
    getCvRevisions(id: string) {
      return db.prepare("SELECT id, content, status FROM cv_revisions WHERE chat_id = ? AND chat_id IN (SELECT id FROM chats WHERE user_id = ?) ORDER BY created_at, id").all(chatId.parse(id), userId);
    },
    getProfileRevisions(): ProfileRevision[] {
      return db.prepare("SELECT id, markdown FROM profile_revisions WHERE user_id = ? ORDER BY rowid DESC").all(userId).map(row => ({ id: String(row.id), markdown: String(row.markdown) }));
    },
    getProfileProposals(id: string): SavedProposal[] {
      if (!this.getChat(id)) throw new Error("Chat not found.");
      return db.prepare("SELECT id, value, status FROM profile_proposals WHERE chat_id = ? ORDER BY rowid DESC").all(id).map(row => ({
        id: String(row.id), value: profileProposal.parse(JSON.parse(String(row.value))), status: row.status as SavedProposal["status"],
      }));
    },
    getProfileBlockIds(): string[] {
      return db.prepare("SELECT id FROM profile_block_ids ORDER BY id").all().map(row => String(row.id));
    },
    getProfileWorkspace(id: string) {
      return {
        revisions: this.getProfileRevisions(),
        proposals: this.getProfileProposals(id).map(proposal => ({ ...proposal, preview: proposal.status === "pending" ? this.previewProfileProposal(proposal.id) : null })),
      };
    },
    previewProfileProposal(id: string): { revisionId: string | null; before: string; after: string | null; conflict: boolean } {
      const row = db.prepare("SELECT value FROM profile_proposals WHERE id = ? AND status = 'pending' AND chat_id IN (SELECT id FROM chats WHERE user_id = ?)").get(chatId.parse(id), userId);
      if (!row) throw new Error("Pending proposal not found.");
      const proposal = profileProposal.parse(JSON.parse(String(row.value)));
      const revisions = this.getProfileRevisions();
      const current = revisions[0];
      const before = current?.markdown ?? emptyProfile;
      const base = proposal.baseRevision === null ? emptyProfile : revisions.find(item => item.id === proposal.baseRevision)?.markdown;
      const revisionId = current?.id ?? null;
      if (!base || (revisionId !== proposal.baseRevision && !canReapply(base, before, proposal))) return { revisionId, before, after: null, conflict: true };
      try {
        const used = new Set(this.getProfileBlockIds());
        return { revisionId, before, after: applyProfileOperations(before, proposal, used), conflict: false };
      } catch { return { revisionId, before, after: null, conflict: true }; }
    },
    approveProfileProposal(id: string, expectedRevision: string | null) {
      z.string().min(1).nullable().parse(expectedRevision);
      db.exec("BEGIN IMMEDIATE");
      try {
        const preview = this.previewProfileProposal(id);
        if (preview.conflict || preview.revisionId !== expectedRevision) {
          db.exec("COMMIT");
          return { approved: false, preview };
        }
        const revisionId = randomUUID();
        db.prepare("INSERT INTO profile_revisions(id, user_id, markdown) VALUES (?, ?, ?)").run(revisionId, userId, preview.after!);
        const proposal = profileProposal.parse(JSON.parse(String(db.prepare("SELECT value FROM profile_proposals WHERE id = ?").get(id)!.value)));
        const ids = new Set(parseProfile(preview.after!).map(block => block.id));
        for (const operation of proposal.operations) if (operation.type === "insert") ids.add(operation.id);
        for (const blockId of ids) db.prepare("INSERT OR IGNORE INTO profile_block_ids(id) VALUES (?)").run(blockId);
        db.prepare("UPDATE profile_proposals SET status = 'approved' WHERE id = ?").run(id);
        db.exec("COMMIT");
        return { approved: true, preview };
      } catch (error) { if (db.isTransaction) db.exec("ROLLBACK"); throw error; }
    },
    restoreProfileRevision(id: string, expectedRevision: string) {
      z.string().min(1).parse(id); z.string().min(1).parse(expectedRevision);
      db.exec("BEGIN IMMEDIATE");
      try {
        const revisions = this.getProfileRevisions();
        if (revisions[0]?.id !== expectedRevision) throw new Error("Profile changed. Review the latest revision before restoring.");
        const target = revisions.find(row => row.id === id);
        if (!target) throw new Error("Profile revision not found.");
        db.prepare("INSERT INTO profile_revisions(id, user_id, markdown) VALUES (?, ?, ?)").run(randomUUID(), userId, target.markdown);
        db.exec("COMMIT");
      } catch (error) { if (db.isTransaction) db.exec("ROLLBACK"); throw error; }
    },
    createChat(input: unknown): Chat {
      const { category, title } = chatInput.parse(input);
      const id = randomUUID();
      db.prepare("INSERT INTO chats(id, user_id, category, title) VALUES (?, ?, ?, ?)").run(id, userId, category, title);
      return this.getChat(id)!;
    },
  };
}


