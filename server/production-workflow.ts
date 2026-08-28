import { randomUUID } from "node:crypto";
import type {
  AssetEntity,
  AssetManifestArtifact,
  MovieDnaCustomOption,
  MovieDnaSelection,
  MovieProject,
  ProductionAssetRecord,
  ProductionCharacter,
  ProductionStage,
  ProductionWorkflow,
  PlatformProfile,
  ProjectConfig,
  PromptArtifact,
  StoryArtifact,
  TargetPlatform,
  WorkflowGateStatus,
} from "../src/types.js";
import { approveContinuitySnapshot, rebuildProductionMemory } from "./production-memory.js";
import { MOVIE_DNA_CATALOG, movieDnaOption } from "../src/movie-dna-catalog.js";
import {
  approveStructuredStory,
  createEmptyStoryState,
  generateStoryOffline,
  lockStructuredStory,
} from "./story-brain.js";
import {
  approveFilmBibleVersion,
  createEmptyFilmBibleState,
  generateFilmBibleOffline,
  lockFilmBibleVersion,
} from "./film-bible.js";
import { buildCanonicalAssetManifest, manifestHealth } from "./asset-manifest.js";
import { generateProductionScript, refreshScriptReadiness } from "./script-workflow.js";
import { createFilmmakingKnowledgeSources } from "./filmmaking-knowledge.js";

const now = () => new Date().toISOString();
const pad = (value: number) => String(value).padStart(2, "0");

const defaultNegativeRules = [
  "No identity drift, face replacement, duplicate characters, or unexplained age changes.",
  "No wardrobe, prop, injury, weather, geography, or screen-direction continuity errors.",
  "No modern objects, text, logos, watermarks, or architecture that contradicts the locked era.",
  "No unmotivated camera changes, exposure shifts, color-grade drift, or inconsistent film grain.",
  "No asset may appear unless it is listed in the sequence dependency and reference-slot map.",
];

export const resolveMovieDnaOption = (project: MovieProject, categoryId: string, optionId: string) => movieDnaOption(categoryId, optionId)
  ?? project.production.movieDna.customOptions[categoryId]?.find((entry) => entry.id === optionId && entry.status === "active");

const selectionFromOption = (project: MovieProject, categoryId: string, optionIds: string[], version = 1): MovieDnaSelection => {
  const options = optionIds.map((id) => resolveMovieDnaOption(project, categoryId, id)).filter((item) => item !== undefined);
  const createdAt = now();
  return {
    id: `DNA_SELECTION_${categoryId.toUpperCase()}`,
    key: categoryId,
    label: options.map((item) => item.name).join(" "),
    optionIds,
    technicalDescription: options.map((item) => item.technicalDescription || item.shortDescription).join(" "),
    technicalValues: Object.assign({}, ...options.map((item) => item.technicalValues)),
    promptDescription: options.map((item) => item.promptDescription).join(" "),
    contactSheet: options[0]?.sheet,
    visualIndex: options[0]?.visualIndex,
    locked: false,
    createdVersion: version,
    modifiedAt: createdAt,
    modificationHistory: [{ version, optionIds: [...optionIds], label: options.map((item) => item.name).join(" "), createdAt }],
  };
};

const defaultSelections = (_config: ProjectConfig): Record<string, MovieDnaSelection> => ({});

const directLockFallbackIds = (project: MovieProject): Record<string, string> => {
  const source = `${project.idea} ${project.genre} ${project.visualStyle} ${project.era}`.toLowerCase();
  return {
    genre: /horror/.test(source) ? "genre_horror" : /science fiction|sci-fi/.test(source) ? "genre_scifi" : "genre_drama",
    cinematography: "cine_motivated", photography: /16mm/.test(source) ? "photo_16mm" : "photo_35mm", cameraSystem: "camera_alexa35", framing: "frame_wide",
    lensStyle: "lens_vintage_spherical", focalLength: "focal_35", filmStock: /night|dark/.test(source) ? "stock_5219" : "stock_5207", grain: "grain_fine35",
    colorGrade: /desert/.test(source) ? "grade_muted_desert" : /horror|cold/.test(source) ? "grade_cold_horror" : "grade_natural",
    contrast: "contrast_soft", saturation: "sat_restrained", exposure: "exp_highlights", lighting: /fire/.test(source) ? "light_fire" : "light_day",
    shadows: "shadow_open", highlights: "highlight_soft", depthOfField: "dof_moderate", cameraMovement: "move_static", texture: "texture_organic",
    productionDesign: /19\d\d|18\d\d|historical|period/.test(source) ? "design_period" : "design_contemporary",
    historicalPeriod: /19(5|6)\d|gulf|uae/.test(source) ? "period_1960s_gulf" : /198/.test(source) ? "period_1980s" : "period_contemporary",
    location: /uae|emirati|united arab emirates|gulf/.test(source) ? "location_united_arab_emirates" : /japan|tokyo/.test(source) ? "location_japan" : /france|french/.test(source) ? "location_france" : "location_united_states",
    costume: /19\d\d|18\d\d|historical|period/.test(source) ? "costume_period" : "costume_contemporary",
    environment: /desert/.test(source) ? "env_desert" : /forest/.test(source) ? "environment_forest" : /space/.test(source) ? "environment_space_station" : "environment_modern_city",
    vfx: "vfx_invisible", realism: "realism_grounded",
    aspectRatio: MOVIE_DNA_CATALOG.find((category) => category.id === "aspectRatio")?.options.find((entry) => entry.name === project.aspectRatio)?.id ?? "aspect_185",
  };
};

