import type {
  AutomaticProductionStageId,
  AutomaticProductionState,
} from "../src/types.js";

const stageDefinitions: Array<[AutomaticProductionStageId, string]> = [
  ["project_setup", "Project Setup"],
  ["movie_dna", "Movie DNA"],
  ["story", "Story"],
  ["film_bible", "Film Bible"],
  ["characters", "Characters"],
  ["main_character", "Main Character"],
  ["asset_manifest", "Asset Manifest"],
  ["asset_generation", "Asset Generation"],
  ["timeline_continuity", "Timeline & Continuity"],
  ["audio_bible", "Audio Bible"],
  ["full_script", "Full Script"],
  ["shot_plans", "Shot Plans"],
  ["sequences", "Sequences"],
  ["prompts", "Sequence Prompts"],
  ["reference_packs", "Reference Packages"],
];

export const createAutomaticProductionState = (
  enabled = false,
  mainCharacterPreference?: string,
): AutomaticProductionState => {
  const timestamp = new Date().toISOString();
  return {
    status: "IDLE",
    stages: stageDefinitions.map(([id, label], index) => ({
      id,
      label,
      status: enabled && index === 0 ? "COMPLETE" : "PENDING",
      attempts: 0,
      completedAt: enabled && index === 0 ? timestamp : undefined,
      note: enabled && index === 0 ? "Created from the simple Automatic Movie setup." : undefined,
    })),
    history: [],
    mainCharacterPreference,
    resumeAfterRestart: false,
    updatedAt: timestamp,
  };
};
