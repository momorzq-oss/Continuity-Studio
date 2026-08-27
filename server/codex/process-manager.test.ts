import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodexProcessManager, resolveCodexCommand, toUnpackedAsarPath } from "./process-manager.js";
import { toCodexApprovalPolicy, toCodexSandboxMode } from "./service.js";

const fakeChild = () => {
  const child = new EventEmitter() as ChildProcessWithoutNullStreams;
  Object.assign(child, {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    exitCode: null,
    killed: false,
    kill: vi.fn(function (this: ChildProcessWithoutNullStreams) {
      Object.defineProperty(this, "killed", { value: true, configurable: true });
      Object.defineProperty(this, "exitCode", { value: 0, configurable: true });
      queueMicrotask(() => this.emit("exit", 0, null));
      return true;
    }),
  });
  return child;
};

afterEach(() => {
  delete process.env.CODEX_EXECUTABLE;
});

describe("CodexProcessManager", () => {
  it("starts the pinned App Server over stdio and shuts it down cleanly", async () => {
    const child = fakeChild();
    const spawn = vi.fn(() => child);
    const manager = new CodexProcessManager(
      { executable: "codex-test.exe", prefixArgs: ["--shim"] },
      spawn as never,
    );

    expect(manager.start()).toBe(child);
    expect(manager.start()).toBe(child);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledWith(
      "codex-test.exe",
      ["--shim", "app-server", "--stdio"],
      expect.objectContaining({ windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }),
    );
    await manager.stop();
    expect(child.kill).toHaveBeenCalled();
    expect(manager.running).toBe(false);
  });

  it("honors an explicit Codex executable override", () => {
    process.env.CODEX_EXECUTABLE = "C:\\Tools\\codex-custom.exe";
    expect(resolveCodexCommand()).toEqual({ executable: "C:\\Tools\\codex-custom.exe", prefixArgs: [] });
  });

  it("translates friendly settings into the tested v2 wire protocol", () => {
    expect(toCodexApprovalPolicy("unlessTrusted")).toBe("untrusted");
    expect(toCodexApprovalPolicy("onRequest")).toBe("on-request");
    expect(toCodexSandboxMode(true)).toBe("workspace-write");
    expect(toCodexSandboxMode(false)).toBe("read-only");
  });

  it("maps packaged native executables from the asar archive to its unpacked directory", () => {
    expect(toUnpackedAsarPath("C:\\app\\resources\\app.asar\\node_modules\\codex.exe"))
      .toBe("C:\\app\\resources\\app.asar.unpacked\\node_modules\\codex.exe");
  });
});
