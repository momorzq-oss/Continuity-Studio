import type { PhaseId, PhaseProgress } from "../src/types.js";

export const PHASE_DEFINITIONS: Array<
  Pick<PhaseProgress, "id" | "label" | "description">
> = [
  {
    id: "story",
    label: "Story",
    description: "Build the logline, synopsis, acts, cast, and dramatic spine.",
  },
  {
    id: "film_bible",
    label: "Film Bible",
    description: "Lock the world, tone, visual language, and movie rules.",
  },
  {
    id: "assets",
    label: "Assets",
    description: "Create permanent IDs for cast, creatures, locations, and props.",
  },
  {
    id: "sequences",
    label: "Sequences",
    description: "Break the runtime into ordered, timed dramatic sequences.",
  },
  {
    id: "frame_plans",
    label: "Frame Plans",
    description: "Plan beginning, middle, and end states for every sequence.",
  },
  {
    id: "prompts",
    label: "Video Prompts",
    description: "Create provider-ready prompts with locked reference IDs.",
  },
  {
    id: "continuity",
    label: "Continuity",
    description: "Check identity, wardrobe, geography, lighting, and screen direction.",
  },
  {
    id: "export",
    label: "Export",
    description: "Validate and prepare the complete movie project package.",
  },
];

export const createPhaseProgress = (): PhaseProgress[] =>
  PHASE_DEFINITIONS.map((phase) => ({
    ...phase,
    state: "pending",
    attempt: 0,
  }));

export const phaseIndex = (phaseId: PhaseId): number =>
  PHASE_DEFINITIONS.findIndex((phase) => phase.id === phaseId);
