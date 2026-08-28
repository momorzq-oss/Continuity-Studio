import { randomUUID } from "node:crypto";
import path from "node:path";
import type {
  ChangeImpactReport,
  MovieProject,
  PlatformProfile,
  ProductionAssetRecord,
  ScriptProductionSequence,
  SequencePromptChangeReview,
  SequencePromptRecord,
  SequencePromptReference,
  SequencePromptState,
  SequencePromptValidation,
  SequencePromptValidationIssue,
  TargetPlatform,
} from "../src/types.js";
import { MOVIE_DNA_CATALOG, movieDnaOption } from "../src/movie-dna-catalog.js";
import { assessChangeImpact } from "./change-impact.js";
import { characterIdentityAnchor, storyboardGridForSequence } from "./storyboard-grid.js";

const now = () => new Date().toISOString();
const pad = (value: number) => String(value).padStart(2, "0");
const recordKey = (sequenceId: string, platform: TargetPlatform) => `${sequenceId}:${platform}`;
const normalizeText = (value: unknown) => String(value ?? "").trim();
const unique = (values: Array<string | undefined>) => [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))];
const list = (values: string[]) => values.length ? values.join("; ") : "None.";
const sourceVersion = (project: MovieProject, sequenceId?: string) => ({
  story: project.production.story.approvedVersion ?? project.production.story.lockedVersion ?? project.production.story.version,
  filmBible: project.production.filmBible.approvedVersion ?? project.production.filmBible.lockedVersion ?? project.production.filmBible.version,
  movieDNA: project.production.movieDna.version,
  continuity: project.memory.productionMemory.continuity.snapshots.reduce((value, snapshot) => Math.max(value, snapshot.version), 0),
  audioBible: project.memory.productionMemory.audioBible.version,
  script: project.memory.productionMemory.script.scriptVersion,
  assets: project.production.assets.reduce((value, asset) => Math.max(value, asset.version), 0),
  filmmakingKnowledge: project.production.knowledgeSources.reduce((value, source) => Math.max(value, source.version), 0),
  storyboardGrid: sequenceId ? (project.production.storyboardGrids[sequenceId]?.version ?? 0) : 0,
});

const categoryPriority: Record<string, number> = {
  movie_dna: 0,
  main_character: 10,
  character: 20,
  character_state: 30,
  creature: 40,
  animal: 45,
  location: 50,
  environment: 55,
  prop: 60,
  weapon: 61,
  vehicle: 65,
  costume: 70,
  set: 75,
  building: 76,
  room: 77,
  accessory: 80,
  story_object: 85,
  other: 100,
};

const referenceRole = (asset: ProductionAssetRecord) => {
  if (asset.category === "movie_dna") return "Visual Style Reference";
  if (asset.category === "main_character" || asset.category === "character") return "Identity Lock";
  if (asset.category === "character_state") return "Character State";
  if (asset.category === "creature") return "Creature Reference";
  if (asset.category === "animal") return "Animal Reference";
  if (["location", "set", "building", "room", "environment"].includes(asset.category)) return "Location Reference";
  if (asset.category === "vehicle") return "Vehicle Reference";
  if (asset.category === "costume") return "Costume Reference";
  if (asset.category === "weapon") return "Prop Reference";
  return asset.referenceRoles?.[0]?.replaceAll("_", " ") ?? "Prop Reference";
};

const platformTag = (profile: PlatformProfile, position: number, name: string) => {
  if (profile.referenceSyntax === "NUMBERED_IMAGE") return `@Image ${position}`;
  if (profile.referenceSyntax === "NAMED_ELEMENT") return `Element ${position} — ${name}`;
  if (profile.platform === "MiniMax") return `[Image ${position}]`;
  if (profile.platform === "Veo") return `Reference image ${position}`;
  if (profile.platform === "Kling") return `Image ${position}`;
  if (profile.platform === "Runway") return `Image Guidance ${position}`;
  if (profile.platform === "Sora") return `Attached image ${position}`;
  return `REF_${position}`;
};

const packageFilename = (position: number, permanentFilename: string) => {
  const extension = path.extname(permanentFilename) || ".png";
  const base = path.basename(permanentFilename, extension).replace(/^\d+[_-]?/, "").replace(/[^a-z0-9_-]+/gi, "_");
  return `${pad(position)}_${base || "Reference"}${extension}`;
};

const sequenceSource = (project: MovieProject, sequenceId: string) => {
  const sequence = project.memory.productionMemory.script.sequences.find((item) => item.id === sequenceId);
  if (!sequence) throw new Error(`Formal sequence ${sequenceId} was not found. Generate Full Script v2 and Sequence Planner first.`);
  return sequence;
};

const assetReference = (asset: ProductionAssetRecord, required: boolean): SequencePromptReference => ({
  assetId: asset.id,
  permanentProjectImageNumber: asset.number,
  permanentFilename: asset.filename,
  assetName: asset.name,
  assetType: asset.category,
  referenceRole: referenceRole(asset),
  reasonRequired: asset.storyPurpose || asset.description || `Required by ${asset.sequenceIds.join(", ")}.`,
  approvalState: asset.status,
  lockState: asset.status === "LOCKED" ? "LOCKED" : "UNLOCKED",
  sourcePath: asset.imagePath,
  thumbnailPath: asset.thumbnailPath,
  priority: categoryPriority[asset.category] ?? 100,
  required,
  selected: true,
  missing: !asset.imagePath || asset.status === "GENERATION_FAILED",
});

