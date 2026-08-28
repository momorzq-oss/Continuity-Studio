import { createHash, randomUUID } from "node:crypto";
import type {
  ApprovalState,
  AssetEntity,
  AssetManifestArtifact,
  AssetType,
  MovieProject,
  ProductionAssetCategory,
  ProductionAssetRecord,
  ProductionAssetSourceType,
  StoryAssetCandidate,
} from "../src/types.js";
import { normalizePermanentAssetFilename, permanentAssetFilename } from "./asset-storage.js";

const now = () => new Date().toISOString();
const unique = <T>(values: T[]) => [...new Set(values)];
const stateHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 10).toUpperCase();

type ManifestCandidate = Omit<ProductionAssetRecord, "number" | "filename"> & { preferredExtension?: string };

const categoryToArtifactType = (category: ProductionAssetCategory): AssetType => {
  if (category === "main_character" || category === "character_state") return "character";
  if (category === "set") return "location";
  if (category === "story_object") return "object";
  if (["movie_dna", "vfx", "environment", "makeup", "other"].includes(category)) return "object";
  return category as AssetType;
};

const categoryToEntityType = (category: ProductionAssetCategory): AssetEntity["category"] => {
  if (["main_character", "character", "character_state"].includes(category)) return "character";
  if (category === "set") return "interior";
  if (category === "story_object") return "object";
  if (category === "vfx") return "effect";
  if (["movie_dna", "environment", "makeup", "other"].includes(category)) return "period_reference";
  return category as AssetEntity["category"];
};

const storySnapshot = (project: MovieProject) => {
  const story = project.production.story;
  const version = story.approvedVersion ?? story.lockedVersion ?? story.version;
  const snapshot = story.history.find((item) => item.version === version && (item.approved || item.locked));
  return {
    version,
    beats: snapshot?.beats ?? story.beats,
    timeline: snapshot?.timeline ?? story.timeline,
    characters: snapshot?.characters ?? story.characters,
    locations: snapshot?.locations ?? story.locations,
    objects: snapshot?.objects ?? story.objects,
    sequenceBreakdown: snapshot?.sequenceBreakdown ?? story.sequenceBreakdown,
  };
};

const bibleSnapshot = (project: MovieProject) => {
  const bible = project.production.filmBible;
  const version = bible.approvedVersion ?? bible.lockedVersion ?? bible.version;
  const snapshot = bible.history.find((item) => item.version === version && ["APPROVED", "LOCKED"].includes(item.status));
  return { version, sections: snapshot?.sections ?? bible.sections };
};

const bibleKeysFor = (category: ProductionAssetCategory) => {
  if (["main_character", "character", "character_state"].includes(category)) return ["characterIdentityLaw", "characterArcsAndRelationships", "costumesAndPhysicalState", "continuityAndProductionRestrictions"];
  if (["creature", "animal"].includes(category)) return ["vfxAndCreatureLaw", "environmentAndWeather", "continuityAndProductionRestrictions"];
  if (["location", "set", "building", "room", "environment"].includes(category)) return ["locationsAndGeography", "historicalAndCulturalLaw", "environmentAndWeather", "continuityAndProductionRestrictions"];
  if (["costume", "accessory", "makeup"].includes(category)) return ["costumesAndPhysicalState", "historicalAndCulturalLaw", "continuityAndProductionRestrictions"];
  if (category === "vfx") return ["vfxAndCreatureLaw", "visualLanguage", "continuityAndProductionRestrictions"];
  return ["objectsPropsAndVehicles", "historicalAndCulturalLaw", "continuityAndProductionRestrictions"];
};

const storyPurposeFor = (project: MovieProject, beatIds: string[], sequenceIds: string[]) => {
  const story = storySnapshot(project);
  const purposes = unique([
    ...story.beats.filter((beat) => beatIds.includes(beat.id)).map((beat) => beat.storyPurpose),
    ...story.sequenceBreakdown.filter((sequence) => sequenceIds.includes(sequence.id)).map((sequence) => sequence.storyPurpose),
  ].filter(Boolean));
  return purposes.join(" ") || "Required by the approved Story and its downstream production contracts.";
};

