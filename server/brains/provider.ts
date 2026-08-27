import type { BrainHealth, BrainMode, MovieProject, PhaseId, ProviderInfo } from "../../src/types.js";
import type { PhaseResult } from "../engine.js";

export interface BrainProvider {
  readonly id: BrainMode | "builtin";
  readonly providerInfo: ProviderInfo;
  generate(phase: PhaseId, project: MovieProject, signal?: AbortSignal): Promise<PhaseResult>;
  continue(project: MovieProject, instruction: string, signal?: AbortSignal): Promise<string>;
  inspect(project: MovieProject, subject: unknown, signal?: AbortSignal): Promise<string>;
  plan(project: MovieProject, objective: string, signal?: AbortSignal): Promise<string>;
  execute(project: MovieProject, instruction: string, signal?: AbortSignal): Promise<string>;
  healthCheck(): Promise<BrainHealth>;
  cancel(projectId: string): Promise<void>;
}

export abstract class BaseBrainProvider implements BrainProvider {
  abstract readonly id: BrainProvider["id"];
  abstract readonly providerInfo: ProviderInfo;
  abstract generate(phase: PhaseId, project: MovieProject, signal?: AbortSignal): Promise<PhaseResult>;
  abstract healthCheck(): Promise<BrainHealth>;

  async continue(project: MovieProject, instruction: string, signal?: AbortSignal) {
    const result = await this.execute(project, instruction, signal);
    return result;
  }

  async inspect(_project: MovieProject, subject: unknown, _signal?: AbortSignal) {
    return `Inspection queued for ${typeof subject === "string" ? subject : "project material"}.`;
  }

  async plan(_project: MovieProject, objective: string, _signal?: AbortSignal) {
    return `Plan requested: ${objective}`;
  }

  async execute(_project: MovieProject, instruction: string, _signal?: AbortSignal) {
    return `Execution requested: ${instruction}`;
  }

  async cancel(_projectId: string) {}
}