const profile = (
  platform: TargetPlatform,
  model: string,
  maxDurationSeconds: number,
  maxReferences: number,
  instructions: string,
  options: Partial<PlatformProfile> = {},
): PlatformProfile => ({
  id: `PLATFORM_${platform.toUpperCase()}`,
  platform,
  name: platform,
  version: 2,
  model,
  promptStyle: "Concise, high-signal cinematic direction compiled from one canonical Prompt State with no unresolved placeholders.",
  referenceSyntax: platform === "Seedance" ? "NUMBERED_IMAGE" : platform === "Higgsfield" ? "NAMED_ELEMENT" : platform === "Custom" ? "CUSTOM" : "IMAGE_GUIDANCE",
  maxReferences,
  imageReferenceBehavior: "References preserve identity, state, environment, props, and visual direction according to their assigned roles.",
  videoReferenceBehavior: "Use video references only when the profile and sequence explicitly support continuation.",
  storyboardGridSupport: true,
  storyboardGridBehavior: "When an optional Storyboard Grid is enabled, read its nine panels as one ordered continuous scene. Character sheets remain identity authority; the grid controls motion, framing, and geography.",
  firstFrameSupport: ["Seedance", "Higgsfield", "Veo", "Kling", "Runway"].includes(platform),
  lastFrameSupport: ["Seedance", "Higgsfield", "Veo", "Kling"].includes(platform),
  videoContinuationSupport: ["Higgsfield", "Veo", "Kling", "Runway", "Sora"].includes(platform),
  durationSupport: [5, 8, 10, 12, 15, 30],
  maxDurationSeconds,
  resolutionSupport: ["720p", "1080p"],
  aspectRatioSupport: ["16:9", "9:16", "1:1", "2.39:1"],
  cameraSyntaxPreferences: "State shot order, framing, lens, camera movement, action, and continuity purpose explicitly.",
  dialogueSupport: "Preserve exact approved Dialogue Lock text and performance metadata when dialogue is supported.",
  audioSupport: "Compile ambience, effects, narration, music, and intentional-silence rules without inventing unsupported audio.",
  negativePromptBehavior: "Append permanent and sequence restrictions using the platform-native negative-prompt convention.",
  knownRestrictions: [],
  exportRules: ["Keep prompt tags synchronized with package upload order.", "Never renumber permanent project images."],
  instructions,
  updatedAt: now(),
  ...options,
});

export const createProductionWorkflow = (config: ProjectConfig): ProductionWorkflow => {
  const createdAt = now();
  return {
    currentStage: "project_setup",
    gates: [
      { stage: "project_setup", status: "READY", updatedAt: createdAt, note: "Initial setup captured; review and lock before Movie DNA." },
      { stage: "movie_dna", status: "DRAFT", updatedAt: createdAt },
      ...(["story", "film_bible", "characters", "character_references", "asset_manifest", "asset_sheets", "sequences", "continuity", "platform_prompts", "manual_generation", "video_review", "export"] as ProductionStage[]).map((stage) => ({ stage, status: "PENDING" as WorkflowGateStatus, updatedAt: createdAt })),
    ],
    movieDna: { status: "DRAFT", version: 1, selections: defaultSelections(config), previews: {}, customOptions: {}, comparisonOptionIds: [], recentOptionIds: [], genreOptionIds: [], negativeRules: [...defaultNegativeRules], history: [] },
    story: createEmptyStoryState(config),
    filmBible: createEmptyFilmBibleState(createdAt),
    characters: [],
    assets: [],
    nextProjectImageNumber: 1,
    audioBible: {
      dialogue: config.dialogueEnabled ? `Dialogue language: ${config.dialogueLanguage}; natural location perspective and consistent character voice.` : "Dialogue disabled.",
      narration: config.narrationEnabled ? `Narration language: ${config.filmLanguage}; intimate, controlled delivery.` : "Narration disabled.",
      music: config.musicEnabled ? "Motif-based score; do not obscure dialogue or destroy location atmosphere." : "Music disabled.",
      ambience: "Maintain continuous room tone, environmental beds, perspective, and transitions across edits.",
    },
    sequences: [],
    continuityLedger: [],
    permanentNegativeRules: [...defaultNegativeRules],
    platformProfiles: {
      Seedance: profile("Seedance", "Seedance", 30, 9, "Use numbered @Image references in exact upload order and explicit start/end continuity.", { referenceSyntax: "NUMBERED_IMAGE" }),
      Higgsfield: profile("Higgsfield", "Higgsfield Cinema Studio", 30, 8, "Use named visual elements, shot design, camera control, and hero-reference consistency.", { referenceSyntax: "NAMED_ELEMENT" }),
      MiniMax: profile("MiniMax", "MiniMax Video", 10, 6, "Use concise motion-first cinematic direction with image guidance and physically legible actions."),
      Veo: profile("Veo", "Veo", 30, 6, "Use complete natural-language scene direction with synchronized sound intent."),
      Kling: profile("Kling", "Kling", 10, 8, "Keep motion physically legible, camera syntax explicit, and references concise."),
      Runway: profile("Runway", "Runway", 10, 3, "Use compact cinematic motion direction and first-frame image guidance."),
      Sora: profile("Sora", "Sora", 20, 4, "Use coherent scene prose with unambiguous chronology, physical action, and camera intent."),
      Custom: profile("Custom", "Custom", config.sequenceDurationSeconds, 8, "Editable provider-neutral canonical prompt.", { referenceSyntax: "CUSTOM" }),
    },
    knowledgeSources: createFilmmakingKnowledgeSources(),
    storyboardGrids: {},
    promptWorkspace: { selectedPlatforms: {}, records: {}, updatedAt: createdAt },
    updatedAt: createdAt,
  };
};