const buildReferences = (
  project: MovieProject,
  sequence: ScriptProductionSequence,
  profile: PlatformProfile,
  prior?: SequencePromptRecord,
  unavailableAssetIds = new Set<string>(),
) => {
  const requiredById = new Map(sequence.assetRequirements.map((requirement) => [requirement.assetId, requirement.required]));
  const ids = unique([...sequence.assetRequirements.map((item) => item.assetId), ...sequence.characterIds, ...sequence.characterStateIds, sequence.locationId]);
  const refs = ids.filter((id) => !unavailableAssetIds.has(id)).map((id) => project.production.assets.find((asset) => asset.id === id)).filter((asset): asset is ProductionAssetRecord => Boolean(asset)).map((asset) => assetReference(asset, requiredById.get(asset.id) ?? true));
  const master = project.production.movieDna.masterFrame;
  if (master?.path && !refs.some((reference) => reference.assetId === master.assetId)) {
    const source = project.production.assets.find((asset) => asset.id === master.assetId);
    refs.push(source ? assetReference(source, true) : {
      assetId: master.assetId,
      permanentProjectImageNumber: master.projectNumber,
      permanentFilename: master.filename,
      assetName: "Movie DNA Master Frame",
      assetType: "movie_dna",
      referenceRole: "Visual Style Reference",
      reasonRequired: "Controls the locked global visual direction, colour, light, texture, and atmosphere.",
      approvalState: master.status === "GENERATED" ? "APPROVED" : "DRAFT",
      lockState: project.production.movieDna.status === "LOCKED" ? "LOCKED" : "UNLOCKED",
      sourcePath: master.path,
      thumbnailPath: master.thumbnailPath,
      priority: 0,
      required: true,
      selected: true,
      missing: false,
    });
  }
  const grid = storyboardGridForSequence(project, sequence.id);
  if (grid.enabled && grid.imagePath && grid.projectImageNumber !== undefined && grid.permanentFilename) {
    refs.push({
      assetId: grid.id,
      permanentProjectImageNumber: grid.projectImageNumber,
      permanentFilename: grid.permanentFilename,
      assetName: `Sequence ${pad(sequence.number)} Storyboard Grid`,
      assetType: "storyboard_grid",
      referenceRole: "Motion, Framing, and Geography Reference",
      reasonRequired: "Controls ordered motion, framing, geography, and staging while character sheets remain identity authority.",
      approvalState: "APPROVED",
      lockState: "UNLOCKED",
      sourcePath: grid.imagePath,
      thumbnailPath: grid.thumbnailPath,
      priority: 35,
      required: false,
      selected: true,
      missing: false,
    });
  }
  refs.sort((a, b) => a.priority - b.priority || a.permanentProjectImageNumber - b.permanentProjectImageNumber);
  const priorSelection = new Map(prior?.state.references.map((reference) => [reference.assetId, reference.selected]) ?? []);
  const mode = prior?.referenceLimitMode ?? "REVIEW";
  refs.forEach((reference, index) => {
    const previous = priorSelection.get(reference.assetId);
    reference.selected = previous ?? (mode === "RECOMMENDED" ? index < profile.maxReferences : true);
  });
  let uploadPosition = 0;
  refs.forEach((reference) => {
    if (!reference.selected) return;
    uploadPosition += 1;
    reference.platformUploadPosition = uploadPosition;
    reference.promptTag = platformTag(profile, uploadPosition, reference.assetName);
    reference.packageFilename = packageFilename(uploadPosition, reference.permanentFilename);
  });
  return refs;
};

const validation = (project: MovieProject, sequence: ScriptProductionSequence, state: SequencePromptState, profile: PlatformProfile, limitMode: SequencePromptRecord["referenceLimitMode"]): SequencePromptValidation => {
  const issues: SequencePromptValidationIssue[] = [];
  const add = (level: SequencePromptValidationIssue["level"], code: string, message: string, sourceId?: string) => issues.push({ id: `${code}_${issues.length + 1}`, level, code, message, sourceId });
  const storyReady = Boolean(project.production.story.content.trim() && (project.production.story.approvedVersion || project.production.story.lockedVersion || ["APPROVED", "LOCKED", "CHANGED_AFTER_PRODUCTION"].includes(project.production.story.status)));
  if (!storyReady) add("BLOCKED", "STORY_REQUIRED", "An approved Story production source is required.");
  const bibleReady = Boolean(Object.values(project.production.filmBible.sections).some((value) => value.trim()) && (project.production.filmBible.approvedVersion || project.production.filmBible.lockedVersion || ["APPROVED", "LOCKED"].includes(project.production.filmBible.status)));
  if (!bibleReady) add("BLOCKED", "FILM_BIBLE_REQUIRED", "An approved Film Bible production source is required.");
  for (const characterId of sequence.characterIds) if (!project.production.characters.some((character) => character.id === characterId)) add("BLOCKED", "CHARACTER_IDENTITY_MISSING", `Character identity ${characterId} does not resolve.`, characterId);
  for (const stateId of sequence.characterStateIds) if (!project.production.characters.some((character) => character.states.some((item) => item.id === stateId))) add("BLOCKED", "CHARACTER_STATE_MISSING", `Character State ${stateId} does not resolve.`, stateId);
  for (const line of state.dialogue) {
    const source = project.memory.productionMemory.script.dialogue.find((item) => item.id === line.id);
    if (!source) add("BLOCKED", "DIALOGUE_SOURCE_MISSING", `Dialogue ${line.id} does not resolve.`, line.id);
    else if (source.lockState === "LOCKED" && source.exactDialogue !== line.exactDialogue) add("BLOCKED", "LOCKED_DIALOGUE_CHANGED", `Locked dialogue ${line.id} changed during compilation.`, line.id);
    if (source && (source.timing.startSeconds < sequence.startSeconds || source.timing.endSeconds > sequence.endSeconds || source.timing.endSeconds <= source.timing.startSeconds)) add("BLOCKED", "DIALOGUE_TIMING_INVALID", `Dialogue ${line.id} is outside the sequence time range.`, line.id);
  }
  const shotTotal = state.shots.reduce((sum, shot) => sum + shot.durationSeconds, 0);
  if (shotTotal !== sequence.durationSeconds) add("BLOCKED", "SHOT_TIMING_INVALID", `Shot Plan totals ${shotTotal}s but the sequence requires ${sequence.durationSeconds}s.`);
  if (sequence.durationSeconds > profile.maxDurationSeconds) add("BLOCKED", "PLATFORM_DURATION_EXCEEDED", `${profile.name} profile v${profile.version} allows at most ${profile.maxDurationSeconds}s, but this sequence is ${sequence.durationSeconds}s.`);
  if (!profile.durationSupport.includes(sequence.durationSeconds)) add("WARNING", "PLATFORM_DURATION_NOT_LISTED", `${sequence.durationSeconds}s is not listed in ${profile.name} profile v${profile.version} duration support (${profile.durationSupport.join(", ")}s).`);
  if (state.storyboardGrid.enabled && !profile.storyboardGridSupport) add("BLOCKED", "STORYBOARD_GRID_UNSUPPORTED", `${profile.name} profile v${profile.version} does not support Storyboard Grid references.`);
  if (state.storyboardGrid.enabled && state.storyboardGrid.panels.length !== 9) add("BLOCKED", "STORYBOARD_GRID_INCOMPLETE", "An enabled Storyboard Grid must contain exactly nine ordered panels derived from the Shot Planner.");
  if (state.storyboardGrid.enabled && !state.storyboardGrid.imagePath) add("WARNING", "STORYBOARD_GRID_REFERENCE_MISSING", "The optional Storyboard Grid plan is compiled, but no composite grid image is attached. Shot Planner prompts remain usable.");
  project.memory.productionMemory.continuity.warnings.filter((warning) => warning.currentSequenceId === sequence.id && warning.status === "OPEN").forEach((warning) => add(warning.severity === "BLOCKING" ? "BLOCKED" : "WARNING", warning.code, `${warning.field}: expected ${warning.expected}; found ${warning.conflicting}.`, warning.id));
  for (const reference of state.references.filter((item) => item.required && item.missing)) add("BLOCKED", "MISSING_REQUIRED_ASSET", `${reference.assetName} (${reference.permanentFilename}) has no usable image.`, reference.assetId);
  const selected = state.references.filter((reference) => reference.selected);
  if (state.references.length > profile.maxReferences && limitMode === "REVIEW") add("BLOCKED", "REFERENCE_LIMIT_WARNING", `Required references: ${state.references.length}. ${profile.name} supports ${profile.maxReferences}. Choose the recommended set, choose manually, change platform, or merge a reference sheet.`);
  if (selected.length > profile.maxReferences && limitMode !== "MERGED_SHEET") add("BLOCKED", "REFERENCE_LIMIT_EXCEEDED", `${selected.length} references are selected but ${profile.name} supports ${profile.maxReferences}.`);
  selected.forEach((reference, index) => {
    if (reference.platformUploadPosition !== index + 1 || reference.promptTag !== platformTag(profile, index + 1, reference.assetName)) add("BLOCKED", "REFERENCE_MAPPING_INVALID", `${reference.assetName} does not match upload position ${index + 1}.`, reference.assetId);
  });
  if (new Set(selected.map((reference) => reference.promptTag)).size !== selected.length) add("BLOCKED", "REFERENCE_MAPPING_DUPLICATE", "Every distinct reference must have one unique platform prompt tag and upload position.");
  const startSaysKnifeMissing = /knife[^.;]*(?:missing|dropped|lost|none)|(?:missing|dropped|lost|no)[^.;]*knife/i.test(state.startState);
  const knifeRestored = [...state.actions, ...state.weapons, ...state.props].some((value) => /(?:carries|holds|has|grabs|wears|belt)[^.;]*knife|knife[^.;]*(?:carried|held|belt)/i.test(value));
  if (startSaysKnifeMissing && knifeRestored) add("BLOCKED", "DROPPED_KNIFE_RESTORED", `${sequence.id} inherits the knife as missing, but the compiled action or asset list restores it.`);
  if (startSaysKnifeMissing && state.references.some((reference) => /knife/i.test(reference.assetName) && reference.selected)) add("BLOCKED", "DROPPED_KNIFE_REFERENCED", `${sequence.id} must not include a carried-knife reference after the knife was dropped.`);
  if (!issues.length) add("VALID", "PROMPT_VALID", "Prompt State, dialogue, shots, continuity, references, and platform mapping are valid.");
  const status = issues.some((issue) => issue.level === "BLOCKED") ? "BLOCKED" : issues.some((issue) => issue.level === "WARNING") ? "WARNING" : "VALID";
  return { status, issues, checkedAt: now() };
};

