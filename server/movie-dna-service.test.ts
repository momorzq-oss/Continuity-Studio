import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ImageGenerationInput, ImageGenerationOutput, ImageGenerationProvider } from "./image-generation/provider.js";
import { MovieDnaService } from "./movie-dna-service.js";
import { AssetMaker } from "./asset-maker.js";
import { lockMovieDna, updateMovieDna } from "./production-workflow.js";
import { ProjectStore } from "./store.js";

const roots: string[] = [];

class CapturingProvider implements ImageGenerationProvider {
  readonly id = "capturing-provider";
  readonly model = "movie-dna-test-model";
  readonly paid = false;
  inputs: ImageGenerationInput[] = [];
  fail = false;
  estimateCost() { return 0; }
  async generate(input: ImageGenerationInput): Promise<ImageGenerationOutput> {
    this.inputs.push(structuredClone(input));
    if (this.fail) throw new Error("Visible Movie DNA provider failure");
    const image = Buffer.from(`real-image-${input.id}-${input.prompt}`);
    return { image, thumbnail: Buffer.from(`thumb-${input.id}`), provider: this.id, model: this.model };
  }
}

const createProject = async () => {
  const root = path.join(tmpdir(), `continuity-movie-dna-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  roots.push(root);
  const store = new ProjectStore(root);
  const project = await store.createProject({
    title: "Movie DNA Test",
    movieTitle: "The Silent Camp",
    idea: "In 1965, a desert courier discovers a silent camp where an ancient presence follows the firelight.",
    genre: "Historical Horror Drama",
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
  return { store, project };
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Movie DNA structured generation", () => {
  it("persists structured selections, combined preview association and technical values", async () => {
    const { store, project } = await createProject();
    const provider = new CapturingProvider();
    const service = new MovieDnaService(store, provider);
    updateMovieDna(project, { key: "genre", optionIds: ["genre_epic", "genre_horror", "genre_drama"], label: "", technicalDescription: "" });
    updateMovieDna(project, { key: "photography", optionIds: ["photo_35mm"], label: "", technicalDescription: "" });
    updateMovieDna(project, { key: "filmStock", optionIds: ["stock_5219"], label: "", technicalDescription: "" });
    updateMovieDna(project, { key: "colorGrade", optionIds: ["grade_muted_desert"], label: "", technicalDescription: "" });
    await service.generateCombinedGenrePreview(project);
    await store.saveProject(project);

    const reopened = await store.getProject(project.id);
    expect(reopened.production.movieDna.genreOptionIds).toEqual(["genre_epic", "genre_horror", "genre_drama"]);
    expect(reopened.production.movieDna.selections.genre.label).toBe("Epic Horror Drama");
    expect(reopened.production.movieDna.selections.colorGrade.technicalValues).toMatchObject({ saturation: 76, contrast: 96, colourBias: "sand ochre" });
    const preview = reopened.production.movieDna.previews[reopened.production.movieDna.combinedGenrePreviewId!];
    expect(preview.status).toBe("GENERATED");
    expect(preview.path && await store.projectFileExists(project.id, preview.path)).toBe(true);
  });

  it("locks every structured selection and blocks unreviewed edits", async () => {
    const { project } = await createProject();
    lockMovieDna(project);
    expect(Object.values(project.production.movieDna.selections).every((selection) => selection.locked)).toBe(true);
    expect(() => updateMovieDna(project, { key: "colorGrade", optionIds: ["grade_cold_horror"], label: "", technicalDescription: "" })).toThrow(/locked/i);
  });

  it("marks previews Generated only after a real file exists and exposes provider failure for Retry", async () => {
    const { store, project } = await createProject();
    const provider = new CapturingProvider();
    const service = new MovieDnaService(store, provider);
    await service.regeneratePreview(project, "colorGrade", "grade_muted_desert");
    const success = project.production.movieDna.previews["colorGrade:grade_muted_desert"]!;
    expect(success.status).toBe("GENERATED");
    expect(success.path && await store.projectFileExists(project.id, success.path)).toBe(true);
    const retainedPath = success.path;

    provider.fail = true;
    await service.regeneratePreview(project, "colorGrade", "grade_muted_desert");
    const failed = project.production.movieDna.previews["colorGrade:grade_muted_desert"]!;
    expect(failed.status).toBe("FAILED");
    expect(failed.error).toMatch(/visible movie dna provider failure/i);
    expect(failed.path).toBe(retainedPath);
  });

  it("keeps the Master Frame permanent number and filename across regenerations", async () => {
    const { store, project } = await createProject();
    const provider = new CapturingProvider();
    const service = new MovieDnaService(store, provider);
    lockMovieDna(project);
    await service.generateMasterFrame(project);
    const first = structuredClone(project.production.movieDna.masterFrame!);
    const counterAfterFirst = project.production.nextProjectImageNumber;
    await service.generateMasterFrame(project);
    const second = project.production.movieDna.masterFrame!;

    expect(second.projectNumber).toBe(first.projectNumber);
    expect(second.filename).toBe(first.filename);
    expect(second.filename).toMatch(/^\d+_Movie_DNA_Master_Frame\.png$/);
    expect(second.version).toBe(first.version + 1);
    expect(project.production.nextProjectImageNumber).toBe(counterAfterFirst);
    expect(project.production.assets.filter((asset) => asset.id === "MOVIE_DNA_MASTER_FRAME")).toHaveLength(1);
  });

  it("injects locked Movie DNA and the separate style reference into later image jobs", async () => {
    const { store, project } = await createProject();
    const provider = new CapturingProvider();
    const service = new MovieDnaService(store, provider);
    lockMovieDna(project);
    await service.generateMasterFrame(project);
    const createdAt = new Date().toISOString();
    const asset = {
      id: "PROP_TEST_LANTERN", projectId: project.id, name: "Test Lantern", category: "prop" as const,
      approvalState: "PROMPT_READY" as const, version: 1, createdAt, updatedAt: createdAt,
      description: "A weathered 1965 brass lantern.", referenceImages: [], lockedTraits: {}, mutableTraits: {}, currentState: {}, notes: [],
      visualDescription: "Weathered brass lantern with warm flame.", generationPrompt: "Generate a production reference for a weathered brass lantern.",
      negativePrompt: "modern electric lamp, text, watermark", provider: "", model: "", sourceReferenceIds: [], generationJobIds: [], critical: false,
    };
    project.memory.database.assets.push(asset);
    const maker = new AssetMaker(store, provider);
    await maker.generateAsset(project, asset.id, true);
    const input = provider.inputs.at(-1)!;

    expect(input.prompt).toContain("LOCKED MOVIE DNA VERSION 1");
    expect(input.prompt).toContain("never replace character identity");
    expect(input.referencePaths).toContain(project.production.movieDna.masterFrame!.path);
    expect(input.prompt).toContain("colorGrade: Muted Desert");
  });
});