const setGate = (workflow: ProductionWorkflow, stage: ProductionStage, status: WorkflowGateStatus, note?: string) => {
  const gate = workflow.gates.find((item) => item.stage === stage);
  if (gate) Object.assign(gate, { status, note, updatedAt: now() });
  else workflow.gates.push({ stage, status, note, updatedAt: now() });
  workflow.updatedAt = now();
};

const requireGate = (project: MovieProject, stage: ProductionStage, statuses: WorkflowGateStatus[]) => {
  const status = project.production.gates.find((item) => item.stage === stage)?.status;
  if (!status || !statuses.includes(status)) throw new Error(`${stage.replaceAll("_", " ")} must be ${statuses.join(" or ").toLowerCase()} first.`);
};

export const updateMovieDna = (project: MovieProject, selection: MovieDnaSelection) => {
  if (project.production.movieDna.status === "LOCKED") throw new Error("Movie DNA is locked. Create a new DNA version before changing it.");
  const dna = project.production.movieDna;
  const current = dna.selections[selection.key];
  let next = selection;
  if (selection.optionIds?.length) {
    const category = MOVIE_DNA_CATALOG.find((item) => item.id === selection.key);
    if (!category) throw new Error(`Unknown Movie DNA category ${selection.key}.`);
    const optionIds = [...new Set(selection.optionIds)]
      .slice(0, category.multi ? Number.MAX_SAFE_INTEGER : 1)
      .sort((left, right) => category.options.findIndex((item) => item.id === left) - category.options.findIndex((item) => item.id === right));
    if (!optionIds.length || optionIds.some((id) => !resolveMovieDnaOption(project, selection.key, id))) throw new Error(`Choose a valid ${category.name} option.`);
    next = selectionFromOption(project, selection.key, optionIds, dna.version);
    const preview = optionIds.length === 1 ? dna.previews[`${selection.key}:${optionIds[0]}`] : dna.combinedGenrePreviewId ? dna.previews[dna.combinedGenrePreviewId] : undefined;
    if (preview?.status === "GENERATED" && preview.path) {
      next.selectedPreviewId = preview.id;
      next.previewPath = preview.path;
    }
    next.modificationHistory = [
      ...(current?.modificationHistory ?? []),
      ...(next.modificationHistory ?? []),
    ];
  }
  dna.selections[selection.key] = next;
  dna.recentOptionIds = [...(next.optionIds ?? []).map((id) => `${selection.key}:${id}`), ...dna.recentOptionIds.filter((id) => !(next.optionIds ?? []).some((optionId) => id === `${selection.key}:${optionId}`))].slice(0, 30);
  if (selection.key === "genre") dna.genreOptionIds = [...(next.optionIds ?? [])];
  setGate(project.production, "movie_dna", "DRAFT", `${next.label} selected for ${selection.key}.`);
};

export const addCustomMovieDnaOption = (
  project: MovieProject,
  input: { categoryId: string; name: string; description: string; technicalValues?: Record<string, string | number | boolean> },
) => {
  if (project.production.movieDna.status === "LOCKED") throw new Error("Create a protected Movie DNA version before adding a custom direction.");
  const category = MOVIE_DNA_CATALOG.find((entry) => entry.id === input.categoryId);
  if (!category) throw new Error("The custom Movie DNA category does not exist.");
  const createdAt = now();
  const id = `custom_${input.categoryId.toLowerCase()}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const technicalValues = {
    interpretation: input.description,
    ...(input.categoryId === "historicalPeriod" && /^\d{1,4}$/.test(input.name.trim()) ? { year: Number(input.name.trim()), anachronismControl: "strict", technology: `accurate to ${input.name.trim()}` } : {}),
    ...(input.technicalValues ?? {}),
  };
  const custom: MovieDnaCustomOption = {
    id, name: input.name.trim(), category: input.categoryId, group: "Custom",
    shortDescription: input.description.trim(), technicalDescription: Object.entries(technicalValues).map(([key, value]) => `${key}: ${String(value)}`).join("; "),
    promptDescription: `Custom ${category.name}: ${input.description.trim()}. Apply these structured values: ${JSON.stringify(technicalValues)}.`,
    previewGenerationPrompt: `Render the fixed neutral comparison scene using this custom ${category.name}: ${input.description.trim()}.`,
    technicalValues, tags: [...new Set(`${input.name} ${input.description}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))],
    compatibilityTags: [], historicalTags: input.categoryId === "historicalPeriod" ? [input.name.trim()] : [], genreTags: input.categoryId === "genre" ? [input.name.trim()] : [],
    source: "custom", status: "active", popular: true,
    sheet: ["framing", "focalLength", "lensStyle", "cameraMovement", "aspectRatio", "cameraSystem"].includes(input.categoryId) ? "camera" : ["genre", "historicalPeriod", "location", "environment", "productionDesign", "costume", "vfx"].includes(input.categoryId) ? "genre" : "look",
    visualIndex: Math.abs([...id].reduce((sum, character) => sum + character.charCodeAt(0), 0)) % 16, createdAt, updatedAt: createdAt,
  };
  (project.production.movieDna.customOptions[input.categoryId] ??= []).push(custom);
  updateMovieDna(project, { key: input.categoryId, optionIds: [id], label: "", technicalDescription: "" });
  return custom;
};

