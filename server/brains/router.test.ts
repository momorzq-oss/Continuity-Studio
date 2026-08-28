import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { BrainHealth, MovieProject, PhaseId, ProviderInfo } from "../../src/types.js";
import { createPhaseProgress } from "../phases.js";
import { createProjectBrain, createProjectMemory } from "../project-schema.js";
import { StructuredLogger } from "../logger.js";
import { SettingsStore } from "../settings.js";
import { LocalLlmBrainProvider } from "./local-llm-provider.js";
import type { BrainProvider } from "./provider.js";
import { BrainRouter, BrainUnavailableError } from "./router.js";
import { createProductionWorkflow } from "../production-workflow.js";
import { createAutomaticProductionState } from "../automatic-production-state.js";
import { createManualProductionState } from "../manual-production-state.js";

const roots: string[] = [];

class StubProvider implements BrainProvider {
  readonly calls: PhaseId[] = [];
  constructor(
    readonly id: BrainProvider["id"],
    readonly providerInfo: ProviderInfo,
    private readonly state: BrainHealth["state"] = "connected",
  ) {}
  async generate(phase: PhaseId) {
    this.calls.push(phase);
    return { artifact: { generatedBy: this.id }, summary: `${this.id} completed ${phase}`, provider: String(this.id) };
  }
  async healthCheck(): Promise<BrainHealth> {
    return { id: this.id, state: this.state, label: this.providerInfo.label, detail: this.state === "connected" ? "Ready" : "Unavailable", checkedAt: new Date().toISOString() };
  }
  async continue() { return "continued"; }
  async inspect() { return "inspected"; }
  async plan() { return "planned"; }
  async execute() { return "executed"; }
  async cancel() {}
}

const project = (brain: MovieProject["brain"]["selected"]): MovieProject => ({
  schemaVersion: 2,
  id: "router-test-project",
  title: "Router Test",
  idea: "A complete story idea long enough for project validation.",
  genre: "Drama",
  runtimeMinutes: 2,
  sequenceCount: 2,
  language: "English",
  visualStyle: "Cinematic",
  mode: "full",
  controlMode: "manual",
  storyMode: "AI_FIRST",
  era: "Contemporary",
  aspectRatio: "2.39:1",
  sequenceDurationSeconds: 60,
  resolution: "4K UHD",
  filmLanguage: "English",
  dialogueLanguage: "English",
  audienceRating: "PG",
  targetPlatform: "Seedance",
  narrationEnabled: false,
  dialogueEnabled: true,
  musicEnabled: true,
  subtitlesEnabled: true,
  autoGenerateAssets: true,
  autoGenerateScenes: true,
  autoGenerateStoryboard: true,
  status: "draft",
  phases: createPhaseProgress(),
  artifacts: {},
  messages: [],
  provider: { kind: "hybrid", label: "Router", available: true },
  brain: createProjectBrain(brain),
  memory: createProjectMemory(),
  preStorySetup: { mode: "AI_FIRST", completed: true, sheetCreation: "AUTO", blockingIssues: [] },
  production: createProductionWorkflow({ title: "Router Test", idea: "A complete story idea long enough for project validation.", genre: "Drama", runtimeMinutes: 2, sequenceCount: 2, sequenceDurationSeconds: 60, language: "English", filmLanguage: "English", dialogueLanguage: "English", visualStyle: "Cinematic", mode: "full", storyMode: "AI_FIRST", era: "Contemporary", aspectRatio: "2.39:1", resolution: "4K UHD", audienceRating: "PG", targetPlatform: "Seedance", narrationEnabled: false, dialogueEnabled: true, musicEnabled: true, subtitlesEnabled: true, autoGenerateAssets: true, autoGenerateScenes: true, autoGenerateStoryboard: true }),
  automaticProduction: createAutomaticProductionState(),
  manualProduction: createManualProductionState(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const setup = async (codexState: BrainHealth["state"] = "connected") => {
  const root = path.join(tmpdir(), `continuity-router-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  roots.push(root);
  const settings = new SettingsStore(path.join(root, "settings.json"));
  const builtin = new StubProvider("builtin", { kind: "builtin", label: "Built-in", available: true });
  const local = new StubProvider("local", { kind: "local", label: "Local LLM", available: true });
  const codex = new StubProvider("codex", { kind: "codex", label: "Codex", available: true }, codexState);
  const openai = new StubProvider("openai", { kind: "openai", label: "OpenAI", available: true });
  const router = new BrainRouter(
    builtin as never,
    local as never,
    codex as never,
    openai as never,
    settings,
    new StructuredLogger(path.join(root, "logs")),
  );
  return { router, settings, builtin, local, codex };
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("BrainRouter", () => {
  it("reports the external local model as disconnected when it is not enabled", async () => {
    const root = path.join(tmpdir(), `continuity-local-health-${Date.now()}`);
    roots.push(root);
    const health = await new LocalLlmBrainProvider(
      new SettingsStore(path.join(root, "settings.json")),
      new StructuredLogger(path.join(root, "logs")),
    ).healthCheck();
    expect(health).toMatchObject({ id: "local", state: "disconnected" });
    expect(health.detail).toContain("offline engine remains available");
  });

  it("uses the offline built-in engine when Local Brain has no configured server", async () => {
    const { router, builtin, local } = await setup();
    const result = await router.generate("story", project("local"));
    expect(result.provider).toBe("builtin");
    expect(builtin.calls).toEqual(["story"]);
    expect(local.calls).toEqual([]);
  });

  it("routes balanced Hybrid supervision phases to Codex and production phases locally", async () => {
    const { router, codex, builtin } = await setup();
    await router.generate("film_bible", project("hybrid"));
    await router.generate("frame_plans", project("hybrid"));
    expect(codex.calls).toEqual(["film_bible"]);
    expect(builtin.calls).toEqual(["frame_plans"]);
  });

  it("returns explicit recovery actions when the selected brain is unavailable", async () => {
    const { router } = await setup("disconnected");
    await expect(router.generate("story", project("codex"))).rejects.toMatchObject({
      brain: "codex",
      actions: ["retry", "continue_local", "switch_brain", "cancel"],
    } satisfies Partial<BrainUnavailableError>);
  });
});
