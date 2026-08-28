import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";
import { findMovieDnaPresetForIdea, MOVIE_DNA_CATALOG, movieDnaCategory, movieDnaOption, searchMovieDnaOptions } from "../src/movie-dna-catalog.js";
import type {
  ImageGenerationJob,
  ImageGenerationTarget,
  MovieDnaMasterFrame,
  MovieDnaPreviewAsset,
  MovieDnaRecommendation,
  MovieProject,
  ProductionAssetRecord,
} from "../src/types.js";
import type { ImageGenerationProvider } from "./image-generation/provider.js";
import { lockedMovieDnaPrompt, resolveMovieDnaOption, updateMovieDna } from "./production-workflow.js";
import type { ProjectStore } from "./store.js";

const stamp = () => new Date().toISOString();
const pad = (value: number) => String(value).padStart(2, "0");
const token = (value: string) => value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();

interface GenerationResult {
  status: "GENERATED" | "FAILED";
  provider: string;
  model: string;
  path?: string;
  thumbnailPath?: string;
  error?: string;
}

export class MovieDnaService {
  constructor(
    private readonly store: ProjectStore,
    private readonly provider: ImageGenerationProvider,
    private readonly workspaceRoot?: string,
  ) {}

  async regeneratePreview(project: MovieProject, categoryId: string, optionId: string) {
    const category = movieDnaCategory(categoryId);
    const option = resolveMovieDnaOption(project, categoryId, optionId);
    if (!category || !option) throw new Error("The selected Movie DNA preview option does not exist.");
    if (project.production.movieDna.status === "LOCKED") throw new Error("Create a protected Movie DNA version before regenerating visual samples.");
    const id = `${categoryId}:${optionId}`;
    const previous = project.production.movieDna.previews[id];
    const version = (previous?.version ?? 0) + 1;
    const prompt = [
      "Create a representative cinematic comparison frame for Continuity Studio.",
      `Project idea: ${project.idea}`,
      `Comparison base scene must remain unchanged: ${category.comparisonBaseScene}`,
      `Change only this visual category — ${category.name}: ${option.name}.`,
      option.promptDescription,
      `Technical values: ${JSON.stringify(option.technicalValues)}.`,
      `Frame for ${project.aspectRatio}; no text, labels, watermarks, split screen or contact sheet.`,
    ].join("\n");
    const createdAt = previous?.createdAt ?? stamp();
    const preview: MovieDnaPreviewAsset = {
      id, categoryId, optionId, version, prompt, status: "GENERATING", createdAt, updatedAt: stamp(),
      path: previous?.path, thumbnailPath: previous?.thumbnailPath,
    };
    project.production.movieDna.previews[id] = preview;
    await this.store.saveProject(project);
    const seedImages = await this.catalogReferences(categoryId, [optionId]);
    const result = await this.generate(project, "MOVIE_DNA_PREVIEW", id, prompt, [], seedImages, `movie_dna/previews/${token(categoryId)}/${token(optionId)}-v${version}`, `${category.name} — ${option.name}`, 1280, 720);
    Object.assign(preview, result, { updatedAt: stamp() });
    const selected = project.production.movieDna.selections[categoryId];
    if (result.status === "GENERATED" && selected?.optionIds?.length === 1 && selected.optionIds[0] === optionId) {
      selected.selectedPreviewId = id;
      selected.previewPath = result.path;
      selected.modifiedAt = stamp();
    }
    await this.store.saveProject(project);
    return project;
  }

