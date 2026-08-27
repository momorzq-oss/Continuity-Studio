import { describe, expect, it, vi } from "vitest";
import { boundedWindowState, startBackendWithCollisionFallback, withStartupTimeout } from "./lifecycle.js";

describe("desktop lifecycle", () => {
  it("falls back to a dynamic localhost port after a collision and can close the backend", async () => {
    const close = vi.fn(async () => undefined);
    const ports: number[] = [];
    const result = await startBackendWithCollisionFallback(async (port) => {
      ports.push(port);
      if (port === 8787) throw Object.assign(new Error("port busy"), { code: "EADDRINUSE" });
      return { port: 49152, close };
    });

    expect(ports).toEqual([8787, 0]);
    expect(result.portCollision).toBe(true);
    await result.backend.close();
    expect(close).toHaveBeenCalledOnce();
  });

  it("keeps restored window bounds visible on the current display", () => {
    expect(boundedWindowState(
      { x: -5000, y: -5000, width: 600, height: 500, maximized: true },
      { x: 0, y: 0, width: 1920, height: 1080 },
    )).toEqual({ x: 410, y: 190, width: 1100, height: 700, maximized: true });
  });

  it("replaces an endless startup wait with a clear timeout error", async () => {
    await expect(withStartupTimeout(
      new Promise<never>(() => undefined),
      10,
      "Local services took too long to start.",
    )).rejects.toThrow("Local services took too long to start.");
  });
});