const dnaVisuals = (project: MovieProject) => MOVIE_DNA_CATALOG.flatMap((category) => {
  const selection = project.production.movieDna.selections[category.id];
  if (!selection) return [];
  const optionId = selection.optionIds?.[0];
  const option = optionId ? movieDnaOption(category.id, optionId) ?? project.production.movieDna.customOptions[category.id]?.find((item) => item.id === optionId) : undefined;
  return [{ categoryId: category.id, categoryName: category.name, label: selection.label, previewPath: selection.previewPath, sheet: option?.sheet ?? selection.contactSheet ?? "look", visualIndex: option?.visualIndex ?? selection.visualIndex ?? 0 }];
});

const createState = (project: MovieProject, sequence: ScriptProductionSequence, platform: TargetPlatform, prior?: SequencePromptRecord, sharedState?: SequencePromptState): SequencePromptState => {
  const createdAt = sharedState?.createdAt ?? prior?.state.createdAt ?? now();
  const profile = project.production.platformProfiles[platform];
  const script = project.memory.productionMemory.script;
  const previous = script.sequences.find((item) => item.id === sequence.previousSequenceId);
  const scenes = script.scenes.filter((scene) => sequence.sceneIds.includes(scene.id));
  const timeline = project.memory.productionMemory.storyTimeline.events.find((event) => event.sequenceId === sequence.id);
  const startSnapshot = project.memory.productionMemory.continuity.snapshots.find((snapshot) => snapshot.sequenceId === sequence.id && snapshot.anchor === "START");
  const unavailableAssetIds = new Set(startSnapshot?.entities.filter((entity) => entity.dropped || entity.lost || entity.destroyed || entity.visible === false).map((entity) => entity.entityId) ?? []);
  for (const asset of project.production.assets) {
    const escapedId = asset.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`${escapedId}[^|\\n]*(?:dropped|lost|destroyed|not visible)`, "i").test(sequence.startState)) unavailableAssetIds.add(asset.id);
  }
  const unavailableAssetLabels = [...unavailableAssetIds].map((id) => {
    const asset = project.production.assets.find((item) => item.id === id);
    const storyIdentifiesKnife = asset?.category === "weapon" && /knife/i.test(`${project.idea} ${project.production.story.content}`);
    return `${storyIdentifiesKnife ? "knife" : asset?.name ?? id} [${id}]`;
  });
  const continuityStartState = unavailableAssetLabels.length
    ? `${sequence.startState}\nUnavailable assets at START: ${unavailableAssetLabels.join(", ")} are dropped, lost, destroyed, or not visible. Do not restore, carry, or reference them.`
    : sequence.startState;
  const dialogue = script.dialogue.filter((line) => sequence.dialogueIds.includes(line.id)).map((line) => {
    const character = project.production.characters.find((item) => item.id === line.speakerCharacterId);
    return { id: line.id, speakerCharacterId: line.speakerCharacterId, speakerName: character?.name ?? line.speakerCharacterId, exactDialogue: line.exactDialogue, language: line.language, accent: line.accent, emotion: line.emotion, delivery: line.delivery, timing: line.timing.label, voiceIdentity: line.audioVoiceProfileId, lockState: line.lockState, approvalState: line.approvalState };
  });
  const characters = sequence.characterIds.map((id) => project.production.characters.find((character) => character.id === id)).filter((character) => character !== undefined).map((character) => {
    const entity = startSnapshot?.entities.find((item) => item.entityId === character.id);
    return { id: character.id, name: character.name, identityAnchor: characterIdentityAnchor(character), motivation: character.motivation, knowledge: entity?.knowledge ?? [], emotion: entity?.emotionalState ?? sequence.emotion, performance: `${entity?.emotionalState ?? sequence.emotion}; ${entity?.physicalCondition ?? "perform the approved Story action with motivated body movement"}.`, identityReferenceId: character.referenceIds[0] };
  });
  const characterStates = sequence.characterStateIds.flatMap((stateId) => project.production.characters.flatMap((character) => character.states.filter((item) => item.id === stateId).map((item) => ({ id: item.id, characterId: character.id, label: `${character.name} · ${sequence.id} State`, physicalState: item.physical, costume: item.wardrobe, injuries: item.injuries, props: item.possessions.join(", ") || "No carried props", location: item.locationId }))));
  const assets = sequence.assetRequirements.filter((requirement) => !unavailableAssetIds.has(requirement.assetId)).map((requirement) => project.production.assets.find((asset) => asset.id === requirement.assetId)).filter((asset): asset is ProductionAssetRecord => Boolean(asset));
  const byCategory = (categories: string[]) => assets.filter((asset) => categories.includes(asset.category)).map((asset) => `${asset.id} · ${asset.name}`);
  const locationAsset = project.production.assets.find((asset) => asset.id === sequence.locationId) ?? assets.find((asset) => ["location", "set", "building", "room", "environment"].includes(asset.category));
  const shots = script.shots.filter((shot) => sequence.shotIds.includes(shot.id)).sort((a, b) => a.number - b.number).map((shot) => ({ id: shot.id, number: shot.number, durationSeconds: shot.durationSeconds, framing: shot.framing, camera: `${shot.shotType} · ${shot.cameraAngle}`, lens: shot.lens, focalLength: shot.focalLength, depthOfField: shot.depthOfField, movement: shot.cameraMovement, action: shot.subjectAction, dialogueIds: [...shot.dialogueIds], continuityPurpose: shot.continuityPurpose }));
  const selections = Object.fromEntries(Object.entries(project.production.movieDna.selections).map(([key, selection]) => [key, selection.promptDescription || selection.technicalDescription || selection.label]));
  const snapshotEntities = startSnapshot?.entities.map((entity) => ({ entityId: entity.entityId, identityId: entity.identityId, characterStateId: entity.characterStateId ?? "", location: entity.location, position: entity.position, movement: entity.movement, screenDirection: entity.screenDirection, clothing: entity.clothing, dirt: entity.dirt, injuries: entity.injuries.join(", ") || "None", propsCarried: entity.propsCarried.join(", ") || "None", weapons: entity.weapons.join(", ") || "None", emotionalState: entity.emotionalState, knowledge: entity.knowledge.join(", "), relationships: entity.relationships.join(", "), condition: entity.condition })) ?? [];
  const audioBible = project.memory.productionMemory.audioBible;
  const references = buildReferences(project, sequence, profile, prior, unavailableAssetIds);
  const storyboardGrid = structuredClone(storyboardGridForSequence(project, sequence.id));
  const styleAnchor = unique([
    selections.colorGrade,
    selections.lighting,
    selections.lensStyle,
    selections.grain,
    selections.cameraMovement,
    `aspect ratio ${project.aspectRatio}`,
  ]).join("; ");
  const state: SequencePromptState = {
    promptStateId: sharedState?.promptStateId ?? prior?.state.promptStateId ?? `PROMPT_STATE_${sequence.id}_${randomUUID().slice(0, 8).toUpperCase()}`,
    projectId: project.id,
    sequenceId: sequence.id,
    sequenceNumber: sequence.number,
    platform,
    projectSettings: { title: project.movieTitle || project.title, durationSeconds: sequence.durationSeconds, timeRange: sequence.timeRange, aspectRatio: project.aspectRatio, resolution: project.resolution, historicalPeriod: project.era, genre: project.genre, filmLanguage: project.filmLanguage, dialogueLanguage: project.dialogueLanguage },
    movieDNA: selections,
    movieDnaVisuals: dnaVisuals(project),
    storyContext: { happenedBefore: previous?.endState ?? "This is the opening sequence.", purpose: sequence.storyPurpose, characterKnowledge: characters.flatMap((character) => character.knowledge), characterMotivation: characters.map((character) => `${character.name}: ${character.motivation}`), emotion: sequence.emotion, conflict: sequence.conflict, turningPoint: timeline?.storyConsequence ?? sequence.midState, changesDuringSequence: timeline?.storyConsequence ?? sequence.storyBeat, requiredEnding: sequence.endState },
    filmBibleContext: { ...project.production.filmBible.sections },
    characters,
    characterStates,
    emotion: sequence.emotion,
    performance: characters.map((character) => `${character.name}: ${character.performance}`),
    actions: unique([...sequence.actions, ...scenes.flatMap((scene) => scene.importantVisualActions), ...scenes.map((scene) => scene.action)]),
    dialogue,
    location: { id: sequence.locationId, name: locationAsset?.name ?? sequence.locationId, description: locationAsset?.description ?? startSnapshot?.global.environmentState.join("; ") ?? "Approved Story location", imagePath: locationAsset?.thumbnailPath ?? locationAsset?.imagePath, projectImageNumber: locationAsset?.number },
    environment: { timeOfDay: timeline?.timeOfDay ?? startSnapshot?.global.timeOfDay ?? "Story-defined", weather: startSnapshot?.global.weather ?? project.memory.productionMemory.continuity.currentGlobal.weather, lighting: startSnapshot?.global.lighting ?? project.memory.productionMemory.continuity.currentGlobal.lighting, globalLocation: locationAsset?.name ?? sequence.locationId, condition: startSnapshot?.global.environmentState.join("; ") ?? "Preserve the inherited environment state." },
    props: byCategory(["prop", "story_object", "accessory"]),
    vehicles: byCategory(["vehicle"]),
    weapons: byCategory(["weapon"]),
    animals: byCategory(["animal"]),
    creatures: byCategory(["creature"]),
    costumes: byCategory(["costume"]),
    shots,
    styleAnchor,
    storyboardGrid,
    camera: { language: selections.cameraMovement ?? selections.cinematography ?? "Motivated camera language", framing: selections.framing ?? shots.map((shot) => shot.framing).join(", "), movement: shots.map((shot) => `${pad(shot.number)} ${shot.movement}`).join("; ") },
    lens: { style: selections.lensStyle ?? "Approved Movie DNA lens style", focalLength: selections.focalLength ?? unique(shots.map((shot) => shot.focalLength)).join(", "), depthOfField: selections.depthOfField ?? unique(shots.map((shot) => shot.depthOfField)).join(", ") },
    lighting: { style: selections.lighting ?? startSnapshot?.global.lighting ?? "Continuity lighting", exposure: selections.exposure ?? "Preserve approved exposure", grade: selections.colorGrade ?? "Preserve locked colour grade" },
    audio: { voices: dialogue.map((line) => `${line.speakerName}: ${line.voiceIdentity ?? "Permanent voice profile required"}`), ambient: audioBible.ambientSounds.map((item) => `${item.name}: ${item.description}`), soundEffects: audioBible.soundEffects.map((item) => `${item.name}: ${item.description}`), narrationRules: audioBible.narrationEnabled && audioBible.narrator ? [`${audioBible.narrator.identity}: ${audioBible.narrator.delivery}`] : ["Narration disabled."], musicRules: audioBible.musicRules, silenceRules: audioBible.intentionalSilenceRules },
    continuity: { summary: startSnapshot ? `Inherited from ${startSnapshot.inheritedFromSnapshotId ?? "approved production memory"}.` : sequence.startState, entities: snapshotEntities, screenDirection: snapshotEntities.map((entity) => entity.screenDirection).filter(Boolean).join("; ") || "Preserve established screen direction", movementDirection: snapshotEntities.map((entity) => entity.movement).filter(Boolean).join("; ") || "Preserve established movement", weather: startSnapshot?.global.weather ?? "Preserve current weather", lighting: startSnapshot?.global.lighting ?? "Preserve current lighting" },
    startState: continuityStartState,
    midState: sequence.midState,
    endState: sequence.endState,
    references,
    negativeRules: unique([...project.production.permanentNegativeRules, ...project.production.movieDna.negativeRules, ...sequence.negativeRules]),
    platformSettings: { profileId: profile.id, profileVersion: profile.version, promptStyle: profile.promptStyle, referenceSyntax: profile.referenceSyntax, maxReferences: profile.maxReferences, maxDurationSeconds: profile.maxDurationSeconds, durationSupport: profile.durationSupport, audioSupport: profile.audioSupport, storyboardGridSupport: profile.storyboardGridSupport, storyboardGridBehavior: profile.storyboardGridBehavior, firstFrameSupport: profile.firstFrameSupport, lastFrameSupport: profile.lastFrameSupport, videoContinuationSupport: profile.videoContinuationSupport, instructions: profile.instructions },
    sequenceOverrides: { ...(sharedState?.sequenceOverrides ?? prior?.state.sequenceOverrides ?? {}) },
    validation: { status: "VALID", issues: [], checkedAt: now() },
    sourceVersions: sourceVersion(project, sequence.id),
    knowledgeSourceIds: project.production.knowledgeSources.filter((source) => source.status === "ACTIVE").map((source) => source.id),
    version: Math.max(prior?.state.version ?? 0, sharedState?.version ?? 0) + 1,
    status: "DRAFT",
    createdAt,
    updatedAt: now(),
  };
  applyOverrides(state);
  state.validation = validation(project, sequence, state, profile, prior?.referenceLimitMode ?? "REVIEW");
  state.status = state.validation.status;
  return state;
};