export const applyMovieDnaPreset = (project: MovieProject, selections: Record<string, string[]>, customOptions: Record<string, MovieDnaCustomOption[]> = {}) => {
  if (project.production.movieDna.status === "LOCKED") throw new Error("Create a protected Movie DNA version before applying a preset.");
  for (const [categoryId, options] of Object.entries(customOptions)) {
    const existing = project.production.movieDna.customOptions[categoryId] ?? [];
    project.production.movieDna.customOptions[categoryId] = [...existing, ...options.filter((candidate) => !existing.some((entry) => entry.id === candidate.id))];
  }
  for (const [key, optionIds] of Object.entries(selections)) if (optionIds.length) updateMovieDna(project, { key, optionIds, label: "", technicalDescription: "" });
  return project;
};

export const createMovieDnaVersion = (project: MovieProject, revisionScope: "FUTURE_ONLY" | "REBUILD_EXISTING" = "FUTURE_ONLY") => {
  const dna = project.production.movieDna;
  dna.history.push({ version: dna.version, selections: structuredClone(dna.selections), negativeRules: [...dna.negativeRules], createdAt: now(), lockedAt: dna.lockedAt });
  dna.version += 1;
  dna.status = "DRAFT";
  dna.revisionScope = revisionScope;
  dna.lockedAt = undefined;
  Object.values(dna.selections).forEach((selection) => { selection.locked = false; });
  if (revisionScope === "REBUILD_EXISTING") {
    project.production.assets.forEach((asset) => {
      if (["GENERATED", "REVIEW"].includes(asset.status)) asset.status = "REGENERATE";
    });
  }
  setGate(project.production, "movie_dna", "DRAFT", `Movie DNA version ${dna.version} is editable for ${revisionScope === "FUTURE_ONLY" ? "future generations only" : "a reviewed existing-work rebuild"}.`);
  project.production.currentStage = "movie_dna";
};

export const lockMovieDna = (project: MovieProject) => {
  const dna = project.production.movieDna;
  // Direct service callers from older projects may lock without visiting the visual selector.
  // Keep the newly-created project neutral, but materialize an explicit project-derived fallback at lock time.
  if (!Object.keys(dna.selections).length) {
    for (const [categoryId, optionId] of Object.entries(directLockFallbackIds(project))) {
      if (resolveMovieDnaOption(project, categoryId, optionId)) dna.selections[categoryId] = selectionFromOption(project, categoryId, [optionId], dna.version);
    }
    dna.genreOptionIds = [...(dna.selections.genre?.optionIds ?? [])];
  }
  dna.status = "LOCKED";
  dna.lockedAt = now();
  Object.values(dna.selections).forEach((selection) => { selection.locked = true; });
  dna.history.push({ version: dna.version, selections: structuredClone(dna.selections), negativeRules: [...dna.negativeRules], createdAt: now(), lockedAt: dna.lockedAt });
  setGate(project.production, "movie_dna", "LOCKED", `Movie DNA v${dna.version} is the permanent visual source.`);
  setGate(project.production, "story", "READY", "Story Agent may now use the locked Movie DNA.");
  project.production.currentStage = "story";
};

const dnaSummary = (project: MovieProject) => Object.values(project.production.movieDna.selections).map((item) => item.label).slice(0, 8).join(", ");

export const lockedMovieDnaPrompt = (project: MovieProject) => {
  const dna = project.production.movieDna;
  if (dna.status !== "LOCKED") return "";
  const selections = Object.values(dna.selections).map((selection) => {
    const technical = Object.entries(selection.technicalValues ?? {}).map(([key, value]) => `${key}=${String(value)}`).join(", ");
    return `${selection.key}: ${selection.label}. ${selection.promptDescription ?? selection.technicalDescription}${technical ? ` Technical values: ${technical}.` : ""}`;
  });
  const master = dna.masterFrame?.status === "GENERATED" && dna.masterFrame.path
    ? `Movie DNA Master Frame: ${dna.masterFrame.filename}, reference role Visual Style Reference only.`
    : "No Movie DNA Master Frame is currently active.";
  return [
    `LOCKED MOVIE DNA VERSION ${dna.version}.`,
    ...selections,
    master,
    "The Movie DNA controls photography, colour, lighting, texture, atmosphere, production design and visual language. It never replaces or alters a character identity reference.",
  ].join("\n");
};

export const generateStory = (project: MovieProject, input?: string, mode?: "AI" | "MANUAL" | "PASTE") => {
  return generateStoryOffline(project, input, mode ?? project.production.story.mode);
};

export const approveStory = (project: MovieProject) => {
  return approveStructuredStory(project);
};

export const lockStory = (project: MovieProject) => {
  return lockStructuredStory(project);
};

export const generateFilmBible = (project: MovieProject) => {
  return generateFilmBibleOffline(project);
};

export const approveFilmBible = (project: MovieProject) => {
  return approveFilmBibleVersion(project);
};

export const lockFilmBible = (project: MovieProject) => lockFilmBibleVersion(project);

