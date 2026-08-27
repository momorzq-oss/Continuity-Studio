import { readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CreateProjectInput } from "../src/types.js";
import { ProductionAgent } from "./agent.js";
import { LocalPhaseEngine } from "./local-engine.js";
import { ProjectStore } from "./store.js";

const roots: string[] = [];

const input: CreateProjectInput = {
  title: "The Last Camp",
  idea: "1965 UAE desert. Rashid becomes lost while travelling with his camel and finds a strange Bedouin camp.",
  genre: "Folk Horror",
  runtimeMinutes: 6,
  sequenceCount: 6,
  language: "Arabic / English",
  visualStyle: "Grounded cinematic realism, widescreen",
  mode: "full",
  storyMode: "AI_FIRST",
  era: "1965 UAE",
  aspectRatio: "2.39:1",
  autoGenerateAssets: true,
  autoGenerateScenes: false,
  autoGenerateStoryboard: false,
};

const setup = async () => {
  const root = path.join(
    tmpdir(),
    `continuity-studio-test-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  roots.push(root);
  const store = new ProjectStore(root);
  const agent = new ProductionAgent(store, new LocalPhaseEngine({ delayMs: 0 }));
  await store.initialize();
  return { store, agent };
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("ProductionAgent", () => {
  it("runs the complete production pipeline and writes a movie project", async () => {
    const { store, agent } = await setup();
    const created = await agent.createProject(input);

    await agent.start(created.id, "full");
    await agent.waitForIdle(created.id);

    const project = await store.getProject(created.id);
    expect(project.status).toBe("complete");
    expect(project.phases.every((phase) => phase.state === "completed")).toBe(true);
    expect(Object.keys(project.artifacts)).toHaveLength(8);
    expect((project.artifacts.sequences as { sequences: unknown[] }).sequences).toHaveLength(6);

    const root = store.projectPath(project.id);
    await expect(stat(path.join(root, "story", "story.md"))).resolves.toBeTruthy();
    await expect(stat(path.join(root, "MOVIE_RULES.md"))).resolves.toBeTruthy();
    await expect(stat(path.join(root, "assets", "manifest.json"))).resolves.toBeTruthy();
    await expect(stat(path.join(root, "continuity", "report.json"))).resolves.toBeTruthy();
    await expect(stat(path.join(root, "final", "EXPORT_READY.md"))).resolves.toBeTruthy();

    const saved = JSON.parse(await readFile(path.join(root, "project.json"), "utf8"));
    expect(saved.id).toBe(project.id);
    expect(saved.status).toBe("complete");
  });

  it("pauses for approval in phase mode and resumes one phase at a time", async () => {
    const { store, agent } = await setup();
    const created = await agent.createProject({ ...input, mode: "phases" });

    await agent.start(created.id, "phases");
    await agent.waitForIdle(created.id);
    let project = await store.getProject(created.id);
    expect(project.status).toBe("awaiting_approval");
    expect(project.phases[0].state).toBe("awaiting_approval");
    expect(project.phases[1].state).toBe("pending");

    await agent.approve(created.id);
    await agent.waitForIdle(created.id);
    project = await store.getProject(created.id);
    expect(project.phases[0].state).toBe("completed");
    expect(project.phases[1].state).toBe("awaiting_approval");
    expect(project.status).toBe("awaiting_approval");
  });

  it("regenerates the selected phase and invalidates downstream work", async () => {
    const { store, agent } = await setup();
    const created = await agent.createProject({ ...input, mode: "phases" });
    await agent.start(created.id, "phases");
    await agent.waitForIdle(created.id);
    const before = await store.getProject(created.id);
    const firstAttempt = before.phases[0].attempt;

    await agent.regenerate(created.id, "story", "Make the protagonist more decisive.");
    await agent.waitForIdle(created.id);
    const project = await store.getProject(created.id);

    expect(project.phases[0].state).toBe("awaiting_approval");
    expect(project.phases[0].attempt).toBe(firstAttempt + 1);
    expect(project.phases[0].feedback).toContain("more decisive");
    expect(project.phases.slice(1).every((phase) => phase.state === "pending")).toBe(true);
    expect(Object.keys(project.artifacts)).toEqual(["story"]);
  });
});
