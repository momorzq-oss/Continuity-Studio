import type {
  BrainMode,
  MovieProject,
  ProjectBrainState,
  ProjectMemory,
  ProviderInfo,
} from "../src/types.js";
import { createProductionDatabase } from "./rule-engine.js";

export const CURRENT_PROJECT_SCHEMA_VERSION = 4;

export const createProjectMemory = (projectId = "UNASSIGNED"): ProjectMemory => ({
  approvedAssets: [],
  lockedCharacters: [],
  lockedWardrobe: [],
  lockedCreatures: [],
  lockedLocations: [],
  lockedProps: [],
  sequenceContinuity: {},
  generationHistory: [],
  regenerationHistory: [],
  approvalHistory: [],
  database: createProductionDatabase(projectId),
});

export const createProjectBrain = (selected: BrainMode): ProjectBrainState => ({
  selected,
  activity: [],
});

const migratedProvider = (provider: ProviderInfo | undefined): ProviderInfo => {
  if (!provider) return { kind: "builtin", label: "Built-in local production engine", available: true };
  if (provider.kind === "local" && /built-in|local engine/i.test(provider.label)) {
    return { ...provider, kind: "builtin" };
  }
  return provider;
};

export const migrateProject = (
  input: unknown,
): { project: MovieProject; changed: boolean; fromVersion: number } => {
  const source = structuredClone(input) as Partial<MovieProject> & Record<string, unknown>;
  const fromVersion = typeof source.schemaVersion === "number" ? source.schemaVersion : 1;
  let changed = fromVersion !== CURRENT_PROJECT_SCHEMA_VERSION;

  source.provider = migratedProvider(source.provider);
  if (!source.brain) {
    const selected: BrainMode = source.provider.kind === "openai" ? "openai" : "local";
    source.brain = createProjectBrain(selected);
    changed = true;
  } else if (!Array.isArray(source.brain.activity)) {
    source.brain.activity = [];
    changed = true;
  }
  if (!source.memory) {
    source.memory = createProjectMemory(source.id);
    changed = true;
  } else {
    const memory = source.memory as ProjectMemory;
    source.memory = { ...createProjectMemory(source.id), ...memory };
    if (!memory.database) changed = true;
  }
  const project = source as Partial<MovieProject>;
  if (!project.storyMode) { project.storyMode = "AI_FIRST"; changed = true; }
  if (!project.era) { project.era = "Contemporary"; changed = true; }
  if (!project.aspectRatio) { project.aspectRatio = "2.39:1"; changed = true; }
  if (typeof project.autoGenerateAssets !== "boolean") { project.autoGenerateAssets = false; changed = true; }
  if (typeof project.autoGenerateScenes !== "boolean") { project.autoGenerateScenes = false; changed = true; }
  if (typeof project.autoGenerateStoryboard !== "boolean") { project.autoGenerateStoryboard = false; changed = true; }
  if (!source.preStorySetup) {
    source.preStorySetup = {
      mode: project.storyMode,
      completed: true,
      completedAt: new Date().toISOString(),
      sheetCreation: "AUTO",
      blockingIssues: [],
    };
    changed = true;
  }
  const database = source.memory?.database;
  if (database) {
    const defaults = createProductionDatabase(source.id ?? "UNASSIGNED");
    source.memory!.database = { ...defaults, ...database };
    for (const asset of source.memory!.database.assets) {
      const legacyReference = asset.referenceImages?.find((item) => !item.startsWith("reference://"));
      asset.referenceImages = legacyReference ? asset.referenceImages.filter((item) => !item.startsWith("reference://")) : [];
      asset.visualDescription ??= asset.description;
      asset.generationPrompt ??= `Cinematic continuity reference for ${asset.name}. ${asset.description}`;
      asset.negativePrompt ??= "identity drift, duplicate subject, incorrect era, text, watermark";
      asset.provider ??= "continuity-local";
      asset.model ??= "reference-renderer-v1";
      asset.generatedImagePath ??= legacyReference;
      asset.sourceReferenceIds ??= [];
      asset.generationJobIds ??= [];
      asset.critical ??= ["character", "creature", "animal", "location"].includes(asset.category);
      if (!asset.generatedImagePath && !asset.sourceReferenceIds.length && ["GENERATED", "REVIEW", "APPROVED", "LOCKED"].includes(asset.approvalState)) {
        asset.approvalState = "PROMPT_READY";
      }
    }
  }
  if (!source.currentAgent && source.currentPhase) {
    source.currentAgent = `${source.currentPhase.replaceAll("_", " ")} agent`;
    changed = true;
  }
  source.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
  return { project: source as MovieProject, changed, fromVersion };
};
