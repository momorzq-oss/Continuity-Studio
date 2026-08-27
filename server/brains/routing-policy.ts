import type { HybridBrainSettings, PhaseId } from "../../src/types.js";

export type HybridRoute = "local" | "codex";

const policies: Record<HybridBrainSettings["routingPolicy"], Record<PhaseId, HybridRoute>> = {
  balanced: {
    story: "local",
    film_bible: "codex",
    assets: "local",
    sequences: "codex",
    frame_plans: "local",
    prompts: "local",
    continuity: "codex",
    export: "local",
  },
  local_first: {
    story: "local",
    film_bible: "local",
    assets: "local",
    sequences: "local",
    frame_plans: "local",
    prompts: "local",
    continuity: "codex",
    export: "local",
  },
  codex_first: {
    story: "codex",
    film_bible: "codex",
    assets: "local",
    sequences: "codex",
    frame_plans: "local",
    prompts: "local",
    continuity: "codex",
    export: "codex",
  },
};

export const routeHybridPhase = (phase: PhaseId, settings: HybridBrainSettings): HybridRoute =>
  policies[settings.routingPolicy][phase];

export const ROUTING_POLICY_DESCRIPTION = {
  balanced: "Codex supervises the film bible, sequence architecture, and continuity; Local handles repeatable production artifacts.",
  local_first: "Local handles every routine phase; Codex is reserved for the final continuity review.",
  codex_first: "Codex handles narrative and project-wide reasoning; Local still handles repetitive asset, frame, and prompt work.",
} as const;
