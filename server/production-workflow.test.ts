import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectStore } from "./store.js";
import {
  approveSequence,
  buildAssetManifest,
  generateStory,
  lockMovieDna,
  runFullProductionWorkflow,
} from "./production-workflow.js";

const roots: string[] = [];

const createProject = async () => {
  const root = path.join(tmpdir(), `continuity-workflow-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  roots.push(root);
  const store = new ProjectStore(root);
  return store.createProject({
    title: "Workflow Film",
    idea: "A desert courier discovers a silent camp and must decide whether to enter before night.",
    genre: "Folk Horror",
    runtimeMinutes: 1,
    sequenceCount: 6,
    sequenceDurationSeconds: 10,
    language: "Arabic / English",
    filmLanguage: "Arabic",
    dialogueLanguage: "Arabic",
    visualStyle: "Grounded 1965 desert realism",
    mode: "phases",
    storyMode: "AI_FIRST",
    era: "1965 UAE",
    aspectRatio: "2.39:1",
    resolution: "4K UHD",
    audienceRating: "PG-13",
    targetPlatform: "Seedance",
    narrationEnabled: false,
    dialogueEnabled: true,
    musicEnabled: true,
    subtitlesEnabled: true,
    autoGenerateAssets: false,
    autoGenerateScenes: false,
    autoGenerateStoryboard: false,
  }, { kind: "builtin", label: "Built-in", available: true });
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("gated production workflow", () => {
  it("blocks Story until Movie DNA is locked", async () => {
    const project = await createProject();
    expect(project.production.movieDna.status).toBe("DRAFT");
    expect(() => generateStory(project)).toThrow(/movie dna must be locked/i);
    lockMovieDna(project);
    generateStory(project);
    expect(project.production.story.status).toBe("GENERATED");
    expect(project.production.gates.find((gate) => gate.stage === "story")?.status).toBe("REVIEW");
  });

  it("builds the full approved-ready package and exact timed sequences", async () => {
    const project = await createProject();
    lockMovieDna(project);
    runFullProductionWorkflow(project);
    expect(project.production.story.status).toBe("APPROVED");
    expect(project.production.filmBible.status).toBe("APPROVED");
    expect(project.production.characters.length).toBeGreaterThan(0);
    expect(project.production.assets.length).toBeGreaterThan(5);
    expect(project.production.sequences).toHaveLength(6);
    expect(project.production.sequences.reduce((total, sequence) => total + sequence.durationSeconds, 0)).toBe(60);
    expect(project.production.sequences.every((sequence) => sequence.compiledPrompt === "" && Object.keys(sequence.promptSections).length === 0)).toBe(true);
    expect(project.memory.productionMemory.script.scriptVersion).toBe(1);
    expect(project.production.gates.find((gate) => gate.stage === "platform_prompts")?.status).toBe("PENDING");
  });

  it("updates the central ledger only after a generated sequence is approved", async () => {
    const project = await createProject();
    lockMovieDna(project);
    runFullProductionWorkflow(project);
    const sequence = project.production.sequences[0];
    expect(project.production.continuityLedger).toHaveLength(0);
    sequence.status = "GENERATED";
    sequence.videoPath = "generated_video/seq-01.mp4";
    approveSequence(project, sequence.id);
    expect(sequence.status).toBe("APPROVED");
    expect(project.production.continuityLedger.length).toBe(sequence.assetIds.length);
    expect(project.production.continuityLedger.every((entry) => entry.source === "APPROVED")).toBe(true);
  });

  it("preserves permanent project image numbers and filenames when the manifest grows", async () => {
    const project = await createProject();
    lockMovieDna(project);
    runFullProductionWorkflow(project);
    const original = new Map(project.production.assets.map((asset) => [asset.id, { number: asset.number, filename: asset.filename }]));
    const highestOriginal = Math.max(...project.production.assets.map((asset) => asset.number));
    const template = project.production.characters[0]!;
    project.production.characters.push({
      ...structuredClone(template),
      id: "CHAR-NEW",
      storyCandidateId: "CHAR-NEW",
      number: 99,
      name: "Desert Guide",
      category: "supporting",
      role: "Guide",
      description: "A supporting guide introduced after the first manifest pass.",
      referenceIds: [],
      states: [],
      version: 1,
      status: "APPROVED",
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    buildAssetManifest(project);

    for (const [id, identity] of original) {
      const asset = project.production.assets.find((item) => item.id === id);
      expect(asset?.number).toBe(identity.number);
      expect(asset?.filename).toBe(identity.filename);
    }
    const added = project.production.assets.find((asset) => asset.id === "CHAR-NEW");
    expect(added?.number).toBeGreaterThan(highestOriginal);
    expect(added?.filename).toMatch(/^\d+_Desert_Guide\.png$/);
    expect(new Set(project.production.assets.map((asset) => asset.number)).size).toBe(project.production.assets.length);
  });
});
