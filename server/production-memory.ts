import { randomUUID } from "node:crypto";
import type {
  CharacterVoiceProfile,
  ContinuityEntityState,
  ContinuityGlobalState,
  ContinuitySnapshot,
  ContinuitySnapshotAnchor,
  ContinuityWarning,
  MovieProject,
  ProductionAudioBible,
  ProductionMemoryLayer,
  ProductionStoryTimeline,
  ProductionTimelineEvent,
  ProjectConfig,
  RecurringAudioIdentity,
} from "../src/types.js";
import { createProductionScriptState, normalizeProductionScriptState } from "./script-workflow.js";

const now = () => new Date().toISOString();
const pad = (value: number) => String(value).padStart(2, "0");
const clock = (seconds: number) => `${pad(Math.floor(seconds / 60))}:${pad(Math.max(0, seconds % 60))}`;
const unique = <T>(values: T[]) => [...new Set(values)];
const asList = (value?: string) => value && !/^(none|unknown|not documented|n\/a)$/i.test(value.trim()) ? [value.trim()] : [];
const clone = <T>(value: T): T => structuredClone(value);
const safeId = (value: string) => value.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toUpperCase();
const sequenceNumber = (sequenceId: string) => Number(sequenceId.match(/(\d+)/)?.[1] ?? 0);

const emptyGlobal = (): ContinuityGlobalState => ({
  currentDate: "Unscheduled",
  currentTime: "00:00",
  timeOfDay: "Story time",
  weather: "Continuity-controlled weather",
  lighting: "Approved Movie DNA lighting",
  storyPhase: "Opening",
  knownEventIds: [],
  environmentState: [],
});

const createAudioBible = (config: Partial<ProjectConfig> = {}): ProductionAudioBible => {
  const createdAt = now();
  return {
    status: "DRAFT",
    version: 1,
    filmLanguage: config.filmLanguage ?? config.language ?? "English",
    dialogueLanguage: config.dialogueLanguage ?? config.language ?? "English",
    narrationEnabled: config.narrationEnabled ?? false,
    dialogueEnabled: config.dialogueEnabled ?? true,
    musicEnabled: config.musicEnabled ?? true,
    subtitlesEnabled: config.subtitlesEnabled ?? true,
    voiceProfiles: [],
    ambientSounds: [],
    soundEffects: [],
    musicRules: [],
    intentionalSilenceRules: [],
    dialogueContract: {
      supportedFields: ["speaker", "exactDialogue", "language", "accent", "emotion", "delivery", "pronunciation", "volume", "timing", "approval", "lockState"],
      preparedForFullScript: true,
    },
    history: [],
    createdAt,
    updatedAt: createdAt,
  };
};

export const createProductionMemoryLayer = (config: Partial<ProjectConfig> = {}, projectId = "UNASSIGNED"): ProductionMemoryLayer => {
  const createdAt = now();
  return {
    storyTimeline: {
      status: "EMPTY",
      version: 0,
      runtimeSeconds: Math.round((config.runtimeMinutes ?? 0) * 60),
      sequenceDurationSeconds: config.sequenceDurationSeconds ?? 30,
      events: [],
      updatedAt: createdAt,
    },
    continuity: {
      currentByEntity: {},
      currentGlobal: emptyGlobal(),
      snapshots: [],
      warnings: [],
      history: [],
      updatedAt: createdAt,
    },
    audioBible: createAudioBible(config),
    script: createProductionScriptState(projectId),
    updatedAt: createdAt,
  };
};

export const normalizeProductionMemoryLayer = (project: MovieProject, saved?: Partial<ProductionMemoryLayer>): ProductionMemoryLayer => {
  const defaults = createProductionMemoryLayer(project);
  const timeline = { ...defaults.storyTimeline, ...(saved?.storyTimeline ?? {}) } as ProductionStoryTimeline;
  timeline.events ??= [];
  const continuity = { ...defaults.continuity, ...(saved?.continuity ?? {}) };
  continuity.currentByEntity ??= {};
  continuity.currentGlobal = { ...defaults.continuity.currentGlobal, ...(continuity.currentGlobal ?? {}) };
  continuity.snapshots ??= [];
  continuity.warnings ??= [];
  continuity.history ??= [];
  const audio = { ...defaults.audioBible, ...(saved?.audioBible ?? {}) } as ProductionAudioBible;
  audio.voiceProfiles ??= [];
  audio.ambientSounds ??= [];
  audio.soundEffects ??= [];
  audio.musicRules ??= [];
  audio.intentionalSilenceRules ??= [];
  audio.history ??= [];
  audio.dialogueContract = { ...defaults.audioBible.dialogueContract, ...(audio.dialogueContract ?? {}) };
  if (!audio.musicRules.length && project.production.audioBible.music) audio.musicRules = [project.production.audioBible.music];
  if (!audio.ambientSounds.length && project.production.audioBible.ambience) audio.ambientSounds = [{ id: "AMBIENT_PROJECT_BED", name: "Project environment bed", description: project.production.audioBible.ambience, identityKey: `${project.id}:PROJECT_AMBIENCE`, conditions: ["Maintain continuity across edits and returning locations."], locked: false, updatedAt: now() }];
  const script = normalizeProductionScriptState(project, saved?.script);
  return { storyTimeline: timeline, continuity, audioBible: audio, script, updatedAt: saved?.updatedAt ?? now() };
};

