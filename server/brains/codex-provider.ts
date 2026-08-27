import type { MovieProject, PhaseId, ProviderInfo } from "../../src/types.js";
import type { CodexService } from "../codex/service.js";
import { BaseBrainProvider } from "./provider.js";

export class CodexBrainProvider extends BaseBrainProvider {
  readonly id = "codex" as const;
  readonly providerInfo: ProviderInfo = {
    kind: "codex",
    label: "Codex App Server",
    available: false,
  };

  constructor(readonly service: CodexService) {
    super();
  }

  generate(phase: PhaseId, project: MovieProject, signal?: AbortSignal) {
    return this.service.generate(phase, project, signal);
  }

  healthCheck() {
    return this.service.healthCheck();
  }

  cancel(projectId: string) {
    return this.service.cancel(projectId);
  }
}