const section = (id: string, body: string) => `[[SECTION:${id}]]\n${body.trim()}`;
const lines = (values: string[]) => values.length ? values.map((value, index) => `${index + 1}. ${value}`).join("\n") : "None.";

export const renderNormalPrompt = (state: SequencePromptState, profile: PlatformProfile) => [
  section("PROJECT", `${state.projectSettings.title} · Sequence ${pad(state.sequenceNumber)} · ${state.projectSettings.timeRange} · ${state.projectSettings.durationSeconds}s\nTarget platform: ${state.platform} · Aspect ratio: ${state.projectSettings.aspectRatio} · Resolution: ${state.projectSettings.resolution}`),
  section("MOVIE_DNA", Object.entries(state.movieDNA).map(([key, value]) => `${key}: ${value}`).join("\n")),
  section("STORY_CONTEXT", `Immediately before: ${state.storyContext.happenedBefore}\nWhy this sequence exists: ${state.storyContext.purpose}\nCharacter knowledge: ${list(state.storyContext.characterKnowledge)}\nCharacter motivation: ${list(state.storyContext.characterMotivation)}\nEmotion: ${state.storyContext.emotion}\nConflict: ${state.storyContext.conflict}\nTurning point: ${state.storyContext.turningPoint}\nWhat changes: ${state.storyContext.changesDuringSequence}\nRequired ending: ${state.storyContext.requiredEnding}`),
  section("FILM_BIBLE", Object.entries(state.filmBibleContext).map(([key, value]) => `${key}: ${value}`).join("\n")),
  section("CHARACTERS", state.characters.map((character) => `${character.name} [${character.id}] — IDENTITY ANCHOR: ${character.identityAnchor}\nMotivation: ${character.motivation}; knows: ${list(character.knowledge)}; emotion/performance: ${character.performance}`).join("\n\n")),
  section("CHARACTER_STATES", state.characterStates.map((item) => `${item.label} [${item.id}] — physical: ${item.physicalState}; costume: ${item.costume}; injuries: ${item.injuries}; props: ${item.props}; location: ${item.location}`).join("\n")),
  section("PERFORMANCE", `Overall emotion: ${state.emotion}\n${lines(state.performance)}`),
  section("ACTIONS", lines(state.actions)),
  section("LOCATION_ENVIRONMENT", `${state.location.name} [${state.location.id}] — ${state.location.description}\nTime: ${state.environment.timeOfDay}. Weather: ${state.environment.weather}. Lighting: ${state.environment.lighting}. Condition: ${state.environment.condition}.`),
  section("PRODUCTION_ASSETS", `Props: ${list(state.props)}\nVehicles: ${list(state.vehicles)}\nWeapons: ${list(state.weapons)}\nAnimals: ${list(state.animals)}\nCreatures: ${list(state.creatures)}\nCostumes: ${list(state.costumes)}`),
  section("SHOT_PLAN", state.shots.map((shot) => `SHOT ${pad(shot.number)} · ${shot.durationSeconds}s · ${shot.camera} · ${shot.framing} · ${shot.lens} · ${shot.focalLength} · ${shot.depthOfField} · ${shot.movement}\nAction: ${shot.action}\nDialogue relation: ${shot.dialogueIds.join(", ") || "None"}. Continuity purpose: ${shot.continuityPurpose}`).join("\n\n")),
  section("STORYBOARD_GRID", state.storyboardGrid.enabled ? `OPTIONAL GRID ENABLED · ${state.storyboardGrid.status} · Source: existing Shot Planner (never replaced).\nPermanent reference: ${state.storyboardGrid.projectImageNumber !== undefined ? `Project Image ${pad(state.storyboardGrid.projectImageNumber)} · ${state.storyboardGrid.permanentFilename}` : "not allocated"}.\n${state.storyboardGrid.panels.map((panel) => `PANEL ${pad(panel.number)} · ${panel.beat}\nCAM: ${panel.camera}. MOVE: ${panel.movement}. ${panel.annotationType}: ${panel.annotation}.`).join("\n")}` : "Optional Storyboard Grid disabled. The existing Shot Planner remains the authoritative shot plan."),
  section("STYLE_ANCHOR", state.styleAnchor),
  section("CAMERA", Object.entries(state.camera).map(([key, value]) => `${key}: ${value}`).join("\n") + `\nLens style: ${state.lens.style}. Focal length: ${state.lens.focalLength}. Depth of field: ${state.lens.depthOfField}.`),
  section("LIGHTING", Object.entries(state.lighting).map(([key, value]) => `${key}: ${value}`).join("\n")),
  section("DIALOGUE", state.dialogue.length ? state.dialogue.map((dialogue) => `${dialogue.speakerName} [${dialogue.id}] — EXACT: ${dialogue.exactDialogue}\nLanguage: ${dialogue.language}. Accent: ${dialogue.accent}. Emotion: ${dialogue.emotion}. Delivery: ${dialogue.delivery}. Timing: ${dialogue.timing}. Voice: ${dialogue.voiceIdentity ?? "Permanent voice profile"}. Lock: ${dialogue.lockState}.`).join("\n\n") : "Dialogue disabled or no dialogue in this sequence."),
  section("AUDIO", `Voices: ${list(state.audio.voices)}\nAmbient: ${list(state.audio.ambient)}\nSound effects: ${list(state.audio.soundEffects)}\nNarration: ${list(state.audio.narrationRules)}\nMusic: ${list(state.audio.musicRules)}\nIntentional silence: ${list(state.audio.silenceRules)}`),
  section("START_MID_END", `START STATE: ${state.startState}\nMID STATE: ${state.midState}\nEND STATE: ${state.endState}`),
  section("CONTINUITY", `${state.continuity.summary}\nScreen direction: ${state.continuity.screenDirection}. Movement direction: ${state.continuity.movementDirection}. Weather: ${state.continuity.weather}. Lighting: ${state.continuity.lighting}.\n${state.continuity.entities.map((entity) => Object.entries(entity).map(([key, value]) => `${key}=${value}`).join("; ")).join("\n")}`),
  section("REFERENCES", state.references.filter((reference) => reference.selected).map((reference) => `${reference.promptTag} — ${reference.referenceRole}; controls ${reference.assetName}. Project Image ${pad(reference.permanentProjectImageNumber)} remains ${reference.permanentFilename}; package file ${reference.packageFilename}.`).join("\n")),
  section("NEGATIVE_RULES", lines(state.negativeRules)),
  section("PLATFORM_INSTRUCTIONS", `${profile.name} profile v${profile.version}. ${profile.instructions}\nPrompt style: ${profile.promptStyle}\nDuration: supported ${profile.durationSupport.join(", ")}s; maximum ${profile.maxDurationSeconds}s.\nReferences: maximum ${profile.maxReferences}; syntax ${profile.referenceSyntax}.\nStoryboard Grid: ${profile.storyboardGridSupport ? profile.storyboardGridBehavior : "Not supported by this profile version."}\nCamera syntax: ${profile.cameraSyntaxPreferences}\nDialogue: ${profile.dialogueSupport}\nAudio: ${profile.audioSupport}\nNegative prompts: ${profile.negativePromptBehavior}\nRestrictions: ${list(profile.knownRestrictions)}\nExport rules: ${list(profile.exportRules)}`),
].join("\n\n");

