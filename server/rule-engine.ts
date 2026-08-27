import type {
  ApprovalState,
  AssetEntity,
  AssetItem,
  AssetManifestArtifact,
  AssetRelationship,
  ContinuityArtifact,
  ContinuityState,
  FilmBibleArtifact,
  FrameEntity,
  FramePlanArtifact,
  FrameState,
  GenerationPromptEntity,
  MovieProject,
  PhaseId,
  ProductionDatabase,
  ReferenceManifestItem,
  RuleDefinition,
  RuleProfile,
  RuleScope,
  SequenceItem,
  SequencesArtifact,
  StoryArtifact,
  ValidationIssue,
} from "../src/types.js";
import { MiniMaxH3Adapter, Seedance25Adapter } from "./model-adapters.js";
import { cloneFilmRules, createRuleProfiles } from "./rule-catalog.js";
import { createDefaultModelProfiles } from "./model-profiles.js";

const now = () => new Date().toISOString();

export const createProductionDatabase = (projectId: string): ProductionDatabase => ({
  projectId,
  assets: [],
  characters: [],
  creatures: [],
  animals: [],
  locations: [],
  props: [],
  wardrobes: [],
  shots: [],
  frames: [],
  continuityStates: [],
  generationPrompts: [],
  generationResults: [],
  rules: cloneFilmRules(),
  ruleProfiles: createRuleProfiles(),
  validationIssues: [],
  approvals: [],
  relationships: [],
  projectReferences: [],
  continuitySheets: [],
  assetLineage: [],
  storyAssetRequirements: [],
  providerReferenceMappings: [],
  modelProfiles: createDefaultModelProfiles(),
  imageGenerationJobs: [],
  assetDependencies: [],
  sceneAssets: [],
  storyboardFrames: [],
});

const safeId = (value: string) => value.replace(/[^A-Z0-9_]+/gi, "_").toUpperCase();
const approvalRank: Record<ApprovalState, number> = {
  PLANNED: 0,
  PROMPT_READY: 1,
  GENERATING: 1,
  DRAFT: 0,
  GENERATED: 2,
  REVIEW: 3,
  APPROVED: 4,
  LOCKED: 5,
  REJECTED: -1,
  REGENERATE: -1,
  GENERATION_FAILED: -1,
};

const anchorOf = (value: FrameState["state"]): "START" | "MID" | "END" => {
  if (value === "beginning" || value === "start") return "START";
  if (value === "middle" || value === "mid") return "MID";
  return "END";
};

const stateLabel = (anchor: "START" | "MID" | "END"): FrameState["state"] =>
  anchor === "START" ? "start" : anchor === "MID" ? "mid" : "end";

const assetGroup = (asset: AssetEntity) => {
  if (asset.category === "character") return "characters" as const;
  if (asset.category === "creature") return "creatures" as const;
  if (asset.category === "animal") return "animals" as const;
  if (asset.category === "location" || asset.category === "interior") return "locations" as const;
  if (asset.category === "wardrobe") return "wardrobes" as const;
  return "props" as const;
};

const assetPrefix: Record<AssetItem["type"], string> = {
  character: "CHAR",
  creature: "CREATURE",
  animal: "ANIMAL",
  location: "LOC",
  prop: "PROP",
  wardrobe: "WARDROBE",
  vehicle: "VEHICLE",
};

const permanentId = (asset: Pick<AssetItem, "id" | "name" | "type">) => {
  if (/^[A-Z][A-Z0-9_]+_\d{3}$/.test(asset.id)) return asset.id;
  const slug = safeId(asset.name).replace(/^_+|_+$/g, "").slice(0, 28) || "ASSET";
  return `${assetPrefix[asset.type]}_${slug}_001`;
};

const defaultLockedTraits = (asset: AssetItem): Record<string, string> => {
  if (asset.type === "character") {
    return {
      identity: asset.name,
      face: `Approved ${asset.name} face and facial proportions`,
      age: "Story-defined age appearance",
      body: "Approved build, height, and body proportions",
      hair: "Approved hair and hairline",
      clothing: "Approved wardrobe state",
      accessories: "Approved footwear, head covering, and accessories",
    };
  }
  if (asset.type === "animal") {
    return {
      identity: asset.name,
      anatomy: "Approved anatomy, size, limbs, surface, and proportions",
      colour: "Approved coat colour and markings",
      saddle: "Approved saddle",
      ropes: "Approved ropes",
      blanket: "Approved blanket",
      tack: "Approved tack and equipment",
    };
  }
  if (asset.type === "location") {
    return {
      geography: "Approved geography, architecture, entrances, exits, and route",
      period: "Approved period details and recurring objects",
      lighting: "Approved practical sources and landmark light direction",
    };
  }
  return { appearance: asset.description, design: `Approved ${asset.name} design and scale` };
};

const issue = (
  ruleId: string,
  severity: ValidationIssue["severity"],
  title: string,
  detail: string,
  context: Partial<Pick<ValidationIssue, "sequenceId" | "assetId" | "expected" | "observed">> = {},
): ValidationIssue => ({
  id: `ISSUE_${safeId(`${ruleId}_${context.sequenceId || context.assetId || title}`).slice(0, 90)}`,
  ruleId,
  severity,
  category: ruleId.split("_")[0] || "RULE",
  title,
  detail,
  ...context,
  blocking: severity === "BLOCKING",
  resolved: false,
  overridden: false,
  createdAt: now(),
});

const unique = <T>(values: T[]) => [...new Set(values)];

export interface ObservedGeneration {
  characterIds?: string[];
  faces?: Record<string, string>;
  wardrobe?: Record<string, string>;
  props?: string[];
  locationId?: string;
  animalIds?: string[];
  damage?: string[];
  screenDirection?: string;
  timeOfDay?: string;
  assetVersions?: Record<string, number>;
  morphing?: boolean;
}

export class FilmRuleEngine {
  readonly seedance = new Seedance25Adapter();
  readonly minimax = new MiniMaxH3Adapter();

  ensure(project: MovieProject) {
    const current = project.memory.database;
    if (!current) {
      project.memory.database = createProductionDatabase(project.id);
      return project.memory.database;
    }
    const defaults = createProductionDatabase(project.id);
    project.memory.database = {
      ...defaults,
      ...current,
      rules: current.rules?.length ? current.rules : defaults.rules,
      ruleProfiles: current.ruleProfiles?.length ? current.ruleProfiles : defaults.ruleProfiles,
    };
    return project.memory.database;
  }