export const analyzeCharacters = (project: MovieProject) => {
  if (!project.production.filmBible.approvedVersion && !["APPROVED", "LOCKED"].includes(project.production.filmBible.status)) {
    throw new Error("Approve the Film Bible before analyzing characters.");
  }
  const structured = project.production.story.contracts?.characterAnalysis.candidates ?? [];
  const legacy = (project.artifacts.story as StoryArtifact | undefined)?.characters ?? [];
  type CharacterAnalysisSource = {
    id: string; name: string; role: string; description: string; relationships: string[];
    importance?: "MAIN" | "SUPPORTING" | "BACKGROUND"; ageRange?: string; goal?: string; motivation?: string;
    conflict?: string; fear?: string; relatedBeatIds?: string[]; relatedSequenceIds?: string[]; referencePriority?: "REQUIRED" | "HIGH" | "NORMAL";
  };
  const source: CharacterAnalysisSource[] = structured.length ? structured : legacy.length ? legacy : [{ id: "CHAR-001", name: "The Protagonist", role: "Lead", description: "Primary dramatic identity.", relationships: [] }];
  const existingCharacters = [...project.production.characters];
  const timestamp = now();
  const mainSourceId = project.preStorySetup.mainCharacterReferenceId;
  project.production.characters = source.map((character, index): ProductionCharacter => {
    const storyCandidateId = character.id || `CHAR-${pad(index + 1)}`;
    const importance = character.importance ?? (index === 0 ? "MAIN" as const : "SUPPORTING" as const);
    const category = importance === "MAIN" ? "main" : importance === "BACKGROUND" ? "background" : "supporting";
    const permanentId = category === "main" && mainSourceId ? "CHAR_MAIN_001" : storyCandidateId;
    const existing = existingCharacters.find((item) => item.storyCandidateId === storyCandidateId || item.id === permanentId || (category === "main" && item.category === "main"));
    const arc = project.production.story.characterArcs.find((item) => item.characterId === storyCandidateId || item.name === character.name);
    const linkedReferences = project.memory.database.projectReferences.filter((reference) => {
      if (reference.type !== "character") return false;
      if (category === "main" && reference.id === mainSourceId) return true;
      return reference.assetId === permanentId || reference.assetId === storyCandidateId || reference.linkedAssetIds.includes(permanentId) || reference.linkedAssetIds.includes(storyCandidateId);
    });
    const sequenceIds = character.relatedSequenceIds?.length ? character.relatedSequenceIds : project.production.story.sequenceBreakdown.filter((sequence) => sequence.characterIds.includes(storyCandidateId)).map((sequence) => sequence.id);
    const previousStates = new Map((existing?.states ?? []).map((state) => [state.sequenceId, state]));
    const possessions = new Set<string>();
    const states = sequenceIds.map((sequenceId) => {
      const sequence = project.production.story.sequenceBreakdown.find((item) => item.id === sequenceId);
      const timeline = project.production.story.timeline.filter((event) => event.relatedSequenceIds.includes(sequenceId) && event.characterIds.includes(storyCandidateId));
      timeline.forEach((event) => {
        event.objectsAcquired.forEach((item) => possessions.add(item));
        event.objectsLost.forEach((item) => possessions.delete(item));
      });
      const prior = previousStates.get(sequenceId);
      const first = sequence?.sequenceNumber === 1;
      const last = sequence?.sequenceNumber === project.production.story.sequenceBreakdown.length;
      return {
        id: prior?.id ?? `CHARSTATE_${permanentId}_${sequenceId}`,
        sequenceId,
        timeRange: sequence?.timeRange ?? "Unscheduled",
        locationId: sequence?.locationId ?? "UNASSIGNED",
        physical: prior?.physical ?? (timeline.flatMap((event) => [...event.injuries, ...event.damage]).join("; ") || "Established identity and physical condition remain stable."),
        emotional: prior?.emotional ?? (first ? arc?.startingEmotionalState : last ? arc?.endingState : sequence?.emotion) ?? "Story-matched emotional state",
        wardrobe: prior?.wardrobe ?? `${project.era} canonical wardrobe; changes require a documented Story event.`,
        injuries: prior?.injuries ?? (timeline.flatMap((event) => event.injuries).join("; ") || "None documented"),
        possessions: prior?.possessions ?? [...possessions],
        knowledge: prior?.knowledge ?? (timeline.map((event) => event.characterKnowledge[storyCandidateId]).filter(Boolean).join("; ") || "Knowledge inherited from the previous Story state."),
        relationshipState: prior?.relationshipState ?? (timeline.map((event) => event.relationshipState[storyCandidateId]).filter(Boolean).join("; ") || arc?.relationships.join("; ") || "No relationship change documented."),
        damage: prior?.damage ?? timeline.flatMap((event) => event.damage),
        sourceStoryVersion: project.production.story.approvedVersion ?? project.production.story.version,
        updatedAt: prior?.updatedAt ?? timestamp,
      };
    });
    const referenceIds = [...new Set([...(existing?.referenceIds ?? []), ...linkedReferences.map((reference) => reference.id)])];
    const record: ProductionCharacter = {
      id: permanentId,
      storyCandidateId,
      number: existing?.number ?? index + 1,
      name: character.name,
      category,
      role: character.role,
      description: character.description,
      importance,
      ageRange: character.ageRange ?? existing?.ageRange,
      occupation: existing?.occupation ?? (category === "main" ? "Defined by the approved Story" : "Story-defined role"),
      personality: existing?.personality ?? `Behavior is expressed through ${character.role.toLowerCase()} choices rather than generic traits.`,
      backstory: existing?.backstory ?? "Only approved Story facts are canonical; unstated history remains intentionally open.",
      goal: character.goal ?? arc?.goal ?? "Fulfil the character's approved Story purpose.",
      motivation: character.motivation ?? arc?.motivation ?? "Story-defined motivation",
      conflict: character.conflict ?? arc?.conflict ?? "Story-defined conflict",
      fear: character.fear ?? arc?.fear ?? "Story-defined fear",
      relationships: character.relationships.length ? [...character.relationships] : [...(arc?.relationships ?? [])],
      relatedBeatIds: character.relatedBeatIds?.length ? [...character.relatedBeatIds] : [...(arc?.relatedBeatIds ?? [])],
      relatedSequenceIds: [...sequenceIds],
      referencePriority: character.referencePriority ?? (category === "main" ? "REQUIRED" : "HIGH"),
      identitySource: referenceIds.length ? existing?.identitySource === "STORY_DEFINED" ? "HYBRID" : "UPLOADED_REFERENCE" : "STORY_DEFINED",
      referenceIds,
      sheetId: existing?.sheetId,
      sheetStatus: existing?.sheetStatus ?? "PLANNED",
      states,
      version: existing?.version ?? 1,
      status: "REVIEW",
      history: existing?.history?.length ? [...existing.history] : [{ version: 1, source: "STORY_ANALYSIS", name: character.name, role: character.role, description: character.description, changedFields: ["analysis", "states"], createdAt: timestamp }],
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    return record;
  });
  for (const character of project.production.characters) {
    let asset = project.memory.database.assets.find((item) => item.id === character.id);
    if (!asset) {
      asset = {
        id: character.id,
        projectId: project.id,
        name: character.name,
        category: "character",
        description: character.description,
        approvalState: "PROMPT_READY",
        version: character.version,
        referenceImages: [],
        lockedTraits: { identity: "Permanent character identity", storyCandidateId: character.storyCandidateId },
        mutableTraits: { storyState: "Versioned per approved sequence" },
        currentState: { condition: character.states[0]?.physical ?? "Baseline", emotion: character.states[0]?.emotional ?? "Baseline" },
        notes: ["Preserve face, age appearance, body proportions, distinctive features, and approved reference priority."],
        visualDescription: character.description,
        generationPrompt: `Create a production-ready character master and only the Story-required continuity views for ${character.id}, ${character.name}. ${character.description} ${lockedMovieDnaPrompt(project)}`,
        negativePrompt: project.production.permanentNegativeRules.join(" "),
        provider: "configured",
        model: "configured",
        sourceReferenceIds: [...character.referenceIds],
        generationJobIds: [],
        critical: character.category === "main",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      project.memory.database.assets.push(asset);
    } else {
      asset.name = character.name;
      asset.description = character.description;
      asset.visualDescription = character.description;
      asset.sourceReferenceIds = [...new Set([...asset.sourceReferenceIds, ...character.referenceIds])];
      asset.referenceImages = [...new Set([...asset.referenceImages, ...project.memory.database.projectReferences.filter((reference) => character.referenceIds.includes(reference.id)).map((reference) => reference.sourcePath)])];
      asset.updatedAt = timestamp;
    }
  }
  project.memory.database.characters = project.memory.database.assets.filter((asset) => asset.category === "character");
  setGate(project.production, "characters", "REVIEW", `${project.production.characters.length} numbered character identities found.`);
  project.status = "awaiting_approval";
};

export const approveCharacters = (project: MovieProject) => {
  if (!project.production.characters.length) throw new Error("Run character analysis first.");
  project.production.characters.forEach((character) => {
    character.status = character.referenceIds.length && character.sheetStatus === "LOCKED" ? "LOCKED" : "APPROVED";
    character.updatedAt = now();
  });
  setGate(project.production, "characters", "APPROVED", "Character analysis approved.");
  setGate(project.production, "character_references", "READY", "Upload, generate, replace, version, and lock character references.");
  setGate(project.production, "asset_manifest", "READY", "Complete numbered asset manifest may be built.");
  project.production.currentStage = "character_references";
  project.status = "draft";
};

export const updateCharacter = (project: MovieProject, characterId: string, changes: Partial<Pick<ProductionCharacter, "name" | "role" | "description" | "ageRange" | "occupation" | "personality" | "backstory" | "goal" | "motivation" | "conflict" | "fear">>) => {
  const character = project.production.characters.find((item) => item.id === characterId);
  if (!character) throw new Error(`Character ${characterId} was not found.`);
  const changedFields = Object.entries(changes).filter(([key, value]) => value !== undefined && value !== character[key as keyof ProductionCharacter]).map(([key]) => key);
  if (!changedFields.length) return character;
  character.history.push({ version: character.version, source: "MANUAL", name: character.name, role: character.role, description: character.description, changedFields, createdAt: now() });
  character.version += 1;
  Object.assign(character, changes, { status: "REVIEW", updatedAt: now() });
  const asset = project.memory.database.assets.find((item) => item.id === character.id);
  if (asset) {
    asset.name = character.name;
    asset.description = character.description;
    asset.visualDescription = character.description;
    asset.approvalState = asset.approvalState === "LOCKED" ? "REGENERATE" : "REVIEW";
    asset.version = Math.max(asset.version + 1, character.version);
    asset.updatedAt = now();
  }
  setGate(project.production, "characters", "REVIEW", `${character.name} identity metadata changed and requires review.`);
  return character;
};

export const updateCharacterState = (project: MovieProject, characterId: string, sequenceId: string, changes: Partial<Pick<ProductionCharacter["states"][number], "physical" | "emotional" | "wardrobe" | "injuries" | "possessions" | "knowledge" | "relationshipState" | "damage">>) => {
  const character = project.production.characters.find((item) => item.id === characterId);
  if (!character) throw new Error(`Character ${characterId} was not found.`);
  const state = character.states.find((item) => item.sequenceId === sequenceId);
  if (!state) throw new Error(`Character state ${sequenceId} was not found for ${character.name}.`);
  Object.assign(state, changes, { updatedAt: now() });
  character.version += 1;
  character.status = "REVIEW";
  character.updatedAt = now();
  character.history.push({ version: character.version, source: "MANUAL", name: character.name, role: character.role, description: character.description, changedFields: [`state:${sequenceId}`], createdAt: now() });
  setGate(project.production, "characters", "REVIEW", `${character.name} story state ${sequenceId} changed and requires review.`);
  return state;
};

export const buildAssetManifest = (project: MovieProject) => {
  requireGate(project, "characters", ["APPROVED"]);
  const records = buildCanonicalAssetManifest(project);
  const missing = records.filter((record) => manifestHealth(project, record).missing).length;
  setGate(project.production, "asset_manifest", missing ? "REVIEW" : "READY", `${records.length} source-backed numbered production assets found; ${missing} required images are missing.`);
  setGate(project.production, "asset_sheets", "READY", "Generate and inspect identity, turnaround, location, prop, costume, and environment sheets.");
  project.production.currentStage = "asset_manifest";
  project.status = "awaiting_approval";
};

export const approveAssets = (project: MovieProject) => {
  if (!project.production.assets.length) throw new Error("Build the asset manifest first.");
  const missing = project.production.assets.filter((asset) => manifestHealth(project, asset).missing);
  if (missing.length) throw new Error(`Generate or explicitly resolve the ${missing.length} missing required assets before approval: ${missing.slice(0, 5).map((asset) => asset.name).join(", ")}${missing.length > 5 ? "…" : ""}`);
  project.production.assets.forEach((asset) => {
    if (asset.status !== "LOCKED" && manifestHealth(project, asset).hasImage) asset.status = "APPROVED";
    const entity = project.memory.database.assets.find((item) => item.id === asset.id);
    if (entity && asset.status === "APPROVED") entity.approvalState = "APPROVED";
  });
  setGate(project.production, "asset_manifest", "APPROVED", "Numbered asset manifest approved.");
  setGate(project.production, "asset_sheets", "APPROVED", "Asset versions are approved; previous versions remain preserved.");
  setGate(project.production, "continuity", "READY", "Build Story Timeline, Continuity Ledger, and Audio Bible before downstream planning.");
  setGate(project.production, "sequences", "BLOCKED", "Production memory must be built before sequence planning.");
  project.production.currentStage = "continuity";
  project.status = "draft";
};

export const planSequences = (project: MovieProject) => {
  requireGate(project, "asset_manifest", ["APPROVED"]);
  if (project.memory.productionMemory.storyTimeline.status !== "READY" || !project.memory.productionMemory.continuity.snapshots.length) throw new Error("Build the Story Timeline, Continuity Ledger, and Audio Bible before sequence planning.");
  if (!project.memory.productionMemory.script.scriptVersion) generateProductionScript(project, "Generated as the source for formal Sequence Planner records.");
  const script = refreshScriptReadiness(project);
  project.sequenceCount = script.sequences.length;
  project.production.assets.forEach((asset) => { asset.sequenceIds = script.sequences.filter((sequence) => sequence.assetRequirements.some((requirement) => requirement.assetId === asset.id)).map((sequence) => sequence.id); });
  setGate(project.production, "sequences", "REVIEW", `${script.sequences.length} Story-aligned sequence plans synchronized with Full Script v${pad(script.scriptVersion)}, Dialogue Lock, Shot Planner, and production memory.`);
  setGate(project.production, "continuity", "READY", "Continuity Ledger is ready to receive approved sequence end states.");
  setGate(project.production, "platform_prompts", "PENDING", "Sequence Workspace v3 and final platform prompt compilation intentionally remain outside this block.");
  project.production.currentStage = "sequences";
  project.status = "awaiting_approval";
};

export const compileProductionPrompts = (project: MovieProject, platform?: TargetPlatform) => {
  if (!project.production.sequences.length) throw new Error("Plan sequences before compiling prompts.");
  const target = platform ?? project.targetPlatform;
  const profileData = project.production.platformProfiles[target];
  const dna = Object.values(project.production.movieDna.selections).map((item) => `${item.label} — ${item.technicalDescription}`).join("\n");
  const bible = Object.entries(project.production.filmBible.sections).map(([key, value]) => `${key.toUpperCase()}: ${value}`).join("\n");
  project.production.sequences.forEach((sequence) => {
    const assets = sequence.assetIds.map((id) => project.production.assets.find((asset) => asset.id === id)).filter(Boolean).map((asset) => `${asset!.id}: ${asset!.description}`).join("\n");
    sequence.promptSections = {
      platform: `${target} / ${profileData.model}. ${profileData.instructions}`,
      movieDna: dna,
      filmBible: bible,
      continuityLedger: project.production.continuityLedger.filter((entry) => entry.sequenceId === sequence.id || entry.sequenceId === `SEQ-${pad(sequence.number - 1)}`).map((entry) => `${entry.entityId}: ${entry.state}`).join("\n") || sequence.startState,
      sequence: `${sequence.title} ${sequence.timeRange}. ${sequence.synopsis}\nSTART: ${sequence.startState}\nMID: ${sequence.middleState}\nEND: ${sequence.endState}`,
      shots: sequence.shots.map((shot) => `${shot.id} ${shot.durationSeconds}s, ${shot.framing}, ${shot.lens}, ${shot.movement}: ${shot.action}`).join("\n"),
      assets,
      references: sequence.referenceSlots.map((slot) => `${slot.tag}=${slot.assetId} upload position ${slot.slot}${slot.required ? " REQUIRED" : ""}`).join("\n"),
      audio: Object.values(project.production.audioBible).join("\n"),
      dialogue: sequence.dialogue.join("\n") || "No dialogue.",
      negative: project.production.permanentNegativeRules.join("\n"),
    };
    sequence.compiledPrompt = Object.entries(sequence.promptSections).map(([key, value]) => `[${key.toUpperCase()}]\n${value}`).join("\n\n");
    sequence.negativePrompt = project.production.permanentNegativeRules.join(" ");
    sequence.status = "READY";
  });
  project.artifacts.prompts = { prompts: project.production.sequences.map((sequence) => ({ sequenceId: sequence.id, prompt: sequence.compiledPrompt, negativePrompt: sequence.negativePrompt, references: sequence.referenceSlots.map((slot) => `${slot.tag}=${slot.assetId}`), model: "generic" })) } satisfies PromptArtifact;
  setGate(project.production, "sequences", "APPROVED", "Timed sequence package approved for prompt compilation.");
  setGate(project.production, "platform_prompts", "APPROVED", `${target} prompts compiled from Movie DNA, Film Bible, and Continuity Ledger.`);
  setGate(project.production, "manual_generation", "READY", "Download references, upload in order, copy the prompt, and generate externally.");
  project.production.currentStage = "platform_prompts";
  project.status = "draft";
};

export const approveSequence = (project: MovieProject, sequenceId: string, lock = false) => {
  const sequence = project.production.sequences.find((item) => item.id === sequenceId);
  if (!sequence) throw new Error(`Sequence ${sequenceId} was not found.`);
  if (!sequence.videoPath) throw new Error("Upload and link the generated video before approval or lock.");
  sequence.status = lock ? "LOCKED" : "APPROVED";
  const source = lock ? "LOCKED" : "APPROVED";
  const structuredEnd = project.memory.productionMemory.continuity.snapshots
    .filter((snapshot) => snapshot.anchor === "END" && Number(snapshot.sequenceId.match(/(\d+)/)?.[1] ?? 0) === sequence.number)
    .sort((a, b) => b.version - a.version)[0];
  if (structuredEnd) {
    approveContinuitySnapshot(project, structuredEnd.id, lock);
    project.production.continuityLedger = project.production.continuityLedger.filter((entry) => entry.sequenceId !== structuredEnd.sequenceId && entry.sequenceId !== sequenceId);
    sequence.assetIds.forEach((entityId) => {
      const state = structuredEnd.entities.find((item) => item.entityId === entityId);
      project.production.continuityLedger.push({ id: randomUUID(), sequenceId, entityId, state: state ? `${state.location} · ${state.condition} · ${state.propsCarried.join(", ") || "no carried props"}` : sequence.endState, source, createdAt: now() });
    });
  } else sequence.assetIds.forEach((entityId) => project.production.continuityLedger.push({ id: randomUUID(), sequenceId, entityId, state: sequence.endState, source, createdAt: now() }));
  sequence.generationHistory.push({ id: randomUUID(), status: source, videoPath: sequence.videoPath, createdAt: now() });
  setGate(project.production, "continuity", "APPROVED", `${sequenceId} end state transferred to the central Continuity Ledger.`);
  if (project.production.sequences.every((item) => ["APPROVED", "LOCKED"].includes(item.status))) {
    setGate(project.production, "video_review", "APPROVED", "Every generated sequence passed continuity inspection.");
    setGate(project.production, "export", "READY", "Final package may be exported.");
    project.production.currentStage = "export";
  }
};

export const runFullProductionWorkflow = (project: MovieProject, input?: string) => {
  requireGate(project, "movie_dna", ["LOCKED"]);
  generateStory(project, input, "AI");
  approveStory(project);
  generateFilmBible(project);
  approveFilmBible(project);
  analyzeCharacters(project);
  approveCharacters(project);
  buildAssetManifest(project);
  project.production.assets.forEach((asset) => {
    if (manifestHealth(project, asset).missing) asset.missingDecision = { action: "IGNORE", reason: "Synchronous planning helper does not execute image generation; runtime full mode generates these files before approval.", createdAt: now() };
  });
  approveAssets(project);
  rebuildProductionMemory(project);
  planSequences(project);
  project.messages.push({ id: randomUUID(), role: "agent", content: `Full Script v2 production block is ready: approved Story and Film Bible sources, ${project.production.assets.length} assets, ${project.memory.productionMemory.script.dialogue.length} dialogue records, ${project.memory.productionMemory.script.shots.length} planned shots, and ${project.production.sequences.length} formal sequences. Sequence Workspace v3 and platform prompt compilation remain intentionally pending.`, createdAt: now() });
};
