import { randomUUID } from "node:crypto";
import type {
  AgentMessage,
  BrainMode,
  MovieProject,
  PhaseId,
  RunMode,
} from "../src/types.js";
import type { PhaseEngine } from "./engine.js";
import { specialistForPhase } from "./agents/definitions.js";
import { BrainUnavailableError } from "./brains/router.js";
import type { StructuredLogger } from "./logger.js";
import {
  pushActivity,
  recordApproval,
  recordGeneration,
  refreshProjectMemory,
} from "./memory.js";
import { phaseIndex } from "./phases.js";
import { ProjectStore } from "./store.js";
import { filmRuleEngine } from "./rule-engine.js";
import { AssetMaker } from "./asset-maker.js";
import { PlatformPromptCompiler } from "./platform-prompt-compiler.js";

export class AgentConflictError extends Error {}

const phaseFromMessage = (message: string): PhaseId | undefined => {
  const normalized = message.toLowerCase();
  const aliases: Array<[PhaseId, string[]]> = [
    ["film_bible", ["bible", "film bible"]],
    ["frame_plans", ["frame", "key frame", "shot plan"]],
    ["prompts", ["prompt", "seedance"]],
    ["continuity", ["continuity", "qc"]],
    ["sequences", ["sequence"]],
    ["assets", ["asset", "character", "location", "prop"]],
    ["story", ["story", "synopsis"]],
    ["export", ["export", "package"]],
  ];
  return aliases.find(([, words]) => words.some((word) => normalized.includes(word)))?.[0];
};

const message = (
  role: AgentMessage["role"],
  content: string,
  phase?: PhaseId,
): AgentMessage => ({
  id: randomUUID(),
  role,
  content,
  createdAt: new Date().toISOString(),
  phase,
});

export class ProductionAgent {
  private readonly jobs = new Map<string, Promise<void>>();
  private readonly controllers = new Map<string, AbortController>();
  readonly assetMaker: AssetMaker;
  readonly promptCompiler = new PlatformPromptCompiler();

  constructor(
    readonly store: ProjectStore,
    readonly engine: PhaseEngine,
    private readonly logger?: StructuredLogger,
  ) {
    this.assetMaker = new AssetMaker(store);
  }

  async createProject(input: Parameters<ProjectStore["createProject"]>[0]) {
    const brain = input.brain ?? "local";
    const provider = this.engine.providerInfoFor?.(brain) ?? this.engine.providerInfo;
    return this.store.createProject({ ...input, brain }, provider);
  }

  async start(projectId: string, mode?: RunMode, instruction?: string) {
    if (this.jobs.has(projectId)) {
      throw new AgentConflictError("The production agent is already running.");
    }
    const project = await this.store.getProject(projectId);
    if (!project.preStorySetup.completed) {
      throw new AgentConflictError("Complete Pre-Story Reference Setup before the Story Agent starts. AI-first mode can continue without uploads; Reference-first requires at least one reference.");
    }
    if (mode) project.mode = mode;
    if (instruction?.trim()) project.idea = instruction.trim();

    const failed = project.phases.find((phase) => phase.state === "failed");
    if (failed) {
      failed.state = "pending";
      failed.error = undefined;
    }
    if (!project.phases.some((phase) => phase.state === "pending")) {
      throw new AgentConflictError(
        "This production is complete. Regenerate a phase or create a new project.",
      );
    }

    project.status = "running";
    project.messages.push(
      message(
        "agent",
        project.mode === "full"
          ? "Full production started. I’ll create every approved-ready artifact from story through export."
          : "Phase-by-phase production started. I’ll stop after each artifact so you can approve it or request changes.",
      ),
    );
    await this.store.saveProject(project);
    this.launch(project.id);
    return project;
  }

  async approve(projectId: string) {
    if (this.jobs.has(projectId)) {
      throw new AgentConflictError("Wait for the current phase to finish before approving.");
    }
    const project = await this.store.getProject(projectId);
    const current = project.phases.find((phase) => phase.state === "awaiting_approval");
    if (!current) throw new AgentConflictError("There is no phase awaiting approval.");
    if (current.id === "assets") {
      const missing = project.memory.database.assets.filter((asset) => !asset.generatedImagePath && !asset.sourceReferenceIds.length);
      if (missing.length) throw new AgentConflictError(`Generate asset images before approval: ${missing.map((asset) => asset.id).join(", ")}.`);
    }

    filmRuleEngine.approvePhase(project, current.id);
    current.state = "completed";
    current.completedAt = new Date().toISOString();
    project.messages.push(
      message("user", `Approved ${current.label}. Continue to the next phase.`, current.id),
    );
    recordApproval(project, `Approved ${current.label}`, "approved", current.id);
    const next = project.phases.find((phase) => phase.state === "pending");
    if (!next) {
      this.markComplete(project);
      await this.store.saveProject(project);
      return project;
    }
    project.status = "running";
    project.currentPhase = next.id;
    await this.store.saveProject(project);
    this.launch(project.id);
    return project;
  }