  applicableRules(project: MovieProject, scopes: RuleScope[]) {
    const database = this.ensure(project);
    return database.rules.filter(
      (rule) => this.ruleEnabled(database.ruleProfiles, rule) && rule.scopes.some((scope) => scopes.includes(scope)),
    );
  }

  setRuleOverride(
    project: MovieProject,
    ruleId: string,
    input: { profileId?: string; enabled?: boolean; severity?: ValidationIssue["severity"]; enforcement?: string; reason?: string },
  ) {
    const database = this.ensure(project);
    if (!database.rules.some((rule) => rule.id === ruleId)) throw new Error(`Rule ${ruleId} was not found.`);
    const profile = database.ruleProfiles.find((item) => item.id === input.profileId)
      ?? database.ruleProfiles.find((item) => item.type === "project")!;
    const existing = profile.overrides.find((item) => item.ruleId === ruleId);
    const next = { ruleId, ...input, profileId: undefined, updatedAt: now() };
    if (existing) Object.assign(existing, next);
    else profile.overrides.push(next);
    return project;
  }

  setAssetApproval(project: MovieProject, assetId: string, state: ApprovalState, note?: string) {
    const database = this.ensure(project);
    const asset = database.assets.find((item) => item.id === assetId);
    if (!asset) throw new Error(`Asset ${assetId} was not found.`);
    if (asset.approvalState === "LOCKED" && state !== "LOCKED") {
      throw new Error(`${assetId} is locked. Create a new version instead of replacing the locked asset.`);
    }
    if (["GENERATED", "REVIEW", "APPROVED", "LOCKED"].includes(state) && !asset.generatedImagePath && !asset.sourceReferenceIds.length) {
      throw new Error(`${assetId} has no generated image or protected user reference. Generate it before approval.`);
    }
    asset.approvalState = state;
    asset.updatedAt = now();
    database.approvals.push({
      id: `APPROVAL_${safeId(asset.id)}_${database.approvals.length + 1}`,
      entityId: asset.id,
      entityType: "asset",
      state,
      note,
      createdAt: now(),
    });
    const artifact = project.artifacts.assets as AssetManifestArtifact | undefined;
    const item = artifact?.assets.find((entry) => entry.id === assetId);
    if (item) {
      item.approvalState = state;
      item.locked = state === "LOCKED";
    }
    this.syncAssetGroups(database);
    return project;
  }

  createAssetVersion(project: MovieProject, assetId: string, description?: string) {
    const database = this.ensure(project);
    const original = database.assets.find((item) => item.id === assetId);
    if (!original) throw new Error(`Asset ${assetId} was not found.`);
    const version = Math.max(
      ...database.assets.filter((item) => item.id === assetId || item.id.startsWith(`${assetId}_V`)).map((item) => item.version),
      original.version,
    ) + 1;
    const next: AssetEntity = {
      ...structuredClone(original),
      id: `${original.id}_V${version}`,
      version,
      approvalState: "DRAFT",
      description: description?.trim() || original.description,
      referenceImages: [],
      generatedImagePath: undefined,
      thumbnailPath: undefined,
      sourceReferenceIds: [],
      generationJobIds: [],
      sheetId: undefined,
      createdAt: now(),
      updatedAt: now(),
    };
    database.assets.push(next);
    database.relationships.push({
      id: `REL_VERSION_${safeId(next.id)}`,
      fromAssetId: next.id,
      relation: "version_of",
      toId: original.id,
    });
    this.syncAssetGroups(database);
    return next;
  }

  approvePhase(project: MovieProject, phase: PhaseId) {
    const database = this.ensure(project);
    if (phase === "film_bible" && database.filmBible) {
      database.filmBible.approvalState = "LOCKED";
      database.filmBible.updatedAt = now();
    }
    if (phase === "assets") {
      for (const asset of database.assets) {
        if (approvalRank[asset.approvalState] >= approvalRank.REVIEW) asset.approvalState = "LOCKED";
        asset.updatedAt = now();
      }
      const manifest = project.artifacts.assets as AssetManifestArtifact | undefined;
      for (const asset of manifest?.assets ?? []) {
        asset.locked = true;
        asset.approvalState = "LOCKED";
      }
      this.syncAssetGroups(database);
    }
    if (phase === "frame_plans") {
      database.frames.forEach((frame) => { frame.approvalState = "APPROVED"; });
      database.continuityStates.forEach((state) => { state.approved = true; });
    }
  }

  enforcePhaseArtifact(project: MovieProject, phase: PhaseId, artifact: unknown): unknown {
    this.ensure(project);
    if (phase === "story") return this.enforceStoryReferences(project, artifact as StoryArtifact);
    if (phase === "film_bible") return this.registerFilmBible(project, artifact as FilmBibleArtifact);
    if (phase === "assets") return this.registerManifest(project, artifact as AssetManifestArtifact);
    if (phase === "sequences") return this.registerSequences(project, artifact as SequencesArtifact);
    if (phase === "frame_plans") return this.registerFrames(project, artifact as FramePlanArtifact);
    if (phase === "prompts") return this.compilePrompts(project);
    if (phase === "continuity") return this.continuityReport(project);
    return artifact;
  }

  private enforceStoryReferences(project: MovieProject, artifact: StoryArtifact) {
    const sourceId = project.preStorySetup.mainCharacterReferenceId;
    if (!sourceId) return artifact;
    const database = this.ensure(project);
    const source = database.projectReferences.find((item) => item.id === sourceId);
    if (!source) return artifact;
    const main = artifact.characters.find((item) => item.id === "CHAR_MAIN_001")
      ?? artifact.characters.find((item) => item.name.trim().toLowerCase() === source.name.trim().toLowerCase())
      ?? artifact.characters.find((item) => /protagonist|main/i.test(item.role))
      ?? artifact.characters[0];
    if (!main) throw new Error("The Story Agent did not return a protagonist for the required main character reference.");
    main.id = "CHAR_MAIN_001";
    main.name = source.name;
    main.role = "Protagonist · required uploaded identity";
    main.description = `${main.description} Visual identity is permanently anchored to ${source.id}; do not redesign or duplicate.`;
    const supporting = artifact.characters.filter((item) => item !== main && item.id !== source.id && item.id !== "CHAR_MAIN_001" && item.name.trim().toLowerCase() !== source.name.trim().toLowerCase());
    for (const character of supporting) {
      if (/protagonist|main character/i.test(character.role)) character.role = "Supporting character · reconciled from duplicate lead proposal";
    }
    artifact.characters = [main, ...supporting];
    const requirement = database.storyAssetRequirements.find((item) => item.sourceReferenceId === source.id);
    if (requirement) { requirement.assetId = main.id; requirement.satisfied = true; }
    return artifact;
  }

