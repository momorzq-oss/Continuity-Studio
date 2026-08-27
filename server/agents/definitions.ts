import type { PhaseId } from "../../src/types.js";

export interface SpecialistAgentDefinition {
  id: string;
  label: string;
  responsibility: string;
  phases: PhaseId[];
  context: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

const objectSchema = (required: string[]) => ({ type: "object", required, additionalProperties: true });

export const SPECIALIST_AGENTS: SpecialistAgentDefinition[] = [
  { id: "story", label: "Story Agent", responsibility: "Develop premise, structure, character arcs, and dialogue.", phases: ["story"], context: ["project brief"], inputSchema: objectSchema(["idea", "genre"]), outputSchema: objectSchema(["logline", "synopsis", "fullStory", "characters"]) },
  { id: "film_bible", label: "Film Bible Agent", responsibility: "Lock world, tone, visual language, and movie rules.", phases: ["film_bible"], context: ["story"], inputSchema: objectSchema(["story"]), outputSchema: objectSchema(["worldRules", "movieRules"]) },
  { id: "character", label: "Character Agent", responsibility: "Define stable character identity and state.", phases: ["assets"], context: ["story characters", "film bible"], inputSchema: objectSchema(["characters"]), outputSchema: objectSchema(["assets"]) },
  { id: "creature", label: "Creature Agent", responsibility: "Define creature identity, count, behaviour, and visual locks.", phases: ["assets"], context: ["story creatures", "movie rules"], inputSchema: objectSchema(["creatures"]), outputSchema: objectSchema(["assets"]) },
  { id: "location", label: "Location Agent", responsibility: "Define geography, lighting anchors, weather, and period detail.", phases: ["assets"], context: ["story locations", "visual language"], inputSchema: objectSchema(["locations"]), outputSchema: objectSchema(["assets"]) },
  { id: "prop", label: "Prop Agent", responsibility: "Define hero props and their carried, damage, and placement states.", phases: ["assets"], context: ["story", "character state"], inputSchema: objectSchema(["props"]), outputSchema: objectSchema(["assets"]) },
  { id: "asset", label: "Asset Agent", responsibility: "Normalize all reusable production assets and stable IDs.", phases: ["assets"], context: ["all asset specialists"], inputSchema: objectSchema(["story", "filmBible"]), outputSchema: objectSchema(["assets", "counts"]) },
  { id: "sequence", label: "Sequence Agent", responsibility: "Break runtime into ordered dramatic sequences.", phases: ["sequences"], context: ["story", "asset manifest"], inputSchema: objectSchema(["runtime", "sequenceCount"]), outputSchema: objectSchema(["sequences"]) },
  { id: "frame_planning", label: "Frame Planning Agent", responsibility: "Create start, mid, and end frame states with transition logic.", phases: ["frame_plans"], context: ["sequence", "previous sequence end", "continuity locks"], inputSchema: objectSchema(["sequences"]), outputSchema: objectSchema(["plans"]) },
  { id: "prompt", label: "Prompt Agent", responsibility: "Create provider-ready prompts using locked references.", phases: ["prompts"], context: ["frame plans", "assets", "visual language"], inputSchema: objectSchema(["plans"]), outputSchema: objectSchema(["prompts"]) },
  { id: "continuity", label: "Continuity Agent", responsibility: "Audit identity, geography, state, and cross-sequence transitions.", phases: ["continuity"], context: ["all approved artifacts", "project memory"], inputSchema: objectSchema(["artifacts", "locks"]), outputSchema: objectSchema(["score", "issues", "passed"]) },
  { id: "inspection", label: "Inspection Agent", responsibility: "Coordinate image and video inspection providers.", phases: ["continuity"], context: ["generated media", "reference assets"], inputSchema: objectSchema(["media"]), outputSchema: objectSchema(["findings"]) },
  { id: "video", label: "Video Agent", responsibility: "Coordinate configured video generation providers.", phases: ["prompts"], context: ["prompts", "reference assets"], inputSchema: objectSchema(["prompt"]), outputSchema: objectSchema(["job"]) },
  { id: "audio", label: "Audio Agent", responsibility: "Coordinate configured voice, sound, and music providers.", phases: ["prompts"], context: ["sequence sound plans"], inputSchema: objectSchema(["soundPlan"]), outputSchema: objectSchema(["job"]) },
  { id: "editing", label: "Editing Agent", responsibility: "Prepare assembly and edit decisions from approved media.", phases: ["export"], context: ["sequence order", "generated media"], inputSchema: objectSchema(["media"]), outputSchema: objectSchema(["editPlan"]) },
  { id: "export", label: "Export Agent", responsibility: "Validate and package the complete movie project.", phases: ["export"], context: ["all project artifacts"], inputSchema: objectSchema(["project"]), outputSchema: objectSchema(["ready", "files", "folders"]) },
];

export const specialistForPhase = (phase: PhaseId) =>
  SPECIALIST_AGENTS.find((agent) => agent.phases.includes(phase)) ?? SPECIALIST_AGENTS[0];