  async regenerate(projectId: string, requestedPhase?: PhaseId, feedback?: string) {
    if (this.jobs.has(projectId)) {
      throw new AgentConflictError("Wait for the current phase to finish before regenerating.");
    }
    const project = await this.store.getProject(projectId);
    const current =
      requestedPhase ??
      project.phases.find((phase) => phase.state === "awaiting_approval")?.id ??
      project.currentPhase;
    if (!current) throw new AgentConflictError("Choose a phase to regenerate.");

    const startIndex = phaseIndex(current);
    const affected = project.phases.slice(startIndex);
    filmRuleEngine.invalidateDownstream(project, current);
    for (const phase of affected) {
      delete project.artifacts[phase.id];
      phase.state = "pending";
      phase.summary = undefined;
      phase.error = undefined;
      phase.provider = undefined;
      phase.startedAt = undefined;
      phase.completedAt = undefined;
      phase.feedback = phase.id === current ? feedback?.trim() || phase.feedback : undefined;
    }
    await this.store.clearPhaseFiles(
      project.id,
      affected.map((phase) => phase.id),
    );
    project.status = "running";
    project.currentPhase = current;
    project.messages.push(
      message(
        "agent",
        `Regenerating ${project.phases[startIndex].label}${feedback ? ` with your note: “${feedback.trim()}”` : ""}. Later phases were reset to keep the project consistent.`,
        current,
      ),
    );
    recordApproval(project, `Regenerated ${project.phases[startIndex].label}`, "regenerated", current, feedback);
    await this.store.saveProject(project);
    this.launch(project.id);
    return project;
  }

  async handleMessage(projectId: string, content: string, mode?: RunMode) {
    let project = await this.store.getProject(projectId);
    const text = content.trim();
    if (!text) return project;
    if (mode) project.mode = mode;
    project.messages.push(message("user", text));
    await this.store.saveProject(project);

    if (this.jobs.has(projectId) || project.status === "running") {
      project = await this.store.getProject(projectId);
      project.messages.push(
        message("agent", "I’m already working on the current phase. Your note is saved in the project log."),
      );
      await this.store.saveProject(project);
      return project;
    }

    const normalized = text.toLowerCase();
    if (project.status === "awaiting_approval") {
      if (/\b(approve|approved|continue|next)\b/.test(normalized)) {
        return this.approve(projectId);
      }
      const current = project.phases.find((phase) => phase.state === "awaiting_approval")?.id;
      return this.regenerate(projectId, current, text);
    }

    if (/\b(regenerate|redo|rewrite|rebuild)\b/.test(normalized)) {
      return this.regenerate(projectId, phaseFromMessage(text), text);
    }

    if (project.status === "complete") {
      project.messages.push(
        message(
          "agent",
          "This project is complete. Ask me to regenerate a named phase, or create a new movie project for a new idea.",
        ),
      );
      await this.store.saveProject(project);
      return project;
    }

    if (!/^\s*(start|run|go|begin)\s*[.!]?$/i.test(text) && text.length > 12) {
      project.idea = text;
      await this.store.saveProject(project);
    }
    return this.start(projectId, mode);
  }

  async waitForIdle(projectId: string) {
    await this.jobs.get(projectId);
  }

  async switchBrain(projectId: string, brain: BrainMode, continueProduction = false) {
    if (this.jobs.has(projectId)) throw new AgentConflictError("Cancel the current task before switching brains.");
    const project = await this.store.getProject(projectId);
    project.brain.selected = brain;
    project.brain.recovery = undefined;
    project.provider = this.engine.providerInfoFor?.(brain) ?? this.engine.providerInfo;
    project.messages.push(message("system", `Brain switched to ${brain.toUpperCase()}.`));
    const failed = project.phases.find((phase) => phase.state === "failed");
    if (failed) {
      failed.state = "pending";
      failed.error = undefined;
    }
    project.status = "draft";
    await this.store.saveProject(project);
    return continueProduction ? this.start(projectId, project.mode) : project;
  }

  async cancel(projectId: string) {
    this.controllers.get(projectId)?.abort();
    await this.engine.cancel?.(projectId);
    const project = await this.store.getProject(projectId);
    project.messages.push(message("system", "Production cancellation requested. Saved work has been preserved."));
    pushActivity(project, {
      brain: project.brain.selected,
      agent: project.currentAgent || "Production controller",
      phase: project.currentPhase,
      state: "warning",
      summary: "Production cancellation requested; project state was preserved.",
    });
    await this.store.saveProject(project);
    return project;
  }

  private launch(projectId: string) {
    const controller = new AbortController();
    this.controllers.set(projectId, controller);
    const job = this.run(projectId, controller.signal).finally(() => {
      this.jobs.delete(projectId);
      this.controllers.delete(projectId);
    });
    this.jobs.set(projectId, job);
  }

