import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CreateProjectInput, SequencesArtifact } from "../src/types.js";
import { AssetMaker } from "./asset-maker.js";
import { filmRuleEngine } from "./rule-engine.js";
import { ProjectStore } from "./store.js";

const roots: string[] = [];
const input: CreateProjectInput = {
  title: "Visual Pipeline Test", idea: "A traveller crosses a desert camp in a continuity test film.", genre: "Drama",
  runtimeMinutes: 1, sequenceCount: 1, language: "English", visualStyle: "Grounded cinema", mode: "phases", brain: "local",
  storyMode: "AI_FIRST", era: "1965", aspectRatio: "2.39:1", autoGenerateAssets: false, autoGenerateScenes: false, autoGenerateStoryboard: false,
};

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("AssetMaker", () => {
  it("creates real PNG assets, sheets, dependency-gated scenes, and separate storyboard frames", async () => {
    const root = path.join(tmpdir(), `continuity-asset-maker-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const store = new ProjectStore(root);
    const project = await store.createProject(input, { kind: "builtin", label: "test", available: true });
    filmRuleEngine.registerManifest(project, { assets: [{ id: "CHAR_TEST_001", name: "Test traveller", type: "character", description: "Stable traveller identity", locked: false, continuityNotes: ["Lock identity"] }], counts: { character: 1 } });
    const maker = new AssetMaker(store);
    await maker.generateAsset(project, "CHAR_TEST_001");
    await maker.generateContinuitySheet(project, "CHAR_TEST_001");
    const asset = project.memory.database.assets[0]!;
    expect(asset.generatedImagePath).toMatch(/\.png$/);
    expect((await readFile(store.resolveProjectFile(project.id, asset.generatedImagePath!))).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(project.memory.database.continuitySheets[0]?.views.every((view) => view.imagePath)).toBe(true);

    project.artifacts.sequences = { targetRuntimeSeconds: 10, sequences: [{ id: "SEQ_001", number: 1, title: "Test scene", durationSeconds: 10, synopsis: "Traveller crosses frame.", locationId: "CHAR_TEST_001", assetIds: ["CHAR_TEST_001"], emotionalBeat: "resolve", status: "ready" }] } satisfies SequencesArtifact;
    maker.planScenes(project);
    await maker.generateAllScenes(project);
    maker.planStoryboard(project);
    await maker.generateStoryboard(project);
    expect(project.memory.database.sceneAssets[0]?.masterImagePath).toBeTruthy();
    expect(project.memory.database.storyboardFrames).toHaveLength(3);
    expect(project.memory.database.storyboardFrames.every((frame) => frame.imagePath && frame.sceneAssetId)).toBe(true);
    expect(project.memory.database.imageGenerationJobs.every((job) => job.status === "GENERATED" && job.estimatedCost === 0)).toBe(true);
  }, 20_000);
});
