import path from "node:path";
import { ZipArchive } from "archiver";
import express from "express";
import { z } from "zod";
import type { ApprovalState, BrainMode, ChangeSourceType, MovieDnaCustomOption, MovieDnaSelection, PhaseId, ProjectSetupPatch, SequencesArtifact, StorySectionId, TargetPlatform } from "../src/types.js";
import { AgentConflictError, ProductionAgent } from "./agent.js";
import { BuiltinBrainProvider } from "./brains/builtin-provider.js";
import { CodexBrainProvider } from "./brains/codex-provider.js";
import { LocalLlmBrainProvider } from "./brains/local-llm-provider.js";
import { OpenAIBrainProvider } from "./brains/openai-provider.js";
import { BrainRouter } from "./brains/router.js";
import { CodexProcessManager } from "./codex/process-manager.js";
import { CodexService } from "./codex/service.js";
import { StructuredLogger } from "./logger.js";
import { SettingsStore } from "./settings.js";
import { ProjectNotFoundError, ProjectStore } from "./store.js";
import { filmRuleEngine } from "./rule-engine.js";
import { ReferenceManager } from "./reference-manager.js";
import { LocalReferenceImageProvider } from "./image-generation/local-provider.js";
import { OpenAIImageGenerationProvider } from "./image-generation/openai-provider.js";
import { applyProjectSetup } from "./project-state.js";
import { assessChangeImpact } from "./change-impact.js";
import { MovieDnaService } from "./movie-dna-service.js";
import {
  analyzeCharacters,
  addCustomMovieDnaOption,
  applyMovieDnaPreset,
  approveAssets,
  approveCharacters,
  approveFilmBible,
  approveSequence,
  approveStory,
  buildAssetManifest,
  compileProductionPrompts,
  createMovieDnaVersion,
  lockMovieDna,
  lockStory,
  planSequences,
  updateCharacter,
  updateCharacterState,
  updateMovieDna,
} from "./production-workflow.js";
import { FilmBibleService, lockFilmBibleVersion, saveFilmBibleSection } from "./film-bible.js";
import {
  applyStoryProposal,
  proposeStoryModification,
  rejectStoryProposal,
  renderStoryExport,
  saveStoryEdits,
  StoryBrain,
} from "./story-brain.js";
import {
  addManualManifestAsset,
  buildCanonicalAssetManifest,
  decideMissingAsset,
  deleteManualManifestAsset,
  syncManifestReferences,
  syncManifestRuntime,
  updateManifestAsset,
} from "./asset-manifest.js";
import {
  approveContinuitySnapshot,
  markProductionMemoryStale,
  rebuildProductionMemory,
  resolveContinuityWarning,
  reviseContinuitySnapshot,
  updateAudioBible,
  updateVoiceProfile,
} from "./production-memory.js";
import {
  addDialogueLine,
  addShot,
  applyScriptChange,
  approveProductionScript,
  deleteDialogueLine,
  deleteShot,
  duplicateShot,
  generateProductionScript,
  proposeDialogueChange,
  proposeScriptChange,
  rejectScriptChange,
  renderScriptExport,
  reorderShots,
  resolveScriptContinuity,
  setDialogueApproval,
  setScriptSequenceApproval,
  updateDialogueLine,
  updateScriptScene,
  updateShot,
} from "./script-workflow.js";
import {
  compileAllSequencePrompts,
  compileSequencePrompt,
  refreshPromptOutdatedState,
  resetSequenceOverrides,
  resolvePromptChange,
  restorePromptFromState,
  sequenceReferencePackage,
  setReferenceLimitMode,
  updatePromptFromJson,
  updatePromptFromNormal,
  validateSequencePrompt,
} from "./sequence-workspace.js";
import { attachStoryboardGridReference, setSequenceStoryboardGrid } from "./storyboard-grid.js";

const targetPlatformSchema = z.enum(["Seedance", "Higgsfield", "MiniMax", "Veo", "Kling", "Runway", "Sora", "Custom"]);

export interface RuntimeOptions {
  workspaceRoot: string;
  dataRoot: string;
  settingsPath: string;
  logsRoot: string;
  distRoot: string;
  production: boolean;
  version: string;
  desktopVersion?: string;
  codexManager?: CodexProcessManager;
}

export interface StartedContinuityServer {
  url: string;
  port: number;
  app: express.Express;
  store: ProjectStore;
  agent: ProductionAgent;
  router: BrainRouter;
  settings: SettingsStore;
  logger: StructuredLogger;
  close(): Promise<void>;
}