  async generateCombinedGenrePreview(project: MovieProject, requestedOptionIds?: string[]) {
    const optionIds = [...new Set(requestedOptionIds?.length ? requestedOptionIds : project.production.movieDna.genreOptionIds)];
    if (!optionIds.length || optionIds.some((id) => !resolveMovieDnaOption(project, "genre", id))) throw new Error("Select at least one valid genre before generating the combined visual.");
    if (project.production.movieDna.status === "LOCKED") throw new Error("Create a protected Movie DNA version before regenerating the combined genre visual.");
    const options = optionIds.map((id) => resolveMovieDnaOption(project, "genre", id)!);
    const id = `combined-genre:${optionIds.join("+")}`;
    const previous = project.production.movieDna.previews[id];
    const version = (previous?.version ?? 0) + 1;
    const category = movieDnaCategory("genre")!;
    const label = options.map((item) => item.name).join(" ");
    const prompt = [
      "Create one cohesive combined-genre cinematic frame for Continuity Studio, not a collage.",
      `Project idea: ${project.idea}`,
      `Keep this base scene: ${category.comparisonBaseScene}`,
      `Combined genre identity: ${label}.`,
      ...options.map((item) => item.promptDescription),
      `Frame for ${project.aspectRatio}; no text, labels, watermark, contact sheet or split screen.`,
    ].join("\n");
    const preview: MovieDnaPreviewAsset = {
      id, categoryId: "genre", optionId: optionIds.join("+"), status: "GENERATING", version, prompt,
      path: previous?.path, thumbnailPath: previous?.thumbnailPath,
      createdAt: previous?.createdAt ?? stamp(), updatedAt: stamp(),
    };
    project.production.movieDna.previews[id] = preview;
    project.production.movieDna.combinedGenrePreviewId = id;
    await this.store.saveProject(project);
    const seedImages = await this.catalogReferences("genre", optionIds);
    const result = await this.generate(project, "MOVIE_DNA_COMBINED_GENRE", id, prompt, [], seedImages, `movie_dna/previews/combined_genre/${token(optionIds.join("-"))}-v${version}`, label, 1280, 720);
    Object.assign(preview, result, { updatedAt: stamp() });
    const selection = project.production.movieDna.selections.genre;
    if (result.status === "GENERATED" && selection && optionIds.join("|") === project.production.movieDna.genreOptionIds.join("|")) {
      selection.selectedPreviewId = id;
      selection.previewPath = result.path;
    }
    await this.store.saveProject(project);
    return project;
  }

  async recommend(project: MovieProject, idea: string) {
    if (project.production.movieDna.status === "LOCKED") throw new Error("Create a protected Movie DNA version before applying a new recommendation.");
    const normalized = `${idea} ${project.genre} ${project.era}`.toLowerCase();
    const presetMatch = findMovieDnaPresetForIdea(normalized);
    const genreCatalog = movieDnaCategory("genre")!;
    const scoredGenres = genreCatalog.options.map((entry) => {
      const terms = entry.name.toLowerCase().split(/\s+/).filter((term) => term.length > 3);
      return { entry, score: terms.reduce((score, term) => score + (normalized.includes(term) ? 2 : 0), 0) + entry.tags.reduce((score, tag) => score + (tag.length > 3 && normalized.includes(tag) ? 1 : 0), 0) };
    }).filter((entry) => entry.score > 0).sort((left, right) => right.score - left.score);
    const searchedGenres = searchMovieDnaOptions(genreCatalog.options, normalized).slice(0, 4).map((entry) => entry.id);
    const genreIds = [...new Set(scoredGenres.slice(0, 4).map(({ entry }) => entry.id).length ? scoredGenres.slice(0, 4).map(({ entry }) => entry.id) : searchedGenres.length ? searchedGenres : ["genre_drama"])];
    const optionIds: Record<string, string[]> = presetMatch && presetMatch.score > 0 ? structuredClone(presetMatch.preset.selections) : {
      genre: genreIds,
      cinematography: [/documentary|real life|observational/.test(normalized) ? "cinematography_documentary_realism" : /independent|art house/.test(normalized) ? "cinematography_european_art_cinema" : "cine_motivated"],
      photography: [/animation|animated/.test(normalized) ? "photography_polished_commercial" : /documentary|news/.test(normalized) ? "photo_documentary" : /epic|spectacle|superhero|space/.test(normalized) ? "photo_large_format" : "photo_digital"],
      lensStyle: [/epic|action|superhero|space/.test(normalized) ? "lens_anamorphic" : "lens_modern_spherical"],
      focalLength: [/portrait|intimate|romance/.test(normalized) ? "focal_50" : "focal_35"],
      colorGrade: [/snow|ice|cold|winter/.test(normalized) ? "grade_cold_horror" : /cyberpunk|neon/.test(normalized) ? "colorgrade_cyberpunk_neon" : "grade_natural"],
      lighting: [/night|moon/.test(normalized) ? "light_moon" : /fire|candle/.test(normalized) ? "light_fire" : "light_day"],
      texture: [/documentary|realism/.test(normalized) ? "texture_naturalistic" : /dream|fantasy/.test(normalized) ? "texture_dreamlike" : "texture_clean"],
      aspectRatio: [MOVIE_DNA_CATALOG.find((entry) => entry.id === "aspectRatio")?.options.find((entry) => entry.name === project.aspectRatio)?.id ?? "aspect_185"],
    };
    for (const category of MOVIE_DNA_CATALOG) {
      if (optionIds[category.id]?.length) continue;
      const direct = category.options.find((entry) => normalized.includes(entry.name.toLowerCase()));
      if (direct) optionIds[category.id] = [direct.id];
    }
    const names = Object.entries(optionIds).map(([categoryId, ids]) => `${movieDnaCategory(categoryId)?.name}: ${ids.map((id) => movieDnaOption(categoryId, id)?.name).join(" ")}`);
    const recommendation: MovieDnaRecommendation = {
      id: randomUUID(), idea, optionIds,
      summary: names.join(" · "),
      createdAt: stamp(),
    };
    project.production.movieDna.recommendation = recommendation;
    await this.store.saveProject(project);
    await this.generateCombinedGenrePreview(project, optionIds.genre);
    recommendation.combinedPreviewId = project.production.movieDna.combinedGenrePreviewId;
    await this.store.saveProject(project);
    return project;
  }

