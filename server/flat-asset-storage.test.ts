import { readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CreateProjectInput } from "../src/types.js";
import { AssetMaker } from "./asset-maker.js";
import { addManualManifestAsset, deleteManualManifestAsset } from "./asset-manifest.js";
import { ProjectStore } from "./store.js";

const roots: string[] = [];
const input: CreateProjectInput = {
  title: "Flat Asset Storage Test",
  idea: "Ten permanent references cross several sequences without losing identity.",
  genre: "Drama",
  runtimeMinutes: 2,
  sequenceCount: 4,
  language: "English",
  visualStyle: "Grounded cinema",
  mode: "phases",
  brain: "local",
  storyMode: "AI_FIRST",
  era: "1965",
  aspectRatio: "2.39:1",
  autoGenerateAssets: false,
  autoGenerateScenes: false,
  autoGenerateStoryboard: false,
};

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("flat permanent Project Image storage", () => {
  it("keeps a newly activated flat image during concurrent stale project polling", async () => {
    const root = path.join(tmpdir(), `continuity-flat-assets-race-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const store = new ProjectStore(root);
    const project = await store.createProject(input, { kind: "builtin", label: "test", available: true });
    const record = addManualManifestAsset(project, {
      name: "Pending Active Asset",
      category: "prop",
      description: "Generation must survive background project polling.",
    });
    await store.saveProject(project);

    const stagedPath = "asset_history/generated/pending-active-v1.png";
    await store.writeProjectBinary(project.id, stagedPath, Buffer.from("generated-image"));
    const activePath = await store.activateProductionAssetFile(project.id, record.filename, stagedPath);

    const stalePoll = await store.getProject(project.id);
    expect(await store.projectFileExists(project.id, activePath)).toBe(true);
    expect(stalePoll.production.assets.find((item) => item.id === record.id)?.imagePath).toBeUndefined();

    record.imagePath = activePath;
    record.status = "REVIEW";
    const entity = project.memory.database.assets.find((item) => item.id === record.id)!;
    entity.generatedImagePath = activePath;
    entity.approvalState = "REVIEW";
    await store.saveProject(project);

    const restored = await store.getProject(project.id);
    expect(restored.production.assets.find((item) => item.id === record.id)?.imagePath).toBe(activePath);
    expect(await store.projectFileExists(project.id, activePath)).toBe(true);
  });

  it("preserves an unreferenced permanent image during later stale reads", async () => {
    const root = path.join(tmpdir(), `continuity-flat-assets-stale-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const store = new ProjectStore(root);
    const project = await store.createProject(input, { kind: "builtin", label: "test", available: true });
    const record = addManualManifestAsset(project, {
      name: "Late Metadata Asset",
      category: "prop",
      description: "A stale read must not delete the permanent image.",
    });
    await store.saveProject(project);

    const stagedPath = "asset_history/generated/late-metadata-v1.png";
    await store.writeProjectBinary(project.id, stagedPath, Buffer.from("generated-image"));
    const activePath = await store.activateProductionAssetFile(project.id, record.filename, stagedPath);

    // Simulate a process restart losing its in-memory pending marker while the
    // durable project file still contains the pre-generation metadata.
    const restartedStore = new ProjectStore(root);
    const stalePoll = await restartedStore.getProject(project.id);
    expect(stalePoll.production.assets.find((item) => item.id === record.id)?.imagePath).toBeUndefined();
    expect(await restartedStore.projectFileExists(project.id, activePath)).toBe(true);
  });

  it("migrates ten active assets, preserves Project Image 007 through regeneration and restart, and never reuses a deleted number", async () => {
    const root = path.join(tmpdir(), `continuity-flat-assets-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const store = new ProjectStore(root);
    const project = await store.createProject(input, { kind: "builtin", label: "test", available: true });

    const records = Array.from({ length: 10 }, (_, index) => addManualManifestAsset(project, {
      name: `Production Asset ${index + 1}`,
      category: "prop",
      description: `Canonical production image ${index + 1}.`,
      sequenceIds: ["SEQ_04"],
      referenceRole: "PROP",
    }));
    for (const record of records) {
      const legacyPath = `assets/props/generated/source-${record.number}.png`;
      await store.writeProjectBinary(project.id, legacyPath, Buffer.from(`legacy-${record.number}`));
      record.imagePath = legacyPath;
      record.status = "APPROVED";
      const entity = project.memory.database.assets.find((item) => item.id === record.id)!;
      entity.generatedImagePath = legacyPath;
      entity.approvalState = "APPROVED";
    }

    await store.saveProject(project);
    const firstRestart = await store.getProject(project.id);
    expect(firstRestart.production.assets).toHaveLength(10);
    expect(firstRestart.production.assets.map((record) => record.filename)).toEqual(
      firstRestart.production.assets.map((record) => `${String(record.number).padStart(3, "0")}_Production_Asset_${record.number}.png`),
    );
    expect(firstRestart.production.assets.every((record) => record.imagePath === `assets/${record.filename}`)).toBe(true);
    expect((await readdir(store.resolveProjectFile(project.id, "assets"), { withFileTypes: true })).some((entry) => entry.isDirectory())).toBe(false);
    expect(await store.projectFileExists(project.id, "asset_history/legacy/props/generated/source-7.png")).toBe(true);

    const imageSeven = firstRestart.production.assets.find((record) => record.number === 7)!;
    const permanentIdentity = { id: imageSeven.id, number: imageSeven.number, filename: imageSeven.filename, imagePath: imageSeven.imagePath };
    const maker = new AssetMaker(store);
    await maker.generateAsset(firstRestart, imageSeven.id, true, "APPLY_ALL");
    const stagedPath = imageSeven.pendingVersion!.imagePath;
    expect(stagedPath).toMatch(/^asset_history\/generated\/007_/);
    await maker.acceptPendingVersion(firstRestart, imageSeven.id);
    expect({ id: imageSeven.id, number: imageSeven.number, filename: imageSeven.filename, imagePath: imageSeven.imagePath }).toEqual(permanentIdentity);
    expect((await readFile(store.resolveProjectFile(project.id, imageSeven.imagePath!))).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(await store.projectFileExists(project.id, stagedPath)).toBe(true);

    deleteManualManifestAsset(firstRestart, firstRestart.production.assets.find((record) => record.number === 3)!.id);
    const later = addManualManifestAsset(firstRestart, { name: "Later Asset", category: "prop", description: "Must not reuse Project Image 003." });
    expect(later.number).toBe(11);
    expect(later.filename).toBe("011_Later_Asset.png");
    await store.saveProject(firstRestart);

    const finalRestart = await store.getProject(project.id);
    const restoredSeven = finalRestart.production.assets.find((record) => record.id === permanentIdentity.id)!;
    expect({ id: restoredSeven.id, number: restoredSeven.number, filename: restoredSeven.filename, imagePath: restoredSeven.imagePath }).toEqual(permanentIdentity);
    const manifest = JSON.parse(await readFile(store.resolveProjectFile(project.id, "assets/asset_manifest.json"), "utf8"));
    expect(manifest.assets.find((record: { projectImageNumber: number }) => record.projectImageNumber === 7)).toMatchObject({
      assetId: permanentIdentity.id,
      exactFilename: permanentIdentity.filename,
      currentVersion: 2,
      sequencesUsed: ["SEQ_04"],
    });
    expect(await store.projectFileExists(project.id, "asset_history/asset_history.json")).toBe(true);
  }, 20_000);
});
