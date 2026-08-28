export const PHASE_IDS = [
  "story",
  "film_bible",
  "assets",
  "sequences",
  "frame_plans",
  "prompts",
  "continuity",
  "export",
] as const;

export type PhaseId = (typeof PHASE_IDS)[number];
export type RunMode = "full" | "phases";
export type TargetPlatform = "Seedance" | "Higgsfield" | "MiniMax" | "Veo" | "Kling" | "Runway" | "Sora" | "Custom";
export const APPROVAL_STATES = [
  "PLANNED",
  "PROMPT_READY",
  "GENERATING",
  "DRAFT",
  "GENERATED",
  "REVIEW",
  "APPROVED",
  "LOCKED",
  "REJECTED",
  "REGENERATE",
  "GENERATION_FAILED",
] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];

export const RULE_CATEGORIES = [
  "project",
  "story",
  "character",
  "creature",
  "wardrobe",
  "prop",
  "location",
  "asset",
  "sequence",
  "frame",
  "continuity",
  "image_generation",
  "video_generation",
  "generation",
  "model_specific",
  "validation",
  "template",
] as const;
export type RuleCategory = (typeof RULE_CATEGORIES)[number];
export type RuleSeverity = "INFO" | "WARNING" | "ERROR" | "BLOCKING";
export type RuleScope =
  | "project"
  | "film_bible"
  | "story"
  | "character"
  | "asset"
  | "sequence"
  | "shot"
  | "frame"
  | "start_frame"
  | "middle_frame"
  | "end_frame"
  | "image_prompt"
  | "video_prompt"
  | "generation_prompt"
  | "generation_result";
export const BRAIN_MODES = ["local", "codex", "hybrid", "openai"] as const;
export type BrainMode = (typeof BRAIN_MODES)[number];
export type UserBrainMode = Exclude<BrainMode, "openai">;
export type ConnectionState =
  | "connected"
  | "disconnected"
  | "unavailable"
  | "loading"
  | "generating"
  | "waiting_for_approval"
  | "error";
export type ProjectStatus =
  | "draft"
  | "running"
  | "awaiting_approval"
  | "complete"
  | "failed";
export type PhaseState =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed";

export interface PhaseProgress {
  id: PhaseId;
  label: string;
  description: string;
  state: PhaseState;
  attempt: number;
  summary?: string;
  feedback?: string;
  error?: string;
  provider?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface AgentMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  createdAt: string;
  phase?: PhaseId;
}

export interface ProjectConfig {
  title: string;
  movieTitle?: string;
  idea: string;
  genre: string;
  runtimeMinutes: number;
  sequenceCount: number;
  language: string;
  visualStyle: string;
  mode: RunMode;
  storyMode: "AI_FIRST" | "REFERENCE_FIRST" | "HYBRID";
  era: string;
  aspectRatio: string;
  sequenceDurationSeconds: number;
  resolution: string;
  filmLanguage: string;
  dialogueLanguage: string;
  audienceRating: string;
  targetPlatform: TargetPlatform;
  narrationEnabled: boolean;
  dialogueEnabled: boolean;
  musicEnabled: boolean;
  subtitlesEnabled: boolean;
  autoGenerateAssets: boolean;
  autoGenerateScenes: boolean;
  autoGenerateStoryboard: boolean;
}

export interface ProjectSetupPatch {
  title?: string;
  movieTitle?: string;
  idea?: string;
  runtimeMinutes?: number;
  sequenceDurationSeconds?: number;
  aspectRatio?: string;
  resolution?: string;
  filmLanguage?: string;
  dialogueLanguage?: string;
  genre?: string;
  era?: string;
  audienceRating?: string;
  targetPlatform?: TargetPlatform;
  narrationEnabled?: boolean;
  dialogueEnabled?: boolean;
  musicEnabled?: boolean;
  subtitlesEnabled?: boolean;
}

export type ChangeSourceType = "movie_dna" | "story" | "film_bible" | "character" | "asset" | "script" | "dialogue" | "sequence" | "continuity" | "audio_bible";

export interface ChangeImpactItem {
  kind: "movie_dna" | "story" | "film_bible" | "character" | "character_state" | "asset" | "location" | "prop" | "script" | "dialogue" | "shot" | "sequence" | "prompt" | "continuity" | "reference_pack" | "audio_bible";
  id: string;
  label: string;
  reason: string;
  protection: "NONE" | "APPROVED" | "LOCKED";
}

export interface ChangeImpactReport {
  sourceType: ChangeSourceType;
  sourceId?: string;
  summary: string;
  requiresReview: boolean;
  lockedCount: number;
  approvedCount: number;
  items: ChangeImpactItem[];
}

export const PRODUCTION_STAGES = [
  "project_setup",
  "movie_dna",
  "story",
  "film_bible",
  "characters",
  "character_references",
  "asset_manifest",
  "asset_sheets",
  "sequences",
  "continuity",
  "platform_prompts",
  "manual_generation",
  "video_review",
  "export",
] as const;
export type ProductionStage = (typeof PRODUCTION_STAGES)[number];
export type WorkflowGateStatus = "LOCKED" | "APPROVED" | "READY" | "REVIEW" | "DRAFT" | "BLOCKED" | "PENDING";

export interface WorkflowGate {
  stage: ProductionStage;
  status: WorkflowGateStatus;
  updatedAt: string;
  note?: string;
}

export interface MovieDnaSelection {
  id?: string;
  key: string;
  label: string;
  technicalDescription: string;
  optionIds?: string[];
  selectedPreviewId?: string;
  previewPath?: string;
  technicalValues?: Record<string, string | number | boolean>;
  promptDescription?: string;
  locked?: boolean;
  createdVersion?: number;
  modifiedAt?: string;
  modificationHistory?: Array<{
    version: number;
    optionIds: string[];
    label: string;
    previewPath?: string;
    createdAt: string;
  }>;
  visualIndex?: number;
  contactSheet?: "genre" | "look" | "camera";
}

