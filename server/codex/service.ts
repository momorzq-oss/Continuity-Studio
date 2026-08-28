import { randomUUID } from "node:crypto";
import type {
  BrainHealth,
  CodexApprovalRequest,
  MovieProject,
  PhaseId,
} from "../../src/types.js";
import type { PhaseResult } from "../engine.js";
import { LocalPhaseEngine } from "../local-engine.js";
import type { StructuredLogger } from "../logger.js";
import type { SettingsStore } from "../settings.js";
import { CodexRpcClient, type RpcNotification } from "./client.js";
import { CodexProcessManager, TESTED_CODEX_VERSION } from "./process-manager.js";

interface ModelListResult {
  data?: Array<{ id: string; model?: string; displayName?: string; isDefault?: boolean; hidden?: boolean }>;
}

interface AccountReadResult {
  account?: { type?: string; email?: string; planType?: string } | null;
  requiresOpenaiAuth?: boolean;
}

interface PendingApprovalInternal {
  public: CodexApprovalRequest;
  method: string;
  params: Record<string, unknown>;
}

interface TurnCompletion {
  status: string;
  error?: { message?: string } | null;
}

const wrapperSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    artifact_json: { type: "string" },
  },
  required: ["summary", "artifact_json"],
};

export const toCodexApprovalPolicy = (policy: "unlessTrusted" | "onRequest") =>
  policy === "onRequest" ? "on-request" : "untrusted";

export const toCodexSandboxMode = (trustedProjectWorkspace: boolean) =>
  trustedProjectWorkspace ? "workspace-write" : "read-only";