const assetIdsFor = (project: MovieProject, sequenceId: string, categories: string[]) => project.production.assets
  .filter((asset) => categories.includes(asset.category) && asset.sequenceIds?.includes(sequenceId))
  .map((asset) => asset.id);

const timelineEventForSequence = (project: MovieProject, sequenceId: string, index: number): ProductionTimelineEvent => {
  const story = project.production.story;
  const sequence = story.sequenceBreakdown.find((item) => item.id === sequenceId) ?? story.sequenceBreakdown[index];
  const source = story.timeline.find((item) => item.relatedSequenceIds.includes(sequenceId)) ?? story.timeline[index];
  const beat = story.beats.find((item) => item.relatedSequenceIds.includes(sequenceId) || sequence?.relatedBeatIds.includes(item.id));
  const storyEvents = story.events.filter((item) => source?.events.includes(item.id) || beat?.eventIds.includes(item.id));
  const startSeconds = sequence?.startSeconds ?? source?.approximateTimeSeconds ?? index * Math.max(1, project.sequenceDurationSeconds);
  const endSeconds = sequence?.endSeconds ?? Math.min(project.runtimeMinutes * 60, startSeconds + Math.max(1, project.sequenceDurationSeconds));
  const characterIds = unique([...(sequence?.characterIds ?? []), ...(source?.characterIds ?? []), ...(beat?.characterIds ?? [])]);
  const characterStateIds: Record<string, string> = {};
  const characterKnowledge: Record<string, string[]> = {};
  const relationships: Record<string, string> = {};
  const injuries: Record<string, string[]> = {};
  const costumeChanges: Record<string, string> = {};
  const characterDamage: string[] = [];
  for (const characterId of characterIds) {
    const character = project.production.characters.find((item) => item.id === characterId || item.storyCandidateId === characterId);
    const state = character?.states.find((item) => item.sequenceId === sequenceId);
    if (state) characterStateIds[characterId] = state.id;
    characterKnowledge[characterId] = unique([...asList(state?.knowledge), ...asList(source?.characterKnowledge[characterId])]);
    relationships[characterId] = state?.relationshipState ?? source?.relationshipState[characterId] ?? "No documented relationship change";
    injuries[characterId] = unique([...asList(state?.injuries), ...(characterId === characterIds[0] ? source?.injuries ?? [] : [])]);
    if (state?.wardrobe) costumeChanges[characterId] = state.wardrobe;
    characterDamage.push(...(state?.damage ?? []));
  }
  const importantAssetIds = sequence?.importantAssetIds ?? beat?.importantAssetIds ?? [];
  const props = unique([
    ...importantAssetIds.filter((id) => project.production.assets.some((asset) => asset.id === id && ["prop", "weapon", "story_object", "accessory"].includes(asset.category))),
    ...assetIdsFor(project, sequenceId, ["prop", "weapon", "story_object", "accessory"]),
  ]);
  const actionText = unique([...(sequence?.events ?? []), ...storyEvents.map((item) => item.description)]).filter(Boolean);
  return {
    id: source?.id ?? `TIMELINE_${pad(index + 1)}`,
    movieTime: { startSeconds, endSeconds, label: sequence?.timeRange ?? `${clock(startSeconds)}–${clock(endSeconds)}` },
    sequenceId,
    scene: actionText[0]?.split(/[.!?]/)[0]?.trim().slice(0, 120) || storyEvents[0]?.name || beat?.name || `Sequence ${pad(index + 1)}`,
    storyBeat: beat?.description ?? sequence?.storyPurpose ?? "Approved Story progression",
    date: source?.date ?? project.era,
    time: source?.time ?? clock(startSeconds),
    timeOfDay: source?.timeOfDay ?? "Story time",
    weather: source?.weather ?? project.production.movieDna.selections.environment?.label ?? "Continuity-controlled weather",
    locationId: sequence?.locationId ?? source?.locationId ?? "LOCATION_TBD",
    characterIds,
    characterStateIds,
    characterKnowledge,
    relationships,
    importantActions: actionText.length ? actionText : [sequence?.storyPurpose ?? beat?.storyPurpose ?? "Approved Story action"],
    objectsAcquired: unique(source?.objectsAcquired ?? []),
    objectsLost: unique(source?.objectsLost ?? []),
    propIds: props,
    vehicleIds: unique(assetIdsFor(project, sequenceId, ["vehicle"])),
    creatureIds: unique(assetIdsFor(project, sequenceId, ["creature"])),
    animalIds: unique(assetIdsFor(project, sequenceId, ["animal"])),
    injuries,
    damage: unique([...(source?.damage ?? []), ...characterDamage]),
    costumeChanges,
    environmentChanges: unique(source?.environmentChanges ?? []),
    lightingState: project.production.movieDna.selections.lighting?.label ?? project.production.filmBible.sections.lighting ?? "Approved Movie DNA lighting",
    storyConsequence: sequence?.requiredEndingCondition ?? beat?.storyPurpose ?? "This event advances the approved Story.",
    sourceEventIds: unique([...(source?.events ?? []), ...storyEvents.map((item) => item.id)]),
    sourceBeatIds: unique([...(sequence?.relatedBeatIds ?? []), ...(beat ? [beat.id] : [])]),
    sourceStoryVersion: story.approvedVersion ?? story.lockedVersion ?? story.version,
    sourceFilmBibleVersion: project.production.filmBible.approvedVersion ?? project.production.filmBible.lockedVersion,
  };
};

