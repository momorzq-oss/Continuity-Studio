import { mkdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startBackendWithCollisionFallback } from "../desktop/lifecycle.js";
import { startContinuityServer } from "./runtime.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("real desktop backend port handling", () => {
  it("detects an occupied port and starts the real backend on an available one", async () => {
    const blocker = createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(0, "127.0.0.1", resolve);
    });
    const address = blocker.address();
    if (!address || typeof address === "string") throw new Error("Could not reserve the test port.");

    const root = path.join(tmpdir(), `continuity-runtime-port-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    await mkdir(path.join(root, "dist"), { recursive: true });
    const start = (port: number) => startContinuityServer({
      workspaceRoot: root,
      dataRoot: path.join(root, "projects"),
      settingsPath: path.join(root, "settings.json"),
      logsRoot: path.join(root, "logs"),
      distRoot: path.join(root, "dist"),
      production: true,
      version: "test",
      host: "127.0.0.1",
      port,
    });

    try {
      const result = await startBackendWithCollisionFallback(start, address.port);
      expect(result.portCollision).toBe(true);
      expect(result.backend.port).not.toBe(address.port);
      expect(result.backend.port).toBeGreaterThan(0);
      await result.backend.close();
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });
});