  applyRecommendation(project: MovieProject) {
    const recommendation = project.production.movieDna.recommendation;
    if (!recommendation) throw new Error("Ask Studio Brain for a recommendation first.");
    for (const [key, optionIds] of Object.entries(recommendation.optionIds)) updateMovieDna(project, { key, optionIds, label: "", technicalDescription: "" });
    recommendation.acceptedAt = stamp();
    return project;
  }

  async generateMasterFrame(project: MovieProject) {
    if (project.production.movieDna.status !== "LOCKED") throw new Error("Lock Movie DNA before generating its Master Frame.");
    let master = project.production.movieDna.masterFrame;
    let productionAsset = project.production.assets.find((asset) => asset.id === "MOVIE_DNA_MASTER_FRAME");
    if (!productionAsset) {
      const number = project.production.nextProjectImageNumber++;
      productionAsset = {
        id: "MOVIE_DNA_MASTER_FRAME",
        number,
        filename: `${pad(number)}_Movie_DNA_Master_Frame.png`,
        name: "Movie DNA Master Frame",
        category: "environment",
        description: "Permanent visual style reference for photography, colour, lighting, texture, atmosphere and production design. Never an identity reference.",
        continuityNotes: ["Reference role: Visual Style Reference", "Never replaces Main Character identity"],
        sequenceIds: [], referenceIds: [], version: 1, status: "GENERATING", previousVersions: [],
      } satisfies ProductionAssetRecord;
      project.production.assets.push(productionAsset);
    } else {
      productionAsset.version += 1;
      productionAsset.status = "GENERATING";
    }
    const version = master ? master.version + 1 : 1;
    const prompt = [
      "Create the single canonical Movie DNA Master Frame for this film.",
      lockedMovieDnaPrompt(project),
      `Project idea: ${project.idea}`,
      "Show the overall photography, colour, lighting, texture, atmosphere, environment and production design. Do not present a character identity sheet, portrait lineup, text, labels, watermark, collage or split screen.",
    ].join("\n\n");
    master = {
      id: "MOVIE_DNA_MASTER_FRAME", assetId: productionAsset.id, projectNumber: productionAsset.number,
      filename: productionAsset.filename, referenceRole: "STYLE", status: "GENERATING", version, prompt,
      path: master?.path, thumbnailPath: master?.thumbnailPath,
      createdAt: master?.createdAt ?? stamp(), updatedAt: stamp(),
    } satisfies MovieDnaMasterFrame;
    project.production.movieDna.masterFrame = master;
    project.production.movieDna.masterFrameReferenceId = productionAsset.id;
    await this.store.saveProject(project);
    const stylePaths = [project.production.movieDna.combinedGenrePreviewId ? project.production.movieDna.previews[project.production.movieDna.combinedGenrePreviewId]?.path : undefined, project.production.movieDna.selections.colorGrade?.previewPath].filter((item): item is string => Boolean(item));
    const result = await this.generate(project, "MOVIE_DNA_MASTER_FRAME", master.id, prompt, stylePaths, [], `movie_dna/master_frames/${pad(productionAsset.number)}_Movie_DNA_Master_Frame-v${version}`, "Movie DNA Master Frame", 1536, 864);
    Object.assign(master, result, { updatedAt: stamp() });
    if (result.status === "GENERATED") {
      productionAsset.status = "REVIEW";
      productionAsset.referenceIds = [productionAsset.id];
    } else if (!master.path) productionAsset.status = "GENERATION_FAILED";
    await this.store.saveProject(project);
    return project;
  }