export const buildStoryTimeline = (project: MovieProject): ProductionStoryTimeline => {
  const storyVersion = project.production.story.approvedVersion ?? project.production.story.lockedVersion;
  if (!storyVersion) throw new Error("Approve the Story before building the production-memory timeline.");
  const bibleVersion = project.production.filmBible.approvedVersion ?? project.production.filmBible.lockedVersion;
  if (!bibleVersion) throw new Error("Approve the Film Bible before building the production-memory timeline.");
  const sequenceIds = project.production.story.sequenceBreakdown.map((item) => item.id);
  const count = Math.max(1, Math.ceil(project.runtimeMinutes * 60 / Math.max(1, project.sequenceDurationSeconds)));
  while (sequenceIds.length < count) sequenceIds.push(`SEQ_${pad(sequenceIds.length + 1)}`);
  const builtAt = now();
  const previous = project.memory.productionMemory.storyTimeline;
  const timeline: ProductionStoryTimeline = {
    status: "READY",
    version: previous.version + 1,
    runtimeSeconds: Math.round(project.runtimeMinutes * 60),
    sequenceDurationSeconds: project.sequenceDurationSeconds,
    sourceStoryVersion: storyVersion,
    sourceFilmBibleVersion: bibleVersion,
    events: sequenceIds.map((sequenceId, index) => timelineEventForSequence(project, sequenceId, index)),
    generatedAt: builtAt,
    updatedAt: builtAt,
  };
  project.memory.productionMemory.storyTimeline = timeline;
  project.memory.productionMemory.updatedAt = builtAt;
  return timeline;
};

const blankEntity = (entityId: string, entityType: ContinuityEntityState["entityType"]): ContinuityEntityState => ({
  entityId,
  entityType,
  identityId: entityId,
  location: "Unknown",
  position: "Story-defined position",
  movement: "Story-defined movement",
  screenDirection: "Not established",
  clothing: "Not applicable",
  shoes: "Not documented",
  headCovering: "Not documented",
  accessories: [],
  hair: "Not documented",
  makeup: "Not documented",
  dirt: "Clean",
  blood: "None",
  injuries: [],
  wetState: "UNKNOWN",
  equipment: [],
  weapons: [],
  propsCarried: [],
  emotionalState: "Not applicable",
  knowledge: [],
  relationships: [],
  physicalCondition: "Stable",
  condition: "Intact",
  damage: [],
  updatedByEventIds: [],
});

