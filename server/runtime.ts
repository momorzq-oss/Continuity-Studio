import path from "node:path";
import { ZipArchive } from "archiver";
import express from "express";
import { z } from "zod";
import type { ApprovalState, BrainMode, PhaseId } from "../src/types.js";
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
const createProjectSchema = z.object({
  title: z.string().trim().min(2).max(100),
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
  autoGenerateAssets: z.boolean().default(true),
  autoGenerateScenes: z.boolean().default(true),
  autoGenerateStoryboard: z.boolean().default(true),
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
  const agent = new ProductionAgent(store, router, logger);
  const references = new ReferenceManager(store);
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16mb" }));

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
    response.status(201).json(project);
  });
  app.get("/api/projects/:projectId", async (request, response) => response.json(await store.getProject(request.params.projectId)));
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
  app.post("/api/projects/:projectId/references", async (request, response) => {
    const input = z.object({
      filename: z.string().trim().min(1).max(260),
      mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
      base64: z.string().min(8),
      name: z.string().trim().min(1).max(120),
      type: z.enum(["character", "creature", "animal", "location", "prop", "wardrobe", "style", "composition", "camera", "lighting", "audio", "voice", "other"]),
      roles: z.array(z.enum(["IDENTITY", "WARDROBE", "CREATURE", "ANIMAL", "LOCATION", "PROP", "COMPOSITION", "CAMERA", "MOTION", "LIGHTING", "STYLE", "START_FRAME", "END_FRAME", "VIDEO_CONTINUITY", "AUDIO", "VOICE"])).optional(),
      storyUsage: z.enum(["REQUIRED", "PREFERRED", "VISUAL_REFERENCE_ONLY", "OPTIONAL"]).optional(),
      mainCharacter: z.boolean().optional(),
    }).parse(request.body);
    const project = await store.getProject(request.params.projectId);
    await references.upload(project, input);
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
      roles: z.array(z.enum(["IDENTITY", "WARDROBE", "CREATURE", "ANIMAL", "LOCATION", "PROP", "COMPOSITION", "CAMERA", "MOTION", "LIGHTING", "STYLE", "START_FRAME", "END_FRAME", "VIDEO_CONTINUITY", "AUDIO", "VOICE"])).min(1).optional(),
      storyUsage: z.enum(["REQUIRED", "PREFERRED", "VISUAL_REFERENCE_ONLY", "OPTIONAL"]).optional(),
      priority: z.number().int().min(0).max(1000).optional(),
    }).parse(request.body);
    const project = await store.getProject(request.params.projectId);
    const reference = project.memory.database.projectReferences.find((item) => item.id === request.params.referenceId);
    if (!reference) throw new ProjectNotFoundError(`Reference ${request.params.referenceId} was not found.`);
    if (reference.id === project.preStorySetup.mainCharacterReferenceId && input.storyUsage && input.storyUsage !== "REQUIRED") throw new AgentConflictError("The protected main character source must remain REQUIRED.");
    Object.assign(reference, input, { updatedAt: new Date().toISOString() });
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
    const input = z.object({ force: z.boolean().optional() }).parse(request.body ?? {});
    const project = await store.getProject(request.params.projectId);
    await agent.assetMaker.generateAsset(project, request.params.assetId, input.force ?? false);
    await agent.assetMaker.generateContinuitySheet(project, request.params.assetId, input.force ?? false);
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