const modeSchema = z.enum(["full", "phases"]);
const brainSchema = z.enum(["local", "codex", "hybrid", "openai"]);
const referenceAssetTypeSchema = z.enum(["character", "creature", "animal", "location", "building", "room", "vehicle", "prop", "weapon", "wardrobe", "costume", "accessory", "object", "style", "composition", "camera", "lighting", "audio", "voice", "other"]);
const referenceRoleSchema = z.enum(["IDENTITY", "WARDROBE", "CREATURE", "ANIMAL", "LOCATION", "PROP", "COMPOSITION", "CAMERA", "MOTION", "LIGHTING", "STYLE", "START_FRAME", "END_FRAME", "VIDEO_CONTINUITY", "AUDIO", "VOICE"]);
const manifestCategorySchema = z.enum(["movie_dna", "main_character", "character", "character_state", "creature", "animal", "location", "set", "building", "room", "prop", "vehicle", "weapon", "costume", "accessory", "makeup", "vfx", "environment", "story_object", "other"]);
const referenceUploadSchema = z.object({
  filename: z.string().trim().min(1).max(260),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  base64: z.string().min(8),
  name: z.string().trim().min(1).max(120),
  type: referenceAssetTypeSchema,
  label: z.string().trim().max(120).optional(),
  roles: z.array(referenceRoleSchema).optional(),
  storyUsage: z.enum(["REQUIRED", "PREFERRED", "VISUAL_REFERENCE_ONLY", "OPTIONAL"]).optional(),
  mainCharacter: z.boolean().optional(),
  assetId: z.string().trim().max(120).optional(),
});
const createProjectSchema = z.object({
  title: z.string().trim().min(2).max(100),
  movieTitle: z.string().trim().min(1).max(160).optional(),
  idea: z.string().trim().min(12).max(12_000),
  genre: z.string().trim().min(2).max(80),
  runtimeMinutes: z.coerce.number().min(0.5).max(180),
  sequenceCount: z.coerce.number().int().min(1).max(120),
  language: z.string().trim().min(2).max(80),
  visualStyle: z.string().trim().min(2).max(300),
  mode: modeSchema,
  brain: brainSchema.optional(),
  storyMode: z.enum(["AI_FIRST", "REFERENCE_FIRST", "HYBRID"]).default("AI_FIRST"),
  era: z.string().trim().min(1).max(120).default("Contemporary"),
  aspectRatio: z.string().trim().min(2).max(20).default("2.39:1"),
  sequenceDurationSeconds: z.coerce.number().int().min(1).max(120).default(8),
  resolution: z.string().trim().min(2).max(40).default("4K UHD"),
  filmLanguage: z.string().trim().min(2).max(80).default("English"),
  dialogueLanguage: z.string().trim().min(2).max(80).default("English"),
  audienceRating: z.string().trim().min(1).max(80).default("General / PG-13"),
  targetPlatform: targetPlatformSchema.default("Seedance"),
  narrationEnabled: z.boolean().default(false),
  dialogueEnabled: z.boolean().default(true),
  musicEnabled: z.boolean().default(true),
  subtitlesEnabled: z.boolean().default(true),
  autoGenerateAssets: z.boolean().default(true),
  autoGenerateScenes: z.boolean().default(true),
  autoGenerateStoryboard: z.boolean().default(true),
  mainCharacterReference: referenceUploadSchema.optional(),
});
const runSchema = z.object({
  mode: modeSchema.optional(),
  instruction: z.string().trim().min(1).max(12_000).optional(),
});
const messageSchema = z.object({
  content: z.string().trim().min(1).max(12_000),
  mode: modeSchema.optional(),
});
const projectSettingsSchema = z.object({
  mode: modeSchema.optional(),
  brain: brainSchema.optional(),
  autoGenerateAssets: z.boolean().optional(),
  autoGenerateScenes: z.boolean().optional(),
  autoGenerateStoryboard: z.boolean().optional(),
});
const projectSetupPatchSchema = z.object({
  title: z.string().trim().min(2).max(100).optional(),
  movieTitle: z.string().trim().min(1).max(160).optional(),
  idea: z.string().trim().min(12).max(12_000).optional(),
  runtimeMinutes: z.coerce.number().min(0.5).max(180).optional(),
  sequenceDurationSeconds: z.coerce.number().int().min(1).max(120).optional(),
  aspectRatio: z.string().min(2).max(20).optional(),
  resolution: z.string().min(2).max(40).optional(),
  filmLanguage: z.string().min(2).max(80).optional(),
  dialogueLanguage: z.string().min(2).max(80).optional(),
  genre: z.string().min(2).max(80).optional(),
  era: z.string().min(1).max(120).optional(),
  audienceRating: z.string().min(1).max(80).optional(),
  targetPlatform: targetPlatformSchema.optional(),
  narrationEnabled: z.boolean().optional(),
  dialogueEnabled: z.boolean().optional(),
  musicEnabled: z.boolean().optional(),
  subtitlesEnabled: z.boolean().optional(),
});
const dnaTechnicalValuesSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));
const customMovieDnaOptionSchema = z.object({
  id: z.string().min(1), name: z.string().min(1).max(160), category: z.string().min(1), group: z.string().min(1),
  shortDescription: z.string().min(1).max(4_000), technicalDescription: z.string().min(1).max(8_000), promptDescription: z.string().min(1).max(8_000), previewGenerationPrompt: z.string().min(1).max(8_000),
  technicalValues: dnaTechnicalValuesSchema, tags: z.array(z.string()), compatibilityTags: z.array(z.string()), historicalTags: z.array(z.string()), genreTags: z.array(z.string()),
  source: z.literal("custom"), status: z.enum(["active", "archived"]), popular: z.boolean(), sheet: z.enum(["genre", "look", "camera"]), visualIndex: z.number().int().min(0).max(15),
  createdAt: z.string(), updatedAt: z.string(),
});
const movieDnaPresetSchema = z.object({
  id: z.string().min(1).max(160), name: z.string().min(1).max(160), description: z.string().max(1_000),
  selections: z.record(z.string(), z.array(z.string().min(1)).max(200)), customOptions: z.record(z.string(), z.array(customMovieDnaOptionSchema).max(200)),
  createdAt: z.string(), updatedAt: z.string(), useCount: z.number().int().min(0),
});
const workflowActionSchema = z.object({
  action: z.enum(["update_setup", "save_setup", "update_dna", "update_dna_rules", "update_dna_comparisons", "add_custom_dna_option", "apply_dna_preset", "generate_dna_preview", "generate_combined_genre_preview", "recommend_dna", "apply_dna_recommendation", "generate_dna_master", "new_dna_version", "lock_dna", "generate_story", "regenerate_story", "update_story", "propose_story_change", "regenerate_story_change", "apply_story_change", "reject_story_change", "approve_story", "lock_story", "generate_bible", "regenerate_bible", "update_bible", "update_audio", "approve_bible", "lock_bible", "analyze_characters", "update_character", "update_character_state", "approve_characters", "build_assets", "update_asset", "approve_assets", "build_production_memory", "update_continuity", "approve_continuity", "lock_continuity", "resolve_continuity_warning", "update_voice_profile", "update_audio_bible", "generate_script", "regenerate_script", "update_script_scene", "propose_script_change", "propose_dialogue_change", "regenerate_script_change", "apply_script_change", "reject_script_change", "approve_script", "lock_script", "update_dialogue", "approve_dialogue", "lock_dialogue", "unlock_dialogue", "add_dialogue", "delete_dialogue", "add_shot", "update_shot", "reorder_shots", "duplicate_shot", "delete_shot", "resolve_script_continuity", "plan_sequences", "approve_script_sequence", "lock_script_sequence", "reject_script_sequence", "update_platform_profile", "compile_prompts", "compile_sequence_prompt", "save_normal_prompt", "save_json_prompt", "resolve_prompt_change", "reset_sequence_overrides", "validate_sequence_prompt", "restore_prompt_state", "set_reference_limit_mode", "set_storyboard_grid", "upload_storyboard_grid", "update_sequence_prompt", "reject_sequence", "approve_sequence", "lock_sequence", "run_full"]),
  payload: z.record(z.string(), z.unknown()).default({}),
});
const changeImpactSchema = z.object({
  sourceType: z.enum(["movie_dna", "story", "film_bible", "character", "asset", "script", "dialogue", "sequence", "continuity", "audio_bible"]),
  sourceId: z.string().trim().min(1).max(160).optional(),
});
const approvalStateSchema = z.enum(["PLANNED", "PROMPT_READY", "GENERATING", "DRAFT", "GENERATED", "REVIEW", "APPROVED", "LOCKED", "REJECTED", "REGENERATE", "GENERATION_FAILED"]);
const ruleOverrideSchema = z.object({
  profileId: z.string().trim().max(120).optional(),
  enabled: z.boolean().optional(),
  severity: z.enum(["INFO", "WARNING", "ERROR", "BLOCKING"]).optional(),
  enforcement: z.string().trim().max(2_000).optional(),
  reason: z.string().trim().max(1_000).optional(),
});
const regenerateSchema = z.object({
  phase: z.enum(["story", "film_bible", "assets", "sequences", "frame_plans", "prompts", "continuity", "export"]).optional(),
  feedback: z.string().trim().max(4_000).optional(),
});
const appSettingsSchema = z.object({
  firstRunComplete: z.boolean().optional(),
  defaultBrain: z.enum(["local", "codex", "hybrid"]).optional(),
  trustedProjectWorkspace: z.boolean().optional(),
  openaiModel: z.string().trim().min(1).max(120).optional(),
  movieDnaPresets: z.array(movieDnaPresetSchema).max(200).optional(),
  local: z.object({
    enabled: z.boolean().optional(),
    serverUrl: z.string().trim().url().optional(),
    model: z.string().trim().max(160).optional(),
    contextLength: z.coerce.number().int().min(1024).max(2_000_000).optional(),
    temperature: z.coerce.number().min(0).max(2).optional(),
    timeoutMs: z.coerce.number().int().min(5_000).max(900_000).optional(),
  }).optional(),
  codex: z.object({
    model: z.string().trim().max(160).optional(),
    autoStart: z.boolean().optional(),
    approvalPolicy: z.enum(["unlessTrusted", "onRequest"]).optional(),
  }).optional(),
  hybrid: z.object({
    localModel: z.string().trim().max(160).optional(),
    codexModel: z.string().trim().max(160).optional(),
    automaticRouting: z.boolean().optional(),
    routingPolicy: z.enum(["balanced", "local_first", "codex_first"]).optional(),
  }).optional(),
});