const statesFromTimelineEvent = (project: MovieProject, event: ProductionTimelineEvent): ContinuityEntityState[] => {
  const states: ContinuityEntityState[] = [];
  for (const characterId of event.characterIds) {
    const character = project.production.characters.find((item) => item.id === characterId || item.storyCandidateId === characterId);
    const storyState = character?.states.find((item) => item.sequenceId === event.sequenceId);
    const state = blankEntity(character?.id ?? characterId, "character");
    state.identityId = character?.id ?? characterId;
    state.characterStateId = storyState?.id ?? event.characterStateIds[characterId];
    state.location = storyState?.locationId ?? event.locationId;
    state.clothing = storyState?.wardrobe ?? event.costumeChanges[characterId] ?? "Approved character wardrobe";
    state.dirt = /dust/i.test(state.clothing) ? "Dusty" : "Clean";
    state.blood = /blood/i.test(storyState?.injuries ?? "") ? "Visible" : "None";
    state.injuries = unique([...(event.injuries[characterId] ?? []), ...asList(storyState?.injuries)]);
    state.propsCarried = unique(storyState?.possessions ?? []);
    state.weapons = state.propsCarried.filter((id) => /knife|sword|rifle|weapon/i.test(id));
    state.emotionalState = storyState?.emotional ?? "Approved Story emotion";
    state.knowledge = unique([...(event.characterKnowledge[characterId] ?? []), ...asList(storyState?.knowledge)]);
    state.relationships = unique([event.relationships[characterId], ...(character?.relationships ?? [])].filter(Boolean));
    state.physicalCondition = storyState?.physical ?? "Stable";
    state.damage = unique([...(storyState?.damage ?? []), ...event.damage]);
    state.updatedByEventIds = [...event.sourceEventIds];
    states.push(state);
  }
  const primaryOwner = states.find((state) => state.entityType === "character")?.entityId;
  const typed = (ids: string[], type: ContinuityEntityState["entityType"]) => ids.forEach((id) => {
    const state = blankEntity(id, type);
    state.location = event.locationId;
    state.updatedByEventIds = [...event.sourceEventIds];
    if (type === "prop") {
      state.ownerId = event.objectsLost.includes(id) ? undefined : event.objectsAcquired.includes(id) ? primaryOwner : undefined;
      state.acquired = event.objectsAcquired.includes(id);
      state.dropped = event.objectsLost.includes(id);
      state.lost = event.objectsLost.includes(id);
      state.visible = true;
      if (state.ownerId) {
        const owner = states.find((item) => item.entityId === state.ownerId);
        if (owner && !owner.propsCarried.includes(id)) owner.propsCarried.push(id);
      }
    }
    states.push(state);
  });
  typed(unique([...event.propIds, ...event.objectsAcquired, ...event.objectsLost]), "prop");
  typed(event.vehicleIds, "vehicle");
  typed(event.creatureIds, "creature");
  typed(event.animalIds, "animal");
  const location = blankEntity(event.locationId, "location");
  location.location = event.locationId;
  location.weather = event.weather;
  location.lighting = event.lightingState;
  location.objectsPresent = unique([...event.propIds, ...event.vehicleIds, ...event.creatureIds, ...event.animalIds]);
  location.environmentChanges = [...event.environmentChanges];
  location.productionState = event.storyConsequence;
  location.updatedByEventIds = [...event.sourceEventIds];
  states.push(location);
  return [...new Map(states.map((state) => [state.entityId, state])).values()];
};

const globalFromEvent = (event: ProductionTimelineEvent): ContinuityGlobalState => ({
  currentDate: event.date,
  currentTime: event.time,
  timeOfDay: event.timeOfDay,
  weather: event.weather,
  lighting: event.lightingState,
  storyPhase: event.storyBeat,
  knownEventIds: [...event.sourceEventIds],
  environmentState: [...event.environmentChanges],
});

const latestSnapshot = (project: MovieProject, sequenceId: string, anchor: ContinuitySnapshotAnchor, statuses?: ContinuitySnapshot["status"][]) => project.memory.productionMemory.continuity.snapshots
  .filter((snapshot) => snapshot.sequenceId === sequenceId && snapshot.anchor === anchor && (!statuses || statuses.includes(snapshot.status)))
  .sort((a, b) => b.version - a.version)[0];

const recordHistory = (project: MovieProject, snapshot: ContinuitySnapshot, action: "CREATED" | "APPROVED" | "LOCKED" | "SUPERSEDED", changedFields: string[], reason: string) => {
  project.memory.productionMemory.continuity.history.push({ id: randomUUID(), sequenceId: snapshot.sequenceId, snapshotId: snapshot.id, version: snapshot.version, action, changedFields, reason, source: snapshot.changeSource, createdAt: now() });
};

const createSnapshot = (
  project: MovieProject,
  event: ProductionTimelineEvent,
  anchor: ContinuitySnapshotAnchor,
  entities: ContinuityEntityState[],
  global: ContinuityGlobalState,
  options: Partial<Pick<ContinuitySnapshot, "inheritedFromSnapshotId" | "changeReason" | "changeSource">> = {},
): ContinuitySnapshot => {
  const previous = latestSnapshot(project, event.sequenceId ?? "UNASSIGNED", anchor);
  const snapshot: ContinuitySnapshot = {
    id: randomUUID(),
    sequenceId: event.sequenceId ?? "UNASSIGNED",
    anchor,
    version: (previous?.version ?? 0) + 1,
    status: "CANDIDATE",
    entities: clone(entities),
    global: clone(global),
    inheritedFromSnapshotId: options.inheritedFromSnapshotId,
    sourceTimelineEventIds: [event.id],
    changeReason: options.changeReason ?? "Built from approved Story Timeline and Film Bible sources.",
    changeSource: options.changeSource ?? "STORY",
    createdAt: now(),
  };
  project.memory.productionMemory.continuity.snapshots.push(snapshot);
  recordHistory(project, snapshot, "CREATED", ["entities", "global"], snapshot.changeReason);
  return snapshot;
};