export interface MovieDnaCustomOption {
  id: string;
  name: string;
  category: string;
  group: string;
  shortDescription: string;
  technicalDescription: string;
  promptDescription: string;
  previewGenerationPrompt: string;
  technicalValues: Record<string, string | number | boolean>;
  tags: string[];
  compatibilityTags: string[];
  historicalTags: string[];
  genreTags: string[];
  source: "custom";
  status: "active" | "archived";
  popular: boolean;
  sheet: "genre" | "look" | "camera";
  visualIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface MovieDnaUserPreset {
  id: string;
  name: string;
  description: string;
  selections: Record<string, string[]>;
  customOptions: Record<string, MovieDnaCustomOption[]>;
  createdAt: string;
  updatedAt: string;
  useCount: number;
}

export type MovieDnaGenerationStatus = "NOT_GENERATED" | "QUEUED" | "GENERATING" | "GENERATED" | "FAILED";

export interface MovieDnaPreviewAsset {
  id: string;
  categoryId: string;
  optionId: string;
  status: MovieDnaGenerationStatus;
  version: number;
  prompt: string;
  provider?: string;
  model?: string;
  path?: string;
  thumbnailPath?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MovieDnaRecommendation {
  id: string;
  idea: string;
  summary: string;
  optionIds: Record<string, string[]>;
  combinedPreviewId?: string;
  createdAt: string;
  acceptedAt?: string;
}

export interface MovieDnaMasterFrame {
  id: string;
  assetId: string;
  projectNumber: number;
  filename: string;
  referenceRole: "STYLE";
  status: MovieDnaGenerationStatus;
  version: number;
  prompt: string;
  provider?: string;
  model?: string;
  path?: string;
  thumbnailPath?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MovieDnaVersion {
  version: number;
  selections: Record<string, MovieDnaSelection>;
  negativeRules: string[];
  createdAt: string;
  lockedAt?: string;
}

export interface MovieDnaState {
  status: "DRAFT" | "LOCKED";
  version: number;
  revisionScope?: "FUTURE_ONLY" | "REBUILD_EXISTING";
  selections: Record<string, MovieDnaSelection>;
  negativeRules: string[];
  previews: Record<string, MovieDnaPreviewAsset>;
  customOptions: Record<string, MovieDnaCustomOption[]>;
  comparisonOptionIds: string[];
  recentOptionIds: string[];
  genreOptionIds: string[];
  combinedGenrePreviewId?: string;
  recommendation?: MovieDnaRecommendation;
  masterFrame?: MovieDnaMasterFrame;
  masterFrameReferenceId?: string;
  lockedAt?: string;
  history: MovieDnaVersion[];
}

export const STORY_SECTION_IDS = ["opening", "beginning", "development", "middle", "escalation", "climax", "ending"] as const;
export type StorySectionId = (typeof STORY_SECTION_IDS)[number];
export type StoryStatus = "DRAFT" | "GENERATED" | "EDITED" | "REVIEW" | "APPROVED" | "LOCKED" | "CHANGED_AFTER_PRODUCTION";
export type StoryChangeSource = "AI" | "MANUAL" | "PASTE" | "REGENERATE";

export interface StorySection {
  id: StorySectionId;
  title: string;
  content: string;
  order: number;
  approximateStartSeconds: number;
  approximateEndSeconds: number;
}

export interface StoryBeat {
  id: string;
  name: string;
  description: string;
  storyPurpose: string;
  approximateTimeSeconds: number;
  sectionId: StorySectionId;
  characterIds: string[];
  locationIds: string[];
  importantAssetIds: string[];
  emotion: string;
  conflict: string;
  eventIds: string[];
  relatedSequenceIds: string[];
}

export interface StoryTimelineEvent {
  id: string;
  approximateTimeSeconds: number;
  date: string;
  time: string;
  timeOfDay: string;
  weather: string;
  locationId: string;
  characterIds: string[];
  characterKnowledge: Record<string, string>;
  relationshipState: Record<string, string>;
  events: string[];
  objectsAcquired: string[];
  objectsLost: string[];
  injuries: string[];
  damage: string[];
  environmentChanges: string[];
  relatedSequenceIds: string[];
}

export interface StoryCharacterCandidate {
  id: string;
  name: string;
  role: string;
  importance: "MAIN" | "SUPPORTING" | "BACKGROUND";
  description: string;
  ageRange?: string;
  goal: string;
  motivation: string;
  conflict: string;
  fear: string;
  relationships: string[];
  relatedBeatIds: string[];
  relatedSequenceIds: string[];
  suggestedStates: string[];
  referencePriority: "REQUIRED" | "HIGH" | "NORMAL";
}

export interface StoryCharacterArc {
  characterId: string;
  name: string;
  role: string;
  startingEmotionalState: string;
  goal: string;
  motivation: string;
  conflict: string;
  fear: string;
  relationships: string[];
  majorDecisions: string[];
  majorChanges: string[];
  endingState: string;
  relatedBeatIds: string[];
  relatedSequenceIds: string[];
}

export interface StoryLocationCandidate {
  id: string;
  name: string;
  description: string;
  historicalRequirements: string[];
  relatedBeatIds: string[];
  relatedSequenceIds: string[];
}

export interface StoryAssetCandidate {
  id: string;
  name: string;
  category: "character" | "creature" | "animal" | "location" | "set" | "prop" | "vehicle" | "weapon" | "costume" | "object" | "vfx" | "environment";
  description: string;
  importance: "CRITICAL" | "SUPPORTING" | "ATMOSPHERIC";
  referencePriority: "REQUIRED" | "HIGH" | "NORMAL" | "OPTIONAL";
  relatedBeatIds: string[];
  relatedSequenceIds: string[];
}

export interface StoryEvent {
  id: string;
  name: string;
  description: string;
  sectionId: StorySectionId;
  approximateTimeSeconds: number;
  characterIds: string[];
  locationIds: string[];
  objectIds: string[];
}

export interface StorySequenceBreakdownEntry {
  id: string;
  sequenceNumber: number;
  timeRange: string;
  startSeconds: number;
  endSeconds: number;
  storyPurpose: string;
  events: string[];
  characterIds: string[];
  locationId: string;
  emotion: string;
  conflict: string;
  importantAssetIds: string[];
  requiredEndingCondition: string;
  relatedBeatIds: string[];
}

export interface StoryGenerationContext {
  projectSettings: {
    movieTitle: string;
    runtimeMinutes: number;
    sequenceDurationSeconds: number;
    sequenceCount: number;
    genreCombination: string;
    historicalPeriod: string;
    filmLanguage: string;
    dialogueLanguage: string;
    audienceRating: string;
    narrationEnabled: boolean;
    dialogueEnabled: boolean;
    musicEnabled: boolean;
    subtitlesEnabled: boolean;
  };
  movieDna: {
    version: number;
    locked: true;
    selections: Record<string, { label: string; promptDescription: string; technicalValues: Record<string, string | number | boolean> }>;
    masterFrameReferenceId?: string;
    tonalDirection: string;
  };
  requestedAt: string;
}

export interface StoryVersionRecord {
  version: number;
  storyId: string;
  title: string;
  premise: string;
  logline: string;
  summary: string;
  content: string;
  sections: StorySection[];
  beats: StoryBeat[];
  timeline: StoryTimelineEvent[];
  characters: StoryCharacterCandidate[];
  characterArcs: StoryCharacterArc[];
  locations: StoryLocationCandidate[];
  objects: StoryAssetCandidate[];
  events: StoryEvent[];
  sequenceBreakdown: StorySequenceBreakdownEntry[];
  status: StoryStatus;
  changeSource: StoryChangeSource;
  instruction?: string;
  affectedSectionIds: StorySectionId[];
  movieDnaVersionUsed?: number;
  approved: boolean;
  locked: boolean;
  createdAt: string;
}

export interface StoryAiProposal {
  id: string;
  instruction: string;
  createdAt: string;
  variant: number;
  changes: Array<{ sectionId: StorySectionId; currentText: string; proposedText: string }>;
  affectedSectionIds: StorySectionId[];
  affectedBeatIds: string[];
  affectedCharacterIds: string[];
  affectedSequenceIds: string[];
  impactLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface StoryImpactDecision {
  id: string;
  proposalId?: string;
  action: "APPLY" | "FUTURE_ONLY" | "CANCEL";
  affectedItemIds: string[];
  createdAt: string;
}

export interface StoryDownstreamContracts {
  filmBible: {
    approvedStoryVersion?: number;
    movieDnaVersion: number;
    projectSettings: StoryGenerationContext["projectSettings"];
    characterCandidates: StoryCharacterCandidate[];
    locations: StoryLocationCandidate[];
    objects: StoryAssetCandidate[];
    worldRules: string[];
    timeline: StoryTimelineEvent[];
    historicalConstraints: string[];
    narrativeRules: string[];
  };
  characterAnalysis: { storyVersion: number; candidates: StoryCharacterCandidate[] };
  assetAnalysis: { storyVersion: number; candidates: StoryAssetCandidate[] };
  script: { storyVersion: number; sections: StorySection[]; beats: StoryBeat[]; sequenceBreakdown: StorySequenceBreakdownEntry[] };
}

export interface StoryDevelopmentState {
  storyId: string;
  mode: "AI" | "MANUAL" | "PASTE";
  input: string;
  title: string;
  premise: string;
  logline: string;
  summary: string;
  content: string;
  sections: StorySection[];
  beats: StoryBeat[];
  timeline: StoryTimelineEvent[];
  characters: StoryCharacterCandidate[];
  characterArcs: StoryCharacterArc[];
  locations: StoryLocationCandidate[];
  objects: StoryAssetCandidate[];
  events: StoryEvent[];
  sequenceBreakdown: StorySequenceBreakdownEntry[];
  historicalRequirements: string[];
  emotionalProgression: string[];
  status: StoryStatus;
  version: number;
  approvedVersion?: number;
  lockedVersion?: number;
  history: StoryVersionRecord[];
  pendingProposal?: StoryAiProposal;
  generationContext?: StoryGenerationContext;
  generationProvider?: string;
  movieDnaVersionUsed?: number;
  impactDecisions: StoryImpactDecision[];
  contracts?: StoryDownstreamContracts;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  lockedAt?: string;
}

export type FilmBibleStatus = "PENDING" | "GENERATING" | "DRAFT" | "EDITED" | "APPROVED" | "LOCKED" | "CHANGED_AFTER_PRODUCTION";

export interface FilmBibleSourceContext {
  storyId: string;
  storyVersion: number;
  approvedStoryVersion: number;
  movieDnaVersion: number;
  projectTitle: string;
  era: string;
  generatedAt: string;
}

export interface FilmBibleVersionRecord {
  version: number;
  status: FilmBibleStatus;
  source: "AI" | "MANUAL" | "MIGRATION";
  sections: Record<string, string>;
  changedSections: string[];
  instruction?: string;
  provider?: string;
  sourceContext?: FilmBibleSourceContext;
  createdAt: string;
  approvedAt?: string;
  lockedAt?: string;
}

export interface ProductionFilmBible {
  filmBibleId: string;
  status: FilmBibleStatus;
  version: number;
  approvedVersion?: number;
  lockedVersion?: number;
  sections: Record<string, string>;
  history: FilmBibleVersionRecord[];
  sourceContext?: FilmBibleSourceContext;
  generationProvider?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  lockedAt?: string;
}

export interface CharacterStoryState {
  id: string;
  sequenceId: string;
  timeRange: string;
  locationId: string;
  physical: string;
  emotional: string;
  wardrobe: string;
  injuries: string;
  possessions: string[];
  knowledge: string;
  relationshipState: string;
  damage: string[];
  sourceStoryVersion: number;
  updatedAt: string;
}

export interface CharacterVersionRecord {
  version: number;
  source: "STORY_ANALYSIS" | "MANUAL" | "REFERENCE" | "MIGRATION";
  name: string;
  role: string;
  description: string;
  changedFields: string[];
  createdAt: string;
}

export interface ProductionCharacter {
  id: string;
  storyCandidateId: string;
  number: number;
  name: string;
  category: "main" | "supporting" | "background";
  role: string;
  description: string;
  importance: "MAIN" | "SUPPORTING" | "BACKGROUND";
  ageRange?: string;
  occupation: string;
  personality: string;
  backstory: string;
  goal: string;
  motivation: string;
  conflict: string;
  fear: string;
  relationships: string[];
  relatedBeatIds: string[];
  relatedSequenceIds: string[];
  referencePriority: "REQUIRED" | "HIGH" | "NORMAL";
  identitySource: "UPLOADED_REFERENCE" | "STORY_DEFINED" | "HYBRID";
  referenceIds: string[];
  sheetId?: string;
  sheetStatus: ApprovalState;
  states: CharacterStoryState[];
  version: number;
  status: ApprovalState;
  history: CharacterVersionRecord[];
  createdAt: string;
  updatedAt: string;
}

export type ProductionAssetCategory =
  | "movie_dna"
  | "main_character"
  | "character"
  | "character_state"
  | "creature"
  | "animal"
  | "location"
  | "set"
  | "building"
  | "room"
  | "prop"
  | "vehicle"
  | "weapon"
  | "costume"
  | "accessory"
  | "makeup"
  | "vfx"
  | "environment"
  | "story_object"
  | "other";

export type ProductionAssetSourceType =
  | "MOVIE_DNA"
  | "UPLOADED_REFERENCE"
  | "STORY"
  | "FILM_BIBLE"
  | "CHARACTER_ANALYSIS"
  | "CHARACTER_STATE"
  | "MANUAL";

export interface ProductionAssetVersionRecord {
  version: number;
  description: string;
  prompt: string;
  imagePath?: string;
  thumbnailPath?: string;
  provider?: string;
  model?: string;
  generationJobId?: string;
  status: ApprovalState;
  createdAt: string;
  activatedAt?: string;
  fileRetained: boolean;
}

export interface ProductionAssetGenerationAttempt {
  id: string;
  version: number;
  status: "GENERATING" | "GENERATED" | "GENERATION_FAILED";
  prompt: string;
  provider?: string;
  model?: string;
  imagePath?: string;
  thumbnailPath?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ProductionAssetPendingVersion {
  version: number;
  prompt: string;
  imagePath: string;
  thumbnailPath?: string;
  provider: string;
  model: string;
  generationJobId: string;
  impactMode?: "FUTURE_ONLY" | "APPLY_ALL";
  createdAt: string;
}

export interface ProductionAssetReferenceUsage {
  sequenceId: string;
  providerProfileId?: string;
  slot?: number;
  tag?: string;
  required: boolean;
  role: string;
}

export interface ProductionAssetRecord {
  id: string;
  number: number;
  filename: string;
  name: string;
  category: ProductionAssetCategory;
  description: string;
  continuityNotes: string[];
  sequenceIds: string[];
  referenceIds: string[];
  version: number;
  status: ApprovalState;
  previousVersions: Array<{ version: number; description: string; createdAt: string }>;
  storyPurpose?: string;
  filmBibleSources?: string[];
  sourceStoryVersion?: number;
  sourceFilmBibleVersion?: number;
  movieDnaVersion?: number;
  relatedBeatIds?: string[];
  dependencyIds?: string[];
  characterId?: string;
  characterRelationships?: string[];
  characterStateId?: string;
  sourceStateIds?: string[];
  costumeState?: string;
  identityReferenceId?: string;
  characterSheetId?: string;
  referenceRoles?: string[];
  sourceType?: ProductionAssetSourceType;
  required?: boolean;
  canGenerate?: boolean;
  generationPrompt?: string;
  negativePrompt?: string;
  imagePath?: string;
  thumbnailPath?: string;
  provider?: string;
  model?: string;
  generationError?: string;
  generationAttempts?: ProductionAssetGenerationAttempt[];
  versionHistory?: ProductionAssetVersionRecord[];
  pendingVersion?: ProductionAssetPendingVersion;
  referenceUsage?: ProductionAssetReferenceUsage[];
  missingDecision?: { action: "GENERATE" | "UPLOAD" | "IGNORE"; reason?: string; createdAt: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductionShotPlan {
  id: string;
  number: number;
  durationSeconds: number;
  framing: string;
  lens: string;
  movement: string;
  action: string;
}

export interface ProductionSequencePlan {
  id: string;
  number: number;
  title: string;
  timeRange: string;
  durationSeconds: number;
  synopsis: string;
  startState: string;
  middleState: string;
  endState: string;
  shots: ProductionShotPlan[];
  script: string;
  dialogue: string[];
  assetIds: string[];
  referenceSlots: Array<{ slot: number; assetId: string; tag: string; required: boolean }>;
  promptSections: Record<string, string>;
  compiledPrompt: string;
  negativePrompt: string;
  status: "PLANNED" | "READY" | "GENERATED" | "REJECTED" | "APPROVED" | "LOCKED";
  videoPath?: string;
  inspectionNotes: string[];
  generationHistory: Array<{
    id: string;
    status: string;
    reason?: string;
    corrections?: string[];
    videoPath?: string;
    importedFilename?: string;
    platform?: TargetPlatform;
    promptVersion?: number;
    jsonVersion?: number;
    referenceAssetIds?: string[];
    attemptNumber?: number;
    generationDate?: string;
    durationSeconds?: number;
    createdAt: string;
  }>;
}

export interface PlatformProfile {
  id: string;
  platform: TargetPlatform;
  name: string;
  version: number;
  model: string;
  promptStyle: string;
  referenceSyntax: "NUMBERED_IMAGE" | "NAMED_ELEMENT" | "IMAGE_GUIDANCE" | "ATTACHMENT" | "CUSTOM";
  maxReferences: number;
  imageReferenceBehavior: string;
  videoReferenceBehavior: string;
  storyboardGridSupport: boolean;
  storyboardGridBehavior: string;
  firstFrameSupport: boolean;
  lastFrameSupport: boolean;
  videoContinuationSupport: boolean;
  durationSupport: number[];
  maxDurationSeconds: number;
  resolutionSupport: string[];
  aspectRatioSupport: string[];
  cameraSyntaxPreferences: string;
  dialogueSupport: string;
  audioSupport: string;
  negativePromptBehavior: string;
  knownRestrictions: string[];
  exportRules: string[];
  instructions: string;
  updatedAt: string;
}

export interface FilmmakingKnowledgePrinciple {
  id: string;
  name: string;
  scope: "CHARACTER_IDENTITY" | "CHARACTER_SHEET" | "STYLE" | "PROMPT" | "STORYBOARD" | "REFERENCE_MAPPING" | "VIDEO_PROMPT" | "PLATFORM_PROFILE";
  enforcement: string;
  sourcePages: number[];
  durable: boolean;
}

export interface FilmmakingKnowledgeSource {
  id: string;
  title: string;
  sourceFilename: string;
  sourceSha256: string;
  pageCount: number;
  version: number;
  status: "ACTIVE" | "ARCHIVED";
  importedAt: string;
  principles: FilmmakingKnowledgePrinciple[];
  platformSnapshotNotes: string[];
}

export interface StoryboardGridPanel {
  number: number;
  row: number;
  column: number;
  shotId: string;
  beat: string;
  camera: string;
  movement: string;
  annotationType: "MOOD" | "VOICE" | "STYLE";
  annotation: string;
}

export interface SequenceStoryboardGrid {
  id: string;
  sequenceId: string;
  sequenceNumber: number;
  enabled: boolean;
  status: "DISABLED" | "PLANNED" | "REFERENCE_READY";
  source: "SHOT_PLANNER";
  projectImageNumber?: number;
  permanentFilename?: string;
  panels: StoryboardGridPanel[];
  generationPrompt: string;
  referenceId?: string;
  imagePath?: string;
  thumbnailPath?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type SequencePromptStatus = "DRAFT" | "VALID" | "WARNING" | "BLOCKED" | "PROMPT_OUTDATED";

export interface SequencePromptReference {
  assetId: string;
  permanentProjectImageNumber: number;
  permanentFilename: string;
  assetName: string;
  assetType: string;
  referenceRole: string;
  reasonRequired: string;
  approvalState: ApprovalState;
  lockState: "LOCKED" | "UNLOCKED";
  sourcePath?: string;
  thumbnailPath?: string;
  priority: number;
  required: boolean;
  selected: boolean;
  platformUploadPosition?: number;
  promptTag?: string;
  packageFilename?: string;
  missing: boolean;
}

export interface SequencePromptValidationIssue {
  id: string;
  level: "VALID" | "WARNING" | "BLOCKED";
  code: string;
  message: string;
  sourceId?: string;
}

export interface SequencePromptValidation {
  status: "VALID" | "WARNING" | "BLOCKED";
  issues: SequencePromptValidationIssue[];
  checkedAt: string;
}

export interface SequencePromptDialogue {
  id: string;
  speakerCharacterId: string;
  speakerName: string;
  exactDialogue: string;
  language: string;
  accent: string;
  emotion: string;
  delivery: string;
  timing: string;
  voiceIdentity?: string;
  lockState: DialogueLockState;
  approvalState: DialogueApprovalState;
}

export interface SequencePromptState {
  promptStateId: string;
  projectId: string;
  sequenceId: string;
  sequenceNumber: number;
  platform: TargetPlatform;
  projectSettings: Record<string, string | number | boolean>;
  movieDNA: Record<string, string>;
  movieDnaVisuals: Array<{ categoryId: string; categoryName: string; label: string; previewPath?: string; sheet: "genre" | "look" | "camera"; visualIndex: number }>;
  storyContext: {
    happenedBefore: string;
    purpose: string;
    characterKnowledge: string[];
    characterMotivation: string[];
    emotion: string;
    conflict: string;
    turningPoint: string;
    changesDuringSequence: string;
    requiredEnding: string;
  };
  filmBibleContext: Record<string, string>;
  characters: Array<{ id: string; name: string; identityAnchor: string; motivation: string; knowledge: string[]; emotion: string; performance: string; identityReferenceId?: string }>;
  characterStates: Array<{ id: string; characterId: string; label: string; physicalState: string; costume: string; injuries: string; props: string; location: string }>;
  emotion: string;
  performance: string[];
  actions: string[];
  dialogue: SequencePromptDialogue[];
  location: { id: string; name: string; description: string; imagePath?: string; projectImageNumber?: number };
  environment: Record<string, string>;
  props: string[];
  vehicles: string[];
  weapons: string[];
  animals: string[];
  creatures: string[];
  costumes: string[];
  shots: Array<{ id: string; number: number; durationSeconds: number; framing: string; camera: string; lens: string; focalLength: string; depthOfField: string; movement: string; action: string; dialogueIds: string[]; continuityPurpose: string }>;
  styleAnchor: string;
  storyboardGrid: SequenceStoryboardGrid;
  camera: Record<string, string>;
  lens: Record<string, string>;
  lighting: Record<string, string>;
  audio: { voices: string[]; ambient: string[]; soundEffects: string[]; narrationRules: string[]; musicRules: string[]; silenceRules: string[] };
  continuity: { summary: string; entities: Array<Record<string, string>>; screenDirection: string; movementDirection: string; weather: string; lighting: string };
  startState: string;
  midState: string;
  endState: string;
  references: SequencePromptReference[];
  negativeRules: string[];
  platformSettings: Record<string, string | number | boolean | string[] | number[]>;
  sequenceOverrides: Record<string, string>;
  validation: SequencePromptValidation;
  sourceVersions: Record<string, number>;
  knowledgeSourceIds: string[];
  version: number;
  status: SequencePromptStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SequencePromptVersionRecord {
  version: number;
  platform: TargetPlatform;
  normalPrompt: string;
  jsonPrompt: string;
  referenceManifest: SequencePromptReference[];
  validation: SequencePromptValidation;
  reason: string;
  createdAt: string;
}

export interface SequencePromptChangeReview {
  id: string;
  changedText: string;
  likelyAffectedField: string;
  currentValue: string;
  proposedValue: string;
  conflict?: string;
  impact?: ChangeImpactReport;
  createdAt: string;
}

export interface SequencePromptRecord {
  sequenceId: string;
  platform: TargetPlatform;
  state: SequencePromptState;
  normalPrompt: string;
  jsonPrompt: string;
  versions: SequencePromptVersionRecord[];
  pendingChange?: SequencePromptChangeReview;
  outdatedReasons: string[];
  referenceLimitMode: "REVIEW" | "RECOMMENDED" | "MANUAL" | "MERGED_SHEET";
  updatedAt: string;
}

export interface SequencePromptWorkspace {
  activeSequenceId?: string;
  selectedPlatforms: Record<string, TargetPlatform>;
  records: Record<string, SequencePromptRecord>;
  updatedAt: string;
}

export interface ContinuityLedgerEntry {
  id: string;
  sequenceId: string;
  entityId: string;
  state: string;
  source: "APPROVED" | "LOCKED";
  createdAt: string;
}

export interface ProductionTimelineEvent {
  id: string;
  movieTime: { startSeconds: number; endSeconds: number; label: string };
  sequenceId?: string;
  scene: string;
  storyBeat: string;
  date: string;
  time: string;
  timeOfDay: string;
  weather: string;
  locationId: string;
  characterIds: string[];
  characterStateIds: Record<string, string>;
  characterKnowledge: Record<string, string[]>;
  relationships: Record<string, string>;
  importantActions: string[];
  objectsAcquired: string[];
  objectsLost: string[];
  propIds: string[];
  vehicleIds: string[];
  creatureIds: string[];
  animalIds: string[];
  injuries: Record<string, string[]>;
  damage: string[];
  costumeChanges: Record<string, string>;
  environmentChanges: string[];
  lightingState: string;
  storyConsequence: string;
  sourceEventIds: string[];
  sourceBeatIds: string[];
  sourceStoryVersion: number;
  sourceFilmBibleVersion?: number;
}

export interface ProductionStoryTimeline {
  status: "EMPTY" | "READY" | "STALE";
  version: number;
  runtimeSeconds: number;
  sequenceDurationSeconds: number;
  sourceStoryVersion?: number;
  sourceFilmBibleVersion?: number;
  events: ProductionTimelineEvent[];
  generatedAt?: string;
  updatedAt: string;
}

export type ContinuityEntityType = "character" | "creature" | "animal" | "prop" | "vehicle" | "location" | "global";

export interface ContinuityEntityState {
  entityId: string;
  entityType: ContinuityEntityType;
  identityId: string;
  characterStateId?: string;
  location: string;
  position: string;
  movement: string;
  screenDirection: string;
  clothing: string;
  shoes: string;
  headCovering: string;
  accessories: string[];
  hair: string;
  makeup: string;
  dirt: string;
  blood: string;
  injuries: string[];
  wetState: "DRY" | "WET" | "DAMP" | "UNKNOWN";
  equipment: string[];
  weapons: string[];
  propsCarried: string[];
  emotionalState: string;
  knowledge: string[];
  relationships: string[];
  physicalCondition: string;
  condition: string;
  damage: string[];
  ownerId?: string;
  visible?: boolean;
  acquired?: boolean;
  dropped?: boolean;
  lost?: boolean;
  destroyed?: boolean;
  direction?: string;
  occupants?: string[];
  objectsPresent?: string[];
  weather?: string;
  lighting?: string;
  environmentChanges?: string[];
  productionState?: string;
  updatedByEventIds: string[];
}

export interface ContinuityGlobalState {
  currentDate: string;
  currentTime: string;
  timeOfDay: string;
  weather: string;
  lighting: string;
  storyPhase: string;
  knownEventIds: string[];
  environmentState: string[];
}

export type ContinuitySnapshotAnchor = "START" | "MID" | "END";
export type ContinuitySnapshotStatus = "CANDIDATE" | "APPROVED" | "LOCKED" | "SUPERSEDED";

export interface ContinuitySnapshot {
  id: string;
  sequenceId: string;
  anchor: ContinuitySnapshotAnchor;
  version: number;
  status: ContinuitySnapshotStatus;
  entities: ContinuityEntityState[];
  global: ContinuityGlobalState;
  inheritedFromSnapshotId?: string;
  sourceTimelineEventIds: string[];
  changeReason: string;
  changeSource: "STORY" | "SCRIPT" | "USER" | "SEQUENCE_APPROVAL" | "GENERATION_INSPECTION" | "MIGRATION";
  createdAt: string;
  approvedAt?: string;
}

export interface ContinuityWarning {
  id: string;
  code: string;
  severity: "WARNING" | "BLOCKING";
  entityId: string;
  field: string;
  expected: string;
  conflicting: string;
  sourceSequenceId: string;
  sourceSnapshotId: string;
  affectedFutureSequenceIds: string[];
  currentSequenceId: string;
  status: "OPEN" | "RESOLVED" | "ACCEPTED_INTENTIONAL";
  resolutionNote?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface ContinuityHistoryRecord {
  id: string;
  sequenceId: string;
  snapshotId: string;
  version: number;
  action: "CREATED" | "APPROVED" | "LOCKED" | "SUPERSEDED" | "WARNING_ACCEPTED" | "WARNING_RESOLVED";
  changedFields: string[];
  reason: string;
  source: ContinuitySnapshot["changeSource"];
  createdAt: string;
}

export interface ProductionContinuityLedger {
  currentByEntity: Record<string, ContinuityEntityState>;
  currentGlobal: ContinuityGlobalState;
  snapshots: ContinuitySnapshot[];
  warnings: ContinuityWarning[];
  history: ContinuityHistoryRecord[];
  latestApprovedSequenceId?: string;
  updatedAt: string;
}

export interface CharacterVoiceProfile {
  id: string;
  characterId: string;
  voiceDescription: string;
  language: string;
  accent: string;
  ageImpression: string;
  pitch: string;
  tone: string;
  speakingSpeed: string;
  emotionRange: string[];
  deliveryStyle: string;
  pronunciationRules: string[];
  volumeTendencies: string;
  status: "DRAFT" | "APPROVED" | "LOCKED";
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface NarratorVoiceProfile {
  id: string;
  identity: string;
  language: string;
  accent: string;
  tone: string;
  style: string;
  delivery: string;
  pacing: string;
  status: "DRAFT" | "APPROVED" | "LOCKED";
}

export interface RecurringAudioIdentity {
  id: string;
  name: string;
  description: string;
  identityKey: string;
  sourceEntityId?: string;
  conditions: string[];
  locked: boolean;
  updatedAt: string;
}

export interface DialogueAudioContract {
  supportedFields: Array<"speaker" | "exactDialogue" | "language" | "accent" | "emotion" | "delivery" | "pronunciation" | "volume" | "timing" | "approval" | "lockState">;
  preparedForFullScript: boolean;
}

export interface ProductionAudioBible {
  status: "DRAFT" | "APPROVED" | "LOCKED";
  version: number;
  filmLanguage: string;
  dialogueLanguage: string;
  narrationEnabled: boolean;
  dialogueEnabled: boolean;
  musicEnabled: boolean;
  subtitlesEnabled: boolean;
  voiceProfiles: CharacterVoiceProfile[];
  narrator?: NarratorVoiceProfile;
  ambientSounds: RecurringAudioIdentity[];
  soundEffects: RecurringAudioIdentity[];
  musicRules: string[];
  intentionalSilenceRules: string[];
  dialogueContract: DialogueAudioContract;
  history: Array<{ version: number; changedFields: string[]; reason: string; createdAt: string }>;
  createdAt: string;
  updatedAt: string;
}

export type ProductionScriptStatus = "EMPTY" | "DRAFT" | "GENERATED" | "EDITED" | "REVIEW" | "APPROVED" | "LOCKED" | "CHANGED" | "PROMPT_OUTDATED";
export type DialogueApprovalState = "DRAFT" | "REVIEW" | "APPROVED";
export type DialogueLockState = "UNLOCKED" | "LOCKED";
export type ScriptSequenceStatus = "PLANNED" | "SCRIPTED" | "READY" | "GENERATED" | "REJECTED" | "APPROVED" | "LOCKED" | "BLOCKED";

export interface ScriptDialogueTiming {
  startSeconds: number;
  endSeconds: number;
  label: string;
}

export interface ScriptDialogueLine {
  id: string;
  sequenceId: string;
  sceneId: string;
  speakerCharacterId: string;
  exactDialogue: string;
  language: string;
  accent: string;
  emotion: string;
  delivery: string;
  pronunciation: string[];
  volume: string;
  timing: ScriptDialogueTiming;
  approvalState: DialogueApprovalState;
  lockState: DialogueLockState;
  sourceScriptVersion: number;
  audioVoiceProfileId?: string;
  timingWarning?: string;
  createdAt: string;
  updatedAt: string;
}

export type ScriptShotType =
  | "Establishing" | "Extreme Wide" | "Wide" | "Medium Wide" | "Medium" | "Medium Close Up"
  | "Close Up" | "Extreme Close Up" | "Over Shoulder" | "Two Shot" | "Group Shot" | "POV"
  | "Reaction" | "Insert" | "Macro" | "Tracking" | "Dolly" | "Crane" | "Low Angle"
  | "High Angle" | "Dutch Angle" | "Top Down" | "Aerial" | "Drone" | "Custom"
  // Legacy names remain readable so existing saved projects migrate without losing shot data.
  | "Establishing shot" | "Wide shot" | "Medium shot" | "Close up" | "Extreme close up"
  | "Over shoulder" | "Reaction shot" | "Tracking shot" | "Dolly shot" | "Crane shot"
  | "Low angle" | "High angle";

export interface ScriptShotContinuityState {
  characterPosition: string;
  characterFacing: string;
  screenDirection: string;
  movementDirection: string;
  props: string;
  costume: string;
  injury: string;
  environment: string;
  lighting: string;
  cameraRelationship: string;
}

export interface ScriptShot {
  id: string;
  sequenceId: string;
  number: number;
  durationSeconds: number;
  startSeconds: number;
  endSeconds: number;
  shotType: ScriptShotType;
  framing: string;
  cameraAngle: string;
  cameraMovement: string;
  lens: string;
  focalLength: string;
  depthOfField: string;
  subject: string;
  subjectAction: string;
  characterStateIds: string[];
  emotion: string;
  locationId: string;
  lighting: string;
  assetIds: string[];
  dialogueIds: string[];
  sound: string;
  storyPurpose: string;
  continuityPurpose: string;
  transition: string;
  startVisualState: string;
  endVisualState: string;
  continuityState: ScriptShotContinuityState;
  controlsSequenceEndState: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionScriptScene {
  id: string;
  number: number;
  sequenceId: string;
  heading: string;
  locationId: string;
  timeOfDay: string;
  action: string;
  characterIds: string[];
  dialogueIds: string[];
  shotIds: string[];
  performanceNotes: string[];
  transition: string;
  importantSound: string[];
  importantVisualActions: string[];
  assetIds: string[];
  sourceStoryEventIds: string[];
  updatedAt: string;
}

export interface ScriptAssetRequirement {
  assetId: string;
  required: boolean;
  resolved: boolean;
  reason: string;
}

export interface ScriptProductionSequence {
  id: string;
  number: number;
  title: string;
  startSeconds: number;
  endSeconds: number;
  timeRange: string;
  durationSeconds: number;
  storyPurpose: string;
  storyBeat: string;
  sceneIds: string[];
  characterIds: string[];
  characterStateIds: string[];
  locationId: string;
  emotion: string;
  conflict: string;
  actions: string[];
  dialogueIds: string[];
  shotIds: string[];
  assetRequirements: ScriptAssetRequirement[];
  startState: string;
  midState: string;
  endState: string;
  continuityRequirements: string[];
  audioRequirements: string[];
  negativeRules: string[];
  status: ScriptSequenceStatus;
  approvalState: "DRAFT" | "REVIEW" | "APPROVED";
  lockState: "UNLOCKED" | "LOCKED";
  warnings: string[];
  previousSequenceId?: string;
  nextSequenceId?: string;
  sourceScriptVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptVersionRecord {
  version: number;
  status: ProductionScriptStatus;
  scenes: ProductionScriptScene[];
  sequences: ScriptProductionSequence[];
  dialogue: ScriptDialogueLine[];
  shots: ScriptShot[];
  sourceStoryVersion: number;
  sourceFilmBibleVersion: number;
  sourceMovieDnaVersion: number;
  sourceContinuityVersion: number;
  sourceAudioBibleVersion: number;
  approved: boolean;
  locked: boolean;
  reason: string;
  createdAt: string;
  approvedAt?: string;
  lockedAt?: string;
}

export interface ScriptChangeProposal {
  id: string;
  instruction: string;
  sequenceId: string;
  sceneId?: string;
  dialogueId?: string;
  variant: number;
  currentSection: string;
  proposedSection: string;
  affectedDialogueIds: string[];
  affectedShotIds: string[];
  affectedSequenceIds: string[];
  affectedContinuityIds: string[];
  affectedAssetIds: string[];
  preservesLockedDialogue: boolean;
  createdAt: string;
}

export interface ProductionScriptSourceManifest {
  storyVersion: number;
  filmBibleVersion: number;
  movieDnaVersion: number;
  continuityVersion: number;
  audioBibleVersion: number;
  storyTimelineEventIds: string[];
  continuitySnapshotIds: string[];
  characterIds: string[];
  characterStateIds: string[];
  assetIds: string[];
  voiceProfileIds: string[];
  runtimeSeconds: number;
  sequenceDurationSeconds: number;
}

export interface ScriptContinuityDecision {
  id: string;
  warningId: string;
  sequenceId: string;
  action: "FIX_SCRIPT" | "ACCEPT_INTENTIONAL_CHANGE";
  note?: string;
  createdAt: string;
}

export interface ProductionScriptState {
  scriptId: string;
  projectId: string;
  storyVersion: number;
  filmBibleVersion: number;
  movieDnaVersion: number;
  continuityVersion: number;
  audioBibleVersion: number;
  scriptVersion: number;
  status: ProductionScriptStatus;
  sourceManifest: ProductionScriptSourceManifest;
  scenes: ProductionScriptScene[];
  sequences: ScriptProductionSequence[];
  dialogue: ScriptDialogueLine[];
  shots: ScriptShot[];
  versions: ScriptVersionRecord[];
  pendingProposal?: ScriptChangeProposal;
  continuityDecisions: ScriptContinuityDecision[];
  history: Array<{ id: string; version: number; action: string; scopeIds: string[]; reason: string; createdAt: string }>;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  lockedAt?: string;
}

export interface ProductionMemoryLayer {
  storyTimeline: ProductionStoryTimeline;
  continuity: ProductionContinuityLedger;
  audioBible: ProductionAudioBible;
  script: ProductionScriptState;
  updatedAt: string;
}

export interface ProductionWorkflow {
  currentStage: ProductionStage;
  gates: WorkflowGate[];
  movieDna: MovieDnaState;
  story: StoryDevelopmentState;
  filmBible: ProductionFilmBible;
  characters: ProductionCharacter[];
  assets: ProductionAssetRecord[];
  nextProjectImageNumber: number;
  audioBible: Record<string, string>;
  sequences: ProductionSequencePlan[];
  continuityLedger: ContinuityLedgerEntry[];
  permanentNegativeRules: string[];
  platformProfiles: Record<TargetPlatform, PlatformProfile>;
  knowledgeSources: FilmmakingKnowledgeSource[];
  storyboardGrids: Record<string, SequenceStoryboardGrid>;
  promptWorkspace: SequencePromptWorkspace;
  updatedAt: string;
}

export const REFERENCE_ROLES = [
  "IDENTITY", "WARDROBE", "CREATURE", "ANIMAL", "LOCATION", "PROP",
  "COMPOSITION", "CAMERA", "MOTION", "LIGHTING", "STYLE", "START_FRAME",
  "END_FRAME", "VIDEO_CONTINUITY", "AUDIO", "VOICE",
] as const;
export type ReferenceRole = (typeof REFERENCE_ROLES)[number];
export type StoryReferenceUsage = "REQUIRED" | "PREFERRED" | "VISUAL_REFERENCE_ONLY" | "OPTIONAL";
export type ReferenceAssetType =
  | "character"
  | "creature"
  | "animal"
  | "location"
  | "building"
  | "room"
  | "vehicle"
  | "prop"
  | "weapon"
  | "wardrobe"
  | "costume"
  | "accessory"
  | "object"
  | "style"
  | "composition"
  | "camera"
  | "lighting"
  | "audio"
  | "voice"
  | "other";

export interface ReferenceUploadInput {
  filename: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  base64: string;
  name: string;
  type: ReferenceAssetType;
  label?: string;
  roles?: ReferenceRole[];
  storyUsage?: StoryReferenceUsage;
  mainCharacter?: boolean;
  assetId?: string;
}

export interface ProjectReferenceVersion {
  version: number;
  sourcePath: string;
  mimeType: string;
  originalFilename: string;
  createdAt: string;
}

export interface PreStorySetup {
  mode: ProjectConfig["storyMode"];
  completed: boolean;
  completedAt?: string;
  sheetCreation: "YES" | "NO" | "AUTO";
  mainCharacterReferenceId?: string;
  blockingIssues: string[];
}

export interface ReferenceAnalysis {
  dominantColours: string[];
  visualTraits: string[];
  suggestedRoles: ReferenceRole[];
  confidence: number;
  analyzedAt: string;
}

export interface ProjectReference {
  id: string;
  projectId: string;
  name: string;
  type: ReferenceAssetType;
  roles: ReferenceRole[];
  storyUsage: StoryReferenceUsage;
  source: "USER_UPLOAD" | "GENERATED" | "IMPORTED";
  sourcePath: string;
  thumbnailPath?: string;
  mimeType: string;
  originalFilename: string;
  priority: number;
  protected: boolean;
  linkedAssetIds: string[];
  assetId?: string;
  label?: string;
  sequenceIds: string[];
  versions: ProjectReferenceVersion[];
  analysis?: ReferenceAnalysis;
  createdAt: string;
  updatedAt: string;
}

export interface AssetLineage {
  id: string;
  assetId: string;
  sourceReferenceIds: string[];
  parentAssetId?: string;
  operation: "UPLOAD" | "GENERATE" | "REGENERATE" | "SHEET_VIEW" | "SCENE_COMPOSE" | "STORYBOARD_FRAME";
  createdAt: string;
}

export interface ContinuitySheetView {
  id: string;
  sheetId: string;
  name: string;
  angle:
    | "MASTER"
    | "FRONT"
    | "PROFILE"
    | "LEFT_PROFILE"
    | "RIGHT_PROFILE"
    | "BACK"
    | "THREE_QUARTER"
    | "FULL_BODY_FRONT"
    | "FULL_BODY_SIDE"
    | "FULL_BODY_BACK"
    | "CLOSE_FACE"
    | "NEUTRAL_EXPRESSION"
    | "DETAIL"
    | "EXPRESSION"
    | "ACTION"
    | "WARDROBE"
    | "STORY_LOOK"
    | "EXTERIOR"
    | "INTERIOR"
    | "DAY"
    | "NIGHT"
    | "TOP"
    | "SIDE"
    | "SCALE"
    | "DAMAGE"
    | "ANATOMY"
    | "EQUIPMENT";
  priority: number;
  imagePath?: string;
  status: ApprovalState;
}

export interface ContinuitySheet {
  id: string;
  projectId: string;
  assetId: string;
  referenceIds: string[];
  views: ContinuitySheetView[];
  status: ApprovalState;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryAssetRequirement {
  id: string;
  assetId: string;
  sourceReferenceId?: string;
  usage: StoryReferenceUsage;
  instruction: string;
  satisfied: boolean;
}

export interface ProviderInfo {
  kind: "builtin" | "local" | "openai" | "codex" | "hybrid";
  label: string;
  model?: string;
  available: boolean;
}

export interface BrainHealth {
  id: BrainMode | "builtin";
  state: ConnectionState;
  label: string;
  model?: string;
  detail?: string;
  version?: string;
  authMode?: string | null;
  checkedAt: string;
}

export interface LocalBrainSettings {
  enabled: boolean;
  serverUrl: string;
  model: string;
  contextLength: number;
  temperature: number;
  timeoutMs: number;
}

export interface CodexBrainSettings {
  model: string;
  autoStart: boolean;
  approvalPolicy: "unlessTrusted" | "onRequest";
}

export interface HybridBrainSettings {
  localModel: string;
  codexModel: string;
  automaticRouting: boolean;
  routingPolicy: "balanced" | "local_first" | "codex_first";
}

export interface AppSettings {
  schemaVersion: number;
  firstRunComplete: boolean;
  defaultBrain: UserBrainMode;
  local: LocalBrainSettings;
  codex: CodexBrainSettings;
  hybrid: HybridBrainSettings;
  openaiModel: string;
  trustedProjectWorkspace: boolean;
  movieDnaPresets: MovieDnaUserPreset[];
  updatedAt: string;
}

export interface BrainActivity {
  id: string;
  createdAt: string;
  brain: BrainMode | "builtin";
  agent: string;
  phase?: PhaseId;
  state: "queued" | "working" | "success" | "warning" | "error";
  summary: string;
}

export interface ProjectBrainState {
  selected: BrainMode;
  localModel?: string;
  codexModel?: string;
  codexThreadId?: string;
  activeTurnId?: string;
  lastHealth?: Partial<Record<BrainMode | "builtin", BrainHealth>>;
  recovery?: {
    failedBrain: BrainMode;
    message: string;
    actions: Array<"retry" | "continue_local" | "continue_codex" | "switch_brain" | "cancel">;
  };
  activity: BrainActivity[];
}

export interface ApprovalRecord {
  id: string;
  createdAt: string;
  phase?: PhaseId;
  action: string;
  decision: "approved" | "denied" | "regenerated";
  detail?: string;
}

export interface GenerationRecord {
  id: string;
  createdAt: string;
  phase: PhaseId;
  attempt: number;
  brain: BrainMode | "builtin";
  provider: string;
  summary: string;
}

export interface SequenceContinuityLock {
  sequenceId: string;
  characterIdentity: string[];
  face: string[];
  age: string[];
  body: string[];
  hair: string[];
  clothing: string[];
  accessories: string[];
  characterCount: number;
  creatureIdentity: string[];
  creatureCount: number;
  location: string;
  props: string[];
  timeOfDay: string;
  lighting: string;
  weather: string;
  colourTreatment: string;
  cameraDirection: string;
  screenDirection: string;
  physicalPosition: string[];
  damage: string[];
  wounds: string[];
  carriedObjects: string[];
  vehicleState: string[];
  animalState: string[];
  previousSequenceEnding?: string;
  currentSequenceBeginning: string;
}

export interface RuleDefinition {
  id: string;
  name: string;
  category: RuleCategory;
  scopes: RuleScope[];
  severity: RuleSeverity;
  enforcement: string;
  source: string;
  enabled: boolean;
}

export interface RuleOverride {
  ruleId: string;
  enabled?: boolean;
  severity?: RuleSeverity;
  enforcement?: string;
  reason?: string;
  updatedAt: string;
}

export type RuleProfileType = "global" | "project" | "character" | "sequence" | "model";

export interface RuleProfile {
  id: string;
  name: string;
  type: RuleProfileType;
  enabled: boolean;
  overrides: RuleOverride[];
}

export interface ReferenceManifestItem {
  assetId: string;
  referenceFile: string;
  roles: string[];
  priority: number;
  stateVersion: number;
  approved: boolean;
}

export interface ContinuityState {
  id: string;
  sequenceId: string;
  anchor: "START" | "MID" | "END";
  approved: boolean;
  characters: string[];
  characterPositions: Record<string, string>;
  screenDirection: string;
  directionOfTravel: string;
  bodyOrientation: Record<string, string>;
  wardrobe: Record<string, string>;
  propsHeld: Record<string, string[]>;
  injuries: Record<string, string[]>;
  creatureState: Record<string, string>;
  animalState: Record<string, string>;
  vehicleState: Record<string, string>;
  environmentState: string;
  locationId: string;
  timeOfDay: string;
  lighting: string;
  weather: string;
  cameraPosition: string;
  characterRelationships: string[];
  assetVisibility: string[];
  damage: string[];
  storyFacts: string[];
  previousSequenceEnding?: string;
  transition?: "DIRECT" | "MATCH" | "TIME_JUMP" | "LOCATION" | "NEW_ANGLE";
}

export interface ProductionEntity {
  id: string;
  projectId: string;
  name: string;
  approvalState: ApprovalState;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface FilmBibleEntity extends ProductionEntity {
  artifact?: FilmBibleArtifact;
}

export interface AssetEntity extends ProductionEntity {
  category: AssetType | "effect" | "interior" | "weapon" | "tool" | "period_reference" | "tack";
  description: string;
  referenceImages: string[];
  lockedTraits: Record<string, string>;
  mutableTraits: Record<string, string>;
  currentState: Record<string, string>;
  firstSequence?: string;
  lastKnownSequence?: string;
  notes: string[];
  visualDescription: string;
  generationPrompt: string;
  negativePrompt: string;
  provider: string;
  model: string;
  generatedImagePath?: string;
  thumbnailPath?: string;
  sourceReferenceIds: string[];
  generationJobIds: string[];
  generationError?: string;
  sheetId?: string;
  critical: boolean;
  manifestCategory?: ProductionAssetCategory;
  projectNumber?: number;
  permanentFilename?: string;
  storyPurpose?: string;
  sourceStoryVersion?: number;
  sourceFilmBibleVersion?: number;
  movieDnaVersion?: number;
  sequenceIds?: string[];
  dependencyIds?: string[];
  parentCharacterId?: string;
  characterStateId?: string;
  costumeState?: string;
  identityReferenceId?: string;
  characterSheetId?: string;
}

export interface ShotEntity extends ProductionEntity {
  sequenceId: string;
  number: number;
  frameIds: string[];
  camera: string;
  action: string;
}

export interface FrameEntity extends ProductionEntity {
  sequenceId: string;
  anchor: "START" | "MID" | "END";
  charactersVisible: string[];
  assetsVisible: string[];
  position: string;
  action: string;
  camera: string;
  lens: string;
  composition: string;
  environment: string;
  lighting: string;
  continuityStateId: string;
  referenceImages: string[];
  prompt: string;
}

export interface GenerationPromptEntity extends ProductionEntity {
  sequenceId: string;
  model: "seedance-2.5" | "minimax-s2v-01" | "minimax-h3" | "higgsfield" | "generic";
  prompt: string;
  negativePrompt: string;
  inheritedRuleIds: string[];
  referenceManifest: ReferenceManifestItem[];
  validationIssueIds: string[];
  canonicalPrompt?: CanonicalPrompt;
  compilation?: PlatformPromptCompilation;
}

export interface ProviderReferenceMapping {
  id: string;
  projectId: string;
  assetId: string;
  provider: "seedance" | "minimax" | "higgsfield" | "generic" | string;
  model: string;
  referenceType: ReferenceRole;
  providerReferenceId?: string;
  promptTag: string;
  uploadPosition: number;
  version: number;
  status: "ACTIVE" | "EXCLUDED" | "MISSING";
}

export interface CanonicalPromptReference {
  assetId: string;
  referenceId?: string;
  roles: ReferenceRole[];
  priority: number;
  critical: boolean;
  sourcePath?: string;
}

export interface CanonicalPrompt {
  projectId: string;
  sequenceId: string;
  shotId?: string;
  durationSeconds: number;
  assets: string[];
  references: CanonicalPromptReference[];
  start: string;
  middle: string;
  end: string;
  action: string[];
  dialogue: string[];
  camera: string;
  lens: string;
  composition: string;
  lighting: string;
  weather: string;
  sound: string;
  continuityLocks: string[];
  negativeConstraints: string[];
}

export interface ModelProfile {
  id: string;
  provider: "seedance" | "minimax" | "higgsfield" | "generic";
  model: string;
  displayName: string;
  enabled: boolean;
  maxDurationSeconds?: number;
  maxImageReferences?: number;
  maxVideoReferences?: number;
  maxAudioReferences?: number;
  supportsStartFrame: boolean;
  supportsEndFrame: boolean;
  supportsReferenceTags: boolean;
  tagTemplate: string;
  rolePriority: ReferenceRole[];
  notes: string[];
  updatedAt: string;
}

export interface PlatformPromptCompilation {
  profileId: string;
  provider: ModelProfile["provider"];
  model: string;
  prompt: string;
  negativePrompt: string;
  mappings: ProviderReferenceMapping[];
  includedReferences: CanonicalPromptReference[];
  excludedReferences: Array<CanonicalPromptReference & { reason: string }>;
  blockingIssues: string[];
  warnings: string[];
  settings: Record<string, string | number | boolean>;
}

export type ImageGenerationTarget = "MOVIE_DNA_PREVIEW" | "MOVIE_DNA_COMBINED_GENRE" | "MOVIE_DNA_MASTER_FRAME" | "ASSET_MASTER" | "SHEET_VIEW" | "SCENE_MASTER" | "SCENE_START" | "SCENE_MID" | "SCENE_END" | "STORYBOARD_FRAME";

export interface ImageGenerationJob {
  id: string;
  projectId: string;
  targetType: ImageGenerationTarget;
  targetId: string;
  provider: string;
  model: string;
  prompt: string;
  negativePrompt: string;
  referenceIds: string[];
  referencePaths: string[];
  width: number;
  height: number;
  estimatedCost: number;
  requiresApproval: boolean;
  approvedToSpend: boolean;
  attempt: number;
  status: ApprovalState;
  resultPath?: string;
  thumbnailPath?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetDependency {
  id: string;
  fromId: string;
  toId: string;
  kind: "REQUIRES" | "DERIVED_FROM" | "USES_REFERENCE" | "APPEARS_IN" | "FRAME_OF";
  required: boolean;
  satisfied: boolean;
}

export interface SceneAsset {
  id: string;
  projectId: string;
  sequenceId: string;
  name: string;
  dependencyIds: string[];
  masterImagePath?: string;
  startImagePath?: string;
  midImagePath?: string;
  endImagePath?: string;
  status: ApprovalState;
  version: number;
  generationJobIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardFrameAsset {
  id: string;
  projectId: string;
  sequenceId: string;
  sceneAssetId: string;
  anchor: "START" | "MID" | "END";
  imagePath?: string;
  status: ApprovalState;
  version: number;
  generationJobId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationResultEntity extends ProductionEntity {
  promptId: string;
  provider: string;
  uri?: string;
  observedState?: Partial<ContinuityState>;
  validationIssueIds: string[];
}

export interface ValidationIssue {
  id: string;
  ruleId: string;
  severity: RuleSeverity;
  category: string;
  title: string;
  detail: string;
  expected?: string;
  observed?: string;
  sequenceId?: string;
  assetId?: string;
  blocking: boolean;
  resolved: boolean;
  overridden: boolean;
  overrideReason?: string;
  createdAt: string;
}

export interface ProductionApproval {
  id: string;
  entityId: string;
  entityType: "project" | "film_bible" | "asset" | "sequence" | "shot" | "frame" | "prompt" | "result";
  state: ApprovalState;
  note?: string;
  createdAt: string;
}

export interface AssetRelationship {
  id: string;
  fromAssetId: string;
  relation: "wears" | "rides" | "uses" | "carries" | "owns" | "appears_in" | "located_at" | "version_of";
  toId: string;
}

export interface ProductionDatabase {
  projectId: string;
  filmBible?: FilmBibleEntity;
  assets: AssetEntity[];
  characters: AssetEntity[];
  creatures: AssetEntity[];
  animals: AssetEntity[];
  locations: AssetEntity[];
  props: AssetEntity[];
  wardrobes: AssetEntity[];
  shots: ShotEntity[];
  frames: FrameEntity[];
  continuityStates: ContinuityState[];
  generationPrompts: GenerationPromptEntity[];
  generationResults: GenerationResultEntity[];
  rules: RuleDefinition[];
  ruleProfiles: RuleProfile[];
  validationIssues: ValidationIssue[];
  approvals: ProductionApproval[];
  relationships: AssetRelationship[];
  projectReferences: ProjectReference[];
  continuitySheets: ContinuitySheet[];
  assetLineage: AssetLineage[];
  storyAssetRequirements: StoryAssetRequirement[];
  providerReferenceMappings: ProviderReferenceMapping[];
  modelProfiles: ModelProfile[];
  imageGenerationJobs: ImageGenerationJob[];
  assetDependencies: AssetDependency[];
  sceneAssets: SceneAsset[];
  storyboardFrames: StoryboardFrameAsset[];
}

export interface ProjectMemory {
  approvedAssets: string[];
  lockedCharacters: string[];
  lockedWardrobe: string[];
  lockedCreatures: string[];
  lockedLocations: string[];
  lockedProps: string[];
  sequenceContinuity: Record<string, SequenceContinuityLock>;
  generationHistory: GenerationRecord[];
  regenerationHistory: GenerationRecord[];
  approvalHistory: ApprovalRecord[];
  database: ProductionDatabase;
  productionMemory: ProductionMemoryLayer;
}

export interface StoryCharacter {
  id: string;
  name: string;
  role: string;
  description: string;
  relationships: string[];
}

export interface StoryArtifact {
  logline: string;
  synopsis: string;
  fullStory: string;
  acts: { title: string; summary: string }[];
  characters: StoryCharacter[];
  locations: { id: string; name: string; description: string }[];
  dialogueExcerpt: string;
}

export interface FilmBibleArtifact {
  title: string;
  genre: string;
  tone: string;
  visualLanguage: string;
  worldRules: string[];
  characterContinuity: string[];
  locationContinuity: string[];
  movieRules: string[];
}

export type AssetType =
  | "character"
  | "animal"
  | "creature"
  | "location"
  | "building"
  | "room"
  | "prop"
  | "weapon"
  | "wardrobe"
  | "costume"
  | "accessory"
  | "object"
  | "vehicle";

export interface AssetItem {
  id: string;
  name: string;
  type: AssetType;
  description: string;
  locked: boolean;
  continuityNotes: string[];
  approvalState?: ApprovalState;
  version?: number;
  referenceImages?: string[];
  lockedTraits?: Record<string, string>;
  mutableTraits?: Record<string, string>;
  currentState?: Record<string, string>;
  firstSequence?: string;
  lastKnownSequence?: string;
  notes?: string[];
}

export interface AssetManifestArtifact {
  assets: AssetItem[];
  counts: Record<string, number>;
}

export interface SequenceItem {
  id: string;
  number: number;
  title: string;
  durationSeconds: number;
  synopsis: string;
  locationId: string;
  assetIds: string[];
  emotionalBeat: string;
  status: "draft" | "ready" | "approved";
  previousContinuitySource?: string;
  referenceManifest?: ReferenceManifestItem[];
  beginning?: string;
  middle?: string;
  ending?: string;
  startStateId?: string;
  midStateId?: string;
  endStateId?: string;
  cameraPlan?: string;
  lightingPlan?: string;
  soundPlan?: string;
  dialogue?: string[];
  negativeRules?: string[];
  generationAttempts?: string[];
  approvedOutput?: string;
  approvedEndStateId?: string;
}

export interface SequencesArtifact {
  targetRuntimeSeconds: number;
  sequences: SequenceItem[];
}

export interface FrameState {
  state: "beginning" | "middle" | "start" | "mid" | "end";
  timeRange: string;
  visual: string;
  charactersPresent?: string[];
  characterState?: string[];
  location?: string;
  props?: string[];
  camera: string;
  lens?: string;
  composition?: string;
  lighting: string;
  movement?: string;
  sound: string;
  emotion: string;
  continuity: string[];
  continuityLocks?: SequenceContinuityLock;
  generationPrompt?: string;
  referenceAssets?: string[];
}

export interface FramePlanArtifact {
  plans: { sequenceId: string; states: FrameState[] }[];
}

export interface PromptArtifact {
  prompts: {
    sequenceId: string;
    prompt: string;
    negativePrompt: string;
    references: string[];
    model?: "seedance-2.5" | "minimax-h3" | "generic";
    ruleIds?: string[];
    validationIssueIds?: string[];
  }[];
}

export interface ContinuityArtifact {
  score: number;
  checkedRules: number;
  issues: {
    id: string;
    severity: "info" | "warning" | "error" | "critical" | "blocking";
    sequenceId?: string;
    title: string;
    detail: string;
    suggestion: string;
    ruleId?: string;
    blocking?: boolean;
    overridden?: boolean;
  }[];
  passed: string[];
}

export interface ExportArtifact {
  ready: boolean;
  folders: string[];
  files: string[];
  note: string;
}

export type ArtifactMap = Partial<Record<PhaseId, unknown>>;

export interface MovieProject extends ProjectConfig {
  schemaVersion: number;
  id: string;
  status: ProjectStatus;
  currentPhase?: PhaseId;
  currentAgent?: string;
  phases: PhaseProgress[];
  artifacts: ArtifactMap;
  messages: AgentMessage[];
  provider: ProviderInfo;
  brain: ProjectBrainState;
  memory: ProjectMemory;
  preStorySetup: PreStorySetup;
  production: ProductionWorkflow;
  createdAt: string;
  updatedAt: string;
}

export type CreateProjectInput = Omit<ProjectConfig,
  "sequenceDurationSeconds" | "resolution" | "filmLanguage" | "dialogueLanguage" |
  "audienceRating" | "targetPlatform" | "narrationEnabled" | "dialogueEnabled" |
  "musicEnabled" | "subtitlesEnabled"
> & Partial<Pick<ProjectConfig,
  "sequenceDurationSeconds" | "resolution" | "filmLanguage" | "dialogueLanguage" |
  "audienceRating" | "targetPlatform" | "narrationEnabled" | "dialogueEnabled" |
  "musicEnabled" | "subtitlesEnabled"
>> & {
  brain?: BrainMode;
  mainCharacterReference?: ReferenceUploadInput;
};

export interface ProjectListItem {
  id: string;
  title: string;
  genre: string;
  status: ProjectStatus;
  mode: RunMode;
  brain: BrainMode;
  updatedAt: string;
  progress: number;
}

export interface CodexApprovalRequest {
  id: string;
  rpcId: number | string;
  projectId: string;
  threadId?: string;
  turnId?: string;
  itemId?: string;
  kind: "command" | "file_change" | "permission" | "user_input";
  title: string;
  detail: string;
  command?: string;
  cwd?: string;
  createdAt: string;
}

export interface BrainStatusSnapshot {
  defaultBrain: UserBrainMode;
  builtin: BrainHealth;
  local: BrainHealth;
  codex: BrainHealth;
  openai: BrainHealth;
  approvals: CodexApprovalRequest[];
}

export interface DiagnosticsSnapshot {
  desktopVersion: string;
  backendVersion: string;
  codexVersion?: string;
  codexConnection: ConnectionState;
  localModelConnection: ConnectionState;
  projectDirectory: string;
  currentBrain: BrainMode;
  platform: string;
  recentErrors: Array<{ createdAt: string; category: string; message: string }>;
}

export interface ApiError {
  error: string;
}
