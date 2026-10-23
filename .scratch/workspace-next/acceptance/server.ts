// Runs the built app from an isolated temporary directory with its own data/app.sqlite. The personal database is never opened.
import { mkdtempSync, mkdirSync, symlinkSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

export function isolatedApp(prefix: string) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  symlinkSync(resolve("node_modules"), join(directory, "node_modules"), "junction");
  symlinkSync(resolve(".next"), join(directory, ".next"), "junction");
  copyFileSync("package.json", join(directory, "package.json"));
  copyFileSync("next.config.ts", join(directory, "next.config.ts"));
  // The parser worker loads outside the bundle, so it must exist next to the app.
  mkdirSync(join(directory, "lib/attachments"), { recursive: true });
  copyFileSync("lib/attachments/parser.mjs", join(directory, "lib/attachments/parser.mjs"));
  mkdirSync(join(directory, "data"));
  let server: ReturnType<typeof spawn> | undefined;
  let diagnostic = "";
  return {
    directory,
    database: join(directory, "data/app.sqlite"),
    diagnostic: () => diagnostic,
    async start(port: number, env: Record<string, string> = {}) {
      diagnostic = "";
      server = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "--port", String(port)], { cwd: directory, env: { ...process.env, ...env }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      server.stdout!.on("data", value => { diagnostic += value; });
      server.stderr!.on("data", value => { diagnostic += value; });
      for (let index = 0; index < 100; index++) {
        if (server.exitCode !== null) throw new Error(diagnostic);
        try { if ((await fetch(`http://localhost:${port}`)).ok) return; } catch { /* Startup can refuse connections. */ }
        await delay(100);
      }
      throw new Error("Isolated startup timed out: " + diagnostic);
    },
    async stop() {
      if (!server) return;
      const current = server;
      if (current.exitCode === null) { current.kill(); await new Promise<void>(resolve => current.once("exit", () => resolve())); }
      server = undefined;
    },
    remove() {
      if (!directory.startsWith(join(tmpdir(), prefix))) throw new Error("Refusing to remove " + directory);
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