const generationPromptFor = (project: MovieProject, input: {
  id: string;
  name: string;
  category: ProductionAssetCategory;
  description: string;
  storyPurpose: string;
  sequenceIds: string[];
  continuityNotes: string[];
  dependencyIds: string[];
  sourceStoryVersion: number;
  sourceFilmBibleVersion: number;
  filmBibleSources: string[];
}) => {
  const bible = bibleSnapshot(project);
  const bibleRules = input.filmBibleSources.map((key) => {
    const value = bible.sections[key];
    return value ? `${key}: ${value.slice(0, 700)}` : undefined;
  }).filter(Boolean).join("\n");
  const dna = Object.entries(project.production.movieDna.selections).map(([key, value]) => `${key}=${value.label}`).join("; ");
  return [
    `Create the canonical production reference for ${input.id}, ${input.name}.`,
    `Asset type: ${input.category}. ${input.description}`,
    `APPROVED STORY V${input.sourceStoryVersion}: ${input.storyPurpose}`,
    `Required sequences: ${input.sequenceIds.join(", ") || "project-wide"}.`,
    `APPROVED FILM BIBLE V${input.sourceFilmBibleVersion}:\n${bibleRules}`,
    `LOCKED MOVIE DNA V${project.production.movieDna.version}: ${dna}.`,
    `Dependencies: ${input.dependencyIds.join(", ") || "Movie DNA only"}.`,
    `Continuity rules: ${input.continuityNotes.join(" ")}`,
    "Preserve exact uploaded identity references. Movie DNA controls visual style only and never replaces identity.",
  ].join("\n\n");
};

const candidateCategory = (candidate: StoryAssetCandidate): ProductionAssetCategory => {
  if (candidate.category === "object") return "story_object";
  return candidate.category;
};

const sourceTypeFor = (category: ProductionAssetCategory): ProductionAssetSourceType => {
  if (category === "character_state") return "CHARACTER_STATE";
  if (["main_character", "character", "creature"].includes(category)) return "CHARACTER_ANALYSIS";
  return "STORY";
};

const createReferenceUsage = (project: MovieProject, assetId: string, sequenceIds: string[], role: string) => {
  const slots = project.production.sequences.flatMap((sequence) => sequence.referenceSlots
    .filter((slot) => slot.assetId === assetId)
    .map((slot) => ({ sequenceId: sequence.id, slot: slot.slot, tag: slot.tag, required: slot.required, role })));
  if (slots.length) return slots;
  return sequenceIds.map((sequenceId) => ({ sequenceId, required: true, role }));
};

const recordHasImage = (record: ProductionAssetRecord) => Boolean(record.imagePath);

