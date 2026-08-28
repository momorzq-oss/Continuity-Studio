import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CreateProjectInput } from "../src/types.js";
import { addManualManifestAsset, buildCanonicalAssetManifest, manifestHealth } from "./asset-manifest.js";
import { ReferenceManager } from "./reference-manager.js";
import {
  analyzeCharacters,
  approveCharacters,
  approveFilmBible,
  approveStory,
  buildAssetManifest,
  generateFilmBible,
  generateStory,
  lockMovieDna,
} from "./production-workflow.js";
import { ProjectStore } from "./store.js";

const roots: string[] = [];
const input: CreateProjectInput = {
  title: "Canonical Manifest Test",
  idea: "In 1965 UAE, a courier and camel enter a silent desert camp where a hidden presence bends the fire.",
  genre: "Folk Horror", runtimeMinutes: 1, sequenceCount: 6, sequenceDurationSeconds: 10,
  language: "English", filmLanguage: "English", dialogueLanguage: "English", visualStyle: "Grounded desert cinema",
  mode: "phases", brain: "local", storyMode: "AI_FIRST", era: "1965 UAE", aspectRatio: "2.39:1",
  autoGenerateAssets: false, autoGenerateScenes: false, autoGenerateStoryboard: false,
};

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("canonical asset manifest", () => {
  it("extracts approved source records, separates the protected identity source, and preserves permanent numbering", async () => {
    const root = path.join(tmpdir(), `continuity-manifest-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const store = new ProjectStore(root);
    const project = await store.createProject(input, { kind: "builtin", label: "test", available: true });
    const references = new ReferenceManager(store);
    await references.upload(project, {
      filename: "lead.png", mimeType: "image/png",
      base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      name: "The Courier", type: "character", mainCharacter: true, storyUsage: "REQUIRED",
    });
    lockMovieDna(project);
    generateStory(project);
    approveStory(project);
    const approvedStoryVersion = project.production.story.approvedVersion!;
    generateFilmBible(project);
    approveFilmBible(project);
    analyzeCharacters(project);
    approveCharacters(project);

    project.production.story.version += 1;
    project.production.story.status = "CHANGED_AFTER_PRODUCTION";
    project.production.story.objects.push({
      id: "PROP_UNAPPROVED_FAKE", name: "Unapproved fake", category: "prop", description: "Must not enter the manifest.",
      importance: "CRITICAL", referencePriority: "REQUIRED", relatedBeatIds: [], relatedSequenceIds: ["SEQ_01"],
    });

    buildAssetManifest(project);
    const records = project.production.assets;
    expect(records.some((record) => record.id === "PROP_UNAPPROVED_FAKE")).toBe(false);
    expect(records.every((record) => record.sourceStoryVersion === approvedStoryVersion)).toBe(true);
    expect(records.some((record) => ["Principal location", "Primary costume", "Hero story object"].includes(record.name))).toBe(false);
    expect(records.find((record) => record.id === "MOVIE_DNA_MASTER_FRAME")).toMatchObject({ number: 1, sourceType: "MOVIE_DNA", canGenerate: false });

    const source = records.find((record) => record.sourceType === "UPLOADED_REFERENCE");
    const main = project.production.characters.find((character) => character.category === "main")!;
    const characterSheet = records.find((record) => record.id === main.id);
    expect(source).toMatchObject({ category: "main_character", status: "LOCKED", canGenerate: false, identityReferenceId: project.preStorySetup.mainCharacterReferenceId });
    expect(source?.id).not.toBe(characterSheet?.id);
    expect(characterSheet?.dependencyIds).toContain(source?.id);
    expect(characterSheet?.characterRelationships).toEqual(main.relationships);
    expect(manifestHealth(project, source!).hasImage).toBe(true);
    expect(manifestHealth(project, characterSheet!).hasImage).toBe(false);
    expect(manifestHealth(project, characterSheet!).missing).toBe(true);

    const stateRecords = records.filter((record) => record.category === "character_state");
    expect(stateRecords).toHaveLength(project.production.characters.reduce((total, character) => total + character.states.length, 0));
    expect(stateRecords.every((record) => record.characterId && record.characterStateId && record.dependencyIds?.includes(record.characterId))).toBe(true);
    expect(new Set(records.map((record) => record.number)).size).toBe(records.length);
    expect(new Set(records.map((record) => record.filename)).size).toBe(records.length);
    expect(project.memory.database.assets.map((asset) => asset.id).sort()).toEqual(records.map((record) => record.id).sort());

    const location = records.find((record) => record.category === "location")!;
    const prop = addManualManifestAsset(project, { name: "Period Story Prop", category: "prop", description: "A historically constrained practical story prop.", sequenceIds: ["SEQ_01"], referenceRole: "PROP", continuityRequirements: ["Preserve exact material and scale."] });
    expect(prop.continuityNotes).toContain("Preserve exact material and scale.");
    expect(characterSheet?.generationPrompt).toContain("LOCKED MOVIE DNA V");
    expect(characterSheet?.generationPrompt).toContain("characterIdentityLaw");
    expect(location.generationPrompt).toContain("APPROVED FILM BIBLE V");
    expect(location.generationPrompt).toContain("environmentAndWeather");
    expect(prop.generationPrompt).toContain("LOCKED MOVIE DNA V");
    expect(prop.generationPrompt).toContain("historicalAndCulturalLaw");

    const permanent = new Map(project.production.assets.map((record) => [record.id, { number: record.number, filename: record.filename }]));
    buildCanonicalAssetManifest(project);
    for (const [id, identity] of permanent) {
      expect(project.production.assets.find((record) => record.id === id)).toMatchObject(identity);
    }
  });
});
