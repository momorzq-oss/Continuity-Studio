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
  autoGenerateAssets: boolean;
  autoGenerateScenes: boolean;
  autoGenerateStoryboard: boolean;
}

export const REFERENCE_ROLES = [
  "IDENTITY", "WARDROBE", "CREATURE", "ANIMAL", "LOCATION", "PROP",
  "COMPOSITION", "CAMERA", "MOTION", "LIGHTING", "STYLE", "START_FRAME",
  "END_FRAME", "VIDEO_CONTINUITY", "AUDIO", "VOICE",
] as const;
export type ReferenceRole = (typeof REFERENCE_ROLES)[number];
export type StoryReferenceUsage = "REQUIRED" | "PREFERRED" | "VISUAL_REFERENCE_ONLY" | "OPTIONAL";
export type ReferenceAssetType = "character" | "creature" | "animal" | "location" | "prop" | "wardrobe" | "style" | "composition" | "camera" | "lighting" | "audio" | "voice" | "other";

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
  angle: "MASTER" | "FRONT" | "PROFILE" | "BACK" | "THREE_QUARTER" | "DETAIL" | "EXPRESSION" | "ACTION";
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
  sheetId?: string;
  critical: boolean;
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

export type ImageGenerationTarget = "ASSET_MASTER" | "SHEET_VIEW" | "SCENE_MASTER" | "SCENE_START" | "SCENE_MID" | "SCENE_END" | "STORYBOARD_FRAME";

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
  | "prop"
  | "wardrobe"
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
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput extends ProjectConfig {
  brain?: BrainMode;
}

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