export const promptStateJsonObject = (state: SequencePromptState, normalPrompt: string) => ({
  project: state.projectSettings,
  sequence: { id: state.sequenceId, number: state.sequenceNumber, duration_seconds: state.projectSettings.durationSeconds, time_range: state.projectSettings.timeRange, start_state: state.startState, mid_state: state.midState, end_state: state.endState },
  platform: { id: state.platform, ...state.platformSettings },
  movie_dna: state.movieDNA,
  story_context: state.storyContext,
  film_bible_context: state.filmBibleContext,
  characters: state.characters,
  character_states: state.characterStates,
  performance: { emotion: state.emotion, instructions: state.performance },
  actions: state.actions,
  dialogue: state.dialogue,
  location: state.location,
  environment: state.environment,
  assets: { props: state.props, vehicles: state.vehicles, weapons: state.weapons, animals: state.animals, creatures: state.creatures, costumes: state.costumes },
  shots: state.shots,
  style_anchor: state.styleAnchor,
  storyboard_grid: state.storyboardGrid,
  camera: state.camera,
  lens: state.lens,
  lighting: state.lighting,
  audio: state.audio,
  continuity: state.continuity,
  references: state.references,
  negative_rules: state.negativeRules,
  platform_instructions: state.platformSettings,
  sequence_overrides: state.sequenceOverrides,
  validation: state.validation,
  knowledge_sources: state.knowledgeSourceIds,
  final_prompt: normalPrompt,
});

