import type { BrainHealth, MovieProject, PhaseId } from "../../src/types.js";
import { OpenAIPhaseEngine } from "../engine.js";
import { BaseBrainProvider } from "./provider.js";

export class OpenAIBrainProvider extends BaseBrainProvider {
  readonly id = "openai" as const;
  readonly providerInfo;
  private readonly engine?: OpenAIPhaseEngine;

  constructor(apiKey: string | undefined, model: string) {
    super();
    if (apiKey?.trim()) this.engine = new OpenAIPhaseEngine(apiKey.trim(), model);
    this.providerInfo = this.engine?.providerInfo ?? {
      kind: "openai" as const,
      label: "OpenAI Responses API",
      model,
      available: false,
    };
  }

  generate(phase: PhaseId, project: MovieProject, signal?: AbortSignal) {
    if (!this.engine) return Promise.reject(new Error("OPENAI_API_KEY is not configured."));
    return this.engine.generate(phase, project, signal);
  }

  async healthCheck(): Promise<BrainHealth> {
    return {
      id: "openai",
      state: this.engine ? "connected" : "unavailable",
      label: this.providerInfo.label,
      model: this.providerInfo.model,
      detail: this.engine ? "OpenAI API configuration is available." : "Set OPENAI_API_KEY to enable OpenAI generation.",
      checkedAt: new Date().toISOString(),
    };
  }
}