  private async run(projectId: string, signal: AbortSignal) {
    while (true) {
      if (signal.aborted) return;
      const project = await this.store.getProject(projectId);
      const phase = project.phases.find((item) => item.state === "pending");
      if (!phase) {
        this.markComplete(project);
        await this.store.saveProject(project);
        return;
      }

      phase.state = "running";
      phase.attempt += 1;
      phase.startedAt = new Date().toISOString();
      phase.error = undefined;
      project.status = "running";
      project.currentPhase = phase.id;
      const specialist = specialistForPhase(phase.id);
      project.currentAgent = specialist.label;
      project.messages.push(
        message("agent", `${specialist.label} started · ${phase.description}`, phase.id),
      );
      pushActivity(project, {
        brain: project.brain.selected,
        agent: specialist.label,
        phase: phase.id,
        state: "working",
        summary: `${specialist.label} is preparing ${phase.label}.`,
      });
      await this.store.saveProject(project);

      try {
        const preflight = filmRuleEngine.preflight(project, phase.id);
        if (preflight.length) throw new Error(`Continuity preflight failed: ${preflight.map((item) => item.title).join("; ")}. Resolve or manually override blocking issues.`);
        const result = await this.engine.generate(phase.id, project, signal);
        const enforcedArtifact = filmRuleEngine.enforcePhaseArtifact(project, phase.id, result.artifact);
        project.artifacts[phase.id] = enforcedArtifact;
        if (phase.id === "assets") {
          this.assetMaker.reconcileProtectedReferences(project);
          if (project.autoGenerateAssets) await this.assetMaker.generateAllAssets(project);
        }
        if (phase.id === "sequences") {
          this.assetMaker.planScenes(project);
          if (project.autoGenerateScenes) await this.assetMaker.generateAllScenes(project);
        }
        if (phase.id === "frame_plans") {
          this.assetMaker.planStoryboard(project);
          if (project.autoGenerateStoryboard) await this.assetMaker.generateStoryboard(project);
        }
        if (phase.id === "prompts") {
          const compiled = this.promptCompiler.compile(project);
          project.artifacts.prompts = {
            prompts: compiled.map((prompt) => ({
              sequenceId: prompt.sequenceId,
              prompt: prompt.prompt,
              negativePrompt: prompt.negativePrompt,
              references: prompt.referenceManifest.map((item) => item.referenceFile).filter(Boolean),
              model: prompt.model,
              ruleIds: prompt.inheritedRuleIds,
              validationIssueIds: prompt.validationIssueIds,
            })),
          };
        }
        phase.summary = result.summary;
        phase.provider = result.provider;
        phase.error = undefined;
        await this.store.writePhaseArtifact(project, phase.id, project.artifacts[phase.id]);
        refreshProjectMemory(project, phase.id);
        const memoryBrain = project.provider.kind === "builtin" ? "builtin" : project.provider.kind;
        recordGeneration(
          project,
          phase.id,
          result.provider,
          result.summary,
          memoryBrain,
          phase.attempt > 1,
        );

        if (project.mode === "phases") {
          phase.state = "awaiting_approval";
          project.status = "awaiting_approval";
          project.messages.push(
            message(
              "agent",
              `${result.summary} Review it now. Approve to continue, or type the changes you want and I’ll regenerate this phase.`,
              phase.id,
            ),
          );
          await this.store.saveProject(project);
          return;
        }

        phase.state = "completed";
        phase.completedAt = new Date().toISOString();
        project.messages.push(message("agent", result.summary, phase.id));
        await this.store.saveProject(project);
        await this.logger?.info("production", "Production phase completed.", {
          projectId,
          phase: phase.id,
          provider: result.provider,
        });
      } catch (error) {
        phase.state = "failed";
        phase.error = error instanceof Error ? error.message : "Unknown phase error";
        project.status = "failed";
        if (error instanceof BrainUnavailableError) {
          project.brain.recovery = {
            failedBrain: error.brain,
            message: error.message,
            actions: error.actions,
          };
        }
        project.messages.push(
          message(
            "agent",
            `${phase.label} stopped: ${phase.error}. Fix the provider or type “retry” to continue with the built-in engine.`,
            phase.id,
          ),
        );
        pushActivity(project, {
          brain: project.brain.selected,
          agent: specialist.label,
          phase: phase.id,
          state: "error",
          summary: phase.error,
        });
        await this.store.saveProject(project);
        await this.logger?.error("production", "Production phase failed.", {
          projectId,
          phase: phase.id,
          message: phase.error,
        });
        return;
      }
    }
  }

  private markComplete(project: MovieProject) {
    project.status = "complete";
    project.currentPhase = "export";
    project.currentAgent = "Export Agent";
    if (!project.messages.some((item) => item.content.startsWith("Production complete"))) {
      project.messages.push(
        message(
          "agent",
          "Production complete. The full project structure is saved locally and the export package is ready to download.",
          "export",
        ),
      );
    }
  }
}
