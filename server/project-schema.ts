import type {
  BrainMode,
  MovieProject,
  ProjectBrainState,
  ProjectMemory,
  ProjectConfig,
  ProviderInfo,
} from "../src/types.js";
import { createProductionDatabase } from "./rule-engine.js";
import { createProductionWorkflow } from "./production-workflow.js";
import { normalizeStoryDevelopmentState } from "./story-brain.js";
import { normalizeFilmBibleState } from "./film-bible.js";
import { createProductionMemoryLayer, normalizeProductionMemoryLayer, rebuildProductionMemory } from "./production-memory.js";

export const CURRENT_PROJECT_SCHEMA_VERSION = 15;

export const createProjectMemory = (projectId = "UNASSIGNED", config: Partial<ProjectConfig> = {}): ProjectMemory => ({
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
  productionMemory: createProductionMemoryLayer(config, projectId),
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
  if (!project.movieTitle) { project.movieTitle = project.title || "Untitled Movie"; changed = true; }
  if (!project.storyMode) { project.storyMode = "AI_FIRST"; changed = true; }
  if (!project.era) { project.era = "Contemporary"; changed = true; }
  if (!project.aspectRatio) { project.aspectRatio = "2.39:1"; changed = true; }
  if (!project.sequenceDurationSeconds) { project.sequenceDurationSeconds = Math.max(1, Math.round(((project.runtimeMinutes ?? 1) * 60) / Math.max(1, project.sequenceCount ?? 1))); changed = true; }
  if (!project.resolution) { project.resolution = "4K UHD"; changed = true; }
  if (!project.filmLanguage) { project.filmLanguage = project.language || "English"; changed = true; }
  if (!project.dialogueLanguage) { project.dialogueLanguage = project.language || "English"; changed = true; }
  if (!project.audienceRating) { project.audienceRating = "General / PG-13"; changed = true; }
  if (!project.targetPlatform) { project.targetPlatform = "Seedance"; changed = true; }
  if (typeof project.narrationEnabled !== "boolean") { project.narrationEnabled = false; changed = true; }
  if (typeof project.dialogueEnabled !== "boolean") { project.dialogueEnabled = true; changed = true; }
  if (typeof project.musicEnabled !== "boolean") { project.musicEnabled = true; changed = true; }
  if (typeof project.subtitlesEnabled !== "boolean") { project.subtitlesEnabled = true; changed = true; }
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
    const savedRules = new Map((database.rules ?? []).map((rule) => [rule.id, rule]));
    source.memory!.database.rules = [
      ...defaults.rules.map((rule) => ({ ...rule, ...(savedRules.get(rule.id) ?? {}) })),
      ...(database.rules ?? []).filter((rule) => !defaults.rules.some((candidate) => candidate.id === rule.id)),
    ];
    for (const reference of source.memory!.database.projectReferences) {
      reference.sequenceIds ??= [];
      reference.assetId ??= reference.linkedAssetIds?.[0];
      reference.versions ??= [{
        version: 1,
        sourcePath: reference.sourcePath,
        mimeType: reference.mimeType,
        originalFilename: reference.originalFilename,
        createdAt: reference.createdAt,
      }];
    }
    for (const asset of source.memory!.database.assets) {
      const legacyReference = asset.referenceImages?.find((item) => !item.startsWith("reference://"));
      asset.referenceImages = legacyReference ? asset.referenceImages.filter((item) => !item.startsWith("reference://")) : [];
      asset.visualDescription ??= asset.description;
      asset.generationPrompt ??= `Cinematic continuity reference for ${asset.name}. ${asset.description}`;
      asset.negativePrompt ??= "identity drift, duplicate subject, incorrect era, text, watermark";
      asset.provider ??= "continuity-local";
      asset.model ??= "reference-renderer-v1";
      asset.sourceReferenceIds ??= [];
      if (!asset.generatedImagePath && !asset.sourceReferenceIds.length) asset.generatedImagePath = legacyReference;
      if (asset.sourceReferenceIds.length && asset.generatedImagePath?.startsWith("references/uploads/") && ["PROMPT_READY", "REGENERATE"].includes(asset.approvalState)) {
        asset.generatedImagePath = undefined;
        changed = true;
      }
      asset.generationJobIds ??= [];
      asset.generationError ??= undefined;
      asset.critical ??= ["character", "creature", "animal", "location"].includes(asset.category);
      asset.sequenceIds ??= [];
      asset.dependencyIds ??= [];
      if (!asset.generatedImagePath && !asset.sourceReferenceIds.length && ["GENERATED", "REVIEW", "APPROVED", "LOCKED"].includes(asset.approvalState)) {
        asset.approvalState = "PROMPT_READY";
      }
    }
  }
  if (!source.currentAgent && source.currentPhase) {
    source.currentAgent = `${source.currentPhase.replaceAll("_", " ")} agent`;
    changed = true;
  }
  if (!source.production) {
    source.production = createProductionWorkflow(project as MovieProject);
    changed = true;
  } else {
    const defaults = createProductionWorkflow(project as MovieProject);
    const savedMovieDna = source.production.movieDna;
    source.production = {
      ...defaults,
      ...source.production,
      movieDna: {
        ...defaults.movieDna,
        ...savedMovieDna,
        selections: { ...defaults.movieDna.selections, ...(savedMovieDna?.selections ?? {}) },
        previews: { ...defaults.movieDna.previews, ...(savedMovieDna?.previews ?? {}) },
      },
      story: { ...defaults.story, ...source.production.story },
      filmBible: { ...defaults.filmBible, ...source.production.filmBible },
      platformProfiles: Object.fromEntries(Object.entries(defaults.platformProfiles).map(([platform, profile]) => {
        const saved = source.production!.platformProfiles?.[platform as keyof typeof source.production.platformProfiles];
        return [platform, { ...profile, ...(saved ?? {}), version: Math.max(profile.version, saved?.version ?? 0) }];
      })) as typeof defaults.platformProfiles,
      knowledgeSources: source.production.knowledgeSources?.length ? source.production.knowledgeSources : defaults.knowledgeSources,
      storyboardGrids: { ...defaults.storyboardGrids, ...(source.production.storyboardGrids ?? {}) },
      promptWorkspace: {
        ...defaults.promptWorkspace,
        ...(source.production.promptWorkspace ?? {}),
        selectedPlatforms: { ...defaults.promptWorkspace.selectedPlatforms, ...(source.production.promptWorkspace?.selectedPlatforms ?? {}) },
        records: { ...defaults.promptWorkspace.records, ...(source.production.promptWorkspace?.records ?? {}) },
      },
    };
    for (const record of Object.values(source.production.promptWorkspace.records)) {
      record.state.characters = record.state.characters.map((character) => ({ ...character, identityAnchor: character.identityAnchor ?? character.name }));
      record.state.styleAnchor ??= [record.state.movieDNA.colorGrade, record.state.movieDNA.lighting, record.state.movieDNA.lensStyle, `aspect ratio ${record.state.projectSettings.aspectRatio}`].filter(Boolean).join("; ");
      record.state.storyboardGrid ??= source.production.storyboardGrids[record.sequenceId] ?? {
        id: `STORYBOARD_GRID_${record.sequenceId}`,
        sequenceId: record.sequenceId,
        sequenceNumber: record.state.sequenceNumber,
        enabled: false,
        status: "DISABLED",
        source: "SHOT_PLANNER",
        panels: [],
        generationPrompt: "",
        version: 0,
        createdAt: record.state.createdAt,
        updatedAt: record.state.updatedAt,
      };
      record.state.knowledgeSourceIds ??= source.production.knowledgeSources.filter((item) => item.status === "ACTIVE").map((item) => item.id);
      const profile = source.production.platformProfiles[record.platform];
      Object.assign(record.state.platformSettings, {
        profileVersion: profile.version,
        maxDurationSeconds: profile.maxDurationSeconds,
        audioSupport: profile.audioSupport,
        storyboardGridSupport: profile.storyboardGridSupport,
        storyboardGridBehavior: profile.storyboardGridBehavior,
      });
      if (fromVersion < 15) {
        record.outdatedReasons = [...new Set([...record.outdatedReasons, "filmmaking knowledge and Platform Profile v2 integrated"] )];
        record.state.status = "PROMPT_OUTDATED";
      }
    }
    source.production.story = normalizeStoryDevelopmentState(source as MovieProject, source.production.story);
    source.production.filmBible = normalizeFilmBibleState(source as MovieProject, source.production.filmBible);
    const migrationTime = new Date().toISOString();
    source.production.characters = (source.production.characters ?? []).map((character, index) => {
      const candidate = source.production!.story.characters.find((item) => item.id === (character.storyCandidateId ?? character.id) || item.name === character.name);
      const arc = source.production!.story.characterArcs.find((item) => item.characterId === (character.storyCandidateId ?? character.id) || item.name === character.name);
      const sheet = source.memory!.database.continuitySheets.find((item) => item.assetId === character.id);
      return {
        ...character,
        storyCandidateId: character.storyCandidateId ?? candidate?.id ?? character.id,
        number: character.number ?? index + 1,
        importance: character.importance ?? (character.category === "main" ? "MAIN" : character.category === "background" ? "BACKGROUND" : "SUPPORTING"),
        ageRange: character.ageRange ?? candidate?.ageRange,
        occupation: character.occupation ?? "Story-defined role",
        personality: character.personality ?? "Expressed through approved Story choices.",
        backstory: character.backstory ?? "Only approved Story facts are canonical.",
        goal: character.goal ?? candidate?.goal ?? arc?.goal ?? "Story-defined goal",
        motivation: character.motivation ?? candidate?.motivation ?? arc?.motivation ?? "Story-defined motivation",
        conflict: character.conflict ?? candidate?.conflict ?? arc?.conflict ?? "Story-defined conflict",
        fear: character.fear ?? candidate?.fear ?? arc?.fear ?? "Story-defined fear",
        relationships: [...(character.relationships ?? candidate?.relationships ?? arc?.relationships ?? [])],
        relatedBeatIds: [...(character.relatedBeatIds ?? candidate?.relatedBeatIds ?? arc?.relatedBeatIds ?? [])],
        relatedSequenceIds: [...(character.relatedSequenceIds ?? candidate?.relatedSequenceIds ?? arc?.relatedSequenceIds ?? [])],
        referencePriority: character.referencePriority ?? candidate?.referencePriority ?? (character.category === "main" ? "REQUIRED" : "HIGH"),
        identitySource: character.identitySource ?? (character.referenceIds?.length ? "UPLOADED_REFERENCE" : "STORY_DEFINED"),
        referenceIds: [...(character.referenceIds ?? [])],
        sheetId: character.sheetId ?? sheet?.id,
        sheetStatus: character.sheetStatus ?? sheet?.status ?? "PLANNED",
        states: (character.states ?? []).map((state) => ({
          id: state.id ?? `CHARSTATE_${character.id}_${state.sequenceId}`,
          sequenceId: state.sequenceId,
          timeRange: state.timeRange ?? source.production!.story.sequenceBreakdown.find((item) => item.id === state.sequenceId)?.timeRange ?? "Unscheduled",
          locationId: state.locationId ?? source.production!.story.sequenceBreakdown.find((item) => item.id === state.sequenceId)?.locationId ?? "UNASSIGNED",
          physical: state.physical ?? "Canonical physical state",
          emotional: state.emotional ?? "Canonical emotional state",
          wardrobe: state.wardrobe ?? "Canonical wardrobe",
          injuries: state.injuries ?? "None documented",
          possessions: [...(state.possessions ?? [])],
          knowledge: state.knowledge ?? "Inherited Story knowledge",
          relationshipState: state.relationshipState ?? "Inherited Story relationship state",
          damage: [...(state.damage ?? [])],
          sourceStoryVersion: state.sourceStoryVersion ?? source.production!.story.approvedVersion ?? source.production!.story.version,
          updatedAt: state.updatedAt ?? migrationTime,
        })),
        history: character.history?.length ? character.history : [{ version: character.version ?? 1, source: "MIGRATION" as const, name: character.name, role: character.role, description: character.description, changedFields: ["schema"], createdAt: migrationTime }],
        createdAt: character.createdAt ?? migrationTime,
        updatedAt: character.updatedAt ?? migrationTime,
      };
    });
    for (const [key, fallback] of Object.entries(defaults.movieDna.selections)) {
      const selection = source.production.movieDna.selections[key];
      if (!selection.optionIds?.length) {
        selection.optionIds = [...(fallback.optionIds ?? [])];
        selection.id ??= fallback.id;
        selection.technicalValues ??= fallback.technicalValues;
        selection.promptDescription ??= selection.technicalDescription || fallback.promptDescription;
        selection.createdVersion ??= source.production.movieDna.version;
        selection.modifiedAt ??= source.production.updatedAt ?? new Date().toISOString();
        selection.modificationHistory ??= [{ version: selection.createdVersion, optionIds: [...selection.optionIds], label: selection.label, previewPath: selection.previewPath, createdAt: selection.modifiedAt }];
        changed = true;
      }
      selection.locked = source.production.movieDna.status === "LOCKED";
    }
    source.production.movieDna.genreOptionIds = [...(source.production.movieDna.selections.genre?.optionIds ?? defaults.movieDna.genreOptionIds)];
    const productionAssets = source.production.assets ?? [];
    for (const asset of productionAssets) {
      if ((asset.category as string) === "audio") asset.category = "other";
      if (!asset.filename) {
        const token = asset.name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || asset.id.replace(/[^a-z0-9]+/gi, "_");
        asset.filename = `${String(asset.number).padStart(2, "0")}_${token}.png`;
        changed = true;
      }
      const entity = source.memory!.database.assets.find((item) => item.id === asset.id);
      asset.storyPurpose ??= "Required by the approved production source of truth.";
      asset.filmBibleSources ??= [];
      asset.sourceStoryVersion ??= source.production.story.approvedVersion ?? source.production.story.version;
      asset.sourceFilmBibleVersion ??= source.production.filmBible.approvedVersion ?? source.production.filmBible.version;
      asset.movieDnaVersion ??= source.production.movieDna.version;
      asset.relatedBeatIds ??= [];
      asset.dependencyIds ??= [];
      asset.referenceRoles ??= [];
      asset.sourceType ??= asset.id === "MOVIE_DNA_MASTER_FRAME" ? "MOVIE_DNA" : "STORY";
      asset.required ??= true;
      asset.canGenerate ??= asset.id !== "MOVIE_DNA_MASTER_FRAME" && asset.sourceType !== "UPLOADED_REFERENCE";
      asset.generationPrompt ??= entity?.generationPrompt ?? `Create the canonical production reference for ${asset.id}, ${asset.name}. ${asset.description}`;
      asset.negativePrompt ??= entity?.negativePrompt ?? source.production.permanentNegativeRules.join(" ");
      asset.imagePath ??= asset.id === "MOVIE_DNA_MASTER_FRAME" ? source.production.movieDna.masterFrame?.path : entity?.generatedImagePath;
      asset.thumbnailPath ??= asset.id === "MOVIE_DNA_MASTER_FRAME" ? source.production.movieDna.masterFrame?.thumbnailPath : entity?.thumbnailPath;
      asset.provider ??= entity?.provider;
      asset.model ??= entity?.model;
      asset.generationError ??= entity?.generationError;
      asset.generationAttempts ??= [];
      asset.versionHistory ??= [];
      asset.referenceUsage ??= [];
      asset.createdAt ??= entity?.createdAt ?? migrationTime;
      asset.updatedAt ??= entity?.updatedAt ?? migrationTime;
    }
    const nextNumber = Math.max(1, ...productionAssets.map((asset) => asset.number + 1));
    if (!source.production.nextProjectImageNumber || source.production.nextProjectImageNumber < nextNumber) {
      source.production.nextProjectImageNumber = nextNumber;
      changed = true;
    }
    source.memory!.productionMemory = normalizeProductionMemoryLayer(source as MovieProject, source.memory!.productionMemory);
    if (
      !source.memory!.productionMemory.storyTimeline.events.length
      && (source.production.story.approvedVersion || source.production.story.lockedVersion)
      && (source.production.filmBible.approvedVersion || source.production.filmBible.lockedVersion)
    ) {
      rebuildProductionMemory(source as MovieProject);
      changed = true;
    }
  }
  source.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
  return { project: source as MovieProject, changed, fromVersion };
};
