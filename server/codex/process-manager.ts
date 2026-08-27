import { createRequire } from "node:module";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";

export const TESTED_CODEX_VERSION = "0.144.4";

export interface CodexCommand {
  executable: string;
  prefixArgs: string[];
  environment?: NodeJS.ProcessEnv;
}

export type CodexSpawn = typeof spawn;

export const toUnpackedAsarPath = (value: string) =>
  value.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);

export const resolveCodexCommand = (): CodexCommand => {
  const configured = process.env.CODEX_EXECUTABLE?.trim();
  if (configured) return { executable: configured, prefixArgs: [] };

  try {
    const require = createRequire(import.meta.url);
    if (process.platform === "win32" && process.arch === "x64" && process.versions.electron) {
      const packageJson = require.resolve("@openai/codex-win32-x64/package.json");
      const nativeExecutable = path.join(
        path.dirname(toUnpackedAsarPath(packageJson)),
        "vendor",
        "x86_64-pc-windows-msvc",
        "bin",
        "codex.exe",
      );
      return { executable: nativeExecutable, prefixArgs: [] };
    }
    const script = require.resolve("@openai/codex/bin/codex.js");
    return {
      executable: process.execPath,
      prefixArgs: [script],
      environment: process.versions.electron ? { ELECTRON_RUN_AS_NODE: "1" } : undefined,
    };
  } catch {
    return { executable: "codex", prefixArgs: [] };
  }
};

export class CodexProcessManager {
  private child?: ChildProcessWithoutNullStreams;

  constructor(
    readonly command: CodexCommand = resolveCodexCommand(),
    private readonly spawnProcess: CodexSpawn = spawn,
  ) {}

  get running() {
    return Boolean(this.child && this.child.exitCode === null && !this.child.killed);
  }

  start() {
    if (this.running && this.child) return this.child;
    const child = this.spawnProcess(
      this.command.executable,
      [...this.command.prefixArgs, "app-server", "--stdio"],
      {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        env: { ...process.env, ...this.command.environment },
      },
    ) as ChildProcessWithoutNullStreams;
    this.child = child;
    return child;
  }

  async stop() {
    const child = this.child;
    this.child = undefined;
    if (!child || child.exitCode !== null) return;
    child.stdin.end();
    child.kill();
    await Promise.race([
      new Promise<void>((resolve) => child.once("exit", () => resolve())),
      delay(2_000).then(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
      }),
    ]);
  }
}
