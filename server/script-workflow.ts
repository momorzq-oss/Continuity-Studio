import { randomUUID } from "node:crypto";
import type {
  MovieProject,
  ProductionScriptScene,
  ProductionScriptState,
  ScriptChangeProposal,
  ScriptDialogueLine,
  ScriptProductionSequence,
  ScriptShot,
  ScriptShotType,
  ScriptVersionRecord,
  SequencesArtifact,
  StoryArtifact,
} from "../src/types.js";

const now = () => new Date().toISOString();
const pad = (value: number) => String(value).padStart(2, "0");
const sequenceNumber = (value: string) => Number(value.match(/(\d+)/)?.[1] ?? 0);
const sequenceId = (number: number) => `SEQ_${pad(number)}`;
const clock = (seconds: number) => `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
const timeRange = (start: number, end: number) => `${clock(start)}–${clock(end)}`;
const clone = <T>(value: T): T => structuredClone(value);

const emptySourceManifest = () => ({
  storyVersion: 0,
  filmBibleVersion: 0,
  movieDnaVersion: 0,
  continuityVersion: 0,
  audioBibleVersion: 0,
  storyTimelineEventIds: [],
  continuitySnapshotIds: [],
  characterIds: [],
  characterStateIds: [],
  assetIds: [],
  voiceProfileIds: [],
  runtimeSeconds: 0,
  sequenceDurationSeconds: 0,
});

export const createProductionScriptState = (projectId = "UNASSIGNED"): ProductionScriptState => {
  const createdAt = now();
  return {
    scriptId: `SCRIPT_${projectId}`,
    projectId,
    storyVersion: 0,
    filmBibleVersion: 0,
    movieDnaVersion: 0,
    continuityVersion: 0,
    audioBibleVersion: 0,
    scriptVersion: 0,
    status: "EMPTY",
    sourceManifest: emptySourceManifest(),
    scenes: [],
    sequences: [],
    dialogue: [],
    shots: [],
    versions: [],
    continuityDecisions: [],
    history: [],
    createdAt,
    updatedAt: createdAt,
  };
};

export const normalizeProductionScriptState = (project: MovieProject, input?: Partial<ProductionScriptState>): ProductionScriptState => {
  const base = createProductionScriptState(project.id);
  if (!input) return base;
  const state: ProductionScriptState = {
    ...base,
    ...input,
    scriptId: input.scriptId || `SCRIPT_${project.id}`,
    projectId: project.id,
    scenes: Array.isArray(input.scenes) ? input.scenes : [],
    sequences: Array.isArray(input.sequences) ? input.sequences : [],
    dialogue: Array.isArray(input.dialogue) ? input.dialogue : [],
    shots: Array.isArray(input.shots) ? input.shots : [],
    sourceManifest: { ...emptySourceManifest(), ...(input.sourceManifest ?? {}) },
    versions: Array.isArray(input.versions) ? input.versions : [],
    continuityDecisions: Array.isArray(input.continuityDecisions) ? input.continuityDecisions : [],
    history: Array.isArray(input.history) ? input.history : [],
  };
  state.dialogue.forEach((line) => {
    line.approvalState ??= "DRAFT";
    line.lockState ??= "UNLOCKED";
    line.pronunciation ??= [];
    line.createdAt ??= state.createdAt;
    line.updatedAt ??= state.updatedAt;
  });
  state.shots.forEach((shot) => {
    shot.continuityState ??= {
      characterPosition: shot.startVisualState || "Continue the established character position.",
      characterFacing: "Preserve the established facing.",
      screenDirection: "Preserve the established screen direction.",
      movementDirection: "Continue motivated movement only.",
      props: "Preserve the linked prop state.",
      costume: "Preserve the linked Character State costume.",
      injury: "Preserve the linked Character State injuries.",
      environment: shot.locationId || "Preserve the established environment.",
      lighting: shot.lighting,
      cameraRelationship: `${shot.framing}; ${shot.cameraAngle}; ${shot.focalLength}`,
    };
  });
  return state;
};

const storyVersion = (project: MovieProject) => project.production.story.approvedVersion ?? project.production.story.lockedVersion ?? project.production.story.version;
const filmBibleVersion = (project: MovieProject) => project.production.filmBible.approvedVersion ?? project.production.filmBible.lockedVersion ?? project.production.filmBible.version;
const continuityVersion = (project: MovieProject) => Math.max(0, ...project.memory.productionMemory.continuity.snapshots.map((snapshot) => snapshot.version));

const snapshotFor = (project: MovieProject, number: number, anchor: "START" | "MID" | "END") => {
  const snapshots = project.memory.productionMemory.continuity.snapshots;
  if (anchor === "START" && number > 1) {
    const previous = snapshots
      .filter((snapshot) => sequenceNumber(snapshot.sequenceId) === number - 1 && snapshot.anchor === "END" && ["APPROVED", "LOCKED"].includes(snapshot.status))
      .sort((a, b) => b.version - a.version)[0];
    if (previous) return previous;
  }
  return snapshots
    .filter((snapshot) => sequenceNumber(snapshot.sequenceId) === number && snapshot.anchor === anchor)
    .sort((a, b) => Number(["APPROVED", "LOCKED"].includes(b.status)) - Number(["APPROVED", "LOCKED"].includes(a.status)) || b.version - a.version)[0];
};

const stateSummary = (project: MovieProject, number: number, anchor: "START" | "MID" | "END") => {
  const snapshot = snapshotFor(project, number, anchor);
  if (!snapshot) return `${anchor} state is waiting for the Continuity Ledger.`;
  const characterIds = new Set(project.production.characters.map((character) => character.id));
  const important = snapshot.entities
    .filter((entity) => characterIds.has(entity.entityId) || entity.entityType === "prop" || entity.entityType === "vehicle")
    .slice(0, 8)
    .map((entity) => {
      const carried = entity.propsCarried.length ? ` carries ${entity.propsCarried.join(", ")}` : " carries no props";
      const disposition = [entity.dropped ? "dropped" : "", entity.lost ? "lost" : ""].filter(Boolean).join(" and ");
      return `${entity.entityId}: ${entity.location}; ${entity.condition}; ${entity.clothing};${carried}${disposition ? ` ${disposition}` : ""}`;
    });
  return `${snapshot.global.timeOfDay}; ${snapshot.global.weather}; ${snapshot.global.lighting}. ${important.join(" | ")}`;
};

const locationName = (project: MovieProject, id: string) => project.production.assets.find((asset) => asset.id === id)?.name
  ?? project.production.story.locations.find((location) => location.id === id)?.name
  ?? id.replace(/[_-]+/g, " ");

const characterForStoryId = (project: MovieProject, id: string) => project.production.characters.find((character) => character.id === id || character.storyCandidateId === id);

const charactersForSequence = (project: MovieProject, number: number, ids: string[]) => {
  const normalized = ids.map((id) => characterForStoryId(project, id)?.id ?? id);
  project.production.characters
    .filter((character) => character.relatedSequenceIds.some((id) => sequenceNumber(id) === number))
    .forEach((character) => normalized.push(character.id));
  return [...new Set(normalized)].filter((id) => project.production.characters.some((character) => character.id === id));
};

const stateIdsFor = (project: MovieProject, number: number, characterIds: string[]) => characterIds.flatMap((id) => {
  const character = project.production.characters.find((item) => item.id === id);
  const state = character?.states.find((item) => sequenceNumber(item.sequenceId) === number);
  return state ? [state.id] : [];
});

const assetsForSequence = (project: MovieProject, number: number, storyIds: string[], characterIds: string[], locationId: string, beatIds: string[]) => {
  const ids = new Set(storyIds.filter((id) => {
    const asset = project.production.assets.find((item) => item.id === id);
    return asset?.category !== "character_state" || (asset.sequenceIds.some((sequence) => sequenceNumber(sequence) === number) && Boolean(asset.characterId && characterIds.includes(asset.characterId)));
  }));
  project.production.assets.forEach((asset) => {
    if (asset.category === "character_state") {
      if (asset.sequenceIds.some((id) => sequenceNumber(id) === number) && Boolean(asset.characterId && characterIds.includes(asset.characterId))) ids.add(asset.id);
      return;
    }
    if (asset.id === locationId) ids.add(asset.id);
    if (asset.characterId && characterIds.includes(asset.characterId)) ids.add(asset.id);
    if (asset.sequenceIds.some((id) => sequenceNumber(id) === number)) ids.add(asset.id);
    if (asset.relatedBeatIds?.some((id) => beatIds.includes(id))) ids.add(asset.id);
  });
  return [...ids].filter((id) => project.production.assets.some((asset) => asset.id === id));
};

const resolvedAsset = (project: MovieProject, id: string) => {
  const asset = project.production.assets.find((item) => item.id === id);
  if (!asset) return false;
  return ["APPROVED", "LOCKED"].includes(asset.status) || asset.missingDecision?.action === "IGNORE";
};

const dialogueSeed = (project: MovieProject, number: number, purpose: string) => {
  const artifact = project.artifacts.story as StoryArtifact | undefined;
  const excerpt = artifact?.dialogueExcerpt?.trim();
  if (number === 1 && excerpt && !/no dialogue|dialogue remains controlled|structured script|later structured/i.test(excerpt)) return excerpt.replace(/^[-–—\s]+/, "").split(/\r?\n/)[0]!.slice(0, 500);
  const language = project.memory.productionMemory.audioBible.dialogueLanguage || project.dialogueLanguage;
  if (/arab/i.test(language)) {
    const lines = ["لازم نمشي الحين.", "في شي غلط هنا.", "سمعت الصوت؟", "لا تلتفت وراك.", "وين اختفى الطريق؟"];
    return lines[(number - 1) % lines.length]!;
  }
  const clauses = purpose.replace(/[.!?]+$/g, "").split(/[,;:]/)[0]?.trim();
  return clauses && clauses.length <= 72 ? `${clauses}.` : "Something here is wrong.";
};

const dialogueTimingWarning = (line: ScriptDialogueLine) => {
  const words = line.exactDialogue.trim().split(/\s+/).filter(Boolean).length;
  const estimated = Math.max(1, words / 2.4);
  const available = Math.max(0, line.timing.endSeconds - line.timing.startSeconds);
  line.timingWarning = estimated > available + 0.25
    ? `TIMING WARNING · approximately ${estimated.toFixed(1)}s of speech in a ${available.toFixed(1)}s window.`
    : undefined;
};

const dialogueForSequence = (project: MovieProject, version: number, number: number, sceneId: string, characterIds: string[], purpose: string, previous: ScriptDialogueLine[]) => {
  if (!project.dialogueEnabled || !project.memory.productionMemory.audioBible.dialogueEnabled || !characterIds.length) return [];
  const speaker = characterIds[0]!;
  const locked = previous.find((line) => sequenceNumber(line.sequenceId) === number && line.speakerCharacterId === speaker && line.lockState === "LOCKED");
  if (locked) return [{ ...clone(locked), sequenceId: sequenceId(number), sceneId, sourceScriptVersion: version, updatedAt: now() }];
  const voice = project.memory.productionMemory.audioBible.voiceProfiles.find((profile) => profile.characterId === speaker);
  const createdAt = now();
  const line: ScriptDialogueLine = {
    id: `DLG_${pad(number)}_01`,
    sequenceId: sequenceId(number),
    sceneId,
    speakerCharacterId: speaker,
    exactDialogue: dialogueSeed(project, number, purpose),
    language: project.memory.productionMemory.audioBible.dialogueLanguage || project.dialogueLanguage,
    accent: voice?.accent || "Project-defined accent",
    emotion: characterForStoryId(project, speaker)?.states.find((state) => sequenceNumber(state.sequenceId) === number)?.emotional || "Story-matched",
    delivery: voice?.deliveryStyle || "Natural dramatic delivery",
    pronunciation: [...(voice?.pronunciationRules ?? [])],
    volume: voice?.volumeTendencies || "Natural conversational level",
    timing: { startSeconds: Math.min(8, Math.max(1, project.sequenceDurationSeconds - 4)), endSeconds: Math.min(12, project.sequenceDurationSeconds - 1), label: "" },
    approvalState: "DRAFT",
    lockState: "UNLOCKED",
    sourceScriptVersion: version,
    audioVoiceProfileId: voice?.id,
    createdAt,
    updatedAt: createdAt,
  };
  line.timing.label = timeRange(line.timing.startSeconds, line.timing.endSeconds);
  dialogueTimingWarning(line);
  return [line];
};

const movieDnaValue = (project: MovieProject, key: string, fallback: string) => project.production.movieDna.selections[key]?.label || fallback;

const createShots = (project: MovieProject, sequence: ScriptProductionSequence, scene: ProductionScriptScene, dialogue: ScriptDialogueLine[]) => {
  const preferredMovement = movieDnaValue(project, "cameraMovement", "Motivated movement");
  const preferredFraming = movieDnaValue(project, "framing", "Story-motivated framing");
  const preferredLens = `${movieDnaValue(project, "cameraSystem", "Cinema camera")} · ${movieDnaValue(project, "lensStyle", "Cinematic lens family")}`;
  const preferredDepth = movieDnaValue(project, "depthOfField", "Moderate environment readability");
  const preferredFocal = movieDnaValue(project, "focalLength", "40mm");
  const focalBase = Number(preferredFocal.match(/(\d+)\s*mm/i)?.[1] ?? 40);
  const focalPalette = [Math.max(14, Math.round(focalBase * 0.75)), focalBase, Math.round(focalBase * 1.25), Math.round(focalBase * 1.65)].map((value) => `${value}mm`);
  const ratios = [0.2, 0.25, 0.25];
  const durations = ratios.map((ratio) => Math.max(1, Math.floor(sequence.durationSeconds * ratio)));
  durations.push(sequence.durationSeconds - durations.reduce((total, value) => total + value, 0));
  const definitions: Array<{ type: ScriptShotType; framing: string; move: string; purpose: string }> = [
    { type: "Establishing", framing: `Wide geography guided by ${preferredFraming}`, move: `Static or measured Dolly within ${preferredMovement}`, purpose: "Establish location, participants, and entering state." },
    { type: "Medium", framing: `Character and environment guided by ${preferredFraming}`, move: `Tracking within ${preferredMovement}`, purpose: "Play the central action and body movement." },
    { type: "Reaction", framing: `Close reaction guided by ${preferredFraming}`, move: `Push In within ${preferredMovement}`, purpose: "Show the emotional and knowledge transition." },
    { type: "Insert", framing: "Continuity detail or ending frame", move: "Settle and hold", purpose: "Establish the exact transferable ending state." },
  ];
  let cursor = 0;
  return definitions.map((definition, index): ScriptShot => {
    const durationSeconds = durations[index]!;
    const startSeconds = cursor;
    cursor += durationSeconds;
    const shotDialogue = dialogue.filter((line) => line.timing.startSeconds < cursor && line.timing.endSeconds > startSeconds).map((line) => line.id);
    const createdAt = now();
    return {
      id: `SHOT_${pad(sequence.number)}_${pad(index + 1)}`,
      sequenceId: sequence.id,
      number: index + 1,
      durationSeconds,
      startSeconds,
      endSeconds: cursor,
      shotType: definition.type,
      framing: definition.framing,
      cameraAngle: index === 2 ? "Eye level close perspective" : "Story-motivated eye level",
      cameraMovement: definition.move,
      lens: preferredLens,
      focalLength: focalPalette[index]!,
      depthOfField: index >= 2 ? `Shallow subject separation within ${preferredDepth}` : preferredDepth,
      subject: sequence.characterIds.map((id) => project.production.characters.find((character) => character.id === id)?.name ?? id).join(" / ") || locationName(project, sequence.locationId),
      subjectAction: index === 0 ? scene.action : definition.purpose,
      characterStateIds: [...sequence.characterStateIds],
      emotion: sequence.emotion,
      locationId: sequence.locationId,
      lighting: movieDnaValue(project, "lighting", project.memory.productionMemory.continuity.currentGlobal.lighting),
      assetIds: sequence.assetRequirements.map((requirement) => requirement.assetId),
      dialogueIds: shotDialogue,
      sound: scene.importantSound[index % Math.max(1, scene.importantSound.length)] ?? "Production ambience",
      storyPurpose: definition.purpose,
      continuityPurpose: index === definitions.length - 1 ? "Control the sequence End State for downstream continuity." : "Preserve position, screen direction, costume, props, injuries, and lighting from the prior shot.",
      transition: index === definitions.length - 1 ? scene.transition : "CONTINUE",
      startVisualState: index === 0 ? sequence.startState : `Continue visual state from SHOT_${pad(sequence.number)}_${pad(index)}.`,
      endVisualState: index === definitions.length - 1 ? sequence.endState : `Pass established state into SHOT_${pad(sequence.number)}_${pad(index + 2)}.`,
      continuityState: {
        characterPosition: index === 0 ? sequence.startState : "Continue the prior shot position without a spatial reset.",
        characterFacing: "Preserve established facing and eyeline.",
        screenDirection: "Preserve the established screen direction and action axis.",
        movementDirection: index === 0 ? "Enter from the established sequence geography." : "Continue the previous shot movement direction.",
        props: sequence.startState,
        costume: sequence.characterStateIds.length ? `Use ${sequence.characterStateIds.join(", ")}.` : "Use the permanent character costume state.",
        injury: sequence.characterStateIds.length ? `Use injury state from ${sequence.characterStateIds.join(", ")}.` : "Preserve the current injury state.",
        environment: `${sequence.locationId}; preserve weather and environmental condition.`,
        lighting: movieDnaValue(project, "lighting", project.memory.productionMemory.continuity.currentGlobal.lighting),
        cameraRelationship: `${definition.framing}; ${index === 2 ? "eye-level reaction relationship" : "story-motivated eye level"}; ${focalPalette[index]}.`,
      },
      controlsSequenceEndState: index === definitions.length - 1,
      createdAt,
      updatedAt: createdAt,
    };
  });
};

const recalculateShotTiming = (state: ProductionScriptState, sequence: ScriptProductionSequence) => {
  const shots = state.shots.filter((shot) => shot.sequenceId === sequence.id).sort((a, b) => a.number - b.number);
  let cursor = 0;
  shots.forEach((shot, index) => {
    shot.number = index + 1;
    shot.startSeconds = cursor;
    cursor += shot.durationSeconds;
    shot.endSeconds = cursor;
    shot.controlsSequenceEndState = index === shots.length - 1;
    shot.updatedAt = now();
  });
  sequence.shotIds = shots.map((shot) => shot.id);
  sequence.warnings = sequence.warnings.filter((warning) => !warning.startsWith("SHOT TIMING WARNING"));
  if (cursor !== sequence.durationSeconds) sequence.warnings.push(`SHOT TIMING WARNING · shots total ${cursor}s but sequence duration is ${sequence.durationSeconds}s.`);
};

const refreshSequence = (project: MovieProject, sequence: ScriptProductionSequence) => {
  const state = project.memory.productionMemory.script;
  recalculateShotTiming(state, sequence);
  const dialogue = state.dialogue.filter((line) => line.sequenceId === sequence.id);
  dialogue.forEach(dialogueTimingWarning);
  sequence.warnings = sequence.warnings.filter((warning) => !/^(DIALOGUE TIMING WARNING|MISSING REQUIRED ASSET|SCRIPT CONTINUITY WARNING|STORY SOURCE NOT APPROVED|FILM BIBLE SOURCE NOT APPROVED|SCRIPT CONTENT MISSING|SHOT PLAN MISSING|LOCATION MISSING|CHARACTER LINK MISSING|CHARACTER STATE MISSING|AUDIO IDENTITY MISSING|AUDIO CONFLICT)/.test(warning));
  dialogue.filter((line) => line.timingWarning).forEach((line) => sequence.warnings.push(`DIALOGUE TIMING WARNING · ${line.id}: ${line.timingWarning}`));
  sequence.assetRequirements.forEach((requirement) => {
    requirement.resolved = resolvedAsset(project, requirement.assetId);
    if (requirement.required && !requirement.resolved) sequence.warnings.push(`MISSING REQUIRED ASSET · ${requirement.assetId}`);
  });
  const hasState = Boolean(snapshotFor(project, sequence.number, "START"));
  if (!hasState && !sequence.warnings.includes("CONTINUITY STATE MISSING")) sequence.warnings.push("CONTINUITY STATE MISSING");
  else if (hasState) sequence.warnings = sequence.warnings.filter((warning) => warning !== "CONTINUITY STATE MISSING");
  if (!project.production.story.approvedVersion && !project.production.story.lockedVersion) sequence.warnings.push("STORY SOURCE NOT APPROVED");
  if (!project.production.filmBible.approvedVersion && !project.production.filmBible.lockedVersion) sequence.warnings.push("FILM BIBLE SOURCE NOT APPROVED");
  const scenes = state.scenes.filter((scene) => scene.sequenceId === sequence.id);
  if (!scenes.length || scenes.every((scene) => !scene.action.trim())) sequence.warnings.push("SCRIPT CONTENT MISSING");
  const shots = state.shots.filter((shot) => shot.sequenceId === sequence.id);
  if (!shots.length) sequence.warnings.push("SHOT PLAN MISSING");
  if (!sequence.locationId || sequence.locationId === "UNASSIGNED") sequence.warnings.push("LOCATION MISSING");
  const missingCharacter = sequence.characterIds.find((id) => !project.production.characters.some((character) => character.id === id));
  if (missingCharacter) sequence.warnings.push(`CHARACTER LINK MISSING · ${missingCharacter}`);
  const missingState = sequence.characterIds.find((id) => !sequence.characterStateIds.some((stateId) => project.production.characters.find((character) => character.id === id)?.states.some((characterState) => characterState.id === stateId)));
  if (missingState) sequence.warnings.push(`CHARACTER STATE MISSING · ${missingState}`);
  dialogue.filter((line) => !line.audioVoiceProfileId || !project.memory.productionMemory.audioBible.voiceProfiles.some((profile) => profile.id === line.audioVoiceProfileId && profile.characterId === line.speakerCharacterId)).forEach((line) => sequence.warnings.push(`AUDIO IDENTITY MISSING · ${line.id}`));
  if (!project.musicEnabled && sequence.audioRequirements.some((rule) => /music/i.test(rule) && !/no music/i.test(rule))) sequence.warnings.push("AUDIO CONFLICT · Project Setup disables music.");
  if (!project.narrationEnabled && sequence.audioRequirements.some((rule) => /narrat/i.test(rule) && !/no narration/i.test(rule))) sequence.warnings.push("AUDIO CONFLICT · Project Setup disables narration.");
  const inheritedNoKnife = /carries no props|knife[^.|]*\b(?:dropped|lost)\b|\b(?:dropped|lost)\b[^.|]*knife/i.test(sequence.startState);
  const scriptRestoresKnife = scenes.some((scene) => /\b(?:carries|carrying|holds|holding|has|grabs|takes|draws|wields)\b[^.!?]{0,45}\bknife\b/i.test(scene.action));
  if (inheritedNoKnife && scriptRestoresKnife) sequence.warnings.push(`SCRIPT CONTINUITY WARNING · Script restores the knife, but ${sequence.id} enters with no knife from the approved prior state.`);
  const blocking = sequence.warnings.some((warning) => /MISSING REQUIRED ASSET|TIMING WARNING|CONTINUITY STATE MISSING|SOURCE NOT APPROVED|CONTENT MISSING|PLAN MISSING|LOCATION MISSING|LINK MISSING|STATE MISSING|AUDIO IDENTITY MISSING|AUDIO CONFLICT|SCRIPT CONTINUITY WARNING/.test(warning));
  if (!["APPROVED", "LOCKED", "GENERATED", "REJECTED"].includes(sequence.status)) sequence.status = blocking ? "BLOCKED" : "READY";
  sequence.updatedAt = now();
};

export const refreshScriptReadiness = (project: MovieProject) => {
  const script = project.memory.productionMemory.script;
  script.sequences.forEach((sequence) => refreshSequence(project, sequence));
  script.updatedAt = now();
  project.memory.productionMemory.updatedAt = script.updatedAt;
  syncLegacySequences(project);
  return script;
};

const versionSnapshot = (state: ProductionScriptState, reason: string): ScriptVersionRecord => ({
  version: state.scriptVersion,
  status: state.status,
  scenes: clone(state.scenes),
  sequences: clone(state.sequences),
  dialogue: clone(state.dialogue),
  shots: clone(state.shots),
  sourceStoryVersion: state.storyVersion,
  sourceFilmBibleVersion: state.filmBibleVersion,
  sourceMovieDnaVersion: state.movieDnaVersion,
  sourceContinuityVersion: state.continuityVersion,
  sourceAudioBibleVersion: state.audioBibleVersion,
  approved: state.status === "APPROVED" || state.status === "LOCKED",
  locked: state.status === "LOCKED",
  reason,
  createdAt: now(),
  approvedAt: state.approvedAt,
  lockedAt: state.lockedAt,
});

const captureVersion = (state: ProductionScriptState, reason: string) => {
  if (!state.scriptVersion) return;
  const snapshot = versionSnapshot(state, reason);
  const index = state.versions.findIndex((version) => version.version === snapshot.version);
  if (index >= 0) state.versions[index] = snapshot;
  else state.versions.push(snapshot);
};

const ensureEditableVersion = (state: ProductionScriptState, reason: string) => {
  if (["APPROVED", "LOCKED"].includes(state.status)) {
    captureVersion(state, `Preserved before edit: ${reason}`);
    state.scriptVersion += 1;
    state.status = "EDITED";
    state.approvedAt = undefined;
    state.lockedAt = undefined;
    state.dialogue.forEach((line) => { line.sourceScriptVersion = state.scriptVersion; });
  } else if (state.status === "EMPTY") throw new Error("Generate Full Script v2 before editing it.");
  else state.status = "EDITED";
};

const setGate = (project: MovieProject, stage: MovieProject["production"]["gates"][number]["stage"], status: MovieProject["production"]["gates"][number]["status"], note: string) => {
  const gate = project.production.gates.find((item) => item.stage === stage);
  if (gate) Object.assign(gate, { status, note, updatedAt: now() });
};

export const generateProductionScript = (project: MovieProject, reason = "Generated from approved production sources") => {
  if (!project.production.story.approvedVersion && !project.production.story.lockedVersion) throw new Error("Approve Story v2 before generating Full Script v2.");
  if (!project.production.filmBible.approvedVersion && !project.production.filmBible.lockedVersion) throw new Error("Approve the Film Bible before generating Full Script v2.");
  if (project.production.movieDna.status !== "LOCKED") throw new Error("Lock Movie DNA before generating Full Script v2.");
  if (project.memory.productionMemory.storyTimeline.status !== "READY") throw new Error("Build the Story Timeline and Continuity Ledger before generating Full Script v2.");

  const previous = project.memory.productionMemory.script;
  captureVersion(previous, "Preserved before generating a new script version.");
  const version = Math.max(1, previous.scriptVersion + 1);
  const createdAt = previous.createdAt || now();
  const generatedAt = now();
  const state: ProductionScriptState = {
    ...createProductionScriptState(project.id),
    scriptId: previous.scriptId || `SCRIPT_${project.id}`,
    projectId: project.id,
    storyVersion: storyVersion(project),
    filmBibleVersion: filmBibleVersion(project),
    movieDnaVersion: project.production.movieDna.version,
    continuityVersion: continuityVersion(project),
    audioBibleVersion: project.memory.productionMemory.audioBible.version,
    scriptVersion: version,
    status: "GENERATED",
    sourceManifest: {
      storyVersion: storyVersion(project),
      filmBibleVersion: filmBibleVersion(project),
      movieDnaVersion: project.production.movieDna.version,
      continuityVersion: continuityVersion(project),
      audioBibleVersion: project.memory.productionMemory.audioBible.version,
      storyTimelineEventIds: project.memory.productionMemory.storyTimeline.events.map((event) => event.id),
      continuitySnapshotIds: project.memory.productionMemory.continuity.snapshots.map((snapshot) => snapshot.id),
      characterIds: project.production.characters.map((character) => character.id),
      characterStateIds: project.production.characters.flatMap((character) => character.states.map((state) => state.id)),
      assetIds: project.production.assets.map((asset) => asset.id),
      voiceProfileIds: project.memory.productionMemory.audioBible.voiceProfiles.map((profile) => profile.id),
      runtimeSeconds: Math.round(project.runtimeMinutes * 60),
      sequenceDurationSeconds: project.sequenceDurationSeconds,
    },
    scenes: [], sequences: [], dialogue: [], shots: [],
    versions: [...previous.versions],
    continuityDecisions: [...previous.continuityDecisions],
    history: [...previous.history],
    createdAt,
    updatedAt: generatedAt,
  };

  const breakdown = project.production.story.sequenceBreakdown;
  const timeline = project.memory.productionMemory.storyTimeline.events;
  const targetCount = Math.max(1, project.sequenceCount || Math.ceil((project.runtimeMinutes * 60) / project.sequenceDurationSeconds));
  let cursor = 0;
  for (let index = 0; index < targetCount; index += 1) {
    const number = index + 1;
    const id = sequenceId(number);
    const source = breakdown.find((entry) => entry.sequenceNumber === number);
    const timelineEvent = timeline.find((event) => sequenceNumber(event.sequenceId ?? "") === number);
    const durationSeconds = index === targetCount - 1 ? Math.round(project.runtimeMinutes * 60) - cursor : project.sequenceDurationSeconds;
    const startSeconds = cursor;
    cursor += durationSeconds;
    const characterIds = charactersForSequence(project, number, source?.characterIds ?? timelineEvent?.characterIds ?? []);
    const characterStateIds = stateIdsFor(project, number, characterIds);
    const locationId = source?.locationId ?? timelineEvent?.locationId ?? "UNASSIGNED";
    const storyPurpose = source?.storyPurpose ?? timelineEvent?.storyConsequence ?? `Advance approved Story event ${number}.`;
    const storyBeat = source?.events.join(" · ") || timelineEvent?.storyBeat || storyPurpose;
    const beatIds = source?.relatedBeatIds ?? timelineEvent?.sourceBeatIds ?? [];
    const assetIds = assetsForSequence(project, number, source?.importantAssetIds ?? timelineEvent?.propIds ?? [], characterIds, locationId, beatIds);
    const audio = project.memory.productionMemory.audioBible;
    const title = timelineEvent?.scene?.slice(0, 80) || storyPurpose.slice(0, 80) || `Sequence ${pad(number)}`;
    const scriptSequence: ScriptProductionSequence = {
      id, number, title, startSeconds, endSeconds: cursor, timeRange: timeRange(startSeconds, cursor), durationSeconds,
      storyPurpose, storyBeat, sceneIds: [`SCENE_${pad(number)}`], characterIds, characterStateIds, locationId,
      emotion: source?.emotion ?? (characterIds.map((characterId) => project.production.characters.find((character) => character.id === characterId)?.states.find((characterState) => sequenceNumber(characterState.sequenceId) === number)?.emotional).filter(Boolean).join(" / ") || "Story-matched emotion"),
      conflict: source?.conflict ?? "Approved Story pressure changes objective, knowledge, emotion, or physical state.",
      actions: [...new Set([...(timelineEvent?.importantActions ?? []), storyPurpose])],
      dialogueIds: [], shotIds: [],
      assetRequirements: assetIds.map((assetId) => ({ assetId, required: project.production.assets.find((asset) => asset.id === assetId)?.required !== false, resolved: resolvedAsset(project, assetId), reason: project.production.assets.find((asset) => asset.id === assetId)?.storyPurpose ?? "Required by script, character, location, or Story event." })),
      startState: stateSummary(project, number, "START"),
      midState: stateSummary(project, number, "MID"),
      endState: source?.requiredEndingCondition ?? stateSummary(project, number, "END"),
      continuityRequirements: ["Preserve permanent character identity and assigned Character State.", "Preserve position, screen direction, costume, injuries, props, weather, lighting, and damage between shots.", ...(project.memory.productionMemory.continuity.warnings.filter((warning) => sequenceNumber(warning.currentSequenceId) === number && warning.status === "OPEN").map((warning) => `${warning.code}: expected ${warning.expected}; conflicting ${warning.conflicting}; source ${warning.sourceSequenceId}.`))],
      audioRequirements: [
        audio.narrationEnabled ? `Narration uses ${audio.narrator?.id ?? "the approved narrator profile"}.` : "No narration.",
        audio.dialogueEnabled ? `Dialogue uses ${audio.dialogueLanguage} and permanent character voice profiles.` : "No spoken dialogue.",
        audio.musicEnabled ? audio.musicRules.join(" ") || "Use approved music rules." : "No music.",
        ...audio.intentionalSilenceRules,
      ],
      negativeRules: [...new Set(["No duplicate characters", "No face changes", "No extra people", "No costume changes", "No missing props", "No modern objects", ...(project.subtitlesEnabled ? [] : ["No subtitles"]), ...(project.musicEnabled ? [] : ["No music"]), ...project.production.permanentNegativeRules])],
      status: "SCRIPTED", approvalState: "DRAFT", lockState: "UNLOCKED", warnings: [],
      previousSequenceId: number > 1 ? sequenceId(number - 1) : undefined,
      nextSequenceId: number < targetCount ? sequenceId(number + 1) : undefined,
      sourceScriptVersion: version, createdAt: generatedAt, updatedAt: generatedAt,
    };
    const sceneId = scriptSequence.sceneIds[0]!;
    const dialogue = dialogueForSequence(project, version, number, sceneId, characterIds, storyPurpose, previous.dialogue);
    scriptSequence.dialogueIds = dialogue.map((line) => line.id);
    const scene: ProductionScriptScene = {
      id: sceneId, number, sequenceId: id,
      heading: `EXT. ${locationName(project, locationId).toUpperCase()} — ${(timelineEvent?.timeOfDay ?? project.memory.productionMemory.continuity.currentGlobal.timeOfDay ?? "STORY TIME").toUpperCase()}`,
      locationId,
      timeOfDay: timelineEvent?.timeOfDay ?? project.memory.productionMemory.continuity.currentGlobal.timeOfDay,
      action: scriptSequence.actions.join(" "),
      characterIds,
      dialogueIds: dialogue.map((line) => line.id),
      shotIds: [],
      performanceNotes: characterIds.map((characterId) => {
        const character = project.production.characters.find((item) => item.id === characterId);
        const characterState = character?.states.find((item) => sequenceNumber(item.sequenceId) === number);
        return `${character?.name ?? characterId}: ${characterState?.emotional ?? "story-matched emotion"}; motivation ${character?.motivation ?? "approved Story objective"}.`;
      }),
      transition: number === targetCount ? "FADE OUT" : "CUT TO",
      importantSound: [...audio.ambientSounds.map((sound) => sound.name), ...audio.soundEffects.filter((sound) => !sound.sourceEntityId || characterIds.includes(sound.sourceEntityId)).map((sound) => sound.name), ...(audio.intentionalSilenceRules.length ? [audio.intentionalSilenceRules[0]!] : [])].slice(0, 4),
      importantVisualActions: [...scriptSequence.actions], assetIds,
      sourceStoryEventIds: timelineEvent?.sourceEventIds ?? source?.events ?? [],
      updatedAt: generatedAt,
    };
    const shots = createShots(project, scriptSequence, scene, dialogue);
    scene.shotIds = shots.map((shot) => shot.id);
    scriptSequence.shotIds = [...scene.shotIds];
    state.scenes.push(scene);
    state.sequences.push(scriptSequence);
    state.dialogue.push(...dialogue);
    state.shots.push(...shots);
  }
  state.history.push({ id: randomUUID(), version, action: "GENERATED", scopeIds: state.sequences.map((sequence) => sequence.id), reason, createdAt: generatedAt });
  project.memory.productionMemory.script = state;
  refreshScriptReadiness(project);
  setGate(project, "sequences", "REVIEW", `Full Script v${pad(version)}, dialogue, shots, and ${state.sequences.length} formal sequences generated from approved production memory.`);
  project.production.currentStage = "sequences";
  project.status = "awaiting_approval";
  return state;
};

export const approveProductionScript = (project: MovieProject, lock = false) => {
  const state = project.memory.productionMemory.script;
  if (!state.scriptVersion) throw new Error("Generate Full Script v2 before approving it.");
  state.status = lock ? "LOCKED" : "APPROVED";
  state.approvedAt = now();
  if (lock) state.lockedAt = state.approvedAt;
  state.updatedAt = state.approvedAt;
  captureVersion(state, lock ? "Script version locked." : "Script version approved.");
  state.history.push({ id: randomUUID(), version: state.scriptVersion, action: lock ? "LOCKED" : "APPROVED", scopeIds: state.sequences.map((sequence) => sequence.id), reason: lock ? "Locked script protection enabled." : "Explicit user approval.", createdAt: state.updatedAt });
  return state;
};

export const setScriptSequenceApproval = (project: MovieProject, sequenceIdValue: string, action: "APPROVE" | "LOCK" | "REJECT", reason?: string) => {
  const state = project.memory.productionMemory.script;
  const sequence = state.sequences.find((item) => item.id === sequenceIdValue);
  if (!sequence) throw new Error(`Sequence ${sequenceIdValue} was not found.`);
  refreshSequence(project, sequence);
  if (action !== "REJECT" && sequence.status === "BLOCKED") throw new Error(`Resolve the blocking sequence warnings before ${action.toLowerCase()}: ${sequence.warnings.join("; ")}`);
  if (action === "APPROVE") {
    sequence.approvalState = "APPROVED";
    sequence.lockState = "UNLOCKED";
    sequence.status = "APPROVED";
  } else if (action === "LOCK") {
    sequence.approvalState = "APPROVED";
    sequence.lockState = "LOCKED";
    sequence.status = "LOCKED";
  } else {
    sequence.approvalState = "DRAFT";
    sequence.lockState = "UNLOCKED";
    sequence.status = "REJECTED";
    if (reason) sequence.warnings.push(`REJECTED · ${reason}`);
  }
  sequence.updatedAt = now();
  state.history.push({ id: randomUUID(), version: state.scriptVersion, action: `SEQUENCE_${action}`, scopeIds: [sequence.id, ...sequence.shotIds, ...sequence.dialogueIds], reason: reason || `Explicit formal sequence ${action.toLowerCase()} action.`, createdAt: sequence.updatedAt });
  state.updatedAt = sequence.updatedAt;
  syncLegacySequences(project);
  return sequence;
};

export const updateScriptScene = (project: MovieProject, sceneId: string, changes: Partial<Pick<ProductionScriptScene, "heading" | "action" | "performanceNotes" | "transition" | "importantSound" | "importantVisualActions">>, reason: string) => {
  const state = project.memory.productionMemory.script;
  const scene = state.scenes.find((item) => item.id === sceneId);
  if (!scene) throw new Error(`Script scene ${sceneId} was not found.`);
  ensureEditableVersion(state, reason);
  Object.assign(scene, changes, { updatedAt: now() });
  const sequence = state.sequences.find((item) => item.id === scene.sequenceId);
  if (sequence) {
    sequence.actions = [scene.action];
    sequence.status = "SCRIPTED";
    sequence.approvalState = "REVIEW";
    sequence.updatedAt = scene.updatedAt;
  }
  state.history.push({ id: randomUUID(), version: state.scriptVersion, action: "SCENE_EDITED", scopeIds: [scene.id, scene.sequenceId], reason, createdAt: scene.updatedAt });
  refreshScriptReadiness(project);
  return state;
};

export const proposeScriptChange = (project: MovieProject, sequence: string, instruction: string, variant = 1) => {
  const state = project.memory.productionMemory.script;
  const target = state.sequences.find((item) => item.id === sequence || item.number === sequenceNumber(sequence));
  if (!target) throw new Error(`Script sequence ${sequence} was not found.`);
  const scene = state.scenes.find((item) => target.sceneIds.includes(item.id));
  if (!scene) throw new Error(`Script scene for ${target.id} was not found.`);
  const lines = state.dialogue.filter((line) => target.dialogueIds.includes(line.id));
  const shots = state.shots.filter((shot) => target.shotIds.includes(shot.id));
  const requestedShotNumber = Number(instruction.match(/shot\s*0*(\d+)/i)?.[1] ?? 0);
  const requestedShot = requestedShotNumber ? shots.find((shot) => shot.number === requestedShotNumber) : undefined;
  let proposed = scene.action;
  if (/fright|afraid|fear/i.test(instruction)) proposed = `${scene.action} Performance becomes visibly more frightened while the approved event and ending state remain unchanged.`;
  else if (/slower|slow down/i.test(instruction)) proposed = `${scene.action} Hold reactions longer and reduce movement speed without changing total sequence duration.`;
  else if (/camel.*before|before.*camel/i.test(instruction)) proposed = `The camel reacts before the human response. ${scene.action}`;
  else if (/silence/i.test(instruction)) proposed = `${scene.action} Insert intentional silence immediately before the reveal.`;
  else if (/shorter.*dialogue|dialogue.*shorter/i.test(instruction)) proposed = lines.some((line) => line.lockState === "LOCKED") ? `${scene.action} Locked dialogue remains exact; shorten only pauses and surrounding action.` : `${scene.action} Shorten the selected unlocked dialogue line only.`;
  else if (/reaction shot/i.test(instruction)) proposed = `${scene.action} Add a motivated reaction shot after the dialogue and preserve the ending state.`;
  else if (/remove.*camera move|camera move/i.test(instruction)) proposed = `${scene.action} Replace the selected camera move with a locked frame.`;
  else proposed = `${scene.action} Scoped change: ${instruction}`;
  const warnings = project.memory.productionMemory.continuity.warnings.filter((warning) => sequenceNumber(warning.currentSequenceId) >= target.number);
  const proposal: ScriptChangeProposal = {
    id: randomUUID(), instruction, sequenceId: target.id, sceneId: scene.id, variant,
    currentSection: scene.action, proposedSection: proposed,
    affectedDialogueIds: /dialogue|fright|delivery/i.test(instruction) ? lines.map((line) => line.id) : [],
    affectedShotIds: /shot|camera|lens|framing|movement|slower|silence|camel|handheld|dolly|drone|85mm/i.test(instruction) ? (requestedShot ? [requestedShot.id] : shots.map((shot) => shot.id)) : [],
    affectedSequenceIds: state.sequences.filter((item) => item.number >= target.number).map((item) => item.id),
    affectedContinuityIds: warnings.map((warning) => warning.id),
    affectedAssetIds: target.assetRequirements.map((requirement) => requirement.assetId),
    preservesLockedDialogue: true,
    createdAt: now(),
  };
  state.pendingProposal = proposal;
  state.status = "REVIEW";
  state.updatedAt = proposal.createdAt;
  return proposal;
};

export const proposeDialogueChange = (project: MovieProject, dialogueId: string, instruction: string, variant = 1) => {
  const state = project.memory.productionMemory.script;
  const line = state.dialogue.find((item) => item.id === dialogueId);
  if (!line) throw new Error(`Dialogue ${dialogueId} was not found.`);
  if (line.lockState === "LOCKED") throw new Error("Unlock this dialogue line before requesting an AI rewrite.");
  const words = line.exactDialogue.trim().split(/\s+/).filter(Boolean);
  let proposed = line.exactDialogue.trim();
  if (/short|concise|trim/i.test(instruction)) proposed = words.slice(0, Math.max(1, Math.ceil(words.length / (variant > 1 ? 2.4 : 1.8)))).join(" ").replace(/[,.!?;:]*$/, ".");
  else if (/silence|pause|hesitat/i.test(instruction)) proposed = `… ${proposed}`;
  else if (/fright|fear|panic|tension/i.test(instruction)) proposed = proposed.replace(/([.!?])?$/, variant % 2 ? "…" : "—");
  else if (/question|uncertain/i.test(instruction)) proposed = proposed.replace(/[.!…—]+$/, "?");
  else proposed = variant % 2 ? proposed.replace(/[.!?]+$/, "…") : `… ${proposed}`;
  const sequence = state.sequences.find((item) => item.id === line.sequenceId)!;
  const warnings = project.memory.productionMemory.continuity.warnings.filter((warning) => sequenceNumber(warning.currentSequenceId) >= sequence.number);
  const proposal: ScriptChangeProposal = {
    id: randomUUID(), instruction, sequenceId: line.sequenceId, sceneId: line.sceneId, dialogueId: line.id, variant,
    currentSection: line.exactDialogue, proposedSection: proposed,
    affectedDialogueIds: [line.id], affectedShotIds: state.shots.filter((shot) => shot.dialogueIds.includes(line.id)).map((shot) => shot.id),
    affectedSequenceIds: [line.sequenceId], affectedContinuityIds: warnings.map((warning) => warning.id),
    affectedAssetIds: sequence.assetRequirements.map((requirement) => requirement.assetId), preservesLockedDialogue: true, createdAt: now(),
  };
  state.pendingProposal = proposal;
  state.status = "REVIEW";
  state.updatedAt = proposal.createdAt;
  return proposal;
};

export const rejectScriptChange = (project: MovieProject) => {
  const state = project.memory.productionMemory.script;
  if (!state.pendingProposal) return state;
  state.history.push({ id: randomUUID(), version: state.scriptVersion, action: "AI_CHANGE_REJECTED", scopeIds: [state.pendingProposal.sequenceId], reason: state.pendingProposal.instruction, createdAt: now() });
  state.pendingProposal = undefined;
  state.status = state.scriptVersion ? "EDITED" : "EMPTY";
  state.updatedAt = now();
  return state;
};

export const applyScriptChange = (project: MovieProject) => {
  const state = project.memory.productionMemory.script;
  const proposal = state.pendingProposal;
  if (!proposal) throw new Error("No script change proposal is waiting for review.");
  ensureEditableVersion(state, proposal.instruction);
  if (proposal.dialogueId) {
    const line = state.dialogue.find((item) => item.id === proposal.dialogueId);
    if (!line) throw new Error(`Dialogue ${proposal.dialogueId} was not found.`);
    if (line.lockState === "LOCKED") throw new Error("Unlock this dialogue line before applying the proposed rewrite.");
    line.exactDialogue = proposal.proposedSection;
    line.approvalState = "DRAFT";
    line.sourceScriptVersion = state.scriptVersion;
    line.updatedAt = now();
    dialogueTimingWarning(line);
  }
  const scene = state.scenes.find((item) => item.id === proposal.sceneId);
  if (scene && !proposal.dialogueId) { scene.action = proposal.proposedSection; scene.updatedAt = now(); }
  const sequence = state.sequences.find((item) => item.id === proposal.sequenceId);
  const requestedShotNumber = Number(proposal.instruction.match(/shot\s*0*(\d+)/i)?.[1] ?? 0);
  const sequenceShots = sequence ? state.shots.filter((shot) => shot.sequenceId === sequence.id).sort((a, b) => a.number - b.number) : [];
  const requestedShot = requestedShotNumber ? sequenceShots.find((shot) => shot.number === requestedShotNumber) : undefined;
  if (sequence && !proposal.dialogueId && /reaction shot/i.test(proposal.instruction)) {
    const afterNumber = Number(proposal.instruction.match(/after\s+shot\s*0*(\d+)/i)?.[1] ?? Math.max(1, sequence.shotIds.length - 1));
    addShotInternal(project, sequence, { shotType: "Reaction", framing: "Close reaction", storyPurpose: "Show the motivated reaction requested by the user." }, Math.max(0, afterNumber - 1));
  }
  if (sequence && /remove.*camera move|camera move/i.test(proposal.instruction)) {
    const shot = requestedShot ?? sequenceShots[0];
    if (shot) shot.cameraMovement = "Static";
  }
  if (requestedShot && /close[- ]?up/i.test(proposal.instruction)) { requestedShot.shotType = "Close Up"; requestedShot.framing = "Close Up"; }
  if (requestedShot && /handheld/i.test(proposal.instruction)) requestedShot.cameraMovement = "Handheld";
  if (requestedShot && /85\s*mm/i.test(proposal.instruction)) { requestedShot.focalLength = "85mm"; requestedShot.lens = movieDnaValue(project, "lens", requestedShot.lens); }
  if (requestedShot && /left\s*(?:to|→|-)\s*right/i.test(proposal.instruction)) requestedShot.continuityState.screenDirection = "Left to right";
  if (sequence && !proposal.dialogueId && /shorter.*dialogue|dialogue.*shorter/i.test(proposal.instruction)) {
    const line = state.dialogue.find((item) => item.sequenceId === sequence.id && item.lockState === "UNLOCKED");
    if (line) line.exactDialogue = line.exactDialogue.split(/\s+/).slice(0, Math.max(1, Math.ceil(line.exactDialogue.split(/\s+/).length / 2))).join(" ");
  }
  state.history.push({ id: randomUUID(), version: state.scriptVersion, action: "AI_CHANGE_ACCEPTED", scopeIds: [proposal.sequenceId, ...(proposal.sceneId ? [proposal.sceneId] : [])], reason: proposal.instruction, createdAt: now() });
  state.pendingProposal = undefined;
  refreshScriptReadiness(project);
  return state;
};

export const updateDialogueLine = (project: MovieProject, dialogueId: string, changes: Partial<Pick<ScriptDialogueLine, "exactDialogue" | "language" | "accent" | "emotion" | "delivery" | "pronunciation" | "volume" | "timing">>, reason: string) => {
  const state = project.memory.productionMemory.script;
  const line = state.dialogue.find((item) => item.id === dialogueId);
  if (!line) throw new Error(`Dialogue ${dialogueId} was not found.`);
  if (line.lockState === "LOCKED") throw new Error("Unlock this dialogue line before changing its exact words or delivery contract.");
  ensureEditableVersion(state, reason);
  Object.assign(line, changes, { sourceScriptVersion: state.scriptVersion, approvalState: "DRAFT", updatedAt: now() });
  if (changes.timing) line.timing.label = timeRange(line.timing.startSeconds, line.timing.endSeconds);
  dialogueTimingWarning(line);
  state.history.push({ id: randomUUID(), version: state.scriptVersion, action: "DIALOGUE_EDITED", scopeIds: [line.id, line.sequenceId], reason, createdAt: line.updatedAt });
  refreshScriptReadiness(project);
  return line;
};

export const setDialogueApproval = (project: MovieProject, dialogueId: string, action: "APPROVE" | "LOCK" | "UNLOCK") => {
  const state = project.memory.productionMemory.script;
  const line = state.dialogue.find((item) => item.id === dialogueId);
  if (!line) throw new Error(`Dialogue ${dialogueId} was not found.`);
  if (action === "APPROVE") line.approvalState = "APPROVED";
  if (action === "LOCK") {
    line.approvalState = "APPROVED";
    line.lockState = "LOCKED";
  }
  if (action === "UNLOCK") line.lockState = "UNLOCKED";
  line.updatedAt = now();
  state.updatedAt = line.updatedAt;
  state.history.push({ id: randomUUID(), version: state.scriptVersion, action: `DIALOGUE_${action}`, scopeIds: [line.id, line.sequenceId], reason: `Explicit dialogue ${action.toLowerCase()} action.`, createdAt: line.updatedAt });
  return line;
};

export const addDialogueLine = (project: MovieProject, sequence: string, input: Pick<ScriptDialogueLine, "speakerCharacterId" | "exactDialogue" | "language" | "accent" | "emotion" | "delivery" | "pronunciation" | "volume" | "timing">) => {
  if (!project.dialogueEnabled || !project.memory.productionMemory.audioBible.dialogueEnabled) throw new Error("Dialogue is disabled in Project Setup or the Audio Bible.");
  const state = project.memory.productionMemory.script;
  const target = state.sequences.find((item) => item.id === sequence);
  if (!target) throw new Error(`Sequence ${sequence} was not found.`);
  ensureEditableVersion(state, "Add dialogue line");
  const voice = project.memory.productionMemory.audioBible.voiceProfiles.find((profile) => profile.characterId === input.speakerCharacterId);
  const createdAt = now();
  const line: ScriptDialogueLine = { id: `DLG_${pad(target.number)}_${pad(state.dialogue.filter((item) => item.sequenceId === target.id).length + 1)}`, sequenceId: target.id, sceneId: target.sceneIds[0]!, ...input, timing: { ...input.timing, label: timeRange(input.timing.startSeconds, input.timing.endSeconds) }, approvalState: "DRAFT", lockState: "UNLOCKED", sourceScriptVersion: state.scriptVersion, audioVoiceProfileId: voice?.id, createdAt, updatedAt: createdAt };
  dialogueTimingWarning(line);
  state.dialogue.push(line);
  target.dialogueIds.push(line.id);
  state.scenes.find((scene) => scene.id === line.sceneId)?.dialogueIds.push(line.id);
  refreshScriptReadiness(project);
  return line;
};

export const deleteDialogueLine = (project: MovieProject, dialogueId: string) => {
  const state = project.memory.productionMemory.script;
  const line = state.dialogue.find((item) => item.id === dialogueId);
  if (!line) throw new Error(`Dialogue ${dialogueId} was not found.`);
  if (line.lockState === "LOCKED") throw new Error("Unlock this dialogue line before deleting it.");
  ensureEditableVersion(state, "Delete dialogue line");
  state.dialogue = state.dialogue.filter((item) => item.id !== dialogueId);
  state.sequences.forEach((sequence) => { sequence.dialogueIds = sequence.dialogueIds.filter((id) => id !== dialogueId); });
  state.scenes.forEach((scene) => { scene.dialogueIds = scene.dialogueIds.filter((id) => id !== dialogueId); });
  state.shots.forEach((shot) => { shot.dialogueIds = shot.dialogueIds.filter((id) => id !== dialogueId); });
  refreshScriptReadiness(project);
  return state;
};

const addShotInternal = (project: MovieProject, sequence: ScriptProductionSequence, changes: Partial<ScriptShot>, afterIndex?: number) => {
  const state = project.memory.productionMemory.script;
  const shots = state.shots.filter((shot) => shot.sequenceId === sequence.id).sort((a, b) => a.number - b.number);
  const insertAt = Math.min(shots.length, Math.max(0, (afterIndex ?? shots.length - 1) + 1));
  const donor = shots[Math.max(0, insertAt - 1)] ?? shots[0];
  const durationSeconds = donor && donor.durationSeconds > 1 ? Math.max(1, Math.floor(donor.durationSeconds / 2)) : 1;
  if (donor && donor.durationSeconds > 1) donor.durationSeconds -= durationSeconds;
  const createdAt = now();
  const shot: ScriptShot = {
    shotType: "Custom", framing: movieDnaValue(project, "framing", "Motivated framing"), cameraAngle: "Story-motivated angle", cameraMovement: movieDnaValue(project, "cameraMovement", "Static"), lens: `${movieDnaValue(project, "cameraSystem", "Cinema camera")} · ${movieDnaValue(project, "lensStyle", "Cinematic lens family")}`, focalLength: movieDnaValue(project, "focalLength", "50mm"), depthOfField: movieDnaValue(project, "depthOfField", "Moderate"), subject: sequence.characterIds.join(" / ") || sequence.locationId, subjectAction: "New scoped shot action", characterStateIds: [...sequence.characterStateIds], emotion: sequence.emotion, locationId: sequence.locationId, lighting: movieDnaValue(project, "lighting", "Continuity lighting"), assetIds: sequence.assetRequirements.map((requirement) => requirement.assetId), dialogueIds: [], sound: "Continue approved audio state", storyPurpose: "User-added motivated shot", continuityPurpose: "Preserve prior shot state", transition: "CONTINUE", startVisualState: sequence.startState, endVisualState: sequence.midState,
    continuityState: { characterPosition: "Continue the prior shot position.", characterFacing: "Preserve established facing.", screenDirection: "Preserve established screen direction.", movementDirection: "Continue motivated movement.", props: sequence.startState, costume: `Use ${sequence.characterStateIds.join(", ") || "the permanent costume state"}.`, injury: "Preserve the current injury state.", environment: sequence.locationId, lighting: movieDnaValue(project, "lighting", "Continuity lighting"), cameraRelationship: "Motivated framing; story-motivated angle; 50mm." },
    controlsSequenceEndState: false,
    ...changes,
    id: `SHOT_${pad(sequence.number)}_${randomUUID().slice(0, 8).toUpperCase()}`,
    sequenceId: sequence.id, number: insertAt + 1, durationSeconds, startSeconds: 0, endSeconds: 0,
    createdAt, updatedAt: createdAt,
  };
  const before = shots.slice(0, insertAt);
  const after = shots.slice(insertAt);
  const unrelated = state.shots.filter((item) => item.sequenceId !== sequence.id);
  state.shots = [...unrelated, ...before, shot, ...after];
  recalculateShotTiming(state, sequence);
  return shot;
};

export const addShot = (project: MovieProject, sequenceIdValue: string, changes: Partial<ScriptShot>, afterIndex?: number) => {
  const state = project.memory.productionMemory.script;
  const sequence = state.sequences.find((item) => item.id === sequenceIdValue);
  if (!sequence) throw new Error(`Sequence ${sequenceIdValue} was not found.`);
  ensureEditableVersion(state, "Add shot");
  const shot = addShotInternal(project, sequence, changes, afterIndex);
  state.history.push({ id: randomUUID(), version: state.scriptVersion, action: "SHOT_ADDED", scopeIds: [shot.id, sequence.id], reason: shot.storyPurpose, createdAt: now() });
  refreshScriptReadiness(project);
  return shot;
};

export const updateShot = (project: MovieProject, shotId: string, changes: Partial<Pick<ScriptShot, "durationSeconds" | "shotType" | "framing" | "cameraAngle" | "cameraMovement" | "lens" | "focalLength" | "depthOfField" | "subjectAction" | "emotion" | "lighting" | "dialogueIds" | "sound" | "storyPurpose" | "continuityPurpose" | "transition" | "startVisualState" | "endVisualState">>, reason: string) => {
  const state = project.memory.productionMemory.script;
  const shot = state.shots.find((item) => item.id === shotId);
  if (!shot) throw new Error(`Shot ${shotId} was not found.`);
  ensureEditableVersion(state, reason);
  Object.assign(shot, changes, { updatedAt: now() });
  const sequence = state.sequences.find((item) => item.id === shot.sequenceId)!;
  recalculateShotTiming(state, sequence);
  state.history.push({ id: randomUUID(), version: state.scriptVersion, action: "SHOT_EDITED", scopeIds: [shot.id, shot.sequenceId], reason, createdAt: shot.updatedAt });
  refreshScriptReadiness(project);
  return shot;
};

export const reorderShots = (project: MovieProject, sequenceIdValue: string, orderedShotIds: string[]) => {
  const state = project.memory.productionMemory.script;
  const sequence = state.sequences.find((item) => item.id === sequenceIdValue);
  if (!sequence) throw new Error(`Sequence ${sequenceIdValue} was not found.`);
  const current = state.shots.filter((shot) => shot.sequenceId === sequence.id);
  if (current.length !== orderedShotIds.length || new Set(orderedShotIds).size !== orderedShotIds.length || current.some((shot) => !orderedShotIds.includes(shot.id))) throw new Error("Shot reorder must include every sequence shot exactly once.");
  ensureEditableVersion(state, "Reorder shots");
  const byId = new Map(current.map((shot) => [shot.id, shot]));
  orderedShotIds.forEach((id, index) => { byId.get(id)!.number = index + 1; });
  recalculateShotTiming(state, sequence);
  state.history.push({ id: randomUUID(), version: state.scriptVersion, action: "SHOTS_REORDERED", scopeIds: [sequence.id, ...orderedShotIds], reason: "User-defined shot order.", createdAt: now() });
  refreshScriptReadiness(project);
  return sequence;
};

export const deleteShot = (project: MovieProject, shotId: string) => {
  const state = project.memory.productionMemory.script;
  const shot = state.shots.find((item) => item.id === shotId);
  if (!shot) throw new Error(`Shot ${shotId} was not found.`);
  const sequence = state.sequences.find((item) => item.id === shot.sequenceId)!;
  const siblings = state.shots.filter((item) => item.sequenceId === sequence.id && item.id !== shotId).sort((a, b) => a.number - b.number);
  if (!siblings.length) throw new Error("A sequence must retain at least one shot.");
  ensureEditableVersion(state, "Delete shot");
  siblings[Math.min(siblings.length - 1, Math.max(0, shot.number - 2))]!.durationSeconds += shot.durationSeconds;
  state.shots = state.shots.filter((item) => item.id !== shotId);
  recalculateShotTiming(state, sequence);
  refreshScriptReadiness(project);
  return sequence;
};

export const duplicateShot = (project: MovieProject, shotId: string) => {
  const state = project.memory.productionMemory.script;
  const shot = state.shots.find((item) => item.id === shotId);
  if (!shot) throw new Error(`Shot ${shotId} was not found.`);
  const sequence = state.sequences.find((item) => item.id === shot.sequenceId)!;
  ensureEditableVersion(state, "Duplicate shot");
  const duplicate = addShotInternal(project, sequence, { ...clone(shot), id: `SHOT_${pad(sequence.number)}_${randomUUID().slice(0, 8).toUpperCase()}`, storyPurpose: `${shot.storyPurpose} (duplicate)` }, shot.number - 1);
  refreshScriptReadiness(project);
  return duplicate;
};

export const resolveScriptContinuity = (project: MovieProject, warningId: string, action: "FIX_SCRIPT" | "ACCEPT_INTENTIONAL_CHANGE", note?: string) => {
  const state = project.memory.productionMemory.script;
  const warning = project.memory.productionMemory.continuity.warnings.find((item) => item.id === warningId);
  if (!warning) throw new Error(`Continuity warning ${warningId} was not found.`);
  state.continuityDecisions.push({ id: randomUUID(), warningId, sequenceId: warning.currentSequenceId, action, note, createdAt: now() });
  if (action === "FIX_SCRIPT") {
    const sequence = state.sequences.find((item) => sequenceNumber(item.id) === sequenceNumber(warning.currentSequenceId));
    if (sequence) {
      sequence.continuityRequirements.push(`Script fixed against ${warning.sourceSequenceId}: ${warning.field} must remain ${warning.expected}.`);
      sequence.actions = sequence.actions.map((value) => warning.entityId.includes("KNIFE") && warning.expected === "None" ? value.replace(/carries? (?:the )?knife/gi, "does not carry the knife") : value);
    }
  }
  state.history.push({ id: randomUUID(), version: state.scriptVersion, action: `CONTINUITY_${action}`, scopeIds: [warningId, warning.currentSequenceId], reason: note || `${warning.field}: expected ${warning.expected}`, createdAt: now() });
  state.updatedAt = now();
  return state;
};

export const syncLegacySequences = (project: MovieProject) => {
  const state = project.memory.productionMemory.script;
  if (!state.sequences.length) return;
  project.production.sequences = state.sequences.map((sequence) => {
    const existing = project.production.sequences.find((item) => item.number === sequence.number);
    const scenes = state.scenes.filter((scene) => sequence.sceneIds.includes(scene.id));
    const dialogue = state.dialogue.filter((line) => sequence.dialogueIds.includes(line.id));
    const shots = state.shots.filter((shot) => sequence.shotIds.includes(shot.id)).sort((a, b) => a.number - b.number);
    const legacyStatus = ["GENERATED", "REJECTED", "APPROVED", "LOCKED"].includes(sequence.status) ? sequence.status as "GENERATED" | "REJECTED" | "APPROVED" | "LOCKED" : sequence.status === "READY" ? "READY" : "PLANNED";
    return {
      id: sequence.id,
      number: sequence.number,
      title: sequence.title,
      timeRange: sequence.timeRange,
      durationSeconds: sequence.durationSeconds,
      synopsis: sequence.storyPurpose,
      startState: sequence.startState,
      middleState: sequence.midState,
      endState: sequence.endState,
      shots: shots.map((shot) => ({ id: shot.id, number: shot.number, durationSeconds: shot.durationSeconds, framing: shot.framing, lens: `${shot.lens} · ${shot.focalLength}`, movement: shot.cameraMovement, action: shot.subjectAction })),
      script: scenes.map((scene) => `${scene.heading}\n\n${scene.action}\n\n${scene.transition}:`).join("\n\n"),
      dialogue: dialogue.map((line) => `${line.speakerCharacterId}: ${line.exactDialogue}`),
      assetIds: sequence.assetRequirements.map((requirement) => requirement.assetId),
      referenceSlots: [],
      promptSections: existing?.promptSections ?? {},
      compiledPrompt: existing?.compiledPrompt ?? "",
      negativePrompt: sequence.negativeRules.join(" "),
      status: legacyStatus,
      videoPath: existing?.videoPath,
      inspectionNotes: [...sequence.warnings],
      generationHistory: existing?.generationHistory ?? [],
    };
  });
  project.artifacts.sequences = {
    targetRuntimeSeconds: Math.round(project.runtimeMinutes * 60),
    sequences: state.sequences.map((sequence) => ({
      id: sequence.id, number: sequence.number, title: sequence.title, durationSeconds: sequence.durationSeconds,
      synopsis: sequence.storyPurpose, locationId: sequence.locationId,
      assetIds: sequence.assetRequirements.map((requirement) => requirement.assetId), emotionalBeat: sequence.emotion,
      status: sequence.status === "READY" ? "ready" : ["APPROVED", "LOCKED"].includes(sequence.status) ? "approved" : "draft",
      previousContinuitySource: sequence.previousSequenceId,
      beginning: sequence.startState, middle: sequence.midState, ending: sequence.endState,
      startStateId: snapshotFor(project, sequence.number, "START")?.id,
      midStateId: snapshotFor(project, sequence.number, "MID")?.id,
      endStateId: snapshotFor(project, sequence.number, "END")?.id,
      cameraPlan: state.shots.filter((shot) => shot.sequenceId === sequence.id).map((shot) => `${shot.number}. ${shot.shotType} · ${shot.focalLength} · ${shot.cameraMovement}`).join("\n"),
      lightingPlan: state.shots.find((shot) => shot.sequenceId === sequence.id)?.lighting,
      soundPlan: sequence.audioRequirements.join(" "), dialogue: state.dialogue.filter((line) => line.sequenceId === sequence.id).map((line) => line.exactDialogue), negativeRules: sequence.negativeRules,
    })),
  } satisfies SequencesArtifact;
};

export type ScriptExportFormat = "full" | "production" | "dialogue" | "shots" | "sequences" | "json";

export const renderScriptExport = (project: MovieProject, format: ScriptExportFormat) => {
  const state = project.memory.productionMemory.script;
  if (!state.scriptVersion) throw new Error("Generate Full Script v2 before exporting it.");
  if (format === "json") return { filename: `${project.id}-script-v${pad(state.scriptVersion)}.json`, contentType: "application/json; charset=utf-8", body: JSON.stringify(state, null, 2) };
  const title = `# ${project.movieTitle} · Full Script V${pad(state.scriptVersion)}\n\nStatus: ${state.status}\n\n`;
  if (format === "dialogue") return { filename: `${project.id}-dialogue-script.md`, contentType: "text/markdown; charset=utf-8", body: title + state.dialogue.map((line) => `## ${line.sequenceId} · ${line.speakerCharacterId}\n\n${line.exactDialogue}\n\n- ${line.language} · ${line.accent} · ${line.emotion}\n- ${line.timing.label} · ${line.lockState}\n- Voice: ${line.audioVoiceProfileId ?? "Not assigned"}`).join("\n\n") };
  if (format === "shots") return { filename: `${project.id}-shot-script.md`, contentType: "text/markdown; charset=utf-8", body: title + state.sequences.map((sequence) => `## ${sequence.id} · ${sequence.title}\n\n${state.shots.filter((shot) => shot.sequenceId === sequence.id).sort((a, b) => a.number - b.number).map((shot) => `- **${shot.id}** ${shot.startSeconds}s–${shot.endSeconds}s · ${shot.shotType} · ${shot.focalLength} · ${shot.cameraMovement}\n  ${shot.subjectAction}`).join("\n")}`).join("\n\n") };
  if (format === "sequences") return { filename: `${project.id}-sequence-plans.md`, contentType: "text/markdown; charset=utf-8", body: title + state.sequences.map((sequence) => `## ${sequence.id} · ${sequence.title}\n\n${sequence.timeRange} · ${sequence.durationSeconds}s · ${sequence.status}\n\n**Purpose:** ${sequence.storyPurpose}\n\n**Start:** ${sequence.startState}\n\n**Mid:** ${sequence.midState}\n\n**End:** ${sequence.endState}\n\n**Warnings:** ${sequence.warnings.join("; ") || "None"}`).join("\n\n") };
  if (format === "production") return { filename: `${project.id}-production-script.md`, contentType: "text/markdown; charset=utf-8", body: title + state.sequences.map((sequence) => {
    const scene = state.scenes.find((item) => item.sequenceId === sequence.id);
    const shots = state.shots.filter((shot) => shot.sequenceId === sequence.id).sort((a, b) => a.number - b.number);
    const lines = state.dialogue.filter((line) => line.sequenceId === sequence.id);
    const characters = sequence.characterIds.map((id) => project.production.characters.find((character) => character.id === id)).filter(Boolean);
    const categorized = (pattern: RegExp) => sequence.assetRequirements.map((requirement) => project.production.assets.find((asset) => asset.id === requirement.assetId)).filter((asset) => asset && pattern.test(asset.category)).map((asset) => asset!.id);
    return `## ${sequence.id} · ${sequence.title}\n\n- Time: ${sequence.timeRange} (${sequence.durationSeconds}s)\n- Story purpose: ${sequence.storyPurpose}\n- Story beat: ${sequence.storyBeat}\n- Scene: ${scene?.heading}\n- Location / time: ${sequence.locationId} · ${scene?.timeOfDay}\n- Weather / environment: ${project.memory.productionMemory.continuity.currentGlobal.weather} · ${shots[0]?.continuityState.environment ?? sequence.locationId}\n- Characters: ${characters.map((character) => `${character!.id} ${character!.name}`).join(", ")}\n- Character States: ${sequence.characterStateIds.join(", ")}\n- Condition / emotion: ${characters.flatMap((character) => character!.states.filter((characterState) => sequence.characterStateIds.includes(characterState.id)).map((characterState) => `${character!.name}: ${characterState.physical}; ${characterState.emotional}`)).join(" | ")}\n- Motivation / knowledge / relationships: ${characters.map((character) => `${character!.name}: ${character!.motivation}; ${character!.relationships.join(", ")}`).join(" | ")}\n- Action / body movement: ${sequence.actions.join(" ")}\n- Dialogue / performance: ${lines.map((line) => `${line.id} ${line.speakerCharacterId}: ${line.exactDialogue} [${line.emotion}; ${line.delivery}; ${line.volume}]`).join(" | ") || "No dialogue."}\n- Props: ${categorized(/prop/i).join(", ") || "None"}\n- Vehicles: ${categorized(/vehicle/i).join(", ") || "None"}\n- Weapons: ${categorized(/weapon/i).join(", ") || "None"}\n- Animals / creatures: ${categorized(/animal|creature/i).join(", ") || "None"}\n- Costumes: ${categorized(/costume|character_state/i).join(", ") || "Permanent Character States"}\n- Camera / lens / focal / depth / framing / movement: ${shots.map((shot) => `${shot.id}: ${shot.cameraAngle}; ${shot.lens}; ${shot.focalLength}; ${shot.depthOfField}; ${shot.framing}; ${shot.cameraMovement}`).join(" | ")}\n- Lighting: ${shots.map((shot) => shot.lighting).filter((value, index, values) => values.indexOf(value) === index).join(" | ")}\n- Ambient sound / effects / music / narration: ${sequence.audioRequirements.join(" ")}\n- Start: ${sequence.startState}\n- Mid: ${sequence.midState}\n- End: ${sequence.endState}\n- Continuity: ${sequence.continuityRequirements.join(" ")}\n- Required assets: ${sequence.assetRequirements.map((item) => `${item.assetId} ${item.resolved ? "READY" : "MISSING"}`).join(", ")}\n- Negative production rules: ${sequence.negativeRules.join("; ")}`;
  }).join("\n\n") };
  return { filename: `${project.id}-full-screenplay.md`, contentType: "text/markdown; charset=utf-8", body: title + state.scenes.map((scene) => {
    const lines = state.dialogue.filter((line) => scene.dialogueIds.includes(line.id));
    return `## ${scene.heading}\n\n${scene.action}\n\n${lines.map((line) => `**${project.production.characters.find((character) => character.id === line.speakerCharacterId)?.name ?? line.speakerCharacterId}**\n\n${line.exactDialogue}`).join("\n\n")}\n\n_Sound: ${scene.importantSound.join("; ") || "Production ambience"}_\n\n**${scene.transition}:**`;
  }).join("\n\n") };
};
