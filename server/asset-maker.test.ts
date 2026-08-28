import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CreateProjectInput, SequencesArtifact } from "../src/types.js";
import type { ImageGenerationProvider } from "./image-generation/provider.js";
import { AssetMaker } from "./asset-maker.js";
import { addManualManifestAsset } from "./asset-manifest.js";
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

  it("persists a real generation failure so the UI can show the error and retry", async () => {
    const root = path.join(tmpdir(), `continuity-asset-failure-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const store = new ProjectStore(root);
    const project = await store.createProject(input, { kind: "builtin", label: "test", available: true });
    filmRuleEngine.registerManifest(project, { assets: [{ id: "PROP_FAIL_001", name: "Failure prop", type: "prop", description: "Provider failure test", locked: false, continuityNotes: [] }], counts: { prop: 1 } });
    const failing: ImageGenerationProvider = { id: "failing-test", model: "failure-model", paid: false, estimateCost: () => 0, generate: async () => { throw new Error("Visible provider failure for Retry test."); } };
    const maker = new AssetMaker(store, failing);
    await maker.generateAsset(project, "PROP_FAIL_001");
    await store.saveProject(project);
    const reopened = await store.getProject(project.id);
    const asset = reopened.memory.database.assets[0]!;
    expect(asset.approvalState).toBe("GENERATION_FAILED");
    expect(asset.generatedImagePath).toBeUndefined();
    expect(asset.generationError).toBe("Visible provider failure for Retry test.");
    expect(reopened.memory.database.imageGenerationJobs[0]).toMatchObject({ status: "GENERATION_FAILED", error: "Visible provider failure for Retry test." });
  });

  it("stages regeneration without touching the active file, then preserves permanent identity on acceptance", async () => {
    const root = path.join(tmpdir(), `continuity-asset-replacement-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const store = new ProjectStore(root);
    const project = await store.createProject(input, { kind: "builtin", label: "test", available: true });
    const record = addManualManifestAsset(project, { name: "Hero Lantern", category: "prop", description: "A dented period brass lantern.", sequenceIds: ["SEQ_01"], referenceRole: "PROP" });
    const maker = new AssetMaker(store);
    await maker.generateAsset(project, record.id, false);
    const entity = project.memory.database.assets.find((item) => item.id === record.id)!;
    const originalPath = entity.generatedImagePath!;
    const originalNumber = record.number;
    const originalFilename = record.filename;
    entity.approvalState = "LOCKED";
    record.status = "LOCKED";

    await maker.generateAsset(project, record.id, true, "APPLY_ALL");
    expect(record.pendingVersion?.imagePath).toBeTruthy();
    expect(record.pendingVersion?.impactMode).toBe("APPLY_ALL");
    expect(entity.generatedImagePath).toBe(originalPath);
    expect(entity.version).toBe(1);
    expect(await store.projectFileExists(project.id, originalPath)).toBe(true);

    const replacementPath = record.pendingVersion!.imagePath;
    await maker.acceptPendingVersion(project, record.id);
    expect(entity.generatedImagePath).toBe(replacementPath);
    expect(entity.approvalState).toBe("LOCKED");
    expect(record.number).toBe(originalNumber);
    expect(record.filename).toBe(originalFilename);
    expect(record.id).toBe(entity.id);
    expect(record.pendingVersion).toBeUndefined();
    expect(await store.projectFileExists(project.id, replacementPath)).toBe(true);
    expect(await store.projectFileExists(project.id, originalPath)).toBe(false);
    expect(record.versionHistory?.some((version) => version.version === 1 && version.fileRetained === false)).toBe(true);
  });
});
