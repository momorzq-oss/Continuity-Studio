import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AssetManifestArtifact, CreateProjectInput, MovieProject } from "../src/types.js";
import { ProductionAgent } from "./agent.js";
import { LocalPhaseEngine } from "./local-engine.js";
import { FilmRuleEngine } from "./rule-engine.js";
import { ProjectStore } from "./store.js";

const input: CreateProjectInput = {
  title: "The Last Camp — Film Brain Demo",
  idea: "Six minute Emirati desert horror film. 1965 UAE desert. One traveller named Rashid travels with one camel and discovers a mysterious Bedouin camp.",
  genre: "Emirati Desert Horror",
  runtimeMinutes: 6,
  sequenceCount: 12,
  language: "Arabic / Emirati dialect",
  visualStyle: "Grounded 1965 Gulf cinema, 2.39:1, restrained grain, practical firelight",
  mode: "full",
  brain: "local",
  storyMode: "AI_FIRST",
  era: "1965 UAE",
  aspectRatio: "2.39:1",
  autoGenerateAssets: true,
  autoGenerateScenes: false,
  autoGenerateStoryboard: false,
};

let root = "";
let baseline: MovieProject;

beforeAll(async () => {
  root = path.join(tmpdir(), `continuity-film-brain-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const store = new ProjectStore(root);
  const agent = new ProductionAgent(store, new LocalPhaseEngine({ delayMs: 0 }));
  await store.initialize();
  const created = await agent.createProject(input);
  await agent.start(created.id, "full");
  await agent.waitForIdle(created.id);
  baseline = await store.getProject(created.id);
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

const project = () => structuredClone(baseline);

describe("FilmRuleEngine", () => {
  it("detects duplicate Rashid identities", () => {
    const value = project();
    const engine = new FilmRuleEngine();
    const rashid = value.memory.database.characters.find((asset) => /rashid/i.test(`${asset.id} ${asset.name}`))!;
    const duplicate = { ...structuredClone(rashid), id: "CHAR_RASHID_DUPLICATE_001" };
    value.memory.database.assets.push(duplicate);
    value.memory.database.characters.push(duplicate);
    expect(engine.validateProject(value).some((item) => item.title.includes("Duplicate Rashid") && item.severity === "BLOCKING")).toBe(true);
  });

  it("flags a wardrobe mismatch", () => {
    const value = project();
    const engine = new FilmRuleEngine();
    const first = value.memory.database.continuityStates.find((state) => state.anchor === "END")!;
    const character = first.characters[0];
    const issues = engine.validateObserved(value, first.sequenceId, { wardrobe: { [character]: "WARDROBE_WRONG_001" } });
    expect(issues.some((item) => item.title === "Wardrobe mismatch" && item.blocking)).toBe(true);
  });

  it("blocks a missing camel required by the story", () => {
    const value = project();
    const engine = new FilmRuleEngine();
    value.memory.database.assets = value.memory.database.assets.filter((asset) => asset.category !== "animal");
    value.memory.database.animals = [];
    expect(engine.validateProject(value).some((item) => item.title === "Missing camel asset")).toBe(true);
  });

  it("flags a wrong or missing held prop", () => {
    const value = project();
    const engine = new FilmRuleEngine();
    const end = value.memory.database.continuityStates.find((state) => Object.values(state.propsHeld).flat().length > 0 && state.anchor === "END")!;
    const issues = engine.validateObserved(value, end.sequenceId, { props: [] });
    expect(issues.some((item) => item.title === "Wrong or missing prop")).toBe(true);
  });

  it("inherits Sequence N approved END into Sequence N+1 START", () => {
    const value = project();
    const states = value.memory.database.continuityStates;
    const end = states.find((state) => state.id === "SEQ_001_END")!;
    const start = states.find((state) => state.id === "SEQ_002_START")!;
    expect(start.previousSequenceEnding).toBe(end.id);
    expect(start.wardrobe).toEqual(end.wardrobe);
    expect(start.injuries).toEqual(end.injuries);
    expect(start.animalState).toEqual(end.animalState);
  });

  it("refuses a silent replacement of a locked asset", () => {
    const value = project();
    const engine = new FilmRuleEngine();
    const rashid = value.memory.database.characters.find((asset) => /rashid/i.test(`${asset.id} ${asset.name}`))!;
    const original = rashid.description;
    const manifest = value.artifacts.assets as AssetManifestArtifact;
    const replacement = structuredClone(manifest);
    replacement.assets = replacement.assets.map((asset) => asset.id === rashid.id ? { ...asset, description: "A redesigned and incompatible Rashid" } : asset);
    engine.registerManifest(value, replacement);
    expect(value.memory.database.assets.find((asset) => asset.id === rashid.id)?.description).toBe(original);
  });

  it("stores consistent START, MID, and END frame anchors", () => {
    const value = project();
    const frames = value.memory.database.frames.filter((frame) => frame.sequenceId === "SEQ_001");
    expect(frames.map((frame) => frame.anchor).sort()).toEqual(["END", "MID", "START"]);
    expect(frames.every((frame) => frame.referenceImages.length > 0 && frame.continuityStateId)).toBe(true);
  });

  it("keeps permanent asset IDs stable across registration", () => {
    const value = project();
    const engine = new FilmRuleEngine();
    const before = value.memory.database.assets.map((asset) => asset.id).sort();
    engine.registerManifest(value, structuredClone(value.artifacts.assets as AssetManifestArtifact));
    expect(value.memory.database.assets.map((asset) => asset.id).sort()).toEqual(before);
  });

  it("applies model rules and compiles editable provider profiles", () => {
    const value = project();
    const prompts = value.memory.database.generationPrompts;
    expect(prompts.some((prompt) => prompt.model === "seedance-2.5" && prompt.prompt.includes("# Seedance 2.5 compiled prompt"))).toBe(true);
    expect(prompts.some((prompt) => prompt.model === "minimax-s2v-01" && prompt.prompt.includes("# MiniMax S2V-01"))).toBe(true);
    expect(prompts.some((prompt) => prompt.model === "higgsfield" && prompt.compilation?.provider === "higgsfield")).toBe(true);
    expect(prompts.every((prompt) => prompt.inheritedRuleIds.some((id) => id.startsWith("MODEL_")))).toBe(true);
  });
});
