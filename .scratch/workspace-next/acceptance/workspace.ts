// Serves the built app at http://localhost:3801 with a disposable synthetic workspace for the Ticket 14 manual checklist:
// 50 build chats, 70 profile chats and 30 jobs. Uses the local Claude login for replies. Ctrl+C stops it and deletes the data.
import { randomUUID } from "node:crypto";
import { isolatedApp } from "./server.ts";
import { openStore } from "../../../lib/storage/store.ts";
import { jobStatuses } from "../../../lib/storage/job-input.ts";

const app = isolatedApp("cv-workspace-");
const store = openStore(app.database);
try {
  store.createChat({ category: "build", title: "Oldest searchable CV" });
  store.createChat({ category: "profile", title: "Oldest searchable profile" });
  for (let index = 2; index <= 50; index++) store.createChat({ category: "build", title: `CV chat ${String(index).padStart(2, "0")}` });
  for (let index = 2; index <= 70; index++) store.createChat({ category: "profile", title: `Profile chat ${String(index).padStart(2, "0")}` });
  for (let index = 1; index <= 30; index++) {
    const job = store.createJob({ operationId: randomUUID(), title: `Fictional role ${String(index).padStart(2, "0")}`, url: `https://example.com/jobs/${index}`, description: index % 3 ? "" : "Fictional description\nwith two lines", status: jobStatuses[index % jobStatuses.length] });
    if (index === 30) store.addJobActivity({ id: job.id, operationId: randomUUID(), expectedVersion: job.version, status: "Interviewing", comment: "<b>literal</b> fictional comment" });
  }
} finally { store.close(); }

try { await app.start(3801); } catch (error) { await app.stop(); app.remove(); throw error; }
console.log("Synthetic workspace ready at http://localhost:3801 (50 CV chats, 70 profile chats, 30 jobs). Press Ctrl+C to stop and delete it.");
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await app.stop();
  app.remove();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