const toEntity = (project: MovieProject, record: ProductionAssetRecord, existing?: AssetEntity): AssetEntity => {
  const timestamp = now();
  const references = project.memory.database.projectReferences.filter((reference) => record.referenceIds.includes(reference.id));
  const generatedReferences = existing?.referenceImages.filter((item) => item !== existing.generatedImagePath) ?? [];
  const approvalState = record.status === "DRAFT" ? "PROMPT_READY" : record.status;
  return {
    id: record.id,
    projectId: project.id,
    name: record.name,
    category: categoryToEntityType(record.category),
    manifestCategory: record.category,
    projectNumber: record.number,
    permanentFilename: record.filename,
    description: record.description,
    storyPurpose: record.storyPurpose,
    referenceImages: unique([...references.map((reference) => reference.sourcePath), ...generatedReferences]),
    lockedTraits: {
      ...(existing?.lockedTraits ?? {}), movieDnaVersion: String(record.movieDnaVersion ?? project.production.movieDna.version),
      storyVersion: String(record.sourceStoryVersion ?? project.production.story.approvedVersion ?? project.production.story.version),
      filmBibleVersion: String(record.sourceFilmBibleVersion ?? project.production.filmBible.approvedVersion ?? project.production.filmBible.version),
      era: project.era, identity: record.identityReferenceId ? "protected uploaded source" : "canonical production identity",
    },
    mutableTraits: existing?.mutableTraits ?? { storyState: "Changes only through an approved Story or continuity decision" },
    currentState: existing?.currentState ?? { status: "canonical", continuity: "tracked" },
    notes: [...record.continuityNotes],
    visualDescription: record.description,
    generationPrompt: record.generationPrompt ?? `Create ${record.name}. ${record.description}`,
    negativePrompt: record.negativePrompt ?? project.production.permanentNegativeRules.join(" "),
    provider: record.provider ?? existing?.provider ?? "continuity-local",
    model: record.model ?? existing?.model ?? "reference-renderer-v1",
    generatedImagePath: record.imagePath ?? existing?.generatedImagePath,
    thumbnailPath: record.thumbnailPath ?? existing?.thumbnailPath,
    sourceReferenceIds: [...record.referenceIds],
    generationJobIds: [...(existing?.generationJobIds ?? [])],
    generationError: record.generationError,
    sheetId: record.characterSheetId ?? existing?.sheetId,
    critical: Boolean(record.required),
    sourceStoryVersion: record.sourceStoryVersion,
    sourceFilmBibleVersion: record.sourceFilmBibleVersion,
    movieDnaVersion: record.movieDnaVersion,
    sequenceIds: [...record.sequenceIds],
    dependencyIds: [...(record.dependencyIds ?? [])],
    parentCharacterId: record.characterId,
    characterStateId: record.characterStateId,
    costumeState: record.costumeState,
    identityReferenceId: record.identityReferenceId,
    characterSheetId: record.characterSheetId,
    approvalState: approvalState as ApprovalState,
    version: record.version,
    createdAt: existing?.createdAt ?? record.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
};

const syncArtifact = (project: MovieProject) => {
  const records = project.production.assets;
  project.artifacts.assets = {
    assets: records.map((record) => ({
      id: record.id, name: record.name, type: categoryToArtifactType(record.category), description: record.description,
      locked: record.status === "LOCKED", continuityNotes: record.continuityNotes, approvalState: record.status,
      version: record.version, referenceImages: unique([...record.referenceIds, ...(record.imagePath ? [record.imagePath] : [])]),
    })),
    counts: records.reduce<Record<string, number>>((counts, record) => ({ ...counts, [record.category]: (counts[record.category] ?? 0) + 1 }), {}),
  } satisfies AssetManifestArtifact;
};

const manifestOwnsDatabase = (project: MovieProject) => {
  const manifestIds = new Set(project.production.assets.map((record) => record.id));
  return manifestIds.size > 0
    && manifestIds.size === project.memory.database.assets.length
    && project.memory.database.assets.every((asset) => manifestIds.has(asset.id));
};

const syncDatabase = (project: MovieProject) => {
  const existing = new Map(project.memory.database.assets.map((asset) => [asset.id, asset]));
  project.memory.database.assets = project.production.assets
    .map((record) => toEntity(project, record, existing.get(record.id)));
  const database = project.memory.database;
  const productionEntityIds = new Set(project.production.assets.filter((record) => record.canGenerate !== false).map((record) => record.id));
  database.characters = database.assets.filter((asset) => productionEntityIds.has(asset.id) && asset.category === "character" && asset.manifestCategory !== "character_state");
  database.creatures = database.assets.filter((asset) => productionEntityIds.has(asset.id) && asset.category === "creature");
  database.animals = database.assets.filter((asset) => productionEntityIds.has(asset.id) && asset.category === "animal");
  database.locations = database.assets.filter((asset) => productionEntityIds.has(asset.id) && ["location", "building", "room", "interior"].includes(asset.category));
  database.props = database.assets.filter((asset) => productionEntityIds.has(asset.id) && ["prop", "object", "weapon", "tool"].includes(asset.category));
  database.wardrobes = database.assets.filter((asset) => productionEntityIds.has(asset.id) && ["wardrobe", "costume", "accessory"].includes(asset.category));
  const manifestIds = new Set(project.production.assets.map((record) => record.id));
  database.assetDependencies = database.assetDependencies.filter((item) => !manifestIds.has(item.fromId));
  for (const record of project.production.assets) {
    for (const dependencyId of record.dependencyIds ?? []) {
      const dependency = project.production.assets.find((item) => item.id === dependencyId);
      database.assetDependencies.push({
        id: `DEP_MANIFEST_${stateHash([record.id, dependencyId])}`,
        fromId: record.id,
        toId: dependencyId,
        kind: record.category === "character_state" ? "DERIVED_FROM" : "REQUIRES",
        required: true,
        satisfied: Boolean(dependency && recordHasImage(dependency)),
      });
    }
  }
};

export const syncManifestRuntime = (project: MovieProject) => {
  for (const record of project.production.assets) {
    const entity = project.memory.database.assets.find((item) => item.id === record.id);
    if (!entity) continue;
    record.imagePath = entity.generatedImagePath;
    record.thumbnailPath = entity.thumbnailPath;
    record.provider = entity.provider;
    record.model = entity.model;
    record.generationError = entity.generationError;
    record.version = entity.version;
    record.status = entity.approvalState;
    record.characterSheetId = entity.sheetId ?? record.characterSheetId;
    record.updatedAt = entity.updatedAt;
  }
  if (manifestOwnsDatabase(project)) syncArtifact(project);
  return project;
};

export const syncManifestReferences = (project: MovieProject) => {
  for (const record of project.production.assets) {
    if (record.sourceType === "UPLOADED_REFERENCE") {
      const reference = project.memory.database.projectReferences.find((item) => record.referenceIds.includes(item.id));
      if (reference) {
        record.imagePath = reference.sourcePath;
        record.status = reference.protected ? "LOCKED" : "APPROVED";
        record.updatedAt = reference.updatedAt;
      }
    }
    const linked = project.memory.database.projectReferences.filter((reference) => reference.assetId === record.id || reference.linkedAssetIds.includes(record.id));
    record.referenceIds = unique([...record.referenceIds, ...linked.map((reference) => reference.id)]);
    if (linked.length) record.identityReferenceId ??= linked.find((reference) => reference.roles.includes("IDENTITY"))?.id;
  }
  for (const entity of project.memory.database.assets) {
    const record = project.production.assets.find((item) => item.id === entity.id);
    if (!record) continue;
    entity.sourceReferenceIds = [...record.referenceIds];
    entity.referenceImages = unique([
      ...project.memory.database.projectReferences.filter((reference) => record.referenceIds.includes(reference.id)).map((reference) => reference.sourcePath),
      ...entity.referenceImages.filter((item) => item === entity.generatedImagePath),
    ]);
    entity.identityReferenceId = record.identityReferenceId;
  }
  if (manifestOwnsDatabase(project)) syncArtifact(project);
  return project;
};

export const buildCanonicalAssetManifest = (project: MovieProject) => {
  const story = storySnapshot(project);
  const bible = bibleSnapshot(project);
  const previous = new Map(project.production.assets.map((record) => [record.id, record]));
  let nextNumber = Math.max(project.production.nextProjectImageNumber || 1, ...project.production.assets.map((record) => record.number + 1));
  const records: ProductionAssetRecord[] = [];
  const ids = new Set<string>();

  const add = (candidate: ManifestCandidate) => {
    if (ids.has(candidate.id)) return records.find((record) => record.id === candidate.id)!;
    ids.add(candidate.id);
    const existing = previous.get(candidate.id);
    const timestamp = now();
    const number = existing?.number ?? nextNumber++;
    const extension = existing?.filename.split(".").at(-1) ?? candidate.preferredExtension ?? "png";
    const filename = existing
      ? normalizePermanentAssetFilename(number, existing.filename, existing.name || candidate.name)
      : permanentAssetFilename(number, candidate.name, extension);
    const record: ProductionAssetRecord = {
      ...candidate,
      number,
      filename,
      version: Math.max(candidate.version, existing?.version ?? 1),
      status: candidate.canGenerate === false ? candidate.status : existing?.status ?? candidate.status,
      previousVersions: [...(existing?.previousVersions ?? candidate.previousVersions)],
      generationAttempts: [...(existing?.generationAttempts ?? candidate.generationAttempts ?? [])],
      versionHistory: [...(existing?.versionHistory ?? candidate.versionHistory ?? [])],
      pendingVersion: existing?.pendingVersion,
      imagePath: candidate.imagePath ?? existing?.imagePath,
      thumbnailPath: candidate.thumbnailPath ?? existing?.thumbnailPath,
      provider: candidate.provider ?? existing?.provider,
      model: candidate.model ?? existing?.model,
      generationError: existing?.generationError,
      missingDecision: existing?.missingDecision,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    delete (record as ProductionAssetRecord & { preferredExtension?: string }).preferredExtension;
    records.push(record);
    return record;
  };

  const master = project.production.movieDna.masterFrame;
  const masterRecord = add({
    id: "MOVIE_DNA_MASTER_FRAME", name: "Movie DNA Master Frame", category: "movie_dna",
    description: "Permanent visual style reference for photography, colour, lighting, texture, atmosphere, environment, and production design. It never replaces character identity.",
    storyPurpose: "Control the visual language of every generated asset and sequence image.",
    filmBibleSources: ["visualLanguage", "historicalAndCulturalLaw", "environmentAndWeather", "continuityAndProductionRestrictions"],
    sourceStoryVersion: story.version, sourceFilmBibleVersion: bible.version, movieDnaVersion: project.production.movieDna.version,
    continuityNotes: ["Visual style reference only.", "Never use as a character identity reference."], sequenceIds: [], referenceIds: [],
    dependencyIds: [], referenceRoles: ["STYLE", "COLOR_GRADE", "LIGHTING"], sourceType: "MOVIE_DNA", required: true, canGenerate: false,
    generationPrompt: master?.prompt ?? "Generate the locked Movie DNA master frame.", negativePrompt: project.production.permanentNegativeRules.join(" "),
    imagePath: master?.path, thumbnailPath: master?.thumbnailPath, provider: master?.provider, model: master?.model,
    version: master?.version ?? 1, status: master?.status === "GENERATED" ? "LOCKED" : master?.status === "FAILED" ? "GENERATION_FAILED" : "PLANNED",
    previousVersions: [], generationAttempts: [], versionHistory: [], referenceUsage: [],
  });

  const mainCharacter = project.production.characters.find((character) => character.category === "main") ?? project.production.characters[0];
  const mainReference = project.preStorySetup.mainCharacterReferenceId
    ? project.memory.database.projectReferences.find((reference) => reference.id === project.preStorySetup.mainCharacterReferenceId)
    : undefined;
  let mainSourceRecord: ProductionAssetRecord | undefined;
  if (mainCharacter && mainReference) {
    const extension = mainReference.sourcePath.split(".").at(-1)?.toLowerCase() === "jpeg" ? "jpg" : mainReference.sourcePath.split(".").at(-1)?.toLowerCase();
    mainSourceRecord = add({
      id: `SOURCE_${mainReference.id}`, name: `${mainCharacter.name} Original Identity`, category: "main_character",
      description: `Protected user-uploaded identity source for ${mainCharacter.name}. The original image remains separate from every generated character sheet.`,
      storyPurpose: "Permanent protagonist identity source.", filmBibleSources: bibleKeysFor("main_character"), sourceStoryVersion: story.version,
      sourceFilmBibleVersion: bible.version, movieDnaVersion: project.production.movieDna.version,
      continuityNotes: ["Never overwrite or delete this protected source.", "Preserve exact face, age, build, skin tone, hair, clothing, accessories, and head covering."],
      sequenceIds: [...mainCharacter.relatedSequenceIds], referenceIds: [mainReference.id], dependencyIds: [], characterId: mainCharacter.id,
      identityReferenceId: mainReference.id, characterSheetId: mainCharacter.sheetId, referenceRoles: [...mainReference.roles], sourceType: "UPLOADED_REFERENCE",
      required: true, canGenerate: false, imagePath: mainReference.sourcePath, version: mainReference.versions.at(-1)?.version ?? 1, status: "LOCKED",
      previousVersions: [], generationAttempts: [], versionHistory: [], referenceUsage: createReferenceUsage(project, mainCharacter.id, mainCharacter.relatedSequenceIds, "Identity Lock"),
      preferredExtension: extension || "jpg",
    });
  }

  const structuredById = new Map(story.objects.map((candidate) => [candidate.id, candidate]));
  const costumeAssetId = story.objects.find((candidate) => candidate.category === "costume")?.id;
  for (const character of project.production.characters) {
    const structured = structuredById.get(character.storyCandidateId) ?? structuredById.get(character.id);
    const category: ProductionAssetCategory = character.category === "main" ? "main_character" : structured?.category === "creature" || character.id.startsWith("CREATURE_") ? "creature" : "character";
    const sequences = unique(character.relatedSequenceIds.length ? character.relatedSequenceIds : structured?.relatedSequenceIds ?? []);
    const beatIds = unique(character.relatedBeatIds.length ? character.relatedBeatIds : structured?.relatedBeatIds ?? []);
    const storyPurpose = storyPurposeFor(project, beatIds, sequences);
    const dependencyIds = unique([masterRecord.id, ...(character.id === mainCharacter?.id && mainSourceRecord ? [mainSourceRecord.id] : [])]);
    const filmBibleSources = bibleKeysFor(category);
    const entity = project.memory.database.assets.find((asset) => asset.id === character.id);
    const record = add({
      id: character.id, name: character.name, category, description: character.description, storyPurpose,
      filmBibleSources, sourceStoryVersion: story.version, sourceFilmBibleVersion: bible.version, movieDnaVersion: project.production.movieDna.version,
      relatedBeatIds: beatIds, continuityNotes: ["Preserve identity, apparent age, body proportions, face, hair, clothing, accessories, and head covering.", "Every state is derived from this master identity."],
      sequenceIds: sequences, referenceIds: [...character.referenceIds], dependencyIds, characterId: character.id, characterRelationships: [...character.relationships],
      identityReferenceId: character.referenceIds.find((id) => project.memory.database.projectReferences.find((reference) => reference.id === id)?.roles.includes("IDENTITY")),
      characterSheetId: character.sheetId, referenceRoles: ["IDENTITY", "CHARACTER_SHEET"], sourceType: sourceTypeFor(category), required: character.importance !== "BACKGROUND",
      canGenerate: true, version: entity?.version ?? character.version, status: entity?.approvalState ?? (character.sheetStatus === "LOCKED" && entity?.generatedImagePath ? "LOCKED" : "PROMPT_READY"),
      previousVersions: [], imagePath: entity?.generatedImagePath, thumbnailPath: entity?.thumbnailPath, provider: entity?.provider, model: entity?.model,
      generationAttempts: [], versionHistory: [], referenceUsage: createReferenceUsage(project, character.id, sequences, "Character Reference"),
      generationPrompt: "", negativePrompt: project.production.permanentNegativeRules.join(" "),
    });
    record.generationPrompt = generationPromptFor(project, { ...record, storyPurpose, filmBibleSources, dependencyIds, sourceStoryVersion: story.version, sourceFilmBibleVersion: bible.version });

    for (const state of character.states) {
      const stateSequences = [state.sequenceId];
      const stateId = `STATE_${character.id}_${state.sequenceId}`;
      const stateDependencies = unique([masterRecord.id, character.id, ...(costumeAssetId ? [costumeAssetId] : [])]);
      const statePurpose = storyPurposeFor(project, beatIds, stateSequences);
      const stateDescription = `${state.physical} Emotional state: ${state.emotional}. Wardrobe: ${state.wardrobe}. Injuries: ${state.injuries}. Possessions: ${state.possessions.join(", ") || "none documented"}. Damage: ${state.damage.join(", ") || "none documented"}.`;
      const stateEntity = project.memory.database.assets.find((asset) => asset.id === stateId);
      const stateRecord = add({
        id: stateId, name: `${character.name} · ${stateSequences.join(" + ")} State`, category: "character_state", description: stateDescription,
        storyPurpose: statePurpose, filmBibleSources: bibleKeysFor("character_state"), sourceStoryVersion: story.version, sourceFilmBibleVersion: bible.version,
        movieDnaVersion: project.production.movieDna.version, relatedBeatIds: beatIds,
        continuityNotes: ["Derive from the parent character identity without face, body, age, or costume drift.", `This exact state applies to ${stateSequences.join(", ")}.`],
        sequenceIds: stateSequences, referenceIds: [...character.referenceIds], dependencyIds: stateDependencies, characterId: character.id, characterRelationships: [...character.relationships],
        characterStateId: state.id, sourceStateIds: [state.id], costumeState: state.wardrobe, identityReferenceId: record.identityReferenceId,
        characterSheetId: character.sheetId, referenceRoles: ["CONTINUITY", "WARDROBE", "IDENTITY"], sourceType: "CHARACTER_STATE", required: true, canGenerate: true,
        version: stateEntity?.version ?? 1, status: stateEntity?.approvalState ?? "PROMPT_READY", previousVersions: [], imagePath: stateEntity?.generatedImagePath,
        thumbnailPath: stateEntity?.thumbnailPath, provider: stateEntity?.provider, model: stateEntity?.model, generationAttempts: [], versionHistory: [],
        referenceUsage: createReferenceUsage(project, stateId, stateSequences, "Character State"), generationPrompt: "", negativePrompt: project.production.permanentNegativeRules.join(" "),
      });
      stateRecord.generationPrompt = generationPromptFor(project, { ...stateRecord, storyPurpose: statePurpose, filmBibleSources: stateRecord.filmBibleSources!, dependencyIds: stateDependencies, sourceStoryVersion: story.version, sourceFilmBibleVersion: bible.version });
    }
  }

  const candidates = new Map<string, StoryAssetCandidate>();
  for (const location of story.locations) {
    candidates.set(location.id, { id: location.id, name: location.name, category: "location", description: location.description, importance: "CRITICAL", referencePriority: "HIGH", relatedBeatIds: location.relatedBeatIds, relatedSequenceIds: location.relatedSequenceIds });
  }
  for (const candidate of story.objects) candidates.set(candidate.id, candidate);
  for (const candidate of candidates.values()) {
    if (project.production.characters.some((character) => character.id === candidate.id || character.storyCandidateId === candidate.id)) continue;
    const category = candidateCategory(candidate);
    const storyPurpose = storyPurposeFor(project, candidate.relatedBeatIds, candidate.relatedSequenceIds);
    const filmBibleSources = bibleKeysFor(category);
    const dependencyIds = [masterRecord.id];
    const entity = project.memory.database.assets.find((asset) => asset.id === candidate.id);
    const record = add({
      id: candidate.id, name: candidate.name, category, description: candidate.description, storyPurpose, filmBibleSources,
      sourceStoryVersion: story.version, sourceFilmBibleVersion: bible.version, movieDnaVersion: project.production.movieDna.version,
      relatedBeatIds: [...candidate.relatedBeatIds], continuityNotes: [candidate.description, "Track scale, materials, geography, condition, ownership, placement, lighting, and damage as applicable."],
      sequenceIds: [...candidate.relatedSequenceIds], referenceIds: [], dependencyIds, referenceRoles: [category === "location" ? "LOCATION" : category.toUpperCase()],
      sourceType: "STORY", required: candidate.importance === "CRITICAL" || ["REQUIRED", "HIGH"].includes(candidate.referencePriority), canGenerate: true,
      version: entity?.version ?? 1, status: entity?.approvalState ?? "PROMPT_READY", previousVersions: [], imagePath: entity?.generatedImagePath,
      thumbnailPath: entity?.thumbnailPath, provider: entity?.provider, model: entity?.model, generationAttempts: [], versionHistory: [],
      referenceUsage: createReferenceUsage(project, candidate.id, candidate.relatedSequenceIds, `${category.replaceAll("_", " ")} Reference`),
      generationPrompt: "", negativePrompt: project.production.permanentNegativeRules.join(" "),
    });
    record.generationPrompt = generationPromptFor(project, { ...record, storyPurpose, filmBibleSources, dependencyIds, sourceStoryVersion: story.version, sourceFilmBibleVersion: bible.version });
  }

  for (const manual of previous.values()) {
    if (manual.sourceType !== "MANUAL" || ids.has(manual.id)) continue;
    add({ ...manual, preferredExtension: manual.filename.split(".").at(-1), previousVersions: [...manual.previousVersions] });
  }

  project.production.assets = records.sort((left, right) => left.number - right.number);
  project.production.nextProjectImageNumber = nextNumber;
  syncDatabase(project);
  syncManifestReferences(project);
  syncArtifact(project);
  return project.production.assets;
};

export const addManualManifestAsset = (project: MovieProject, input: {
  name: string;
  category: ProductionAssetCategory;
  description: string;
  storyPurpose?: string;
  sequenceIds?: string[];
  referenceRole?: string;
  continuityRequirements?: string[];
}) => {
  const number = project.production.nextProjectImageNumber++;
  const timestamp = now();
  const id = `ASSET_${String(number).padStart(3, "0")}`;
  const storyVersion = project.production.story.approvedVersion ?? project.production.story.version;
  const bibleVersion = project.production.filmBible.approvedVersion ?? project.production.filmBible.version;
  const dependencyIds = project.production.assets.some((record) => record.id === "MOVIE_DNA_MASTER_FRAME") ? ["MOVIE_DNA_MASTER_FRAME"] : [];
  const filmBibleSources = bibleKeysFor(input.category);
  const storyPurpose = input.storyPurpose?.trim() || "Manually added production requirement.";
  const record: ProductionAssetRecord = {
    id, number, filename: permanentAssetFilename(number, input.name, "png"), name: input.name.trim(), category: input.category, description: input.description.trim(),
    storyPurpose, filmBibleSources, sourceStoryVersion: storyVersion, sourceFilmBibleVersion: bibleVersion, movieDnaVersion: project.production.movieDna.version,
    continuityNotes: unique([input.description.trim(), ...(input.continuityRequirements ?? []).map((item) => item.trim()).filter(Boolean)]), sequenceIds: unique(input.sequenceIds ?? []), referenceIds: [], dependencyIds,
    referenceRoles: [input.referenceRole ?? "CONTINUITY"], sourceType: "MANUAL", required: true, canGenerate: true,
    generationPrompt: "", negativePrompt: project.production.permanentNegativeRules.join(" "), version: 1, status: "PROMPT_READY",
    previousVersions: [], generationAttempts: [], versionHistory: [], referenceUsage: createReferenceUsage(project, id, input.sequenceIds ?? [], input.referenceRole ?? "Continuity Reference"),
    createdAt: timestamp, updatedAt: timestamp,
  };
  record.generationPrompt = generationPromptFor(project, { ...record, storyPurpose, filmBibleSources, dependencyIds, sourceStoryVersion: storyVersion, sourceFilmBibleVersion: bibleVersion });
  project.production.assets.push(record);
  project.memory.database.assets.push(toEntity(project, record));
  syncDatabase(project);
  syncArtifact(project);
  return record;
};

export const updateManifestAsset = (project: MovieProject, assetId: string, input: Partial<Pick<ProductionAssetRecord, "description" | "storyPurpose" | "sequenceIds" | "referenceRoles" | "generationPrompt">>) => {
  const record = project.production.assets.find((item) => item.id === assetId);
  if (!record) throw new Error(`Asset ${assetId} was not found.`);
  if (input.description !== undefined) record.description = input.description.trim();
  if (input.storyPurpose !== undefined) record.storyPurpose = input.storyPurpose.trim();
  if (input.sequenceIds !== undefined) record.sequenceIds = unique(input.sequenceIds);
  if (input.referenceRoles !== undefined) record.referenceRoles = unique(input.referenceRoles);
  if (input.generationPrompt !== undefined) record.generationPrompt = input.generationPrompt.trim();
  record.updatedAt = now();
  const entity = project.memory.database.assets.find((item) => item.id === assetId);
  if (entity) {
    entity.description = record.description;
    entity.visualDescription = record.description;
    entity.storyPurpose = record.storyPurpose;
    entity.sequenceIds = [...record.sequenceIds];
    entity.generationPrompt = record.generationPrompt ?? entity.generationPrompt;
    entity.updatedAt = record.updatedAt;
  }
  syncArtifact(project);
  return record;
};

export const decideMissingAsset = (project: MovieProject, assetId: string, action: "GENERATE" | "UPLOAD" | "IGNORE", reason?: string) => {
  const record = project.production.assets.find((item) => item.id === assetId);
  if (!record) throw new Error(`Asset ${assetId} was not found.`);
  if (action === "IGNORE" && !reason?.trim()) throw new Error("Ignoring a required asset needs a reason.");
  record.missingDecision = { action, reason: reason?.trim(), createdAt: now() };
  record.updatedAt = now();
  return record;
};

export const manifestHealth = (project: MovieProject, record: ProductionAssetRecord) => {
  const entity = project.memory.database.assets.find((item) => item.id === record.id);
  const missingOnDisk = /missing on disk/i.test(record.generationError ?? "");
  const hasImage = !missingOnDisk && Boolean(record.imagePath || entity?.generatedImagePath);
  return {
    hasImage,
    missing: Boolean(record.required && !hasImage && record.missingDecision?.action !== "IGNORE"),
    failed: record.status === "GENERATION_FAILED" || Boolean(record.generationError),
    review: ["REVIEW", "GENERATED", "REGENERATE"].includes(record.status) || Boolean(record.pendingVersion),
  };
};

export const deleteManualManifestAsset = (project: MovieProject, assetId: string) => {
  const record = project.production.assets.find((item) => item.id === assetId);
  if (!record) throw new Error(`Asset ${assetId} was not found.`);
  if (record.sourceType !== "MANUAL") throw new Error("Only manually added assets can be deleted from the manifest.");
  const dependants = project.production.assets.filter((item) => item.dependencyIds?.includes(assetId));
  if (dependants.length) throw new Error(`${record.name} is required by ${dependants.map((item) => item.name).join(", ")}. Remove those dependencies first.`);
  project.production.assets = project.production.assets.filter((item) => item.id !== assetId);
  project.memory.database.assets = project.memory.database.assets.filter((item) => item.id !== assetId);
  project.memory.database.continuitySheets = project.memory.database.continuitySheets.filter((item) => item.assetId !== assetId);
  project.memory.database.assetDependencies = project.memory.database.assetDependencies.filter((item) => item.fromId !== assetId && item.toId !== assetId);
  syncDatabase(project);
  syncArtifact(project);
  return record;
};

export const newAttemptId = () => `ASSET_ATTEMPT_${randomUUID()}`;
