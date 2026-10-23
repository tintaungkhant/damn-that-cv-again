import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export const chatInput = z.object({
  category: z.enum(["profile", "build"]),
  title: z.string().trim().min(1).max(120),
});
const chatId = z.uuid();
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
    } else if (version !== 1) {
      throw new Error("Database version is newer than this app supports.");
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
    getMessages(id: string) {
      return db.prepare("SELECT id, role, content, status FROM messages WHERE chat_id = ? AND chat_id IN (SELECT id FROM chats WHERE user_id = ?) ORDER BY created_at, id").all(chatId.parse(id), userId);
    },
    getCvRevisions(id: string) {
      return db.prepare("SELECT id, content, status FROM cv_revisions WHERE chat_id = ? AND chat_id IN (SELECT id FROM chats WHERE user_id = ?) ORDER BY created_at, id").all(chatId.parse(id), userId);
    },
    getProfileRevisions() {
      return db.prepare("SELECT id, markdown FROM profile_revisions WHERE user_id = ? ORDER BY created_at DESC, id DESC").all(userId);
    },
    createChat(input: unknown): Chat {
      const { category, title } = chatInput.parse(input);
      const id = randomUUID();
      db.prepare("INSERT INTO chats(id, user_id, category, title) VALUES (?, ?, ?, ?)").run(id, userId, category, title);
      return this.getChat(id)!;
    },
  };
}