export const renderJsonPrompt = (state: SequencePromptState, normalPrompt: string) => JSON.stringify(promptStateJsonObject(state, normalPrompt), null, 2);

const applyOverrides = (state: SequencePromptState) => {
  const overrides = state.sequenceOverrides;
  if (overrides.ACTIONS) state.actions = overrides.ACTIONS.split("\n").map((value) => value.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean);
  if (overrides.PERFORMANCE) state.performance = overrides.PERFORMANCE.split("\n").map((value) => value.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean);
  if (overrides.EMOTION) state.emotion = overrides.EMOTION;
  if (overrides.CAMERA) state.camera.language = overrides.CAMERA;
  if (overrides.LIGHTING) state.lighting.style = overrides.LIGHTING;
};

const syncLegacyPrompt = (project: MovieProject, record: SequencePromptRecord) => {
  const sequence = project.production.sequences.find((item) => item.id === record.sequenceId);
  if (!sequence) return;
  sequence.compiledPrompt = record.normalPrompt;
  sequence.promptSections = parseNormalSections(record.normalPrompt);
  sequence.negativePrompt = record.state.negativeRules.join(" ");
  sequence.referenceSlots = record.state.references.filter((reference) => reference.selected).map((reference) => ({ slot: reference.platformUploadPosition!, assetId: reference.assetId, tag: reference.promptTag!, required: reference.required }));
  if (record.state.validation.status !== "BLOCKED" && sequence.status === "PLANNED") sequence.status = "READY";
};

const finalizeRecord = (project: MovieProject, record: SequencePromptRecord, reason: string, addVersion = true) => {
  const profile = project.production.platformProfiles[record.platform];
  record.state.validation = validation(project, sequenceSource(project, record.sequenceId), record.state, profile, record.referenceLimitMode);
  record.state.status = record.outdatedReasons.length ? "PROMPT_OUTDATED" : record.state.validation.status;
  record.state.updatedAt = now();
  record.normalPrompt = renderNormalPrompt(record.state, profile);
  record.jsonPrompt = renderJsonPrompt(record.state, record.normalPrompt);
  record.updatedAt = now();
  if (addVersion) record.versions.push({ version: record.versions.length + 1, platform: record.platform, normalPrompt: record.normalPrompt, jsonPrompt: record.jsonPrompt, referenceManifest: structuredClone(record.state.references), validation: structuredClone(record.state.validation), reason, createdAt: now() });
  project.production.promptWorkspace.records[recordKey(record.sequenceId, record.platform)] = record;
  project.production.promptWorkspace.selectedPlatforms[record.sequenceId] = record.platform;
  project.production.promptWorkspace.updatedAt = now();
  syncLegacyPrompt(project, record);
  return record;
};