  private async generate(
    project: MovieProject,
    targetType: ImageGenerationTarget,
    targetId: string,
    prompt: string,
    referencePaths: string[],
    seedImages: Array<{ data: Buffer; filename: string; mimeType: string }>,
    outputBase: string,
    label: string,
    width: number,
    height: number,
  ): Promise<GenerationResult> {
    const timestamp = stamp();
    const input = { id: `IMGJOB_${String(project.memory.database.imageGenerationJobs.length + 1).padStart(5, "0")}`, prompt, negativePrompt: project.production.movieDna.negativeRules.join(", "), width, height, referencePaths, referenceImages: [...seedImages], label, kind: targetType };
    const job: ImageGenerationJob = {
      id: input.id, projectId: project.id, targetType, targetId,
      provider: this.provider.id, model: this.provider.model,
      prompt, negativePrompt: input.negativePrompt, referenceIds: [], referencePaths,
      width, height, estimatedCost: this.provider.estimateCost(input), requiresApproval: this.provider.paid,
      approvedToSpend: true, attempt: 1, status: "GENERATING", createdAt: timestamp, updatedAt: timestamp,
    };
    project.memory.database.imageGenerationJobs.push(job);
    await this.store.saveProject(project);
    try {
      const loadedReferences = await Promise.all(referencePaths.map(async (relative) => {
        try {
          const data = await this.store.readProjectBinary(project.id, relative);
          return { data, filename: relative.split("/").at(-1) ?? "reference.png", mimeType: relative.toLowerCase().endsWith(".webp") ? "image/webp" : relative.toLowerCase().match(/\.jpe?g$/) ? "image/jpeg" : "image/png" };
        } catch { return undefined; }
      }));
      input.referenceImages = [...seedImages, ...loadedReferences.filter((item) => item !== undefined)];
      const output = await this.provider.generate(input);
      const path = await this.store.writeProjectBinary(project.id, `${outputBase}.png`, output.image);
      const thumbnailPath = await this.store.writeProjectBinary(project.id, `${outputBase}-thumb.png`, output.thumbnail);
      if (!(await this.store.projectFileExists(project.id, path))) throw new Error("The provider returned an image, but the project file could not be verified.");
      Object.assign(job, { provider: output.provider, model: output.model, resultPath: path, thumbnailPath, status: "GENERATED", updatedAt: stamp() });
      return { status: "GENERATED", provider: output.provider, model: output.model, path, thumbnailPath };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown image generation failure.";
      Object.assign(job, { status: "GENERATION_FAILED", error: message, updatedAt: stamp() });
      return { status: "FAILED", provider: this.provider.id, model: this.provider.model, error: message };
    }
  }

  private async catalogReferences(categoryId: string, optionIds: string[]) {
    if (!this.workspaceRoot) return [];
    const references: Array<{ data: Buffer; filename: string; mimeType: string }> = [];
    for (const optionId of optionIds.slice(0, 4)) {
      const option = movieDnaOption(categoryId, optionId);
      if (!option) continue;
      try {
        const source = PNG.sync.read(await readFile(path.join(this.workspaceRoot, "assets", "movie-dna", `${option.sheet}-contact-sheet.png`)));
        const cellWidth = Math.floor(source.width / 4);
        const cellHeight = Math.floor(source.height / 4);
        const column = option.visualIndex % 4;
        const row = Math.floor(option.visualIndex / 4);
        const crop = new PNG({ width: cellWidth, height: cellHeight });
        PNG.bitblt(source, crop, column * cellWidth, row * cellHeight, cellWidth, cellHeight, 0, 0);
        references.push({ data: PNG.sync.write(crop), filename: `${option.id}-cinematic-sample.png`, mimeType: "image/png" });
      } catch {
        // The built-in sample remains visible in the UI even if an optional seed cannot be loaded.
      }
    }
    return references;
  }
}

export const movieDnaCatalogSummary = () => MOVIE_DNA_CATALOG.map((category) => ({ id: category.id, name: category.name, options: category.options.length }));