const seedAudioIdentities = (project: MovieProject) => {
  const audio = project.memory.productionMemory.audioBible;
  if (audio.dialogueEnabled) {
    for (const character of project.production.characters) {
      if (audio.voiceProfiles.some((profile) => profile.characterId === character.id)) continue;
      const createdAt = now();
      audio.voiceProfiles.push({
        id: `VOICE_${safeId(character.id)}`,
        characterId: character.id,
        voiceDescription: `${character.name} permanent production voice identity`,
        language: audio.dialogueLanguage || project.dialogueLanguage,
        accent: "Project-defined accent",
        ageImpression: character.ageRange || "Character-appropriate",
        pitch: "Character-appropriate stable pitch",
        tone: character.personality || "Story-matched stable tone",
        speakingSpeed: "Natural dramatic pace",
        emotionRange: character.states.map((state) => state.emotional).filter((value, index, values) => Boolean(value) && values.indexOf(value) === index),
        deliveryStyle: "Natural performance matched to the approved Character State",
        pronunciationRules: [],
        volumeTendencies: "Scene-appropriate natural dynamics",
        status: "DRAFT",
        version: 1,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }
  const source = `${project.production.story.content} ${project.production.story.timeline.flatMap((item) => item.environmentChanges).join(" ")}`;
  const ambientCandidates: Array<[RegExp, string, string]> = [
    [/wind|sandstorm/i, "Desert wind", "Recurring weather and environment bed"],
    [/camel/i, "Camel movement and bell", "Recurring animal movement identity"],
    [/fire|campfire/i, "Campfire", "Recurring practical fire identity"],
    [/ocean|sea|wave/i, "Ocean", "Recurring coastal environment identity"],
    [/rain/i, "Rain", "Recurring weather identity"],
    [/traffic|car|vehicle/i, "Traffic and vehicle bed", "Recurring movement environment identity"],
  ];
  for (const [pattern, name, description] of ambientCandidates) {
    if (!pattern.test(source) || audio.ambientSounds.some((item) => item.name === name)) continue;
    audio.ambientSounds.push({ id: `AMBIENT_${safeId(name)}`, name, description, identityKey: `${project.id}:${safeId(name)}`, conditions: ["Use only when the approved Story event calls for it."], locked: false, updatedAt: now() });
  }
  for (const asset of project.production.assets.filter((item) => ["prop", "weapon", "vehicle", "animal"].includes(item.category))) {
    if (audio.soundEffects.some((item) => item.sourceEntityId === asset.id)) continue;
    audio.soundEffects.push({ id: `SFX_${safeId(asset.id)}`, name: `${asset.name} sound identity`, description: `Recurring sound effects for ${asset.name}; preserve the same timbre when it returns.`, identityKey: `${project.id}:${asset.id}`, sourceEntityId: asset.id, conditions: asset.sequenceIds.map((id) => `Used in ${id}`), locked: false, updatedAt: now() });
  }
};

export const buildContinuityLedger = (project: MovieProject) => {
  const memory = project.memory.productionMemory;
  if (!memory.storyTimeline.events.length) buildStoryTimeline(project);
  const continuity = memory.continuity;
  for (const event of memory.storyTimeline.events) {
    if (!event.sequenceId) continue;
    const states = statesFromTimelineEvent(project, event);
    const global = globalFromEvent(event);
    for (const anchor of ["START", "MID", "END"] as const) {
      if (!latestSnapshot(project, event.sequenceId, anchor)) createSnapshot(project, event, anchor, states, global);
    }
  }
  seedAudioIdentities(project);
  continuity.updatedAt = now();
  memory.updatedAt = continuity.updatedAt;
  return continuity;
};

export const rebuildProductionMemory = (project: MovieProject) => {
  buildStoryTimeline(project);
  buildContinuityLedger(project);
  const audio = project.memory.productionMemory.audioBible;
  audio.filmLanguage = project.filmLanguage;
  audio.dialogueLanguage = project.dialogueLanguage;
  audio.narrationEnabled = project.narrationEnabled;
  audio.dialogueEnabled = project.dialogueEnabled;
  audio.musicEnabled = project.musicEnabled;
  audio.subtitlesEnabled = project.subtitlesEnabled;
  audio.updatedAt = now();
  const continuityGate = project.production.gates.find((gate) => gate.stage === "continuity");
  if (continuityGate) Object.assign(continuityGate, { status: "READY", note: "Story Timeline, Continuity Ledger, and Audio Bible are built and persisted.", updatedAt: audio.updatedAt });
  const sequenceGate = project.production.gates.find((gate) => gate.stage === "sequences");
  if (sequenceGate && sequenceGate.status === "BLOCKED") Object.assign(sequenceGate, { status: "READY", note: "Production memory downstream contract is ready.", updatedAt: audio.updatedAt });
  project.memory.productionMemory.updatedAt = audio.updatedAt;
  return project.memory.productionMemory;
};

export const markProductionMemoryStale = (project: MovieProject) => {
  const memory = project.memory.productionMemory;
  if (memory.storyTimeline.events.length) memory.storyTimeline.status = "STALE";
  if (memory.script.scriptVersion && !["EMPTY", "CHANGED"].includes(memory.script.status)) memory.script.status = "CHANGED";
  memory.storyTimeline.updatedAt = now();
  memory.script.updatedAt = memory.storyTimeline.updatedAt;
  memory.updatedAt = memory.storyTimeline.updatedAt;
};

type StatePatch = { entityId: string; entityType?: ContinuityEntityState["entityType"]; fields: Partial<ContinuityEntityState> };

const comparable = (value: unknown) => JSON.stringify(value ?? null);
const display = (value: unknown) => Array.isArray(value) ? value.join(", ") || "None" : value === undefined ? "None" : String(value);

const conflictWarnings = (project: MovieProject, snapshot: ContinuitySnapshot, expected: ContinuitySnapshot | undefined, patches: StatePatch[]) => {
  if (!expected) return [] as ContinuityWarning[];
  const warnings: ContinuityWarning[] = [];
  for (const patch of patches) {
    const expectedEntity = expected.entities.find((item) => item.entityId === patch.entityId);
    const actualEntity = snapshot.entities.find((item) => item.entityId === patch.entityId);
    if (!expectedEntity || !actualEntity) continue;
    for (const field of Object.keys(patch.fields) as Array<keyof ContinuityEntityState>) {
      if (["updatedByEventIds", "characterStateId"].includes(field)) continue;
      if (comparable(expectedEntity[field]) === comparable(actualEntity[field])) continue;
      const number = sequenceNumber(snapshot.sequenceId);
      warnings.push({
        id: randomUUID(),
        code: `CONTINUITY_${String(field).toUpperCase()}`,
        severity: ["identityId", "knowledge", "injuries", "propsCarried", "ownerId"].includes(field) ? "BLOCKING" : "WARNING",
        entityId: patch.entityId,
        field,
        expected: display(expectedEntity[field]),
        conflicting: display(actualEntity[field]),
        sourceSequenceId: expected.sequenceId,
        sourceSnapshotId: expected.id,
        affectedFutureSequenceIds: project.memory.productionMemory.storyTimeline.events.filter((event) => event.sequenceId && sequenceNumber(event.sequenceId) > number).map((event) => event.sequenceId!),
        currentSequenceId: snapshot.sequenceId,
        status: "OPEN",
        createdAt: now(),
      });
    }
  }
  return warnings;
};

export const reviseContinuitySnapshot = (project: MovieProject, input: {
  sequenceId: string;
  anchor: ContinuitySnapshotAnchor;
  patches: StatePatch[];
  reason: string;
  source?: ContinuitySnapshot["changeSource"];
}) => {
  const event = project.memory.productionMemory.storyTimeline.events.find((item) => item.sequenceId === input.sequenceId);
  if (!event) throw new Error(`Timeline event for ${input.sequenceId} was not found.`);
  const base = latestSnapshot(project, input.sequenceId, input.anchor)
    ?? latestSnapshot(project, input.sequenceId, "START")
    ?? createSnapshot(project, event, input.anchor, statesFromTimelineEvent(project, event), globalFromEvent(event));
  const entities = clone(base.entities);
  const changedFields: string[] = [];
  for (const patch of input.patches) {
    let entity = entities.find((item) => item.entityId === patch.entityId);
    if (!entity) {
      entity = blankEntity(patch.entityId, patch.entityType ?? "prop");
      entities.push(entity);
    }
    for (const [key, value] of Object.entries(patch.fields)) {
      if (key === "entityId" || key === "entityType" || key === "identityId") continue;
      (entity as unknown as Record<string, unknown>)[key] = clone(value);
      changedFields.push(`${patch.entityId}.${key}`);
    }
  }
  const snapshot = createSnapshot(project, event, input.anchor, entities, base.global, {
    inheritedFromSnapshotId: base.inheritedFromSnapshotId,
    changeReason: input.reason,
    changeSource: input.source ?? "USER",
  });
  const previousSequenceId = project.memory.productionMemory.storyTimeline.events
    .filter((item) => item.sequenceId && sequenceNumber(item.sequenceId) < sequenceNumber(input.sequenceId))
    .sort((a, b) => sequenceNumber(b.sequenceId!) - sequenceNumber(a.sequenceId!))[0]?.sequenceId;
  const expected = input.anchor === "START" && previousSequenceId
    ? latestSnapshot(project, previousSequenceId, "END", ["APPROVED", "LOCKED"])
    : latestSnapshot(project, input.sequenceId, "START", ["APPROVED", "LOCKED"]);
  const warnings = conflictWarnings(project, snapshot, expected, input.patches);
  project.memory.productionMemory.continuity.warnings.push(...warnings);
  recordHistory(project, snapshot, "CREATED", changedFields, input.reason);
  project.memory.productionMemory.continuity.updatedAt = now();
  project.memory.productionMemory.updatedAt = project.memory.productionMemory.continuity.updatedAt;
  return { snapshot, warnings };
};

const legacyStateSummary = (state: ContinuityEntityState) => [
  state.location,
  state.clothing,
  state.dirt,
  state.injuries.length ? `injuries: ${state.injuries.join(", ")}` : "no injury",
  state.propsCarried.length ? `carrying: ${state.propsCarried.join(", ")}` : "carrying no props",
].filter(Boolean).join(" · ");

export const approveContinuitySnapshot = (project: MovieProject, snapshotId: string, lock = false) => {
  const continuity = project.memory.productionMemory.continuity;
  const snapshot = continuity.snapshots.find((item) => item.id === snapshotId);
  if (!snapshot) throw new Error(`Continuity snapshot ${snapshotId} was not found.`);
  const blocking = continuity.warnings.filter((warning) => warning.currentSequenceId === snapshot.sequenceId && warning.status === "OPEN" && warning.severity === "BLOCKING");
  if (blocking.length) throw new Error(`Resolve ${blocking.length} blocking continuity warning${blocking.length === 1 ? "" : "s"} before approval.`);
  snapshot.status = lock ? "LOCKED" : "APPROVED";
  snapshot.approvedAt = now();
  recordHistory(project, snapshot, lock ? "LOCKED" : "APPROVED", ["status"], lock ? "User locked the continuity snapshot." : "User approved the continuity snapshot.");
  if (snapshot.anchor === "END") {
    continuity.currentByEntity = Object.fromEntries(snapshot.entities.map((state) => [state.entityId, clone(state)]));
    continuity.currentGlobal = clone(snapshot.global);
    continuity.latestApprovedSequenceId = snapshot.sequenceId;
    const source = lock ? "LOCKED" : "APPROVED";
    for (const state of snapshot.entities) {
      project.production.continuityLedger.push({ id: randomUUID(), sequenceId: snapshot.sequenceId, entityId: state.entityId, state: legacyStateSummary(state), source, createdAt: now() });
    }
    const nextEvent = project.memory.productionMemory.storyTimeline.events.find((event) => event.sequenceId && sequenceNumber(event.sequenceId) === sequenceNumber(snapshot.sequenceId) + 1);
    if (nextEvent?.sequenceId) {
      createSnapshot(project, nextEvent, "START", snapshot.entities, snapshot.global, {
        inheritedFromSnapshotId: snapshot.id,
        changeReason: `${nextEvent.sequenceId} Start State inherited from approved ${snapshot.sequenceId} End State.`,
        changeSource: "SEQUENCE_APPROVAL",
      });
    }
  }
  continuity.updatedAt = now();
  project.memory.productionMemory.updatedAt = continuity.updatedAt;
  return snapshot;
};

export const resolveContinuityWarning = (project: MovieProject, warningId: string, action: "FIX_CURRENT_DATA" | "ACCEPT_INTENTIONAL_CHANGE", note?: string) => {
  const continuity = project.memory.productionMemory.continuity;
  const warning = continuity.warnings.find((item) => item.id === warningId);
  if (!warning) throw new Error(`Continuity warning ${warningId} was not found.`);
  if (action === "FIX_CURRENT_DATA") {
    const source = continuity.snapshots.find((item) => item.id === warning.sourceSnapshotId);
    const target = latestSnapshot(project, warning.currentSequenceId, "START");
    const sourceEntity = source?.entities.find((item) => item.entityId === warning.entityId);
    if (!source || !target || !sourceEntity) throw new Error("The source state for this warning is no longer available.");
    reviseContinuitySnapshot(project, { sequenceId: warning.currentSequenceId, anchor: target.anchor, patches: [{ entityId: warning.entityId, entityType: sourceEntity.entityType, fields: { [warning.field]: clone((sourceEntity as unknown as Record<string, unknown>)[warning.field]) } }], reason: note ?? `Fixed ${warning.field} from ${warning.sourceSequenceId}.`, source: "USER" });
    warning.status = "RESOLVED";
  } else {
    warning.status = "ACCEPTED_INTENTIONAL";
  }
  warning.resolutionNote = note;
  warning.resolvedAt = now();
  continuity.history.push({ id: randomUUID(), sequenceId: warning.currentSequenceId, snapshotId: warning.sourceSnapshotId, version: 0, action: action === "FIX_CURRENT_DATA" ? "WARNING_RESOLVED" : "WARNING_ACCEPTED", changedFields: [warning.field], reason: note ?? action.replaceAll("_", " "), source: "USER", createdAt: now() });
  continuity.updatedAt = now();
  return warning;
};

const syncLegacyAudio = (project: MovieProject) => {
  const audio = project.memory.productionMemory.audioBible;
  project.production.audioBible = {
    ...project.production.audioBible,
    filmLanguage: audio.filmLanguage,
    dialogueLanguage: audio.dialogueLanguage,
    narration: audio.narrationEnabled ? "Enabled" : "Disabled",
    dialogue: audio.dialogueEnabled ? "Enabled" : "Disabled",
    music: audio.musicEnabled ? audio.musicRules.join(" · ") || "Enabled" : "Disabled",
    subtitles: audio.subtitlesEnabled ? "Enabled" : "Disabled",
    voices: audio.voiceProfiles.map((profile) => `${profile.characterId}: ${profile.id} ${profile.voiceDescription}`).join("\n"),
    ambience: audio.ambientSounds.map((sound) => `${sound.identityKey}: ${sound.description}`).join("\n"),
  };
};

export const updateVoiceProfile = (project: MovieProject, input: Partial<CharacterVoiceProfile> & { characterId: string }) => {
  const character = project.production.characters.find((item) => item.id === input.characterId || item.storyCandidateId === input.characterId);
  if (!character) throw new Error(`Character ${input.characterId} was not found.`);
  const audio = project.memory.productionMemory.audioBible;
  const existing = audio.voiceProfiles.find((item) => item.characterId === character.id);
  const createdAt = existing?.createdAt ?? now();
  const profile: CharacterVoiceProfile = {
    id: existing?.id ?? `VOICE_${safeId(character.id)}`,
    characterId: character.id,
    voiceDescription: input.voiceDescription ?? existing?.voiceDescription ?? "User-defined character voice",
    language: input.language ?? existing?.language ?? project.dialogueLanguage,
    accent: input.accent ?? existing?.accent ?? "User-defined accent",
    ageImpression: input.ageImpression ?? existing?.ageImpression ?? character.ageRange ?? "Character-appropriate",
    pitch: input.pitch ?? existing?.pitch ?? "Natural",
    tone: input.tone ?? existing?.tone ?? "Story-appropriate",
    speakingSpeed: input.speakingSpeed ?? existing?.speakingSpeed ?? "Measured",
    emotionRange: input.emotionRange ?? existing?.emotionRange ?? ["Story-defined emotional range"],
    deliveryStyle: input.deliveryStyle ?? existing?.deliveryStyle ?? "Natural performance",
    pronunciationRules: input.pronunciationRules ?? existing?.pronunciationRules ?? [],
    volumeTendencies: input.volumeTendencies ?? existing?.volumeTendencies ?? "Natural dynamics",
    status: input.status ?? existing?.status ?? "DRAFT",
    version: existing ? existing.version + 1 : 1,
    createdAt,
    updatedAt: now(),
  };
  if (existing) Object.assign(existing, profile); else audio.voiceProfiles.push(profile);
  audio.version += 1;
  audio.updatedAt = now();
  audio.history.push({ version: audio.version, changedFields: [`voiceProfiles.${character.id}`], reason: "Voice profile updated without changing the permanent character identity.", createdAt: audio.updatedAt });
  syncLegacyAudio(project);
  project.memory.productionMemory.updatedAt = audio.updatedAt;
  return profile;
};

export const updateAudioBible = (project: MovieProject, input: {
  settings?: Partial<Pick<ProductionAudioBible, "filmLanguage" | "dialogueLanguage" | "narrationEnabled" | "dialogueEnabled" | "musicEnabled" | "subtitlesEnabled">>;
  musicRules?: string[];
  intentionalSilenceRules?: string[];
  ambientSounds?: RecurringAudioIdentity[];
  soundEffects?: RecurringAudioIdentity[];
  narrator?: ProductionAudioBible["narrator"];
  status?: ProductionAudioBible["status"];
  reason?: string;
}) => {
  const audio = project.memory.productionMemory.audioBible;
  const changed: string[] = [];
  for (const [key, value] of Object.entries(input.settings ?? {})) {
    (audio as unknown as Record<string, unknown>)[key] = value;
    changed.push(key);
  }
  for (const key of ["musicRules", "intentionalSilenceRules", "ambientSounds", "soundEffects", "narrator"] as const) {
    if (input[key] === undefined) continue;
    (audio as unknown as Record<string, unknown>)[key] = clone(input[key]);
    changed.push(key);
  }
  if (input.status) { audio.status = input.status; changed.push("status"); }
  audio.version += 1;
  audio.updatedAt = now();
  audio.history.push({ version: audio.version, changedFields: changed, reason: input.reason ?? "Audio Bible updated by user.", createdAt: audio.updatedAt });
  syncLegacyAudio(project);
  project.memory.productionMemory.updatedAt = audio.updatedAt;
  return audio;
};