export class CodexService {
  private client?: CodexRpcClient;
  private status: BrainHealth = this.health("disconnected", "Codex is not running.");
  private models: ModelListResult["data"] = [];
  private account: AccountReadResult = {};
  private startPromise?: Promise<void>;
  private readonly threadProjects = new Map<string, string>();
  private readonly activeTurns = new Map<string, { threadId: string; turnId: string }>();
  private readonly turnMessages = new Map<string, string>();
  private readonly completedTurns = new Map<string, TurnCompletion>();
  private readonly turnWaiters = new Map<string, { resolve: (value: TurnCompletion) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  private readonly pendingApprovals = new Map<string, PendingApprovalInternal>();
  private readonly shapeEngine = new LocalPhaseEngine({ delayMs: 0 });

  constructor(
    readonly manager: CodexProcessManager,
    private readonly settings: SettingsStore,
    private readonly logger: StructuredLogger,
    private readonly projectPath: (projectId: string) => string = () => process.cwd(),
  ) {}

  get approvalRequests() {
    return [...this.pendingApprovals.values()].map((item) => item.public);
  }

  get discoveredModels() {
    return this.models ?? [];
  }

  async start() {
    if (this.client && this.manager.running) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.startInternal().finally(() => {
      this.startPromise = undefined;
    });
    return this.startPromise;
  }

  private async startInternal() {
    this.status = this.health("loading", "Starting Codex App Server.");
    try {
      const child = this.manager.start();
      const client = new CodexRpcClient(child);
      this.client = client;
      client.on("notification", (event: RpcNotification) => this.handleNotification(event));
      client.on("serverRequest", (event: RpcNotification) => this.handleServerRequest(event));
      client.on("exit", () => {
        this.client = undefined;
        this.status = this.health("disconnected", "Codex App Server stopped.");
      });
      child.stderr.on("data", (chunk) => {
        const message = String(chunk).trim();
        if (message) void this.logger.warn("codex", "Codex App Server stderr output.", { message });
      });
      const appVersion = process.env.npm_package_version || "1.0.0";
      await client.initialize(appVersion);
      const [models, account] = await Promise.all([
        client.request<ModelListResult>("model/list", { limit: 100, includeHidden: false }),
        client.request<AccountReadResult>("account/read", { refreshToken: false }),
      ]);
      this.models = models.data ?? [];
      this.account = account;
      this.status = this.health(
        account.account || account.requiresOpenaiAuth === false ? "connected" : "unavailable",
        account.account ? "Codex connected." : "Codex requires sign in.",
        this.selectedModel(),
        account.account?.type ?? null,
      );
      await this.logger.info("codex", "Codex App Server initialized.", {
        testedVersion: TESTED_CODEX_VERSION,
        authMode: account.account?.type ?? null,
        models: this.models.length,
      });
    } catch (error) {
      this.client = undefined;
      await this.manager.stop();
      const message = error instanceof Error ? error.message : "Codex failed to start.";
      this.status = this.health("error", message);
      await this.logger.error("codex", "Codex startup failed.", { message });
      throw error;
    }
  }

  async healthCheck(): Promise<BrainHealth> {
    try {
      await this.start();
      if (!this.client) return this.status;
      this.account = await this.client.request<AccountReadResult>("account/read", { refreshToken: false });
      this.status = this.health(
        this.account.account || this.account.requiresOpenaiAuth === false ? "connected" : "unavailable",
        this.account.account ? "Codex connected." : "Sign in to Codex to use this brain.",
        this.selectedModel(),
        this.account.account?.type ?? null,
      );
    } catch {
      // start() already recorded a useful status.
    }
    return this.status;
  }

  async login() {
    await this.start();
    if (!this.client) throw new Error("Codex App Server is unavailable.");
    return this.client.request<{
      type: string;
      loginId: string;
      authUrl?: string;
      verificationUrl?: string;
      userCode?: string;
    }>("account/login/start", {
      type: "chatgpt",
      useHostedLoginSuccessPage: true,
      appBrand: "codex",
    });
  }

  async logout() {
    await this.start();
    await this.client?.request("account/logout");
    this.account = {};
    this.status = this.health("unavailable", "Codex is signed out.");
  }

  async generate(phase: PhaseId, project: MovieProject, signal?: AbortSignal): Promise<PhaseResult> {
    const health = await this.healthCheck();
    if (health.state !== "connected" || !this.client) {
      throw new Error(health.detail || "Codex is unavailable or not signed in.");
    }
    const settings = await this.settings.get();
    const model = project.brain.codexModel || settings.codex.model || this.selectedModel();
    const projectRoot = this.projectPath(project.id);
    let threadId = project.brain.codexThreadId;
    if (threadId) {
      try {
        await this.client.request("thread/resume", { threadId, model: model || undefined });
      } catch {
        threadId = undefined;
      }
    }
    if (!threadId) {
      const result = await this.client.request<{ thread: { id: string } }>("thread/start", {
        model: model || undefined,
        cwd: projectRoot,
        approvalPolicy: toCodexApprovalPolicy(settings.codex.approvalPolicy),
        sandbox: toCodexSandboxMode(settings.trustedProjectWorkspace),
        serviceName: "continuity_studio",
      });
      threadId = result.thread.id;
      project.brain.codexThreadId = threadId;
    }
    this.threadProjects.set(threadId, project.id);
    project.brain.codexModel = model || undefined;

    const shape = await this.shapeEngine.generate(phase, project);
    const context = JSON.stringify({
      project: {
        title: project.title,
        movieTitle: project.movieTitle,
        idea: project.idea,
        genre: project.genre,
        runtimeMinutes: project.runtimeMinutes,
        sequenceCount: project.sequenceCount,
        sequenceDurationSeconds: project.sequenceDurationSeconds,
        language: project.language,
        filmLanguage: project.filmLanguage,
        dialogueLanguage: project.dialogueLanguage,
        audienceRating: project.audienceRating,
        narrationEnabled: project.narrationEnabled,
        dialogueEnabled: project.dialogueEnabled,
        musicEnabled: project.musicEnabled,
        subtitlesEnabled: project.subtitlesEnabled,
        visualStyle: project.visualStyle,
        era: project.era,
        aspectRatio: project.aspectRatio,
        storyGenerationContext: project.production.story.generationContext,
        lockedMovieDna: project.production.movieDna.status === "LOCKED" ? project.production.movieDna : undefined,
        preStorySetup: project.preStorySetup,
      },
      projectMemory: project.memory,
      approvedArtifacts: project.artifacts,
      feedback: project.phases.find((item) => item.id === phase)?.feedback,
    });
    const prompt = [
      `You are supervising the ${phase.replaceAll("_", " ")} phase inside Continuity Studio.`,
      "Return production-ready film data. Do not expose hidden reasoning. Use tools only when necessary and never delete project files.",
      "Required user-uploaded references are protected production inputs. A main character source must become the protagonist and must never be duplicated, silently replaced, or overwritten.",
      `PROJECT CONTEXT: ${context}`,
      `REQUIRED ARTIFACT SHAPE: ${JSON.stringify(shape.artifact)}`,
      "Return a short summary and the complete artifact encoded as artifact_json.",
    ].join("\n\n");

    const turnResult = await this.client.request<{ turn: { id: string } }>("turn/start", {
      threadId,
      input: [{ type: "text", text: prompt }],
      model: model || undefined,
      cwd: projectRoot,
      approvalPolicy: toCodexApprovalPolicy(settings.codex.approvalPolicy),
      sandboxPolicy: settings.trustedProjectWorkspace
        ? { type: "workspaceWrite", writableRoots: [projectRoot], networkAccess: false }
        : { type: "readOnly" },
      outputSchema: wrapperSchema,
    }, settings.local.timeoutMs);
    const turnId = turnResult.turn.id;
    project.brain.activeTurnId = turnId;
    this.activeTurns.set(project.id, { threadId, turnId });
    const interrupt = () => void this.cancel(project.id);
    signal?.addEventListener("abort", interrupt, { once: true });
    try {
      const completion = await this.waitForTurn(turnId, settings.local.timeoutMs);
      if (completion.status !== "completed") {
        throw new Error(completion.error?.message || `Codex turn ${completion.status}.`);
      }
      const output = this.turnMessages.get(turnId)?.trim();
      if (!output) throw new Error("Codex completed without a structured artifact.");
      const wrapper = JSON.parse(output) as { summary: string; artifact_json: string };
      return {
        artifact: JSON.parse(wrapper.artifact_json),
        summary: wrapper.summary,
        provider: `Codex App Server · ${model || "default model"}`,
      };
    } finally {
      signal?.removeEventListener("abort", interrupt);
      this.activeTurns.delete(project.id);
      project.brain.activeTurnId = undefined;
      this.turnMessages.delete(turnId);
      this.completedTurns.delete(turnId);
    }
  }

  async resolveApproval(id: string, decision: "allow" | "deny") {
    const pending = this.pendingApprovals.get(id);
    if (!pending || !this.client) throw new Error("This Codex approval request is no longer active.");
    if (pending.method === "item/permissions/requestApproval") {
      const requested = (pending.params.permissions as Record<string, unknown> | undefined) ?? {};
      this.client.respond(pending.public.rpcId, {
        permissions: decision === "allow" ? requested : {},
        scope: "turn",
      });
    } else {
      this.client.respond(pending.public.rpcId, { decision: decision === "allow" ? "accept" : "decline" });
    }
    this.pendingApprovals.delete(id);
  }

  async cancel(projectId: string) {
    const active = this.activeTurns.get(projectId);
    if (active && this.client) {
      await this.client.request("turn/interrupt", active).catch(() => undefined);
    }
  }

  async stop() {
    this.client?.close();
    this.client = undefined;
    await this.manager.stop();
    this.status = this.health("disconnected", "Codex App Server stopped.");
  }

  private selectedModel() {
    return this.models?.find((model) => model.isDefault)?.model ?? this.models?.[0]?.model;
  }

  private handleNotification(event: RpcNotification) {
    const params = event.params ?? {};
    if (event.method === "item/agentMessage/delta") {
      const turnId = String(params.turnId ?? "");
      const delta = String(params.delta ?? "");
      this.turnMessages.set(turnId, `${this.turnMessages.get(turnId) ?? ""}${delta}`);
    }
    if (event.method === "item/completed") {
      const item = params.item as { type?: string; text?: string } | undefined;
      const turnId = String(params.turnId ?? "");
      if (item?.type === "agentMessage" && item.text) this.turnMessages.set(turnId, item.text);
    }
    if (event.method === "turn/completed") {
      const turn = params.turn as { id: string; status: string; error?: { message?: string } | null };
      this.completedTurns.set(turn.id, turn);
      const waiter = this.turnWaiters.get(turn.id);
      if (waiter) {
        clearTimeout(waiter.timer);
        this.turnWaiters.delete(turn.id);
        waiter.resolve(turn);
      }
    }
    if (event.method === "account/updated") {
      const authMode = (params.authMode as string | null | undefined) ?? null;
      this.status = this.health(authMode ? "connected" : "unavailable", authMode ? "Codex connected." : "Codex is signed out.", this.selectedModel(), authMode);
    }
    if (event.method === "account/login/completed" && params.success === false) {
      this.status = this.health("error", String(params.error || "Codex sign in failed."));
    }
  }

  private handleServerRequest(event: RpcNotification) {
    if (event.id === undefined) return;
    const params = event.params ?? {};
    const supported = new Set([
      "item/commandExecution/requestApproval",
      "item/fileChange/requestApproval",
      "item/permissions/requestApproval",
      "item/tool/requestUserInput",
      "tool/requestUserInput",
    ]);
    if (!supported.has(event.method)) {
      this.client?.respondError(event.id, -32601, `Continuity Studio does not support ${event.method}.`);
      return;
    }
    const threadId = String(params.threadId ?? "");
    const projectId = this.threadProjects.get(threadId) ?? "unknown";
    const id = randomUUID();
    const kind = event.method.includes("commandExecution")
      ? "command"
      : event.method.includes("fileChange")
        ? "file_change"
        : event.method.includes("permissions")
          ? "permission"
          : "user_input";
    const command = Array.isArray(params.command) ? params.command.join(" ") : String(params.command ?? "");
    const detail = String(params.reason ?? params.message ?? command ?? "Codex requests approval.");
    this.pendingApprovals.set(id, {
      method: event.method,
      params,
      public: {
        id,
        rpcId: event.id,
        projectId,
        threadId: threadId || undefined,
        turnId: params.turnId ? String(params.turnId) : undefined,
        itemId: params.itemId ? String(params.itemId) : undefined,
        kind,
        title: kind === "command" ? "Allow Codex command" : kind === "file_change" ? "Allow Codex file changes" : "Codex needs approval",
        detail,
        command: command || undefined,
        cwd: params.cwd ? String(params.cwd) : undefined,
        createdAt: new Date().toISOString(),
      },
    });
    this.status = this.health("waiting_for_approval", detail, this.selectedModel(), this.account.account?.type ?? null);
  }

  private waitForTurn(turnId: string, timeoutMs: number) {
    const completed = this.completedTurns.get(turnId);
    if (completed) return Promise.resolve(completed);
    return new Promise<TurnCompletion>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.turnWaiters.delete(turnId);
        reject(new Error("Codex generation timed out."));
      }, timeoutMs);
      this.turnWaiters.set(turnId, { resolve, reject, timer });
    });
  }

  private health(
    state: BrainHealth["state"],
    detail: string,
    model?: string,
    authMode?: string | null,
  ): BrainHealth {
    return {
      id: "codex",
      state,
      label: "Codex App Server",
      model,
      detail,
      version: TESTED_CODEX_VERSION,
      authMode,
      checkedAt: new Date().toISOString(),
    };
  }
}