export const createRuntime = async (options: RuntimeOptions) => {
  const store = new ProjectStore(options.dataRoot);
  const settings = new SettingsStore(options.settingsPath);
  const logger = new StructuredLogger(options.logsRoot);
  await Promise.all([store.initialize(), settings.get()]);
  const codexService = new CodexService(
    options.codexManager ?? new CodexProcessManager(),
    settings,
    logger,
    (projectId) => store.projectPath(projectId),
  );
  const router = new BrainRouter(
    new BuiltinBrainProvider(),
    new LocalLlmBrainProvider(settings, logger),
    new CodexBrainProvider(codexService),
    new OpenAIBrainProvider(process.env.OPENAI_API_KEY, process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini"),
    settings,
    logger,
  );
  const imageProvider = process.env.OPENAI_API_KEY
    ? new OpenAIImageGenerationProvider(process.env.OPENAI_API_KEY)
    : new LocalReferenceImageProvider();
  const agent = new ProductionAgent(store, router, logger, imageProvider);
  const movieDna = new MovieDnaService(store, imageProvider, options.workspaceRoot);
  const storyBrain = new StoryBrain(router);
  const filmBible = new FilmBibleService(router);
  const references = new ReferenceManager(store);
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32mb" }));

  app.get("/api/health", async (_request, response) => {
    response.json({ ok: true, provider: router.providerInfo, dataRoot: options.dataRoot, version: options.version });
  });
  app.get("/api/settings", async (_request, response) => response.json(await settings.get()));
  app.patch("/api/settings", async (request, response) => response.json(await settings.update(appSettingsSchema.parse(request.body))));

  app.get("/api/brains/status", async (_request, response) => response.json(await router.status()));
  app.post("/api/brains/local/test", async (_request, response) => response.json(await router.local.healthCheck()));
  app.post("/api/brains/codex/test", async (_request, response) => response.json(await router.codex.healthCheck()));
  app.get("/api/brains/codex/models", async (_request, response) => {
    await router.codex.healthCheck();
    response.json(router.codex.service.discoveredModels);
  });
  app.post("/api/brains/codex/login", async (_request, response) => response.json(await router.codex.service.login()));
  app.post("/api/brains/codex/logout", async (_request, response) => {
    await router.codex.service.logout();
    response.json({ ok: true });
  });
  app.post("/api/brains/codex/approvals/:approvalId", async (request, response) => {
    const input = z.object({ decision: z.enum(["allow", "deny"]) }).parse(request.body);
    await router.codex.service.resolveApproval(request.params.approvalId, input.decision);
    response.json({ ok: true });
  });

  app.get("/api/projects", async (_request, response) => response.json(await store.listProjects()));
  app.post("/api/projects", async (request, response) => {
    const input = createProjectSchema.parse(request.body);
    const appSettings = await settings.get();
    const project = await agent.createProject({ ...input, brain: input.brain ?? appSettings.defaultBrain });
    if (input.mainCharacterReference) {
      await references.upload(project, { ...input.mainCharacterReference, type: "character", mainCharacter: true, storyUsage: "REQUIRED" });
      await store.saveProject(project);
    }
    response.status(201).json(project);
  });
  app.get("/api/projects/:projectId", async (request, response) => {
    const project = await store.getProject(request.params.projectId);
    if (await agent.assetMaker.reconcileFileStatus(project)) await store.saveProject(project);
    response.json(project);
  });
  app.post("/api/projects/:projectId/change-impact", async (request, response) => {
    const input = changeImpactSchema.parse(request.body);
    const project = await store.getProject(request.params.projectId);
    response.json(assessChangeImpact(project, input.sourceType as ChangeSourceType, input.sourceId));
  });
  app.get("/api/projects/:projectId/story/export", async (request, response) => {
    const format = z.enum(["full", "structure", "timeline", "arcs", "sequences", "json"]).parse(request.query.format ?? "full");
    const project = await store.getProject(request.params.projectId);
    const output = renderStoryExport(project, format);
    response.setHeader("Content-Type", output.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${output.filename}"`);
    response.send(output.body);
  });
  app.get("/api/projects/:projectId/script/export", async (request, response) => {
    const format = z.enum(["full", "production", "dialogue", "shots", "sequences", "json"]).parse(request.query.format ?? "full");
    const project = await store.getProject(request.params.projectId);
    const output = renderScriptExport(project, format);
    response.setHeader("Content-Type", output.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${output.filename}"`);
    response.send(output.body);
  });
  app.patch("/api/projects/:projectId", async (request, response) => {
    const input = projectSettingsSchema.parse(request.body);
    const project = await store.getProject(request.params.projectId);
    if (project.status === "running") throw new AgentConflictError("Project settings cannot change while the agent is working.");
    if (input.mode) project.mode = input.mode;
    if (typeof input.autoGenerateAssets === "boolean") project.autoGenerateAssets = input.autoGenerateAssets;
    if (typeof input.autoGenerateScenes === "boolean") project.autoGenerateScenes = input.autoGenerateScenes;
    if (typeof input.autoGenerateStoryboard === "boolean") project.autoGenerateStoryboard = input.autoGenerateStoryboard;
    if (input.brain) {
      project.brain.selected = input.brain;
      project.provider = router.providerInfoFor(input.brain);
      project.brain.recovery = undefined;
    }
    await store.saveProject(project);
    response.json(project);
  });
  app.post("/api/projects/:projectId/workflow/actions", async (request, response) => {
    const { action, payload } = workflowActionSchema.parse(request.body);
    const project = await store.getProject(request.params.projectId);
    if (project.status === "running") throw new AgentConflictError("Wait for the Production Agent before changing workflow state.");
    switch (action) {
      case "update_setup":
      case "save_setup": {
        const gate = project.production.gates.find((item) => item.stage === "project_setup");
        if (action === "update_setup" && gate?.status === "LOCKED") {
          throw new AgentConflictError("Project Setup is locked. Review downstream impact before creating a setup revision.");
        }
        applyProjectSetup(project, projectSetupPatchSchema.parse(payload) as ProjectSetupPatch, { lock: action === "save_setup" });
        break;
      }
      case "update_dna": updateMovieDna(project, z.object({ key: z.string(), optionIds: z.array(z.string()).min(1).max(200), label: z.string().default(""), technicalDescription: z.string().default("") }).parse(payload) as MovieDnaSelection); break;
      case "update_dna_rules": {
        if (project.production.movieDna.status === "LOCKED") throw new AgentConflictError("Create a new Movie DNA version before changing negative rules.");
        project.production.movieDna.negativeRules = z.array(z.string().trim().min(2).max(1000)).min(1).parse(payload.rules);
        project.production.permanentNegativeRules = [...project.production.movieDna.negativeRules];
        break;
      }
      case "update_dna_comparisons": project.production.movieDna.comparisonOptionIds = z.array(z.string()).max(12).parse(payload.optionIds); break;
      case "add_custom_dna_option": {
        const input = z.object({ categoryId: z.string().min(1), name: z.string().trim().min(1).max(160), description: z.string().trim().min(3).max(4_000), technicalValues: dnaTechnicalValuesSchema.optional() }).parse(payload);
        const custom = addCustomMovieDnaOption(project, input);
        await movieDna.regeneratePreview(project, input.categoryId, custom.id);
        break;
      }
      case "apply_dna_preset": {
        const input = z.object({ selections: z.record(z.string(), z.array(z.string()).max(200)), customOptions: z.record(z.string(), z.array(customMovieDnaOptionSchema)).default({}) }).parse(payload);
        applyMovieDnaPreset(project, input.selections, input.customOptions as Record<string, MovieDnaCustomOption[]>);
        break;
      }
      case "generate_dna_preview": await movieDna.regeneratePreview(project, z.string().parse(payload.categoryId), z.string().parse(payload.optionId)); break;
      case "generate_combined_genre_preview": await movieDna.generateCombinedGenrePreview(project, z.array(z.string()).min(1).max(200).optional().parse(payload.optionIds)); break;
      case "recommend_dna": await movieDna.recommend(project, z.string().trim().min(12).max(12_000).parse(payload.idea)); break;
      case "apply_dna_recommendation": movieDna.applyRecommendation(project); break;
      case "generate_dna_master": await movieDna.generateMasterFrame(project); break;
      case "new_dna_version": createMovieDnaVersion(project, z.enum(["FUTURE_ONLY", "REBUILD_EXISTING"]).default("FUTURE_ONLY").parse(payload.scope)); break;
      case "lock_dna": lockMovieDna(project); break;
      case "generate_story": await storyBrain.generate(project, typeof payload.input === "string" ? payload.input : undefined, z.enum(["AI", "MANUAL", "PASTE"]).optional().parse(payload.mode) ?? project.production.story.mode); markProductionMemoryStale(project); break;
      case "regenerate_story": await storyBrain.generate(project, typeof payload.input === "string" ? payload.input : project.production.story.input, "AI", "REGENERATE"); markProductionMemoryStale(project); break;
      case "update_story": {
        const sectionSchema = z.object({ id: z.enum(["opening", "beginning", "development", "middle", "escalation", "climax", "ending"]), content: z.string().max(100_000) });
        const updates = Array.isArray(payload.sections)
          ? z.array(sectionSchema).min(1).max(7).parse(payload.sections)
          : [{ id: "middle" as StorySectionId, content: z.string().trim().min(20).max(100_000).parse(payload.content) }];
        try {
          saveStoryEdits(project, updates, {
            confirmedImpact: payload.confirmedImpact === true,
            impactAction: z.enum(["APPLY", "FUTURE_ONLY"]).optional().parse(payload.impactAction),
            instruction: typeof payload.instruction === "string" ? payload.instruction : undefined,
          });
        } catch (error) {
          if (error instanceof Error && /review affected production/i.test(error.message)) throw new AgentConflictError(error.message);
          throw error;
        }
        markProductionMemoryStale(project);
        break;
      }
      case "propose_story_change": proposeStoryModification(project, z.string().trim().min(3).max(4_000).parse(payload.instruction)); break;
      case "regenerate_story_change": {
        const current = project.production.story.pendingProposal;
        const instruction = z.string().trim().min(3).max(4_000).optional().parse(payload.instruction) ?? current?.instruction;
        if (!instruction) throw new AgentConflictError("Analyze a Story change before regenerating its proposal.");
        proposeStoryModification(project, instruction, (current?.variant ?? 1) + 1);
        break;
      }
      case "apply_story_change": applyStoryProposal(project, z.enum(["APPLY", "FUTURE_ONLY"]).parse(payload.impactAction), z.array(z.string()).default([]).parse(payload.affectedItemIds)); markProductionMemoryStale(project); break;
      case "reject_story_change": rejectStoryProposal(project); break;
      case "approve_story": approveStory(project); break;
      case "lock_story": lockStory(project); break;
      case "generate_bible": await filmBible.generate(project, typeof payload.instruction === "string" ? payload.instruction : undefined); markProductionMemoryStale(project); break;
      case "regenerate_bible": await filmBible.generate(project, typeof payload.instruction === "string" ? payload.instruction : "Regenerate as a new draft without replacing the approved canonical version."); markProductionMemoryStale(project); break;
      case "update_bible": {
        const key = z.string().trim().min(1).max(80).parse(payload.key);
        const value = z.string().trim().min(1).max(100_000).parse(payload.value);
        saveFilmBibleSection(project, key, value);
        markProductionMemoryStale(project);
        break;
      }
      case "update_audio": {
        const key = z.string().trim().min(1).max(80).parse(payload.key);
        const value = z.string().trim().min(1).max(20_000).parse(payload.value);
        project.production.audioBible[key] = value;
        if (/music/i.test(key)) updateAudioBible(project, { musicRules: [value], reason: `Film Bible audio field ${key} updated.` });
        else if (/ambient|sound/i.test(key)) updateAudioBible(project, { ambientSounds: [{ id: `AMBIENT_${key.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}`, name: key, description: value, identityKey: `${project.id}:${key}`, conditions: ["Use according to approved Story events."], locked: false, updatedAt: new Date().toISOString() }], reason: `Film Bible audio field ${key} updated.` });
        else updateAudioBible(project, { reason: `Film Bible audio field ${key} updated.` });
        break;
      }
      case "approve_bible": approveFilmBible(project); break;
      case "lock_bible": lockFilmBibleVersion(project); break;
      case "analyze_characters": analyzeCharacters(project); break;
      case "update_character": {
        const input = z.object({
          characterId: z.string().min(1), name: z.string().trim().min(1).max(160).optional(), role: z.string().trim().min(1).max(500).optional(), description: z.string().trim().min(1).max(10_000).optional(), ageRange: z.string().trim().max(160).optional(), occupation: z.string().trim().max(500).optional(), personality: z.string().trim().max(4_000).optional(), backstory: z.string().trim().max(10_000).optional(), goal: z.string().trim().max(4_000).optional(), motivation: z.string().trim().max(4_000).optional(), conflict: z.string().trim().max(4_000).optional(), fear: z.string().trim().max(4_000).optional(),
        }).parse(payload);
        const { characterId, ...changes } = input;
        updateCharacter(project, characterId, changes);
        markProductionMemoryStale(project);
        break;
      }
      case "update_character_state": {
        const input = z.object({ characterId: z.string().min(1), sequenceId: z.string().min(1), physical: z.string().max(4_000).optional(), emotional: z.string().max(4_000).optional(), wardrobe: z.string().max(4_000).optional(), injuries: z.string().max(4_000).optional(), possessions: z.array(z.string().max(500)).optional(), knowledge: z.string().max(4_000).optional(), relationshipState: z.string().max(4_000).optional(), damage: z.array(z.string().max(500)).optional() }).parse(payload);
        const { characterId, sequenceId, ...changes } = input;
        updateCharacterState(project, characterId, sequenceId, changes);
        markProductionMemoryStale(project);
        break;
      }
      case "approve_characters": approveCharacters(project); break;
      case "build_assets": buildAssetManifest(project); markProductionMemoryStale(project); break;
      case "update_asset": {
        const input = z.object({ assetId: z.string(), description: z.string().min(2).max(10_000).optional(), status: z.enum(["PLANNED", "PROMPT_READY", "GENERATING", "DRAFT", "GENERATED", "REVIEW", "APPROVED", "LOCKED", "REJECTED", "REGENERATE", "GENERATION_FAILED"]).optional() }).parse(payload);
        const asset = project.production.assets.find((item) => item.id === input.assetId);
        if (!asset) throw new ProjectNotFoundError(`Asset ${input.assetId} was not found.`);
        if (input.description && input.description !== asset.description) {
          asset.previousVersions.push({ version: asset.version, description: asset.description, createdAt: new Date().toISOString() });
          asset.version += 1;
          asset.description = input.description;
        }
        if (input.status) asset.status = input.status;
        markProductionMemoryStale(project);
        break;
      }
      case "approve_assets": approveAssets(project); break;
      case "build_production_memory": rebuildProductionMemory(project); break;
      case "update_continuity": {
        const input = z.object({
          sequenceId: z.string().min(1),
          anchor: z.enum(["START", "MID", "END"]),
          patches: z.array(z.object({
            entityId: z.string().min(1),
            entityType: z.enum(["character", "creature", "animal", "prop", "vehicle", "location", "global"]).optional(),
            fields: z.record(z.string(), z.unknown()),
          })).min(1).max(200),
          reason: z.string().trim().min(2).max(4_000),
          confirmedImpact: z.boolean().default(false),
        }).parse(payload);
        const impact = assessChangeImpact(project, "continuity", input.sequenceId);
        if (impact.requiresReview && !input.confirmedImpact) throw new AgentConflictError(`${impact.summary} Review affected production before applying this permanent continuity change.`);
        reviseContinuitySnapshot(project, { sequenceId: input.sequenceId, anchor: input.anchor, patches: input.patches, reason: input.reason, source: "USER" });
        if (project.memory.productionMemory.script.scriptVersion) project.memory.productionMemory.script.status = "CHANGED";
        break;
      }
      case "approve_continuity": approveContinuitySnapshot(project, z.string().min(1).parse(payload.snapshotId), false); break;
      case "lock_continuity": approveContinuitySnapshot(project, z.string().min(1).parse(payload.snapshotId), true); break;
      case "resolve_continuity_warning": {
        const input = z.object({ warningId: z.string().min(1), action: z.enum(["FIX_CURRENT_DATA", "ACCEPT_INTENTIONAL_CHANGE"]), note: z.string().max(2_000).optional() }).parse(payload);
        resolveContinuityWarning(project, input.warningId, input.action, input.note);
        break;
      }
      case "update_voice_profile": {
        const input = z.object({
          characterId: z.string().min(1), voiceDescription: z.string().max(4_000).optional(), language: z.string().max(160).optional(), accent: z.string().max(160).optional(), ageImpression: z.string().max(160).optional(), pitch: z.string().max(160).optional(), tone: z.string().max(500).optional(), speakingSpeed: z.string().max(160).optional(), emotionRange: z.array(z.string().max(500)).max(50).optional(), deliveryStyle: z.string().max(1_000).optional(), pronunciationRules: z.array(z.string().max(1_000)).max(100).optional(), volumeTendencies: z.string().max(500).optional(), status: z.enum(["DRAFT", "APPROVED", "LOCKED"]).optional(), confirmedImpact: z.boolean().default(false),
        }).parse(payload);
        const impact = assessChangeImpact(project, "audio_bible", input.characterId);
        if (impact.requiresReview && !input.confirmedImpact) throw new AgentConflictError(`${impact.summary} Review affected production before changing this voice identity.`);
        updateVoiceProfile(project, input);
        if (project.memory.productionMemory.script.scriptVersion) project.memory.productionMemory.script.status = "CHANGED";
        break;
      }
      case "update_audio_bible": {
        const input = z.object({
          settings: z.object({ filmLanguage: z.string().max(160).optional(), dialogueLanguage: z.string().max(160).optional(), narrationEnabled: z.boolean().optional(), dialogueEnabled: z.boolean().optional(), musicEnabled: z.boolean().optional(), subtitlesEnabled: z.boolean().optional() }).optional(),
          musicRules: z.array(z.string().max(2_000)).max(100).optional(), intentionalSilenceRules: z.array(z.string().max(2_000)).max(100).optional(),
          narrator: z.object({ id: z.string().min(1), identity: z.string().max(500), language: z.string().max(160), accent: z.string().max(160), tone: z.string().max(500), style: z.string().max(500), delivery: z.string().max(500), pacing: z.string().max(500), status: z.enum(["DRAFT", "APPROVED", "LOCKED"]) }).optional(),
          status: z.enum(["DRAFT", "APPROVED", "LOCKED"]).optional(), reason: z.string().max(2_000).optional(), confirmedImpact: z.boolean().default(false),
        }).parse(payload);
        const impact = assessChangeImpact(project, "audio_bible", "AUDIO_BIBLE");
        if (impact.requiresReview && !input.confirmedImpact) throw new AgentConflictError(`${impact.summary} Review affected production before changing permanent audio rules.`);
        updateAudioBible(project, input);
        if (project.memory.productionMemory.script.scriptVersion) project.memory.productionMemory.script.status = "CHANGED";
        break;
      }
      case "generate_script": generateProductionScript(project, "Generated Full Script v2 from approved Story, Film Bible, Movie DNA, production memory, characters, assets, Audio Bible, runtime, and Project Setup."); break;
      case "regenerate_script": generateProductionScript(project, typeof payload.reason === "string" ? payload.reason : "Generated a new script draft without replacing the approved version."); break;
      case "update_script_scene": {
        const input = z.object({
          sceneId: z.string().min(1),
          changes: z.object({ heading: z.string().max(1_000).optional(), action: z.string().max(100_000).optional(), performanceNotes: z.array(z.string().max(4_000)).max(100).optional(), transition: z.string().max(500).optional(), importantSound: z.array(z.string().max(2_000)).max(100).optional(), importantVisualActions: z.array(z.string().max(4_000)).max(100).optional() }),
          reason: z.string().trim().min(2).max(4_000),
          confirmedImpact: z.boolean().default(false),
        }).parse(payload);
        const scene = project.memory.productionMemory.script.scenes.find((item) => item.id === input.sceneId);
        const impact = assessChangeImpact(project, "script", scene?.sequenceId);
        if (impact.requiresReview && !input.confirmedImpact) throw new AgentConflictError(`${impact.summary} Review affected dialogue, shots, sequence states, continuity, assets, and future prompts before applying this edit.`);
        updateScriptScene(project, input.sceneId, input.changes, input.reason);
        break;
      }
      case "propose_script_change": {
        const input = z.object({ sequenceId: z.string().min(1), instruction: z.string().trim().min(3).max(4_000) }).parse(payload);
        proposeScriptChange(project, input.sequenceId, input.instruction);
        break;
      }
      case "propose_dialogue_change": {
        const input = z.object({ dialogueId: z.string().min(1), instruction: z.string().trim().min(3).max(4_000) }).parse(payload);
        proposeDialogueChange(project, input.dialogueId, input.instruction);
        break;
      }
      case "regenerate_script_change": {
        const proposal = project.memory.productionMemory.script.pendingProposal;
        if (!proposal) throw new AgentConflictError("Analyze a scoped script change before regenerating its proposal.");
        if (proposal.dialogueId) proposeDialogueChange(project, proposal.dialogueId, typeof payload.instruction === "string" ? payload.instruction : proposal.instruction, proposal.variant + 1);
        else proposeScriptChange(project, proposal.sequenceId, typeof payload.instruction === "string" ? payload.instruction : proposal.instruction, proposal.variant + 1);
        break;
      }
      case "apply_script_change": {
        const proposal = project.memory.productionMemory.script.pendingProposal;
        if (!proposal) throw new AgentConflictError("No script change proposal is waiting for review.");
        const confirmed = z.boolean().default(false).parse(payload.confirmedImpact);
        const impact = assessChangeImpact(project, "script", proposal.sequenceId);
        if (impact.requiresReview && !confirmed) throw new AgentConflictError(`${impact.summary} Confirm the displayed change impact before accepting this scoped script modification.`);
        applyScriptChange(project);
        break;
      }
      case "reject_script_change": rejectScriptChange(project); break;
      case "approve_script": approveProductionScript(project, false); break;
      case "lock_script": approveProductionScript(project, true); break;
      case "update_dialogue": {
        const input = z.object({
          dialogueId: z.string().min(1),
          changes: z.object({ exactDialogue: z.string().max(20_000).optional(), language: z.string().max(160).optional(), accent: z.string().max(160).optional(), emotion: z.string().max(500).optional(), delivery: z.string().max(1_000).optional(), pronunciation: z.array(z.string().max(1_000)).max(100).optional(), volume: z.string().max(500).optional(), timing: z.object({ startSeconds: z.number().min(0), endSeconds: z.number().positive(), label: z.string().default("") }).optional() }),
          reason: z.string().trim().min(2).max(4_000), confirmedImpact: z.boolean().default(false),
        }).parse(payload);
        const line = project.memory.productionMemory.script.dialogue.find((item) => item.id === input.dialogueId);
        const impact = assessChangeImpact(project, "dialogue", line?.sequenceId);
        if (impact.requiresReview && !input.confirmedImpact) throw new AgentConflictError(`${impact.summary} Review affected timing, shots, sequence state, and audio before changing this dialogue line.`);
        updateDialogueLine(project, input.dialogueId, input.changes, input.reason);
        break;
      }
      case "approve_dialogue": setDialogueApproval(project, z.string().min(1).parse(payload.dialogueId), "APPROVE"); break;
      case "lock_dialogue": setDialogueApproval(project, z.string().min(1).parse(payload.dialogueId), "LOCK"); break;
      case "unlock_dialogue": setDialogueApproval(project, z.string().min(1).parse(payload.dialogueId), "UNLOCK"); break;
      case "add_dialogue": {
        const input = z.object({ sequenceId: z.string().min(1), speakerCharacterId: z.string().min(1), exactDialogue: z.string().min(1).max(20_000), language: z.string().max(160), accent: z.string().max(160), emotion: z.string().max(500), delivery: z.string().max(1_000), pronunciation: z.array(z.string().max(1_000)).max(100).default([]), volume: z.string().max(500), timing: z.object({ startSeconds: z.number().min(0), endSeconds: z.number().positive(), label: z.string().default("") }) }).parse(payload);
        const { sequenceId, ...dialogue } = input;
        addDialogueLine(project, sequenceId, dialogue);
        break;
      }
      case "delete_dialogue": deleteDialogueLine(project, z.string().min(1).parse(payload.dialogueId)); break;
      case "add_shot": {
        const input = z.object({ sequenceId: z.string().min(1), afterIndex: z.number().int().min(-1).optional(), shotType: z.enum(["Establishing", "Extreme Wide", "Wide", "Medium Wide", "Medium", "Medium Close Up", "Close Up", "Extreme Close Up", "Over Shoulder", "Two Shot", "Group Shot", "POV", "Reaction", "Insert", "Macro", "Tracking", "Dolly", "Crane", "Low Angle", "High Angle", "Dutch Angle", "Top Down", "Aerial", "Drone", "Custom", "Establishing shot", "Wide shot", "Medium shot", "Close up", "Extreme close up", "Over shoulder", "Reaction shot", "Tracking shot", "Dolly shot", "Crane shot", "Low angle", "High angle"]).optional(), storyPurpose: z.string().max(2_000).optional(), subjectAction: z.string().max(4_000).optional() }).parse(payload);
        const { sequenceId, afterIndex, ...changes } = input;
        addShot(project, sequenceId, changes, afterIndex);
        break;
      }
      case "update_shot": {
        const input = z.object({
          shotId: z.string().min(1), confirmedImpact: z.boolean().default(false), reason: z.string().trim().min(2).max(4_000),
          changes: z.object({ durationSeconds: z.number().int().positive().optional(), shotType: z.enum(["Establishing", "Extreme Wide", "Wide", "Medium Wide", "Medium", "Medium Close Up", "Close Up", "Extreme Close Up", "Over Shoulder", "Two Shot", "Group Shot", "POV", "Reaction", "Insert", "Macro", "Tracking", "Dolly", "Crane", "Low Angle", "High Angle", "Dutch Angle", "Top Down", "Aerial", "Drone", "Custom", "Establishing shot", "Wide shot", "Medium shot", "Close up", "Extreme close up", "Over shoulder", "Reaction shot", "Tracking shot", "Dolly shot", "Crane shot", "Low angle", "High angle"]).optional(), framing: z.string().max(1_000).optional(), cameraAngle: z.string().max(1_000).optional(), cameraMovement: z.string().max(1_000).optional(), lens: z.string().max(1_000).optional(), focalLength: z.string().max(160).optional(), depthOfField: z.string().max(500).optional(), subjectAction: z.string().max(4_000).optional(), emotion: z.string().max(500).optional(), lighting: z.string().max(2_000).optional(), dialogueIds: z.array(z.string().min(1)).max(100).optional(), sound: z.string().max(2_000).optional(), storyPurpose: z.string().max(2_000).optional(), continuityPurpose: z.string().max(2_000).optional(), transition: z.string().max(500).optional(), startVisualState: z.string().max(4_000).optional(), endVisualState: z.string().max(4_000).optional() }),
        }).parse(payload);
        const shot = project.memory.productionMemory.script.shots.find((item) => item.id === input.shotId);
        const impact = assessChangeImpact(project, "script", shot?.sequenceId);
        if (impact.requiresReview && !input.confirmedImpact) throw new AgentConflictError(`${impact.summary} Review affected sequence timing and continuity before changing this shot.`);
        updateShot(project, input.shotId, input.changes, input.reason);
        break;
      }
      case "reorder_shots": {
        const input = z.object({ sequenceId: z.string().min(1), orderedShotIds: z.array(z.string().min(1)).min(1) }).parse(payload);
        reorderShots(project, input.sequenceId, input.orderedShotIds);
        break;
      }
      case "duplicate_shot": duplicateShot(project, z.string().min(1).parse(payload.shotId)); break;
      case "delete_shot": deleteShot(project, z.string().min(1).parse(payload.shotId)); break;
      case "resolve_script_continuity": {
        const input = z.object({ warningId: z.string().min(1), action: z.enum(["FIX_SCRIPT", "ACCEPT_INTENTIONAL_CHANGE"]), note: z.string().max(2_000).optional() }).parse(payload);
        resolveScriptContinuity(project, input.warningId, input.action, input.note);
        if (input.action === "ACCEPT_INTENTIONAL_CHANGE") resolveContinuityWarning(project, input.warningId, "ACCEPT_INTENTIONAL_CHANGE", input.note);
        break;
      }
      case "plan_sequences": planSequences(project); break;
      case "approve_script_sequence": setScriptSequenceApproval(project, z.string().min(1).parse(payload.sequenceId), "APPROVE"); break;
      case "lock_script_sequence": setScriptSequenceApproval(project, z.string().min(1).parse(payload.sequenceId), "LOCK"); break;
      case "reject_script_sequence": {
        const input = z.object({ sequenceId: z.string().min(1), reason: z.string().trim().min(2).max(2_000) }).parse(payload);
        setScriptSequenceApproval(project, input.sequenceId, "REJECT", input.reason);
        break;
      }
      case "update_platform_profile": {
        const input = z.object({ platform: targetPlatformSchema, model: z.string().trim().min(1).max(120).optional(), maxDurationSeconds: z.coerce.number().int().min(1).max(120).optional(), maxReferences: z.coerce.number().int().min(1).max(30).optional(), instructions: z.string().trim().min(1).max(5000).optional() }).parse(payload);
        const profile = project.production.platformProfiles[input.platform];
        if (input.model !== undefined) profile.model = input.model;
        if (input.maxDurationSeconds !== undefined) profile.maxDurationSeconds = input.maxDurationSeconds;
        if (input.maxReferences !== undefined) profile.maxReferences = input.maxReferences;
        if (input.instructions !== undefined) profile.instructions = input.instructions;
        profile.version += 1;
        profile.updatedAt = new Date().toISOString();
        break;
      }
      case "compile_prompts": {
        const platform = targetPlatformSchema.optional().parse(payload.platform) as TargetPlatform | undefined;
        if (project.memory.productionMemory.script.sequences.length) compileAllSequencePrompts(project, platform);
        else compileProductionPrompts(project, platform);
        break;
      }
      case "compile_sequence_prompt": {
        const input = z.object({ sequenceId: z.string().min(1), platform: targetPlatformSchema.optional() }).parse(payload);
        compileSequencePrompt(project, input.sequenceId, input.platform as TargetPlatform | undefined);
        project.production.promptWorkspace.activeSequenceId = input.sequenceId;
        break;
      }
      case "save_normal_prompt": {
        const input = z.object({ sequenceId: z.string().min(1), activeSequenceId: z.string().min(1).optional(), platform: targetPlatformSchema, text: z.string().max(500_000) }).parse(payload);
        updatePromptFromNormal(project, input.sequenceId, input.platform as TargetPlatform, input.text);
        project.production.promptWorkspace.activeSequenceId = input.activeSequenceId ?? input.sequenceId;
        break;
      }
      case "save_json_prompt": {
        const input = z.object({ sequenceId: z.string().min(1), activeSequenceId: z.string().min(1).optional(), platform: targetPlatformSchema, text: z.string().max(1_000_000) }).parse(payload);
        updatePromptFromJson(project, input.sequenceId, input.platform as TargetPlatform, input.text);
        project.production.promptWorkspace.activeSequenceId = input.activeSequenceId ?? input.sequenceId;
        break;
      }
      case "resolve_prompt_change": {
        const input = z.object({ sequenceId: z.string().min(1), platform: targetPlatformSchema, resolution: z.enum(["APPLY", "KEEP_OVERRIDE", "CANCEL", "APPLY_PROJECT"]) }).parse(payload);
        resolvePromptChange(project, input.sequenceId, input.platform as TargetPlatform, input.resolution);
        break;
      }
      case "reset_sequence_overrides": {
        const input = z.object({ sequenceId: z.string().min(1), platform: targetPlatformSchema }).parse(payload);
        resetSequenceOverrides(project, input.sequenceId, input.platform as TargetPlatform);
        break;
      }
      case "validate_sequence_prompt": {
        const input = z.object({ sequenceId: z.string().min(1), platform: targetPlatformSchema }).parse(payload);
        validateSequencePrompt(project, input.sequenceId, input.platform as TargetPlatform);
        break;
      }
      case "restore_prompt_state": {
        const input = z.object({ sequenceId: z.string().min(1), platform: targetPlatformSchema }).parse(payload);
        restorePromptFromState(project, input.sequenceId, input.platform as TargetPlatform);
        break;
      }
      case "set_reference_limit_mode": {
        const input = z.object({ sequenceId: z.string().min(1), platform: targetPlatformSchema, mode: z.enum(["REVIEW", "RECOMMENDED", "MANUAL", "MERGED_SHEET"]), selectedAssetIds: z.array(z.string()).optional() }).parse(payload);
        setReferenceLimitMode(project, input.sequenceId, input.platform as TargetPlatform, input.mode, input.selectedAssetIds);
        break;
      }
      case "set_storyboard_grid": {
        const input = z.object({ sequenceId: z.string().min(1), platform: targetPlatformSchema, enabled: z.boolean() }).parse(payload);
        setSequenceStoryboardGrid(project, input.sequenceId, input.enabled);
        compileSequencePrompt(project, input.sequenceId, input.platform as TargetPlatform, input.enabled ? "Optional Storyboard Grid enabled from the existing Shot Planner" : "Optional Storyboard Grid disabled; Shot Planner preserved");
        break;
      }
      case "upload_storyboard_grid": {
        const input = z.object({ sequenceId: z.string().min(1), platform: targetPlatformSchema, filename: z.string().trim().min(1).max(260), mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]), base64: z.string().min(1) }).parse(payload);
        const grid = setSequenceStoryboardGrid(project, input.sequenceId, true);
        const existing = grid.referenceId ? project.memory.database.projectReferences.find((reference) => reference.id === grid.referenceId) : undefined;
        const reference = existing
          ? await references.replace(project, existing.id, input)
          : await references.upload(project, {
              ...input,
              name: `Sequence ${String(grid.sequenceNumber).padStart(2, "0")} Storyboard Grid`,
              type: "composition",
              roles: ["COMPOSITION", "MOTION", "CAMERA"],
              storyUsage: "PREFERRED",
            });
        reference.priority = 35;
        reference.sequenceIds = [input.sequenceId];
        attachStoryboardGridReference(project, input.sequenceId, { referenceId: reference.id, imagePath: reference.sourcePath, thumbnailPath: reference.thumbnailPath });
        compileSequencePrompt(project, input.sequenceId, input.platform as TargetPlatform, "Storyboard Grid reference attached and uniquely mapped");
        break;
      }
      case "update_sequence_prompt": {
        const sequenceId = z.string().parse(payload.sequenceId);
        const key = z.string().trim().min(1).max(80).parse(payload.key);
        const value = z.string().trim().max(100_000).parse(payload.value);
        const sequence = project.production.sequences.find((item) => item.id === sequenceId);
        if (!sequence) throw new ProjectNotFoundError(`Sequence ${sequenceId} was not found.`);
        sequence.promptSections[key] = value;
        sequence.compiledPrompt = Object.entries(sequence.promptSections).map(([section, content]) => `[${section.toUpperCase()}]\n${content}`).join("\n\n");
        break;
      }
      case "reject_sequence": {
        const sequenceId = z.string().parse(payload.sequenceId);
        const reason = z.string().trim().min(2).max(2000).parse(payload.reason);
        const sequence = project.production.sequences.find((item) => item.id === sequenceId);
        if (!sequence) throw new ProjectNotFoundError(`Sequence ${sequenceId} was not found.`);
        sequence.status = "REJECTED";
        sequence.inspectionNotes.push(reason);
        sequence.generationHistory.push({ id: crypto.randomUUID(), status: "REJECTED", reason, videoPath: sequence.videoPath, createdAt: new Date().toISOString() });
        break;
      }
      case "approve_sequence": approveSequence(project, z.string().parse(payload.sequenceId), false); break;
      case "lock_sequence": approveSequence(project, z.string().parse(payload.sequenceId), true); break;
      case "run_full": {
        await storyBrain.generate(project, typeof payload.input === "string" ? payload.input : undefined, "AI");
        approveStory(project);
        await filmBible.generate(project);
        approveFilmBible(project);
        analyzeCharacters(project);
        approveCharacters(project);
        buildAssetManifest(project);
        await agent.assetMaker.generateAllAssets(project, false);
        approveAssets(project);
        rebuildProductionMemory(project);
        planSequences(project);
        break;
      }
    }
    refreshPromptOutdatedState(project);
    await store.saveProject(project);
    response.json(project);
  });
  app.post("/api/projects/:projectId/sequences/:sequenceId/video", express.raw({ type: ["video/mp4", "video/webm", "video/quicktime"], limit: "2gb" }), async (request, response) => {
    const project = await store.getProject(request.params.projectId);
    const sequence = project.production.sequences.find((item) => item.id === request.params.sequenceId);
    if (!sequence) throw new ProjectNotFoundError(`Sequence ${request.params.sequenceId} was not found.`);
    const contentType = String(request.headers["content-type"] ?? "");
    const extension = contentType.includes("webm") ? ".webm" : contentType.includes("quicktime") ? ".mov" : ".mp4";
    const relativePath = `generated_video/${sequence.id.toLowerCase()}-${Date.now()}${extension}`;
    await store.writeProjectBinary(project.id, relativePath, Buffer.isBuffer(request.body) ? request.body : Buffer.from(request.body));
    sequence.videoPath = relativePath;
    sequence.status = "GENERATED";
    sequence.generationHistory.push({ id: crypto.randomUUID(), status: "GENERATED", videoPath: relativePath, createdAt: new Date().toISOString() });
    const gate = project.production.gates.find((item) => item.stage === "video_review");
    if (gate) Object.assign(gate, { status: "REVIEW", updatedAt: new Date().toISOString(), note: `${sequence.id} is ready for continuity inspection.` });
    await store.saveProject(project);
    response.json(project);
  });
  app.post("/api/projects/:projectId/references", async (request, response) => {
    const input = referenceUploadSchema.parse(request.body);
    const project = await store.getProject(request.params.projectId);
    await references.upload(project, input);
    syncManifestReferences(project);
    await store.saveProject(project);
    response.status(201).json(project);
  });
  app.post("/api/projects/:projectId/reference-setup/complete", async (request, response) => {
    const project = await store.getProject(request.params.projectId);
    references.completeSetup(project);
    await store.saveProject(project);
    response.json(project);
  });
  app.patch("/api/projects/:projectId/references/:referenceId", async (request, response) => {
    const input = z.object({
      roles: z.array(referenceRoleSchema).min(1).optional(),
      storyUsage: z.enum(["REQUIRED", "PREFERRED", "VISUAL_REFERENCE_ONLY", "OPTIONAL"]).optional(),
      priority: z.number().int().min(0).max(1000).optional(),
      sequenceIds: z.array(z.string().trim().min(1).max(120)).optional(),
      label: z.string().trim().max(120).optional(),
      name: z.string().trim().min(1).max(120).optional(),
    }).parse(request.body);
    const project = await store.getProject(request.params.projectId);
    const reference = project.memory.database.projectReferences.find((item) => item.id === request.params.referenceId);
    if (!reference) throw new ProjectNotFoundError(`Reference ${request.params.referenceId} was not found.`);
    if (reference.id === project.preStorySetup.mainCharacterReferenceId && input.storyUsage && input.storyUsage !== "REQUIRED") throw new AgentConflictError("The protected main character source must remain REQUIRED.");
    Object.assign(reference, input, { updatedAt: new Date().toISOString() });
    if (input.sequenceIds && project.artifacts.sequences) {
      project.artifacts.sequences = filmRuleEngine.registerSequences(project, project.artifacts.sequences as SequencesArtifact);
    }
    await store.saveProject(project);
    response.json(project);
  });
  app.put("/api/projects/:projectId/references/:referenceId/image", async (request, response) => {
    const input = z.object({
      filename: z.string().trim().min(1).max(260),
      mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
      base64: z.string().min(8),
    }).parse(request.body);
    const project = await store.getProject(request.params.projectId);
    await references.replace(project, request.params.referenceId, input);
    syncManifestReferences(project);
    await store.saveProject(project);
    response.json(project);
  });
  app.delete("/api/projects/:projectId/references/:referenceId", async (request, response) => {
    const project = await store.getProject(request.params.projectId);
    await references.remove(project, request.params.referenceId);
    syncManifestReferences(project);
    await store.saveProject(project);
    response.json(project);
  });
  app.post("/api/projects/:projectId/references/:referenceId/generate-sheet", async (request, response) => {
    const input = z.object({ force: z.boolean().optional() }).parse(request.body ?? {});
    const project = await store.getProject(request.params.projectId);
    const asset = references.ensureAsset(project, request.params.referenceId);
    await agent.assetMaker.generateAsset(project, asset.id, input.force ?? false);
    const record = project.production.assets.find((item) => item.id === asset.id);
    if (asset.generatedImagePath && !record?.pendingVersion) await agent.assetMaker.generateContinuitySheet(project, asset.id, input.force ?? false);
    references.syncCharacterSheet(project, asset.id);
    syncManifestRuntime(project);
    await store.saveProject(project);
    response.json(project);
  });
  app.get("/api/projects/:projectId/media", async (request, response) => {
    const relative = z.string().min(1).parse(request.query.path);
    await store.getProject(request.params.projectId);
    response.sendFile(store.resolveProjectFile(request.params.projectId, relative));
  });
  app.patch("/api/projects/:projectId/rules/:ruleId", async (request, response) => {
    const input = ruleOverrideSchema.parse(request.body);
    const project = await store.getProject(request.params.projectId);
    filmRuleEngine.setRuleOverride(project, request.params.ruleId, input);
    await store.saveProject(project);
    response.json(project);
  });
  app.patch("/api/projects/:projectId/assets/:assetId", async (request, response) => {
    const input = z.object({ state: approvalStateSchema, note: z.string().trim().max(1_000).optional() }).parse(request.body);
    const project = await store.getProject(request.params.projectId);
    filmRuleEngine.setAssetApproval(project, request.params.assetId, input.state as ApprovalState, input.note);
    const manifestRecord = project.production.assets.find((item) => item.id === request.params.assetId);
    if (manifestRecord) {
      manifestRecord.status = input.state as ApprovalState;
      manifestRecord.updatedAt = new Date().toISOString();
    }
    const sheet = project.memory.database.continuitySheets.find((item) => item.assetId === request.params.assetId);
    if (sheet && ["APPROVED", "LOCKED"].includes(input.state)) {
      sheet.status = input.state;
      sheet.views.forEach((view) => { if (view.imagePath) view.status = input.state; });
      sheet.updatedAt = new Date().toISOString();
    }
    const character = project.production.characters.find((item) => item.id === request.params.assetId);
    if (character) {
      character.sheetId = sheet?.id;
      character.sheetStatus = sheet?.status ?? input.state;
      character.updatedAt = new Date().toISOString();
    }
    syncManifestRuntime(project);
    await store.saveProject(project);
    response.json(project);
  });
  app.post("/api/projects/:projectId/assets/:assetId/versions", async (request, response) => {
    const input = z.object({ description: z.string().trim().max(4_000).optional() }).parse(request.body ?? {});
    const project = await store.getProject(request.params.projectId);
    filmRuleEngine.createAssetVersion(project, request.params.assetId, input.description);
    await store.saveProject(project);
    response.status(201).json(project);
  });
  app.post("/api/projects/:projectId/assets/rebuild", async (request, response) => {
    const project = await store.getProject(request.params.projectId);
    buildAssetManifest(project);
    await store.saveProject(project);
    response.json(project);
  });
  app.post("/api/projects/:projectId/assets", async (request, response) => {
    const input = z.object({
      name: z.string().trim().min(2).max(160),
      category: manifestCategorySchema.exclude(["movie_dna", "character_state"]),
      description: z.string().trim().min(2).max(8_000),
      storyPurpose: z.string().trim().max(2_000).optional(),
      sequenceIds: z.array(z.string().trim().min(1).max(120)).max(120).optional(),
      referenceRole: z.string().trim().min(1).max(120).optional(),
      continuityRequirements: z.array(z.string().trim().min(1).max(1_000)).max(50).optional(),
    }).parse(request.body);
    const project = await store.getProject(request.params.projectId);
    const record = addManualManifestAsset(project, input);
    await store.saveProject(project);
    response.status(201).json({ project, assetId: record.id });
  });
  app.patch("/api/projects/:projectId/assets/:assetId/manifest", async (request, response) => {
    const input = z.object({
      description: z.string().trim().min(2).max(8_000).optional(),
      storyPurpose: z.string().trim().min(2).max(2_000).optional(),
      sequenceIds: z.array(z.string().trim().min(1).max(120)).max(120).optional(),
      referenceRoles: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
      generationPrompt: z.string().trim().min(2).max(20_000).optional(),
    }).parse(request.body);
    const project = await store.getProject(request.params.projectId);
    updateManifestAsset(project, request.params.assetId, input);
    await store.saveProject(project);
    response.json(project);
  });
  app.post("/api/projects/:projectId/assets/:assetId/missing-decision", async (request, response) => {
    const input = z.object({ action: z.enum(["GENERATE", "UPLOAD", "IGNORE"]), reason: z.string().trim().max(1_000).optional() }).parse(request.body);
    const project = await store.getProject(request.params.projectId);
    decideMissingAsset(project, request.params.assetId, input.action, input.reason);
    if (input.action === "GENERATE") {
      await agent.assetMaker.generateAsset(project, request.params.assetId, false);
      const record = project.production.assets.find((item) => item.id === request.params.assetId);
      if (record?.imagePath && !record.pendingVersion) await agent.assetMaker.generateContinuitySheet(project, request.params.assetId, false);
      syncManifestRuntime(project);
    }
    await store.saveProject(project);
    response.json(project);
  });
  app.post("/api/projects/:projectId/assets/:assetId/replacement/accept", async (request, response) => {
    const project = await store.getProject(request.params.projectId);
    await agent.assetMaker.acceptPendingVersion(project, request.params.assetId);
    await agent.assetMaker.generateContinuitySheet(project, request.params.assetId, true);
    syncManifestRuntime(project);
    await store.saveProject(project);
    response.json(project);
  });
  app.delete("/api/projects/:projectId/assets/:assetId/replacement", async (request, response) => {
    const project = await store.getProject(request.params.projectId);
    await agent.assetMaker.rejectPendingVersion(project, request.params.assetId);
    await store.saveProject(project);
    response.json(project);
  });
  app.delete("/api/projects/:projectId/assets/:assetId/manifest", async (request, response) => {
    const project = await store.getProject(request.params.projectId);
    const removed = deleteManualManifestAsset(project, request.params.assetId);
    if (removed.imagePath) await store.removeProjectFile(project.id, removed.imagePath);
    if (removed.thumbnailPath) await store.removeProjectFile(project.id, removed.thumbnailPath);
    await store.saveProject(project);
    response.json(project);
  });
  app.get("/api/projects/:projectId/assets/generation-preview", async (request, response) => {
    const project = await store.getProject(request.params.projectId);
    agent.assetMaker.planScenes(project);
    agent.assetMaker.planStoryboard(project);
    response.json(agent.assetMaker.preview(project));
  });
  app.post("/api/projects/:projectId/assets/generate-all", async (request, response) => {
    const input = z.object({ force: z.boolean().optional() }).parse(request.body ?? {});
    const project = await store.getProject(request.params.projectId);
    await agent.assetMaker.generateAllAssets(project, input.force ?? false);
    await store.saveProject(project);
    response.json(project);
  });
  app.post("/api/projects/:projectId/assets/:assetId/generate", async (request, response) => {
    const input = z.object({ force: z.boolean().optional(), impactMode: z.enum(["FUTURE_ONLY", "APPLY_ALL"]).optional() }).parse(request.body ?? {});
    const project = await store.getProject(request.params.projectId);
    const manifestRecord = project.production.assets.find((item) => item.id === request.params.assetId);
    if (input.force && manifestRecord?.status === "LOCKED" && !input.impactMode) {
      throw new AgentConflictError("This asset is locked. Review affected production items and choose Replace for Future Work or Apply Replacement before regeneration.");
    }
    await agent.assetMaker.generateAsset(project, request.params.assetId, input.force ?? false, input.impactMode);
    if (!manifestRecord?.pendingVersion && project.memory.database.assets.find((item) => item.id === request.params.assetId)?.generatedImagePath) {
      await agent.assetMaker.generateContinuitySheet(project, request.params.assetId, input.force ?? false);
    }
    syncManifestRuntime(project);
    await store.saveProject(project);
    response.json(project);
  });
  app.post("/api/projects/:projectId/scenes/plan", async (request, response) => {
    const project = await store.getProject(request.params.projectId);
    agent.assetMaker.planScenes(project);
    await store.saveProject(project);
    response.json(project);
  });
  app.post("/api/projects/:projectId/scenes/generate-all", async (request, response) => {
    const input = z.object({ force: z.boolean().optional() }).parse(request.body ?? {});
    const project = await store.getProject(request.params.projectId);
    await agent.assetMaker.generateAllScenes(project, input.force ?? false);
    await store.saveProject(project);
    response.json(project);
  });
  app.post("/api/projects/:projectId/scenes/:sceneId/generate", async (request, response) => {
    const input = z.object({ force: z.boolean().optional() }).parse(request.body ?? {});
    const project = await store.getProject(request.params.projectId);
    await agent.assetMaker.generateScene(project, request.params.sceneId, input.force ?? false);
    await store.saveProject(project);
    response.json(project);
  });
  app.post("/api/projects/:projectId/storyboards/generate", async (request, response) => {
    const input = z.object({ force: z.boolean().optional() }).parse(request.body ?? {});
    const project = await store.getProject(request.params.projectId);
    await agent.assetMaker.generateStoryboard(project, input.force ?? false);
    await store.saveProject(project);
    response.json(project);
  });
  app.post("/api/projects/:projectId/prompts/compile", async (request, response) => {
    const input = z.object({ profileIds: z.array(z.string()).optional() }).parse(request.body ?? {});
    const project = await store.getProject(request.params.projectId);
    agent.promptCompiler.compile(project, input.profileIds);
    await store.saveProject(project);
    response.json(project);
  });
  app.patch("/api/projects/:projectId/model-profiles/:profileId", async (request, response) => {
    const input = z.object({
      enabled: z.boolean().optional(), model: z.string().trim().min(1).max(120).optional(),
      maxDurationSeconds: z.number().positive().optional(), maxImageReferences: z.number().int().positive().optional(),
      maxVideoReferences: z.number().int().nonnegative().optional(), maxAudioReferences: z.number().int().nonnegative().optional(),
      supportsStartFrame: z.boolean().optional(), supportsEndFrame: z.boolean().optional(), tagTemplate: z.string().min(1).max(80).optional(),
    }).parse(request.body);
    const project = await store.getProject(request.params.projectId);
    const profile = project.memory.database.modelProfiles.find((item) => item.id === request.params.profileId);
    if (!profile) throw new ProjectNotFoundError(`Model profile ${request.params.profileId} was not found.`);
    Object.assign(profile, input, { updatedAt: new Date().toISOString() });
    await store.saveProject(project);
    response.json(project);
  });
  app.post("/api/projects/:projectId/validation-issues/:issueId/override", async (request, response) => {
    const input = z.object({ reason: z.string().trim().min(3).max(1_000) }).parse(request.body);
    const project = await store.getProject(request.params.projectId);
    filmRuleEngine.overrideIssue(project, request.params.issueId, input.reason);
    await store.saveProject(project);
    response.json(project);
  });
  app.post("/api/projects/:projectId/agent/run", async (request, response) => {
    const input = runSchema.parse(request.body ?? {});
    response.status(202).json(await agent.start(request.params.projectId, input.mode, input.instruction));
  });
  app.post("/api/projects/:projectId/agent/message", async (request, response) => {
    const input = messageSchema.parse(request.body);
    response.status(202).json(await agent.handleMessage(request.params.projectId, input.content, input.mode));
  });
  app.post("/api/projects/:projectId/agent/approve", async (request, response) => response.status(202).json(await agent.approve(request.params.projectId)));
  app.post("/api/projects/:projectId/agent/regenerate", async (request, response) => {
    const input = regenerateSchema.parse(request.body ?? {});
    response.status(202).json(await agent.regenerate(request.params.projectId, input.phase as PhaseId | undefined, input.feedback));
  });
  app.post("/api/projects/:projectId/agent/cancel", async (request, response) => response.status(202).json(await agent.cancel(request.params.projectId)));
  app.post("/api/projects/:projectId/brain/recover", async (request, response) => {
    const input = z.object({
      action: z.enum(["retry", "continue_local", "continue_codex", "switch_brain", "cancel"]),
      brain: brainSchema.optional(),
    }).parse(request.body);
    if (input.action === "cancel") return response.status(202).json(await agent.cancel(request.params.projectId));
    if (input.action === "continue_local") return response.status(202).json(await agent.switchBrain(request.params.projectId, "local", true));
    if (input.action === "continue_codex") return response.status(202).json(await agent.switchBrain(request.params.projectId, "codex", true));
    if (input.action === "switch_brain") {
      if (!input.brain) throw new AgentConflictError("Choose a brain before switching.");
      return response.json(await agent.switchBrain(request.params.projectId, input.brain));
    }
    return response.status(202).json(await agent.start(request.params.projectId));
  });

  app.get("/api/projects/:projectId/assets/:assetId/download", async (request, response, next) => {
    try {
      const project = await store.getProject(request.params.projectId);
      const record = project.production.assets.find((item) => item.id === request.params.assetId);
      if (!record) throw new ProjectNotFoundError(`Asset ${request.params.assetId} was not found.`);
      const entity = project.memory.database.assets.find((item) => item.id === record.id);
      const relativePath = record.imagePath ?? entity?.generatedImagePath;
      if (!relativePath || !await store.projectFileExists(project.id, relativePath)) throw new ProjectNotFoundError(`${record.name} does not have an available image file.`);
      response.setHeader("Content-Disposition", `attachment; filename="${record.filename.replaceAll('"', "")}"`);
      response.sendFile(store.resolveProjectFile(project.id, relativePath));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/projects/:projectId/sequences/:sequenceId/references", async (request, response, next) => {
    try {
      const project = await store.getProject(request.params.projectId);
      const platform = targetPlatformSchema.parse(request.query.platform ?? project.production.promptWorkspace.selectedPlatforms[request.params.sequenceId] ?? project.targetPlatform) as TargetPlatform;
      const pkg = sequenceReferencePackage(project, request.params.sequenceId, platform);
      response.setHeader("Content-Type", "application/zip");
      response.setHeader("Content-Disposition", `attachment; filename="${pkg.folderName}.zip"`);
      const archive = new ZipArchive({ zlib: { level: 9 } });
      archive.on("error", next);
      archive.pipe(response);
      for (const file of pkg.files) {
        if (await store.projectFileExists(project.id, file.sourcePath)) archive.file(store.resolveProjectFile(project.id, file.sourcePath), { name: `${pkg.folderName}/${file.packageFilename}` });
      }
      archive.append(pkg.record.normalPrompt, { name: `${pkg.folderName}/prompt.txt` });
      archive.append(pkg.record.jsonPrompt, { name: `${pkg.folderName}/prompt.json` });
      archive.append(`${JSON.stringify(pkg.manifest, null, 2)}\n`, { name: `${pkg.folderName}/reference_manifest.json` });
      await archive.finalize();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/projects/:projectId/assets/export", async (request, response, next) => {
    try {
      const project = await store.getProject(request.params.projectId);
      const scope = z.enum(["all", "selected", "approved", "locked"]).parse(request.query.scope ?? "all");
      const selectedIds = new Set(String(request.query.ids ?? "").split(",").map((item) => item.trim()).filter(Boolean));
      const records = project.production.assets.filter((record) => {
        if (scope === "selected") return selectedIds.has(record.id);
        if (scope === "approved") return ["APPROVED", "LOCKED"].includes(record.status);
        if (scope === "locked") return record.status === "LOCKED";
        return true;
      });
      response.setHeader("Content-Type", "application/zip");
      response.setHeader("Content-Disposition", `attachment; filename="${project.id}-assets-${scope}.zip"`);
      const archive = new ZipArchive({ zlib: { level: 9 } });
      archive.on("error", next);
      archive.pipe(response);
      for (const record of records) {
        const entity = project.memory.database.assets.find((item) => item.id === record.id);
        const relativePath = record.imagePath ?? entity?.generatedImagePath;
        if (relativePath && await store.projectFileExists(project.id, relativePath)) archive.file(store.resolveProjectFile(project.id, relativePath), { name: record.filename });
      }
      archive.append(`${JSON.stringify({ projectId: project.id, scope, exportedAt: new Date().toISOString(), assets: records }, null, 2)}\n`, { name: "asset-manifest.json" });
      await archive.finalize();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/projects/:projectId/export", async (request, response, next) => {
    try {
      const project = await store.getProject(request.params.projectId);
      const projectRoot = store.projectPath(project.id);
      response.setHeader("Content-Type", "application/zip");
      response.setHeader("Content-Disposition", `attachment; filename="${project.id}.zip"`);
      const archive = new ZipArchive({ zlib: { level: 9 } });
      archive.on("error", next);
      archive.pipe(response);
      archive.glob("**/*", { cwd: projectRoot, dot: false, ignore: ["**/*.tmp"] });
      await archive.finalize();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/diagnostics", async (request, response) => {
    const appSettings = await settings.get();
    const currentBrain = (request.query.brain as BrainMode | undefined) ?? appSettings.defaultBrain;
    const status = await router.status();
    response.json({
      desktopVersion: options.desktopVersion ?? options.version,
      backendVersion: options.version,
      codexVersion: status.codex.version,
      codexConnection: status.codex.state,
      localModelConnection: status.local.state,
      projectDirectory: options.dataRoot,
      currentBrain,
      platform: `${process.platform} ${process.arch}`,
      recentErrors: await logger.recentErrors(),
    });
  });

  if (options.production) {
    app.use(express.static(options.distRoot));
    app.use((request, response, next) => {
      if (request.method !== "GET" || request.path.startsWith("/api/")) return next();
      response.sendFile(path.join(options.distRoot, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ root: options.workspaceRoot, server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof z.ZodError) return response.status(400).json({ error: error.issues[0]?.message ?? "Invalid request." });
    if (error instanceof ProjectNotFoundError) return response.status(404).json({ error: error.message });
    if (error instanceof AgentConflictError) return response.status(409).json({ error: error.message });
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    void logger.error("backend", "Unhandled backend request error.", { message });
    response.status(500).json({ error: message });
  });
  return { app, store, agent, router, settings, logger };
};

export const startContinuityServer = async (
  options: RuntimeOptions & { port?: number; host?: string },
): Promise<StartedContinuityServer> => {
  const runtime = await createRuntime(options);
  const host = options.host ?? "127.0.0.1";
  const server = await new Promise<import("node:http").Server>((resolve, reject) => {
    const listener = runtime.app.listen(options.port ?? 8787, host, (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(listener);
    });
    listener.once("error", reject);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.port ?? 8787;
  await runtime.logger.info("backend", "Continuity Studio backend started.", { host, port, production: options.production });
  return {
    ...runtime,
    url: `http://${host}:${port}`,
    port,
    async close() {
      await runtime.router.shutdown();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
};
