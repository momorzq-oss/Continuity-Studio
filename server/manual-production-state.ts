import type {
  ManualGuidedProductionState,
  ManualGuidedStepId,
  MovieProject,
  TargetPlatform,
} from "../src/types.js";
import { MANUAL_GUIDED_STEP_IDS } from "../src/types.js";

const stamp = () => new Date().toISOString();

export const createManualProductionState = (
  enabled = true,
  preferredPlatform?: TargetPlatform,
): ManualGuidedProductionState => {
  const createdAt = stamp();
  return {
    status: "ACTIVE",
    currentStep: "project_setup",
    completedSteps: [],
    visitedSteps: enabled ? ["project_setup"] : [],
    recommendations: [],
    preferredPlatform,
    briefCompletedAt: enabled ? createdAt : undefined,
    lastSavedAt: createdAt,
    updatedAt: createdAt,
  };
};

const approved = (value?: string) => value === "APPROVED" || value === "LOCKED";

export const inferManualGuidedStep = (project: MovieProject): ManualGuidedStepId => {
  const gate = (id: string) => project.production.gates.find((item) => item.stage === id)?.status;
  if (gate("project_setup") !== "LOCKED") return "project_setup";
  if (project.production.movieDna.status !== "LOCKED") return Object.keys(project.production.movieDna.selections).length ? "movie_dna_board" : "movie_dna";
  if (!approved(project.production.story.status)) return "story";
  if (!approved(project.production.filmBible.status)) return "film_bible";
  if (!project.production.characters.length || !project.production.characters.every((item) => approved(item.status))) return "characters";
  if (!project.preStorySetup.mainCharacterReferenceId && !project.production.assets.some((asset) => asset.category === "main_character" && Boolean(asset.imagePath))) return "character_sheets";
  if (!project.production.assets.length) return "asset_manifest";
  if (!project.production.assets.filter((asset) => asset.required !== false && asset.canGenerate !== false).every((asset) => Boolean(asset.imagePath) && approved(asset.status))) return "asset_generation";
  if (!project.memory.productionMemory.storyTimeline.events.length) return "story_timeline";
  if (!project.memory.productionMemory.continuity.snapshots.length) return "continuity_ledger";
  if (!approved(project.memory.productionMemory.audioBible.status)) return "audio_bible";
  if (!project.memory.productionMemory.script.scriptVersion || !approved(project.memory.productionMemory.script.status)) return "full_script";
  if (project.memory.productionMemory.script.dialogue.some((line) => line.lockState !== "LOCKED")) return "dialogue";
  if (!project.memory.productionMemory.script.shots.length) return "shot_planner";
  if (!project.memory.productionMemory.script.sequences.length) return "sequence_planner";
  if (!Object.keys(project.production.promptWorkspace.records).length) return "sequence_workspace";
  return "export";
};

export const activateManualGuidedState = (project: MovieProject) => {
  const state = project.manualProduction ?? createManualProductionState(true);
  const currentStep = inferManualGuidedStep(project);
  const currentIndex = MANUAL_GUIDED_STEP_IDS.indexOf(currentStep);
  state.status = "ACTIVE";
  state.currentStep = currentStep;
  state.completedSteps = MANUAL_GUIDED_STEP_IDS.slice(0, Math.max(0, currentIndex));
  state.visitedSteps = [...new Set([...state.visitedSteps, currentStep])];
  state.updatedAt = stamp();
  state.lastSavedAt = state.updatedAt;
  project.manualProduction = state;
  return state;
};
