import "server-only";
import { join } from "node:path";
import { openStore } from "./storage/store";

const globalStore = globalThis as typeof globalThis & { cvStore?: ReturnType<typeof openStore> };
export function getStore() {
  if (!globalStore.cvStore) {
    globalStore.cvStore = openStore(join(process.cwd(), "data", "app.sqlite"));
    globalStore.cvStore.recoverInterruptedTurns();
  }
  return globalStore.cvStore;
}
