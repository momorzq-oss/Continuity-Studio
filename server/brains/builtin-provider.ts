import type { BrainHealth, MovieProject, PhaseId, ProviderInfo } from "../../src/types.js";
import { LocalPhaseEngine } from "../local-engine.js";
import { BaseBrainProvider } from "./provider.js";

export class BuiltinBrainProvider extends BaseBrainProvider {
  readonly id = "builtin" as const;
  readonly providerInfo: ProviderInfo = {
    kind: "builtin",
    label: "Built-in offline production engine",
    available: true,
  };

  constructor(private readonly engine = new LocalPhaseEngine()) {
    super();
  }

  generate(phase: PhaseId, project: MovieProject, signal?: AbortSignal) {
    return this.engine.generate(phase, project, signal);
  }

  async healthCheck(): Promise<BrainHealth> {
    return {
      id: "builtin",
      state: "connected",
      label: this.providerInfo.label,
      detail: "Ready without an internet connection or external model.",
      checkedAt: new Date().toISOString(),
    };
  }
}