  invalidateDownstream(project: MovieProject, phase: PhaseId) {
    const database = this.ensure(project);
    const order: PhaseId[] = ["story", "film_bible", "assets", "sequences", "frame_plans", "prompts", "continuity", "export"];
    const start = order.indexOf(phase);
    if (start <= order.indexOf("frame_plans")) {
      database.frames.forEach((frame) => { frame.approvalState = "REGENERATE"; frame.updatedAt = now(); });
      database.shots.forEach((shot) => { shot.approvalState = "REGENERATE"; shot.updatedAt = now(); });
      database.continuityStates.forEach((state) => { state.approved = false; });
    }
    if (start <= order.indexOf("prompts")) {
      database.generationPrompts.forEach((prompt) => { prompt.approvalState = "REGENERATE"; prompt.updatedAt = now(); });
      database.generationResults.forEach((result) => { result.approvalState = "REGENERATE"; result.updatedAt = now(); });
    }
  }

  registerFilmBible(project: MovieProject, artifact: FilmBibleArtifact) {
    const database = this.ensure(project);
    const timestamp = now();
    database.filmBible = {
      id: `BIBLE_${safeId(project.id)}`,
      projectId: project.id,
      name: `${project.title} Film Bible`,
      approvalState: project.mode === "full" ? "LOCKED" : "REVIEW",
      version: database.filmBible?.version ?? 1,
      artifact,
      createdAt: database.filmBible?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    if (project.mode === "full" && !database.approvals.some((approval) => approval.entityId === database.filmBible!.id && approval.state === "LOCKED")) {
      database.approvals.push({ id: `APPROVAL_${safeId(database.filmBible.id)}_LOCKED`, entityId: database.filmBible.id, entityType: "film_bible", state: "LOCKED", note: "Full-production Film Bible lock", createdAt: timestamp });
    }
    return artifact;
  }

  registerManifest(project: MovieProject, artifact: AssetManifestArtifact) {
    const database = this.ensure(project);
    const source = this.withRequiredStoryAssets(project, artifact.assets ?? []);
    const activeIds = new Set(source.map((item) => permanentId(item)));
    const retiredIds = new Set(database.assets.filter((item) => !activeIds.has(item.id)).map((item) => item.id));
    database.assets = database.assets.filter((item) => activeIds.has(item.id));
    database.relationships = database.relationships.filter((item) => !retiredIds.has(item.fromAssetId) && !retiredIds.has(item.toId));
    database.continuitySheets = database.continuitySheets.filter((item) => activeIds.has(item.assetId));
    const normalized: AssetItem[] = [];
    for (const input of source) {
      const id = permanentId(input);
      const existing = database.assets.find((item) => item.id === id);
      if (existing?.approvalState === "LOCKED") {
        normalized.push(this.toArtifactAsset(existing));
        continue;
      }
      const approvalState: ApprovalState = existing?.generatedImagePath
        ? "REVIEW"
        : "PROMPT_READY";
      const timestamp = now();
      const entity: AssetEntity = {
        id,
        projectId: project.id,
        name: input.name,
        category: input.type,
        description: input.description,
        approvalState,
        version: input.version ?? existing?.version ?? 1,
        referenceImages: input.referenceImages?.filter((item) => !item.startsWith("reference://")) ?? [],
        lockedTraits: input.lockedTraits ?? defaultLockedTraits(input),
        mutableTraits: input.mutableTraits ?? { storyState: "May change only through an approved story event" },
        currentState: input.currentState ?? { condition: "Established", visibility: "Available" },
        firstSequence: input.firstSequence,
        lastKnownSequence: input.lastKnownSequence,
        notes: unique([...(input.notes ?? []), ...input.continuityNotes]),
        visualDescription: input.description,
        generationPrompt: `Cinematic continuity reference image for ${input.name}. ${input.description}. ${project.era}, ${project.visualStyle}, ${project.aspectRatio}. Neutral reference presentation, full readable silhouette, stable identity and materials.`,
        negativePrompt: "identity drift, duplicate subject, extra limbs, incorrect era, text, watermark, logo, cropped identity details",
        provider: existing?.provider ?? "continuity-local",
        model: existing?.model ?? "reference-renderer-v1",
        generatedImagePath: existing?.generatedImagePath,
        thumbnailPath: existing?.thumbnailPath,
        sourceReferenceIds: existing?.sourceReferenceIds ?? [],
        generationJobIds: existing?.generationJobIds ?? [],
        sheetId: existing?.sheetId,
        critical: ["character", "creature", "animal", "location"].includes(input.type),
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      if (existing) Object.assign(existing, entity);
      else database.assets.push(entity);
      normalized.push(this.toArtifactAsset(entity));
    }
    this.syncAssetGroups(database);
    this.buildRelationships(project);
    const counts = normalized.reduce<Record<string, number>>((result, asset) => {
      result[asset.type] = (result[asset.type] ?? 0) + 1;
      return result;
    }, {});
    counts.rulesApplied = database.rules.filter((rule) => this.ruleEnabled(database.ruleProfiles, rule)).length;
    return { assets: normalized, counts } satisfies AssetManifestArtifact;
  }

  registerSequences(project: MovieProject, artifact: SequencesArtifact) {
    const database = this.ensure(project);
    const keyAssets = database.assets.filter((asset) =>
      ["character", "animal"].includes(asset.category) && asset.approvalState !== "REJECTED",
    );
    const sequences = (artifact.sequences ?? []).map((sequence, index) => {
      const assetIds = unique([
        ...sequence.assetIds.filter((id) => database.assets.some((asset) => asset.id === id)),
        ...keyAssets.map((asset) => asset.id),
      ]);
      const references = this.referenceManifest(database, assetIds, sequence.locationId);
      const previous = artifact.sequences[index - 1];
      const result: SequenceItem = {
        ...sequence,
        assetIds,
        status: "ready",
        previousContinuitySource: previous ? `${previous.id}_END` : "PROJECT_OPENING_STATE",
        referenceManifest: references,
        beginning: sequence.beginning ?? `Establish the inherited physical state in ${sequence.locationId}.`,
        middle: sequence.middle ?? `Advance ${sequence.emotionalBeat} through a controlled physical change.`,
        ending: sequence.ending ?? "Land on an exact physical and emotional handoff for the next sequence.",
        startStateId: `${sequence.id}_START`,
        midStateId: `${sequence.id}_MID`,
        endStateId: `${sequence.id}_END`,
        cameraPlan: sequence.cameraPlan ?? "Preserve the established axis, eyelines, lens family, and screen direction.",
        lightingPlan: sequence.lightingPlan ?? "Preserve Film Bible colour, practical sources, contrast, exposure, and time of day.",
        soundPlan: sequence.soundPlan ?? "Preserve location tone and recurring sound continuity.",
        dialogue: sequence.dialogue ?? [],
        negativeRules: sequence.negativeRules ?? ["No duplicate identity", "No asset drift", "No teleportation"],
        generationAttempts: sequence.generationAttempts ?? [],
      };
      for (const assetId of assetIds) {
        if (!database.relationships.some((rel) => rel.fromAssetId === assetId && rel.relation === "appears_in" && rel.toId === sequence.id)) {
          database.relationships.push({ id: `REL_${safeId(`${assetId}_APPEARS_${sequence.id}`)}`, fromAssetId: assetId, relation: "appears_in", toId: sequence.id });
        }
      }
      return result;
    });
    return { ...artifact, sequences } satisfies SequencesArtifact;
  }

  registerFrames(project: MovieProject, artifact: FramePlanArtifact) {
    const database = this.ensure(project);
    const sequences = (project.artifacts.sequences as SequencesArtifact | undefined)?.sequences ?? [];
    database.frames = [];
    database.shots = [];
    database.continuityStates = [];
    const plans = sequences.map((sequence, index) => {
      const supplied = artifact.plans?.find((plan) => plan.sequenceId === sequence.id)?.states ?? [];
      const byAnchor = (anchor: "START" | "MID" | "END") =>
        supplied.find((frame) => anchorOf(frame.state) === anchor);
      let previousEnd = index ? database.continuityStates.find((state) => state.id === `${sequences[index - 1].id}_END`) : undefined;
      const states = (["START", "MID", "END"] as const).map((anchor) => {
        const frame = byAnchor(anchor) ?? this.defaultFrame(sequence, anchor);
        const inherited = anchor === "START" && previousEnd ? structuredClone(previousEnd) : undefined;
        const state = this.continuityState(project, sequence, frame, anchor, inherited);
        database.continuityStates.push(state);
        const entity: FrameEntity = {
          id: `${sequence.id}_${anchor}_FRAME`,
          projectId: project.id,
          name: `${sequence.id} ${anchor} Frame`,
          approvalState: project.mode === "full" ? "APPROVED" : "REVIEW",
          version: 1,
          sequenceId: sequence.id,
          anchor,
          charactersVisible: state.characters,
          assetsVisible: state.assetVisibility,
          position: Object.entries(state.characterPositions).map(([id, position]) => `${id}: ${position}`).join("; "),
          action: frame.visual,
          camera: frame.camera,
          lens: frame.lens || "Project lens language",
          composition: frame.composition || "Continuity-safe composition",
          environment: state.environmentState,
          lighting: state.lighting,
          continuityStateId: state.id,
          referenceImages: sequence.referenceManifest?.map((item) => item.referenceFile) ?? [],
          prompt: frame.generationPrompt || this.framePrompt(project, sequence, frame, state),
          createdAt: now(),
          updatedAt: now(),
        };
        database.frames.push(entity);
        return {
          ...frame,
          state: stateLabel(anchor),
          charactersPresent: state.characters,
          location: state.locationId,
          continuity: unique([...(frame.continuity ?? []), `${anchor} state: ${state.id}`]),
          generationPrompt: entity.prompt,
          referenceAssets: state.assetVisibility,
        } satisfies FrameState;
      });
      database.shots.push({
        id: `SHOT_${sequence.id}_001`,
        projectId: project.id,
        name: `${sequence.id} master production shot`,
        approvalState: project.mode === "full" ? "APPROVED" : "REVIEW",
        version: 1,
        sequenceId: sequence.id,
        number: 1,
        frameIds: database.frames.filter((frame) => frame.sequenceId === sequence.id).map((frame) => frame.id),
        camera: sequence.cameraPlan || "Preserve established camera axis",
        action: sequence.synopsis,
        createdAt: now(),
        updatedAt: now(),
      });
      previousEnd = database.continuityStates.find((state) => state.id === `${sequence.id}_END`);
      return { sequenceId: sequence.id, states };
    });
    return { plans } satisfies FramePlanArtifact;
  }

  compilePrompts(project: MovieProject) {
    const database = this.ensure(project);
    const sequences = (project.artifacts.sequences as SequencesArtifact | undefined)?.sequences ?? [];
    database.generationPrompts = [];
    const prompts = sequences.map((sequence) => {
      const start = this.requiredState(database, `${sequence.id}_START`);
      const mid = this.requiredState(database, `${sequence.id}_MID`);
      const end = this.requiredState(database, `${sequence.id}_END`);
      const assets = sequence.assetIds.map((id) => database.assets.find((asset) => asset.id === id)).filter((asset): asset is AssetEntity => Boolean(asset));
      const references = sequence.referenceManifest ?? this.referenceManifest(database, sequence.assetIds, sequence.locationId);
      const rules = this.applicableRules(project, ["project", "asset", "sequence", "frame", "video_prompt", "generation_prompt"]);
      const seedance = this.seedance.compile({ project, sequence, start, mid, end, assets, references, rules });
      const minimax = this.minimax.compile({ project, sequence, start, mid, end, assets, references, rules });
      database.generationPrompts.push(
        this.promptEntity(project, sequence, seedance),
        this.promptEntity(project, sequence, minimax),
      );
      return {
        sequenceId: sequence.id,
        prompt: seedance.prompt,
        negativePrompt: seedance.negativePrompt,
        references: references.map((item) => item.assetId),
        model: seedance.model,
        ruleIds: seedance.ruleIds,
        validationIssueIds: database.validationIssues.filter((item) => item.sequenceId === sequence.id).map((item) => item.id),
      };
    });
    return { prompts };
  }

  preflight(project: MovieProject, phase: PhaseId) {
    const database = this.ensure(project);
    const issues = this.validateProject(project);
    if (["prompts", "continuity", "export"].includes(phase)) {
      const bible = database.filmBible;
      if (!bible || approvalRank[bible.approvalState] < approvalRank.APPROVED) {
        issues.push(issue("GLOBAL_LOCK_BEFORE_GENERATION", "BLOCKING", "Film Bible is not approved", "Approve the Film Bible before prompt compilation."));
      }
      for (const asset of database.assets) {
        if (approvalRank[asset.approvalState] < approvalRank.APPROVED) {
          issues.push(issue("ASSET_LOCKED_REUSE", "BLOCKING", `${asset.id} is not approved`, "Approve or lock every active recurring asset before prompt compilation.", { assetId: asset.id }));
        }
      }
    }
    this.mergeIssues(database, issues);
    return database.validationIssues.filter((item) => !item.resolved && item.blocking && !item.overridden);
  }

  validateProject(project: MovieProject) {
    const database = this.ensure(project);
    const issues: ValidationIssue[] = [];
    const charactersByName = new Map<string, AssetEntity[]>();
    for (const character of database.characters) {
      const key = character.name.trim().toLowerCase();
      charactersByName.set(key, [...(charactersByName.get(key) ?? []), character]);
    }
    for (const duplicates of charactersByName.values()) {
      if (duplicates.length > 1) {
        issues.push(issue("CONT_EXACT_CHARACTER_COUNT", "BLOCKING", `Duplicate ${duplicates[0].name} detected`, `Multiple character entities represent the same identity: ${duplicates.map((item) => item.id).join(", ")}.`, { assetId: duplicates[0].id }));
      }
    }
    if (project.artifacts.assets && /\bcamel\b/i.test(project.idea) && !database.animals.some((asset) => /camel/i.test(`${asset.id} ${asset.name}`))) {
      issues.push(issue("ASSET_REGISTER_BEFORE_USE", "BLOCKING", "Missing camel asset", "The story requires one camel, but no permanent camel asset is registered."));
    }
    const sequences = (project.artifacts.sequences as SequencesArtifact | undefined)?.sequences ?? [];
    for (const sequence of sequences) {
      const missing = sequence.assetIds.filter((id) => !database.assets.some((asset) => asset.id === id));
      if (missing.length) issues.push(issue("ASSET_REGISTER_BEFORE_USE", "BLOCKING", `${sequence.id} references missing assets`, missing.join(", "), { sequenceId: sequence.id }));
      const requiredReferences = sequence.assetIds.filter((id) => !sequence.referenceManifest?.some((reference) => reference.assetId === id && reference.approved));
      if (requiredReferences.length) issues.push(issue("ASSET_REFERENCE_ROLES", "BLOCKING", `${sequence.id} is missing required references`, requiredReferences.join(", "), { sequenceId: sequence.id }));
      const states = database.continuityStates.filter((state) => state.sequenceId === sequence.id);
      if (database.frames.length && !["START", "MID", "END"].every((anchor) => states.some((state) => state.anchor === anchor))) {
        issues.push(issue("FRAME_THREE_ANCHORS", "BLOCKING", `${sequence.id} is missing frame anchors`, "Every sequence requires START, MID, and END continuity states.", { sequenceId: sequence.id }));
      }
      const prompts = database.generationPrompts.filter((prompt) => prompt.sequenceId === sequence.id);
      if (prompts.length && !prompts.some((prompt) => prompt.inheritedRuleIds.some((id) => id.startsWith("MODEL_")))) {
        issues.push(issue("MODEL_SEEDANCE_STRUCTURE", "ERROR", `${sequence.id} has no model rules`, "The compiled prompt must include active model-specific rules.", { sequenceId: sequence.id }));
      }
    }
    for (let index = 1; index < sequences.length; index += 1) {
      const previous = database.continuityStates.find((state) => state.id === `${sequences[index - 1].id}_END`);
      const start = database.continuityStates.find((state) => state.id === `${sequences[index].id}_START`);
      if (previous && start && start.previousSequenceEnding !== previous.id) {
        issues.push(issue("CONT_END_TO_START", "BLOCKING", `${sequences[index].id} does not inherit the previous END`, `Expected ${previous.id}, observed ${start.previousSequenceEnding || "none"}.`, { sequenceId: sequences[index].id, expected: previous.id, observed: start.previousSequenceEnding }));
      }
    }
    return issues;
  }

  validateObserved(project: MovieProject, sequenceId: string, observed: ObservedGeneration) {
    const database = this.ensure(project);
    const expected = this.requiredState(database, `${sequenceId}_END`);
    const issues: ValidationIssue[] = [];
    if (observed.characterIds) {
      const expectedCharacters = [...expected.characters].sort();
      const actualCharacters = [...observed.characterIds].sort();
      if (new Set(actualCharacters).size !== actualCharacters.length) issues.push(issue("CONT_EXACT_CHARACTER_COUNT", "BLOCKING", "Duplicate character detected", actualCharacters.join(", "), { sequenceId }));
      if (JSON.stringify(expectedCharacters) !== JSON.stringify(actualCharacters)) issues.push(issue("CONT_EXACT_CHARACTER_COUNT", "BLOCKING", "Extra or missing character", `Expected ${expectedCharacters.join(", ")}; observed ${actualCharacters.join(", ")}.`, { sequenceId }));
    }
    if (observed.morphing) issues.push(issue("CONT_IDENTITY_LOCK", "BLOCKING", "Character morphing detected", "Observed identity geometry changes within the generated sequence.", { sequenceId }));
    if (observed.faces) {
      for (const [characterId, observedFace] of Object.entries(observed.faces)) {
        const character = database.characters.find((asset) => asset.id === characterId);
        const expectedFace = character?.lockedTraits.face;
        if (expectedFace && observedFace !== expectedFace) issues.push(issue("CONT_IDENTITY_LOCK", "BLOCKING", "Wrong face", `Expected ${expectedFace}; observed ${observedFace}.`, { sequenceId, assetId: characterId }));
      }
    }
    if (observed.wardrobe) {
      for (const [characterId, expectedWardrobe] of Object.entries(expected.wardrobe)) {
        const actualWardrobe = observed.wardrobe[characterId];
        if (actualWardrobe && actualWardrobe !== expectedWardrobe) {
          issues.push(issue("WARDROBE_STATE_VERSION", "BLOCKING", "Wardrobe mismatch", `Expected ${characterId} to wear ${expectedWardrobe}; observed ${actualWardrobe}.`, { sequenceId, assetId: characterId }));
        }
      }
    }
    if (observed.locationId && observed.locationId !== expected.locationId) issues.push(issue("CONT_LOCATION_GEOGRAPHY", "BLOCKING", "Wrong location", `Expected ${expected.locationId}; observed ${observed.locationId}.`, { sequenceId }));
    if (observed.screenDirection && observed.screenDirection !== expected.screenDirection) issues.push(issue("CONT_CAMERA_AXIS", "ERROR", "Wrong screen direction", `Expected ${expected.screenDirection}; observed ${observed.screenDirection}.`, { sequenceId }));
    if (observed.timeOfDay && observed.timeOfDay !== expected.timeOfDay) issues.push(issue("CONT_VISUAL_LANGUAGE", "ERROR", "Wrong time of day", `Expected ${expected.timeOfDay}; observed ${observed.timeOfDay}.`, { sequenceId }));
    if (observed.props) {
      const required = unique(Object.values(expected.propsHeld).flat());
      const missing = required.filter((prop) => !observed.props!.includes(prop));
      if (missing.length) issues.push(issue("CONT_PROP_POSSESSION", "ERROR", "Wrong or missing prop", missing.join(", "), { sequenceId }));
    }
    if (observed.damage) {
      const expectedDamage = [...expected.damage].sort();
      const observedDamage = [...observed.damage].sort();
      if (JSON.stringify(expectedDamage) !== JSON.stringify(observedDamage)) issues.push(issue("CONT_DAMAGE_LEDGER", "ERROR", "Incorrect damage state", `Expected ${expectedDamage.join(", ") || "no damage"}; observed ${observedDamage.join(", ") || "no damage"}.`, { sequenceId }));
    }
    if (observed.animalIds) {
      const required = Object.keys(expected.animalState);
      const missing = required.filter((animal) => !observed.animalIds!.includes(animal));
      if (missing.length) issues.push(issue("CONT_CREATURE_ANIMAL_LOCK", "BLOCKING", "Wrong or missing animal", missing.join(", "), { sequenceId }));
    }
    if (observed.assetVersions) {
      for (const [assetId, version] of Object.entries(observed.assetVersions)) {
        const asset = database.assets.find((item) => item.id === assetId);
        if (asset && asset.version !== version) issues.push(issue("ASSET_LOCKED_REUSE", "BLOCKING", "Wrong asset version", `Expected ${assetId} v${asset.version}; observed v${version}.`, { sequenceId, assetId }));
      }
    }
    this.mergeIssues(database, issues);
    return issues;
  }

  overrideIssue(project: MovieProject, issueId: string, reason: string) {
    const database = this.ensure(project);
    const value = database.validationIssues.find((item) => item.id === issueId);
    if (!value) throw new Error(`Validation issue ${issueId} was not found.`);
    value.overridden = true;
    value.overrideReason = reason.trim();
    return project;
  }

  continuityReport(project: MovieProject): ContinuityArtifact {
    const database = this.ensure(project);
    this.mergeIssues(database, this.validateProject(project));
    const active = database.validationIssues.filter((item) => !item.resolved);
    const hard = active.filter((item) => item.blocking && !item.overridden);
    const errors = active.filter((item) => item.severity === "ERROR").length;
    return {
      score: hard.length ? Math.max(0, 70 - hard.length * 15) : Math.max(70, 100 - errors * 7 - active.length * 2),
      checkedRules: database.rules.filter((rule) => this.ruleEnabled(database.ruleProfiles, rule)).length,
      issues: active.map((item) => ({
        id: item.id,
        severity: item.severity.toLowerCase() as ContinuityArtifact["issues"][number]["severity"],
        sequenceId: item.sequenceId,
        title: item.title,
        detail: item.detail,
        suggestion: item.blocking ? "Resolve or manually override this issue before generation." : "Review and apply the smallest appropriate repair.",
        ruleId: item.ruleId,
        blocking: item.blocking,
        overridden: item.overridden,
      })),
      passed: [
        "Permanent asset IDs are registered and provider independent.",
        "Every available sequence has structured START, MID, and END anchors.",
        "Approved END state is the structured source for the next START state.",
        "Seedance 2.5 and MiniMax H3 prompts inherit active rules and explicit reference roles.",
        "Locked asset versions are protected from silent replacement.",
      ],
    };
  }

  private ruleEnabled(profiles: RuleProfile[], rule: RuleDefinition) {
    const overrides = profiles.filter((profile) => profile.enabled).flatMap((profile) => profile.overrides).filter((override) => override.ruleId === rule.id);
    return overrides.at(-1)?.enabled ?? rule.enabled;
  }

  private syncAssetGroups(database: ProductionDatabase) {
    database.characters = database.assets.filter((asset) => assetGroup(asset) === "characters");
    database.creatures = database.assets.filter((asset) => assetGroup(asset) === "creatures");
    database.animals = database.assets.filter((asset) => assetGroup(asset) === "animals");
    database.locations = database.assets.filter((asset) => assetGroup(asset) === "locations");
    database.props = database.assets.filter((asset) => assetGroup(asset) === "props");
    database.wardrobes = database.assets.filter((asset) => assetGroup(asset) === "wardrobes");
  }

  private toArtifactAsset(asset: AssetEntity): AssetItem {
    const type = (["character", "animal", "creature", "location", "prop", "wardrobe", "vehicle"].includes(asset.category)
      ? asset.category
      : "prop") as AssetItem["type"];
    return {
      id: asset.id,
      name: asset.name,
      type,
      description: asset.description,
      locked: asset.approvalState === "LOCKED",
      continuityNotes: asset.notes,
      approvalState: asset.approvalState,
      version: asset.version,
      referenceImages: asset.referenceImages,
      lockedTraits: asset.lockedTraits,
      mutableTraits: asset.mutableTraits,
      currentState: asset.currentState,
      firstSequence: asset.firstSequence,
      lastKnownSequence: asset.lastKnownSequence,
      notes: asset.notes,
    };
  }

  private withRequiredStoryAssets(project: MovieProject, assets: AssetItem[]) {
    const result = [...assets];
    const protagonist = (project.artifacts.story as { characters?: Array<{ id: string; name: string }> } | undefined)?.characters?.find((item) => item.id.startsWith("CHAR_"));
    const rashidId = protagonist?.id ?? "CHAR_RASHID_001";
    if (/\bcamel\b/i.test(project.idea) && !result.some((asset) => asset.type === "animal" && /camel/i.test(`${asset.id} ${asset.name}`))) {
      result.push({ id: "ANIMAL_CAMEL_001", name: "Rashid's camel", type: "animal", description: "One sand-coloured travelling camel with fixed saddle, ropes, blanket, tack, proportions, and markings.", locked: false, continuityNotes: ["Exactly one camel", "Lock saddle, ropes, blanket, tack, colour, anatomy, and damage state"] });
    }
    if (/\bcamel\b/i.test(project.idea) && !result.some((asset) => asset.id === "TACK_CAMEL_001")) {
      result.push({ id: "TACK_CAMEL_001", name: "Camel saddle and tack set", type: "prop", description: "The camel's permanent saddle, ropes, blanket, and tack set, versioned with the animal state.", locked: false, continuityNotes: ["Linked to ANIMAL_CAMEL_001", "Preserve saddle, ropes, blanket, tack, colour, wear, and damage"] });
    }
    if (/\b(bedouin\s+camp|camp)\b/i.test(project.idea) && !result.some((asset) => asset.type === "location" && /camp/i.test(`${asset.id} ${asset.name}`))) {
      result.push({ id: "LOC_BEDOUIN_CAMP_001", name: "Mysterious Bedouin camp", type: "location", description: "A 1965 desert camp with locked tent placement, fire, coffee area, entrances, exits, and surrounding dunes.", locked: false, continuityNotes: ["Preserve tent geography", "Preserve fire and route positions", "No modern contamination"] });
    }
    if (/\b1965\b/.test(project.idea) && !result.some((asset) => asset.type === "wardrobe" && asset.id.includes(safeId(protagonist?.name || "RASHID")))) {
      result.push({ id: `WARDROBE_${safeId(protagonist?.name || "RASHID")}_001`, name: `${protagonist?.name || "Rashid"} 1965 travelling wardrobe`, type: "wardrobe", description: "Period-correct Emirati desert travel clothing, head covering, footwear, and accessories with tracked dust and damage.", locked: false, continuityNotes: ["Link to protagonist", "Track clean, dusty, damaged, and blood states"] });
    }
    if (/\b(bedouin\s+camp|camp)\b/i.test(project.idea) && !result.some((asset) => asset.id === "PROP_DALLAH_001")) {
      result.push({ id: "PROP_DALLAH_001", name: "Camp dallah", type: "prop", description: "Period-correct Arabic coffee pot with fixed material, scale, wear, orientation, and damage state.", locked: false, continuityNotes: ["Track holder and position", "Preserve shape, scale, wear, and orientation"] });
    }
    if (/\b(bedouin\s+camp|camp)\b/i.test(project.idea) && !result.some((asset) => asset.id === "PROP_CAMPFIRE_001")) {
      result.push({ id: "PROP_CAMPFIRE_001", name: "Central campfire", type: "prop", description: "The camp's central practical fire with fixed stone ring, fuel layout, flame state, smoke direction, and light radius.", locked: false, continuityNotes: ["Track flame and ember state", "Preserve position and motivated light direction"] });
    }
    if (rashidId && protagonist && !result.some((asset) => asset.id === protagonist.id)) {
      result.unshift({ id: protagonist.id, name: protagonist.name, type: "character", description: "Primary traveller identity from the approved story.", locked: false, continuityNotes: ["Lock face, age, body, hair, wardrobe, accessories, and proportions"] });
    }
    return result;
  }

  private buildRelationships(project: MovieProject) {
    const database = this.ensure(project);
    const protagonist = database.characters[0];
    const wardrobe = database.wardrobes.find((asset) => protagonist && asset.name.toLowerCase().includes(protagonist.name.toLowerCase())) ?? database.wardrobes[0];
    const camel = database.animals.find((asset) => /camel/i.test(`${asset.id} ${asset.name}`));
    const tack = database.props.find((asset) => asset.id === "TACK_CAMEL_001");
    const prop = database.props.find((asset) => /knife/i.test(`${asset.id} ${asset.name}`)) ?? database.props.find((asset) => asset.id === "PROP_DALLAH_001");
    const relations: AssetRelationship[] = [];
    if (protagonist && wardrobe) relations.push({ id: `REL_${safeId(`${protagonist.id}_WEARS_${wardrobe.id}`)}`, fromAssetId: protagonist.id, relation: "wears", toId: wardrobe.id });
    if (protagonist && camel) relations.push({ id: `REL_${safeId(`${protagonist.id}_RIDES_${camel.id}`)}`, fromAssetId: protagonist.id, relation: "rides", toId: camel.id });
    if (camel && tack) relations.push({ id: `REL_${safeId(`${camel.id}_USES_${tack.id}`)}`, fromAssetId: camel.id, relation: "uses", toId: tack.id });
    if (protagonist && prop) relations.push({ id: `REL_${safeId(`${protagonist.id}_CARRIES_${prop.id}`)}`, fromAssetId: protagonist.id, relation: "carries", toId: prop.id });
    database.relationships = unique([...database.relationships, ...relations].map((item) => JSON.stringify(item))).map((item) => JSON.parse(item) as AssetRelationship);
  }

  private referenceManifest(database: ProductionDatabase, assetIds: string[], locationId: string): ReferenceManifestItem[] {
    return unique([locationId, ...assetIds]).map((assetId, index) => {
      const asset = database.assets.find((item) => item.id === assetId);
      const roles = asset?.category === "character" ? ["identity", "face", "body"]
        : asset?.category === "wardrobe" ? ["wardrobe", "accessories"]
          : asset?.category === "animal" ? ["animal identity", "anatomy", "saddle", "ropes", "blanket", "tack"]
            : asset?.category === "location" ? ["location", "terrain", "architecture"]
              : ["asset design", "state"];
      return {
        assetId,
        referenceFile: asset?.referenceImages[0] ?? "",
        roles,
        priority: index + 1,
        stateVersion: asset?.version ?? 1,
        approved: asset ? approvalRank[asset.approvalState] >= approvalRank.APPROVED : false,
      };
    });
  }

  private defaultFrame(sequence: SequenceItem, anchor: "START" | "MID" | "END"): FrameState {
    const visual = anchor === "START" ? sequence.beginning : anchor === "MID" ? sequence.middle : sequence.ending;
    return {
      state: stateLabel(anchor),
      timeRange: anchor,
      visual: visual || sequence.synopsis,
      charactersPresent: sequence.assetIds.filter((id) => id.startsWith("CHAR_")),
      location: sequence.locationId,
      props: sequence.assetIds.filter((id) => id.startsWith("PROP_")),
      camera: sequence.cameraPlan || "Preserve established camera axis",
      lens: "Project lens language",
      composition: "Readable continuity geography",
      lighting: sequence.lightingPlan || "Film Bible lighting",
      sound: sequence.soundPlan || "Location tone",
      emotion: sequence.emotionalBeat,
      continuity: [],
      referenceAssets: sequence.assetIds,
    };
  }

  private continuityState(project: MovieProject, sequence: SequenceItem, frame: FrameState, anchor: "START" | "MID" | "END", inherited?: ContinuityState): ContinuityState {
    const database = this.ensure(project);
    const characterIds = sequence.assetIds.filter((id) => database.characters.some((asset) => asset.id === id));
    const animalIds = sequence.assetIds.filter((id) => database.animals.some((asset) => asset.id === id));
    const creatureIds = sequence.assetIds.filter((id) => database.creatures.some((asset) => asset.id === id));
    const vehicleIds = sequence.assetIds.filter((id) => database.assets.some((asset) => asset.id === id && asset.category === "vehicle"));
    const propIds = sequence.assetIds.filter((id) => database.props.some((asset) => asset.id === id && asset.category !== "wardrobe"));
    const wardrobe = database.wardrobes[0]?.id;
    const previousLocation = inherited?.locationId;
    return {
      ...(inherited ?? {}),
      id: `${sequence.id}_${anchor}`,
      sequenceId: sequence.id,
      anchor,
      approved: project.mode === "full",
      characters: characterIds,
      characterPositions: Object.fromEntries(characterIds.map((id) => [id, anchor === "START" ? inherited?.characterPositions[id] ?? "Established entrance position" : anchor === "MID" ? "Advanced through the planned action" : "Recorded outgoing position"])),
      screenDirection: inherited?.screenDirection ?? "screen-left to screen-right",
      directionOfTravel: inherited?.directionOfTravel ?? "forward along the established route",
      bodyOrientation: Object.fromEntries(characterIds.map((id) => [id, inherited?.bodyOrientation[id] ?? "toward the objective"])),
      wardrobe: Object.fromEntries(characterIds.map((id) => [id, inherited?.wardrobe[id] ?? wardrobe ?? "approved wardrobe"])),
      propsHeld: Object.fromEntries(characterIds.map((id, index) => [id, index === 0 ? propIds : []])),
      injuries: Object.fromEntries(characterIds.map((id) => [id, inherited?.injuries[id] ?? []])),
      creatureState: Object.fromEntries(creatureIds.map((id) => [id, inherited?.creatureState[id] ?? "approved established state"])),
      animalState: Object.fromEntries(animalIds.map((id) => [id, inherited?.animalState[id] ?? "same approved animal, saddle, ropes, blanket, tack, colour, and physical state"])),
      vehicleState: Object.fromEntries(vehicleIds.map((id) => [id, inherited?.vehicleState[id] ?? "approved established state"])),
      environmentState: frame.visual,
      locationId: sequence.locationId,
      timeOfDay: inherited?.timeOfDay ?? (/night/i.test(project.idea) ? "night" : "story-defined time"),
      lighting: frame.lighting,
      weather: inherited?.weather ?? "dry desert weather",
      cameraPosition: frame.camera,
      characterRelationships: inherited?.characterRelationships ?? [],
      assetVisibility: unique([sequence.locationId, ...sequence.assetIds]),
      damage: inherited?.damage ?? [],
      storyFacts: anchor === "END" ? [sequence.ending || sequence.synopsis] : inherited?.storyFacts ?? [],
      previousSequenceEnding: inherited?.id,
      transition: inherited ? (previousLocation !== sequence.locationId ? "LOCATION" : "DIRECT") : undefined,
    };
  }

  private framePrompt(project: MovieProject, sequence: SequenceItem, frame: FrameState, state: ContinuityState) {
    return `LOCKED REFERENCES: ${(sequence.referenceManifest ?? []).map((item) => `${item.assetId} (${item.roles.join(", ")})`).join("; ")}\nPHYSICAL STATE: ${JSON.stringify(state)}\nCOMPOSITION: ${frame.composition || "Continuity-safe composition"}\nCAMERA/LENS: ${frame.camera}; ${frame.lens || "project lens"}\nLIGHT/COLOUR: ${frame.lighting}; ${project.visualStyle}\nFROZEN ACTION: ${frame.visual}\nNEGATIVE CONTINUITY: no duplicate identity, no wrong wardrobe, no missing prop, no morphing, no location drift, no direction reversal.`;
  }

  private requiredState(database: ProductionDatabase, id: string) {
    const state = database.continuityStates.find((item) => item.id === id);
    if (!state) throw new Error(`Required continuity state ${id} is missing.`);
    return state;
  }

  private promptEntity(project: MovieProject, sequence: SequenceItem, compiled: ReturnType<Seedance25Adapter["compile"]>): GenerationPromptEntity {
    return {
      id: `PROMPT_${sequence.id}_${safeId(compiled.model)}`,
      projectId: project.id,
      name: `${sequence.id} ${compiled.model} prompt`,
      approvalState: project.mode === "full" ? "APPROVED" : "REVIEW",
      version: 1,
      sequenceId: sequence.id,
      model: compiled.model,
      prompt: compiled.prompt,
      negativePrompt: compiled.negativePrompt,
      inheritedRuleIds: compiled.ruleIds,
      referenceManifest: compiled.referenceManifest,
      validationIssueIds: [],
      createdAt: now(),
      updatedAt: now(),
    };
  }

  private mergeIssues(database: ProductionDatabase, incoming: ValidationIssue[]) {
    const activeIds = new Set(incoming.map((item) => item.id));
    for (const existing of database.validationIssues) {
      if (!activeIds.has(existing.id) && !existing.overridden) existing.resolved = true;
    }
    for (const next of incoming) {
      const existing = database.validationIssues.find((item) => item.id === next.id);
      if (existing) Object.assign(existing, { ...next, overridden: existing.overridden, overrideReason: existing.overrideReason, resolved: false, createdAt: existing.createdAt });
      else database.validationIssues.push(next);
    }
  }
}

export const filmRuleEngine = new FilmRuleEngine();