export const compileSequencePrompt = (project: MovieProject, sequenceId: string, platform?: TargetPlatform, reason = "Compiled from current structured production state") => {
  const target = platform ?? project.production.promptWorkspace.selectedPlatforms[sequenceId] ?? project.targetPlatform;
  const key = recordKey(sequenceId, target);
  const previous = project.production.promptWorkspace.records[key];
  const sharedRecord = Object.values(project.production.promptWorkspace.records)
    .filter((record) => record.sequenceId === sequenceId)
    .sort((a, b) => b.state.version - a.state.version || b.updatedAt.localeCompare(a.updatedAt))[0] ?? previous;
  const state = createState(project, sequenceSource(project, sequenceId), target, previous, sharedRecord?.state);
  const record: SequencePromptRecord = previous ? { ...previous, state, platform: target, sequenceId, pendingChange: undefined, outdatedReasons: [], updatedAt: now() } : { sequenceId, platform: target, state, normalPrompt: "", jsonPrompt: "", versions: [], outdatedReasons: [], referenceLimitMode: "REVIEW", updatedAt: now() };
  return finalizeRecord(project, record, reason, true);
};

export const compileAllSequencePrompts = (project: MovieProject, platform?: TargetPlatform) => project.memory.productionMemory.script.sequences.map((sequence) => compileSequencePrompt(project, sequence.id, platform));

export const getSequencePromptRecord = (project: MovieProject, sequenceId: string, platform?: TargetPlatform) => {
  const target = platform ?? project.production.promptWorkspace.selectedPlatforms[sequenceId] ?? project.targetPlatform;
  return project.production.promptWorkspace.records[recordKey(sequenceId, target)] ?? compileSequencePrompt(project, sequenceId, target);
};

export const parseNormalSections = (text: string) => {
  const sections: Record<string, string> = {};
  const expression = /^\[\[SECTION:([A-Z0-9_]+)\]\]\r?\n([\s\S]*?)(?=^\[\[SECTION:|\s*$)/gm;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(text))) sections[match[1]!] = match[2]!.trim();
  return sections;
};

const review = (field: string, changedText: string, currentValue: string, proposedValue: string, conflict?: string): SequencePromptChangeReview => ({ id: `PROMPT_CHANGE_${randomUUID().slice(0, 8).toUpperCase()}`, changedText, likelyAffectedField: field, currentValue, proposedValue, conflict, createdAt: now() });

export const updatePromptFromNormal = (project: MovieProject, sequenceId: string, platform: TargetPlatform, text: string) => {
  const record = getSequencePromptRecord(project, sequenceId, platform);
  const current = parseNormalSections(record.normalPrompt);
  const proposed = parseNormalSections(text);
  if (!Object.keys(proposed).length) {
    record.pendingChange = review("normal_prompt", text, record.normalPrompt, text, "Stable section boundaries are missing, so the edit cannot be mapped safely.");
    return finalizeRecord(project, record, "Ambiguous Normal Prompt edit held for review", false);
  }
  const immutable = ["PROJECT", "MOVIE_DNA", "FILM_BIBLE", "CHARACTERS", "CHARACTER_STATES", "STORYBOARD_GRID", "STYLE_ANCHOR", "DIALOGUE", "START_MID_END", "CONTINUITY", "REFERENCES"];
  const changedImmutable = immutable.find((key) => proposed[key] !== undefined && proposed[key] !== current[key]);
  if (changedImmutable) {
    const conflict = changedImmutable === "DIALOGUE" && record.state.dialogue.some((line) => line.lockState === "LOCKED") ? "Locked Dialogue cannot be rewritten during prompt compilation." : `${changedImmutable.replaceAll("_", " ")} is an approved project source and requires Change Impact review.`;
    record.pendingChange = review(changedImmutable, proposed[changedImmutable]!, current[changedImmutable] ?? "", proposed[changedImmutable]!, conflict);
    return finalizeRecord(project, record, "Protected Normal Prompt edit held for review", false);
  }
  if (proposed.ACTIONS !== undefined && proposed.ACTIONS !== current.ACTIONS) record.state.sequenceOverrides.ACTIONS = proposed.ACTIONS;
  if (proposed.PERFORMANCE !== undefined && proposed.PERFORMANCE !== current.PERFORMANCE) {
    const emotion = proposed.PERFORMANCE.match(/^Overall emotion:\s*(.+)$/mi)?.[1]?.trim();
    if (emotion) record.state.sequenceOverrides.EMOTION = emotion;
    record.state.sequenceOverrides.PERFORMANCE = proposed.PERFORMANCE.replace(/^Overall emotion:\s*.+(?:\r?\n|$)/mi, "").trim();
  }
  if (proposed.CAMERA !== undefined && proposed.CAMERA !== current.CAMERA) record.state.sequenceOverrides.CAMERA = proposed.CAMERA.match(/^language:\s*(.+)$/mi)?.[1]?.trim() ?? proposed.CAMERA;
  if (proposed.LIGHTING !== undefined && proposed.LIGHTING !== current.LIGHTING) record.state.sequenceOverrides.LIGHTING = proposed.LIGHTING.match(/^style:\s*(.+)$/mi)?.[1]?.trim() ?? proposed.LIGHTING;
  applyOverrides(record.state);
  record.state.version += 1;
  record.pendingChange = undefined;
  return finalizeRecord(project, record, "Normal Prompt sequence override saved", true);
};

