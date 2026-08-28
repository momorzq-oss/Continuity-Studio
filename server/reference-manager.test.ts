import { access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CreateProjectInput, SequencesArtifact, StoryArtifact } from "../src/types.js";
import { AssetMaker } from "./asset-maker.js";
import { ReferenceManager } from "./reference-manager.js";
import { filmRuleEngine } from "./rule-engine.js";
import { ProjectStore } from "./store.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("ReferenceManager", () => {
  it("protects a main source, gates reference-first setup, and reconciles it as the only protagonist", async () => {
    const root = path.join(tmpdir(), `continuity-reference-${Date.now()}-${Math.random().toString(16).slice(2)}`); roots.push(root);
    const store = new ProjectStore(root);
    const input: CreateProjectInput = { title: "Reference Test", idea: "A person crosses a desert in a complete short film.", genre: "Drama", runtimeMinutes: 1, sequenceCount: 1, language: "English", visualStyle: "Cinema", mode: "phases", brain: "local", storyMode: "REFERENCE_FIRST", era: "1965", aspectRatio: "2.39:1", autoGenerateAssets: false, autoGenerateScenes: false, autoGenerateStoryboard: false };
    const project = await store.createProject(input, { kind: "builtin", label: "test", available: true });
    const manager = new ReferenceManager(store);
    expect(() => manager.completeSetup(project)).toThrow(/requires at least one/i);
    const reference = await manager.upload(project, { filename: "rashid.png", mimeType: "image/png", base64: png, name: "Rashid", type: "character", mainCharacter: true });
    manager.completeSetup(project);
    expect(reference.id).toBe("CHAR_MAIN_001_SOURCE");
    expect(reference.protected).toBe(true);
    await access(store.resolveProjectFile(project.id, reference.sourcePath));
    const story = filmRuleEngine.enforcePhaseArtifact(project, "story", { logline: "Test", synopsis: "Test", fullStory: "Test", acts: [], characters: [{ id: "CHAR_OTHER_001", name: "Someone", role: "Protagonist", description: "A person", relationships: [] }, { id: "CHAR_DUP_001", name: "Rashid", role: "Other protagonist", description: "Duplicate", relationships: [] }], locations: [], dialogueExcerpt: "" } satisfies StoryArtifact) as StoryArtifact;
    expect(story.characters.filter((item) => /protagonist/i.test(item.role))).toHaveLength(1);
    expect(story.characters[0]).toMatchObject({ id: "CHAR_MAIN_001", name: "Rashid" });
  });

  it("persists previews, versions, generated sheets, assignments, replacement, and removal", async () => {
    const root = path.join(tmpdir(), `continuity-reference-lifecycle-${Date.now()}-${Math.random().toString(16).slice(2)}`); roots.push(root);
    const store = new ProjectStore(root);
    const input: CreateProjectInput = { title: "Reference Lifecycle", idea: "A traveller reaches a protected location during a continuity test.", genre: "Drama", runtimeMinutes: 1, sequenceCount: 1, language: "English", visualStyle: "Cinema", mode: "phases", brain: "local", storyMode: "REFERENCE_FIRST", era: "Now", aspectRatio: "16:9", autoGenerateAssets: false, autoGenerateScenes: false, autoGenerateStoryboard: false };
    const project = await store.createProject(input, { kind: "builtin", label: "test", available: true });
    const manager = new ReferenceManager(store);
    const main = await manager.upload(project, { filename: "lead.png", mimeType: "image/png", base64: png, name: "Lead", type: "character", mainCharacter: true });
    const location = await manager.upload(project, { filename: "camp.png", mimeType: "image/png", base64: png, name: "Desert Camp", label: "Night Reference", type: "location" });
    location.sequenceIds = ["SEQ_001"];
    const mainAsset = manager.ensureAsset(project, main.id);
    const locationAsset = manager.ensureAsset(project, location.id);
    const maker = new AssetMaker(store);
    await maker.generateAsset(project, mainAsset.id);
    await maker.generateContinuitySheet(project, mainAsset.id);
    await maker.generateAsset(project, locationAsset.id);
    await maker.generateContinuitySheet(project, locationAsset.id);
    filmRuleEngine.setAssetApproval(project, mainAsset.id, "APPROVED");
    filmRuleEngine.setAssetApproval(project, locationAsset.id, "APPROVED");
    await store.writePhaseArtifact(project, "assets", project.artifacts.assets!);
    await expect(access(store.resolveProjectFile(project.id, mainAsset.generatedImagePath!))).resolves.toBeUndefined();
    await expect(access(store.resolveProjectFile(project.id, locationAsset.generatedImagePath!))).resolves.toBeUndefined();
    project.artifacts.sequences = filmRuleEngine.registerSequences(project, { targetRuntimeSeconds: 10, sequences: [{ id: "SEQ_001", number: 1, title: "Camp", durationSeconds: 10, synopsis: "Arrival", locationId: "LOC_OTHER_001", assetIds: [], emotionalBeat: "Arrival", status: "draft" }] } satisfies SequencesArtifact);
    await store.saveProject(project);

    const reopened = await store.getProject(project.id);
    expect(reopened.preStorySetup.mainCharacterReferenceId).toBe(main.id);
    const mainViews = reopened.memory.database.continuitySheets.find((sheet) => sheet.assetId === mainAsset.id)?.views ?? [];
    expect(mainViews.length).toBeGreaterThanOrEqual(9);
    expect(mainViews.map((view) => view.angle)).toEqual(expect.arrayContaining(["MASTER", "FRONT", "THREE_QUARTER", "FULL_BODY_FRONT", "WARDROBE", "STORY_LOOK"]));
    const sequence = (reopened.artifacts.sequences as SequencesArtifact).sequences[0]!;
    expect(sequence.locationId).toBe(locationAsset.id);
    expect(sequence.assetIds).toContain(mainAsset.id);
    expect(sequence.referenceManifest?.[0]).toMatchObject({ assetId: mainAsset.id, priority: 1000, approved: true });

    const previousPath = reopened.memory.database.projectReferences.find((item) => item.id === main.id)!.sourcePath;
    await manager.replace(reopened, main.id, { filename: "lead-new.png", mimeType: "image/png", base64: png });
    const replaced = reopened.memory.database.projectReferences.find((item) => item.id === main.id)!;
    expect(replaced.versions).toHaveLength(2);
    expect(replaced.sourcePath).not.toBe(previousPath);
    expect(reopened.memory.database.assets.find((item) => item.id === mainAsset.id)?.generatedImagePath).toBeUndefined();
    await expect(access(store.resolveProjectFile(reopened.id, previousPath))).resolves.toBeUndefined();
    await store.saveProject(reopened);
    const reopenedReplacement = await store.getProject(reopened.id);
    expect(reopenedReplacement.memory.database.assets.find((item) => item.id === mainAsset.id)?.generatedImagePath).toBeUndefined();
    await manager.remove(reopenedReplacement, main.id);
    expect(reopenedReplacement.preStorySetup.mainCharacterReferenceId).toBeUndefined();
    await expect(access(store.resolveProjectFile(reopened.id, previousPath))).rejects.toThrow();
  }, 20_000);
});
