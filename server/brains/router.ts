import type {
  BrainMode,
  BrainStatusSnapshot,
  MovieProject,
  PhaseId,
  ProviderInfo,
} from "../../src/types.js";
import type { PhaseEngine, PhaseResult } from "../engine.js";
import type { StructuredLogger } from "../logger.js";
import { pushActivity } from "../memory.js";
import type { SettingsStore } from "../settings.js";
import { BuiltinBrainProvider } from "./builtin-provider.js";
import { CodexBrainProvider } from "./codex-provider.js";
import { LocalLlmBrainProvider } from "./local-llm-provider.js";
import { OpenAIBrainProvider } from "./openai-provider.js";
import type { BrainProvider } from "./provider.js";
import { routeHybridPhase } from "./routing-policy.js";

export class BrainUnavailableError extends Error {
  constructor(
    message: string,
    readonly brain: BrainMode,
    readonly actions: Array<"retry" | "continue_local" | "continue_codex" | "switch_brain" | "cancel">,
  ) {
    super(message);
  }
}

export class BrainRouter implements PhaseEngine {
  readonly providerInfo: ProviderInfo = {
    kind: "hybrid",
    label: "Continuity Studio Brain Router",
    available: true,
  };

  constructor(
    readonly builtin: BuiltinBrainProvider,
    readonly local: LocalLlmBrainProvider,
    readonly codex: CodexBrainProvider,
    readonly openai: OpenAIBrainProvider,
    private readonly settings: SettingsStore,
    private readonly logger: StructuredLogger,
  ) {}

  providerInfoFor(brain: BrainMode): ProviderInfo {
    if (brain === "hybrid") return { kind: "hybrid", label: "Hybrid · Codex supervisor + Local production", available: true };
    if (brain === "local") return { ...this.local.providerInfo, label: "Local Brain · offline engine or configured local LLM", available: true };
    return this.provider(brain).providerInfo;
  }

  async generate(phase: PhaseId, project: MovieProject, signal?: AbortSignal): Promise<PhaseResult> {
    const selected = project.brain.selected;
    const settings = await this.settings.get();
    let provider: BrainProvider;
    let routedBrain: BrainMode | "builtin" = selected;

    if (selected === "hybrid") {
      const route = routeHybridPhase(phase, settings.hybrid);
      routedBrain = route;
      provider = route === "codex" ? this.codex : await this.localOrBuiltin();
      if (provider.id === "builtin") routedBrain = "builtin";
    } else if (selected === "local") {
      provider = await this.localOrBuiltin();
      routedBrain = provider.id;
    } else {
      provider = this.provider(selected);
    }

    pushActivity(project, {
      brain: routedBrain,
      agent: project.currentAgent || `${phase.replaceAll("_", " ")} agent`,
      phase,
      state: "working",
      summary: `${provider.providerInfo.label} is generating ${phase.replaceAll("_", " ")}.`,
    });
    const health = await provider.healthCheck();
    project.brain.lastHealth = { ...project.brain.lastHealth, [provider.id]: health };
    if (health.state !== "connected") {
      const actions = provider.id === "codex"
        ? ["retry", "continue_local", "switch_brain", "cancel"] as const
        : ["retry", "continue_codex", "switch_brain", "cancel"] as const;
      throw new BrainUnavailableError(
        health.detail || `${provider.providerInfo.label} is unavailable.`,
        provider.id === "builtin" ? "local" : provider.id,
        [...actions],
      );
    }

    try {
      const result = await provider.generate(phase, project, signal);
      project.provider = provider.providerInfo;
      project.brain.recovery = undefined;
      pushActivity(project, {
        brain: routedBrain,
        agent: project.currentAgent || `${phase.replaceAll("_", " ")} agent`,
        phase,
        state: "success",
        summary: result.summary,
      });
      await this.logger.info("brain-router", "Brain phase completed.", {
        projectId: project.id,
        phase,
        selected,
        routedBrain,
        provider: result.provider,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Brain generation failed.";
      pushActivity(project, {
        brain: routedBrain,
        agent: project.currentAgent || `${phase.replaceAll("_", " ")} agent`,
        phase,
        state: "error",
        summary: message,
      });
      if (error instanceof BrainUnavailableError) throw error;
      const actions = provider.id === "codex"
        ? ["retry", "continue_local", "switch_brain", "cancel"] as const
        : ["retry", "continue_codex", "switch_brain", "cancel"] as const;
      throw new BrainUnavailableError(message, provider.id === "builtin" ? "local" : provider.id, [...actions]);
    }
  }

  async status(): Promise<BrainStatusSnapshot> {
    const settings = await this.settings.get();
    const [builtin, local, codex, openai] = await Promise.all([
      this.builtin.healthCheck(),
      this.local.healthCheck(),
      this.codex.healthCheck(),
      this.openai.healthCheck(),
    ]);
    return {
      defaultBrain: settings.defaultBrain,
      builtin,
      local,
      codex,
      openai,
      approvals: this.codex.service.approvalRequests,
    };
  }

  async cancel(projectId: string) {
    await Promise.allSettled([
      this.local.cancel(projectId),
      this.codex.cancel(projectId),
      this.openai.cancel(projectId),
    ]);
  }

  async shutdown() {
    await this.codex.service.stop();
  }

  private async localOrBuiltin(): Promise<BrainProvider> {
    const settings = await this.settings.get();
    return settings.local.enabled ? this.local : this.builtin;
  }

  private provider(brain: Exclude<BrainMode, "hybrid" | "local">): BrainProvider;
  private provider(brain: BrainMode): BrainProvider {
    if (brain === "codex") return this.codex;
    if (brain === "openai") return this.openai;
    if (brain === "local") return this.local;
    return this.builtin;
  }
}
