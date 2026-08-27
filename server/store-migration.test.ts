import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CreateProjectInput } from "../src/types.js";
import { CURRENT_PROJECT_SCHEMA_VERSION } from "./project-schema.js";
import { ProjectStore } from "./store.js";

const roots: string[] = [];
const input: CreateProjectInput = {
  title: "Migration Check",
  idea: "A projectionist discovers one missing frame that changes every remembered ending.",
  genre: "Mystery",
  runtimeMinutes: 4,
  sequenceCount: 4,
  language: "English",
  visualStyle: "Shadowy analog cinema",
  mode: "phases",
  brain: "local",
  storyMode: "AI_FIRST",
  era: "1965 UAE",
  aspectRatio: "2.39:1",
  autoGenerateAssets: true,
  autoGenerateScenes: true,
  autoGenerateStoryboard: true,
};

const setup = async () => {
  const root = path.join(tmpdir(), `continuity-migration-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  roots.push(root);
  const store = new ProjectStore(root);
  await store.initialize();
  return store;
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("ProjectStore migrations and persistence", () => {
  it("backs up and migrates a legacy project without losing its artifacts", async () => {
    const store = await setup();
    const created = await store.createProject(input, {
      kind: "local",
      label: "Built-in local engine",
      available: true,
    });
    const filePath = path.join(store.projectPath(created.id), "project.json");
    const legacy = JSON.parse(await readFile(filePath, "utf8"));
    delete legacy.schemaVersion;
    delete legacy.brain;
    delete legacy.memory;
    legacy.artifacts.story = { logline: "Preserve me" };
    await writeFile(filePath, `${JSON.stringify(legacy, null, 2)}\n`, "utf8");

    const migrated = await store.getProject(created.id);
    const files = await readdir(store.projectPath(created.id));

    expect(migrated.schemaVersion).toBe(CURRENT_PROJECT_SCHEMA_VERSION);
    expect(migrated.brain.selected).toBe("local");
    expect(migrated.memory.generationHistory).toEqual([]);
    expect(migrated.artifacts.story).toEqual({ logline: "Preserve me" });
    expect(files.some((name) => name.startsWith("project.json.backup-v1-"))).toBe(true);
  });

  it("persists the Codex thread id across store instances", async () => {
    const store = await setup();
    const created = await store.createProject({ ...input, brain: "codex" }, {
      kind: "codex",
      label: "Codex App Server",
      available: true,
    });
    created.brain.codexThreadId = "thread-persisted-123";
    await store.saveProject(created);

    const reopened = await new ProjectStore(store.rootDir).getProject(created.id);
    expect(reopened.brain.codexThreadId).toBe("thread-persisted-123");
  });
});