export const updatePromptFromJson = (project: MovieProject, sequenceId: string, platform: TargetPlatform, text: string) => {
  const record = getSequencePromptRecord(project, sequenceId, platform);
  let parsed: Record<string, any>;
  try { parsed = JSON.parse(text) as Record<string, any>; }
  catch (error) {
    record.pendingChange = review("json_prompt", text, record.jsonPrompt, text, `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return finalizeRecord(project, record, "Invalid JSON held for review", false);
  }
  const current = promptStateJsonObject(record.state, record.normalPrompt) as Record<string, any>;
  for (const key of ["movie_dna", "characters", "character_states", "style_anchor", "storyboard_grid", "dialogue", "continuity"]) {
    if (parsed[key] !== undefined && JSON.stringify(parsed[key]) !== JSON.stringify(current[key])) {
      const conflict = key === "dialogue" && record.state.dialogue.some((line) => line.lockState === "LOCKED") ? "Locked Dialogue cannot be rewritten from JSON." : `${key.replaceAll("_", " ")} is a protected project source.`;
      record.pendingChange = review(key, JSON.stringify(parsed[key], null, 2), JSON.stringify(current[key], null, 2), JSON.stringify(parsed[key], null, 2), conflict);
      return finalizeRecord(project, record, "Protected JSON edit held for review", false);
    }
  }
  if (Array.isArray(parsed.actions) && JSON.stringify(parsed.actions) !== JSON.stringify(current.actions)) record.state.sequenceOverrides.ACTIONS = parsed.actions.map(normalizeText).filter(Boolean).map((value: string, index: number) => `${index + 1}. ${value}`).join("\n");
  const emotion = normalizeText(parsed.performance?.emotion);
  if (emotion && emotion !== record.state.emotion) record.state.sequenceOverrides.EMOTION = emotion;
  if (Array.isArray(parsed.performance?.instructions) && JSON.stringify(parsed.performance.instructions) !== JSON.stringify(record.state.performance)) record.state.sequenceOverrides.PERFORMANCE = parsed.performance.instructions.map(normalizeText).filter(Boolean).map((value: string, index: number) => `${index + 1}. ${value}`).join("\n");
  if (parsed.camera && JSON.stringify(parsed.camera) !== JSON.stringify(current.camera)) record.state.sequenceOverrides.CAMERA = normalizeText(parsed.camera.language ?? parsed.camera.movement ?? JSON.stringify(parsed.camera));
  if (parsed.lighting && JSON.stringify(parsed.lighting) !== JSON.stringify(current.lighting)) record.state.sequenceOverrides.LIGHTING = normalizeText(parsed.lighting.style ?? JSON.stringify(parsed.lighting));
  applyOverrides(record.state);
  record.state.version += 1;
  record.pendingChange = undefined;
  return finalizeRecord(project, record, "JSON Prompt sequence override saved", true);
};

export const resolvePromptChange = (project: MovieProject, sequenceId: string, platform: TargetPlatform, action: "APPLY" | "KEEP_OVERRIDE" | "CANCEL" | "APPLY_PROJECT") => {
  const record = getSequencePromptRecord(project, sequenceId, platform);
  const pending = record.pendingChange;
  if (!pending) return record;
  if (action === "CANCEL") record.pendingChange = undefined;
  else if (action === "APPLY_PROJECT") {
    pending.impact = assessChangeImpact(project, pending.likelyAffectedField === "MOVIE_DNA" ? "movie_dna" : pending.likelyAffectedField === "DIALOGUE" ? "dialogue" : "sequence", pending.likelyAffectedField === "DIALOGUE" ? record.state.dialogue[0]?.id : sequenceId) as ChangeImpactReport;
    return finalizeRecord(project, record, "Change Impact review prepared", false);
  } else {
    if (pending.likelyAffectedField === "DIALOGUE" && record.state.dialogue.some((line) => line.lockState === "LOCKED")) throw new Error("Locked Dialogue cannot be changed or stored as a prompt override.");
    record.state.sequenceOverrides[pending.likelyAffectedField] = pending.proposedValue;
    record.pendingChange = undefined;
    record.state.version += 1;
  }
  return finalizeRecord(project, record, action === "KEEP_OVERRIDE" ? "Ambiguous edit kept as sequence override" : action === "APPLY" ? "Reviewed prompt change applied" : "Prompt change cancelled", action !== "CANCEL");
};

export const resetSequenceOverrides = (project: MovieProject, sequenceId: string, platform: TargetPlatform) => {
  const record = getSequencePromptRecord(project, sequenceId, platform);
  record.state.sequenceOverrides = {};
  return compileSequencePrompt(project, sequenceId, platform, "Sequence overrides reset from current structured project state");
};

export const setReferenceLimitMode = (project: MovieProject, sequenceId: string, platform: TargetPlatform, mode: SequencePromptRecord["referenceLimitMode"], selectedAssetIds?: string[]) => {
  const record = getSequencePromptRecord(project, sequenceId, platform);
  record.referenceLimitMode = mode;
  const profile = project.production.platformProfiles[platform];
  if (mode === "RECOMMENDED") record.state.references.forEach((reference, index) => { reference.selected = index < profile.maxReferences; });
  if (mode === "MANUAL") {
    const selected = new Set(selectedAssetIds ?? []);
    record.state.references.forEach((reference) => { reference.selected = selected.has(reference.assetId); });
  }
  if (mode === "MERGED_SHEET") record.state.references.forEach((reference, index) => { reference.selected = index === 0; });
  let position = 0;
  record.state.references.forEach((reference) => {
    reference.platformUploadPosition = undefined; reference.promptTag = undefined; reference.packageFilename = undefined;
    if (!reference.selected) return;
    position += 1;
    reference.platformUploadPosition = position;
    reference.promptTag = platformTag(profile, position, reference.assetName);
    reference.packageFilename = packageFilename(position, reference.permanentFilename);
  });
  return finalizeRecord(project, record, `Reference limit mode changed to ${mode}`, true);
};

export const validateSequencePrompt = (project: MovieProject, sequenceId: string, platform: TargetPlatform) => finalizeRecord(project, getSequencePromptRecord(project, sequenceId, platform), "Prompt validation refreshed", false);

export const restorePromptFromState = (project: MovieProject, sequenceId: string, platform: TargetPlatform) => finalizeRecord(project, getSequencePromptRecord(project, sequenceId, platform), "Normal and JSON restored from shared Prompt State", false);

export const refreshPromptOutdatedState = (project: MovieProject) => {
  for (const record of Object.values(project.production.promptWorkspace.records)) {
    const current = sourceVersion(project, record.sequenceId);
    const reasons = Object.entries(current).filter(([key, value]) => record.state.sourceVersions[key] !== value).map(([key]) => `${key.replaceAll(/([A-Z])/g, " $1")} changed`);
    record.outdatedReasons = reasons;
    if (reasons.length) record.state.status = "PROMPT_OUTDATED";
  }
};

export const sequenceReferenceManifest = (record: SequencePromptRecord) => ({
  sequenceNumber: record.state.sequenceNumber,
  sequenceId: record.sequenceId,
  platform: record.platform,
  promptVersion: record.versions.length,
  references: record.state.references.filter((reference) => reference.selected).map((reference) => ({ uploadPosition: reference.platformUploadPosition, promptTag: reference.promptTag, permanentProjectImageNumber: reference.permanentProjectImageNumber, permanentFilename: reference.permanentFilename, packageFilename: reference.packageFilename, assetId: reference.assetId, assetName: reference.assetName, assetType: reference.assetType, referenceRole: reference.referenceRole, reasonRequired: reference.reasonRequired, approvalState: reference.approvalState, lockState: reference.lockState, missing: reference.missing })),
});

export const sequenceReferencePackage = (project: MovieProject, sequenceId: string, platform: TargetPlatform) => {
  const record = getSequencePromptRecord(project, sequenceId, platform);
  const manifest = sequenceReferenceManifest(record);
  return {
    folderName: `Sequence_${pad(record.state.sequenceNumber)}_${platform}`,
    record,
    manifest,
    files: record.state.references.filter((reference) => reference.selected && !reference.missing && reference.sourcePath && reference.packageFilename).map((reference) => ({ sourcePath: reference.sourcePath!, packageFilename: reference.packageFilename! })),
  };
};
