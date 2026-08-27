import { randomUUID } from "node:crypto";
import type {
  AssetManifestArtifact,
  BrainActivity,
  BrainMode,
  FramePlanArtifact,
  MovieProject,
  PhaseId,
  SequenceContinuityLock,
  SequencesArtifact,
} from "../src/types.js";

export const pushActivity = (
  project: MovieProject,
  activity: Omit<BrainActivity, "id" | "createdAt">,
) => {
  project.brain.activity.push({
    ...activity,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  });
  project.brain.activity = project.brain.activity.slice(-120);
};

export const recordGeneration = (
  project: MovieProject,
  phase: PhaseId,
  provider: string,
  summary: string,
  brain: BrainMode | "builtin",
  regenerated = false,
) => {
  const attempt = project.phases.find((item) => item.id === phase)?.attempt ?? 1;
  const record = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    phase,
    attempt,
    brain,
    provider,
    summary,
  };
  project.memory.generationHistory.push(record);
  project.memory.generationHistory = project.memory.generationHistory.slice(-300);
  if (regenerated) {
    project.memory.regenerationHistory.push(record);
    project.memory.regenerationHistory = project.memory.regenerationHistory.slice(-120);
  }
};

export const recordApproval = (
  project: MovieProject,
  action: string,
  decision: "approved" | "denied" | "regenerated",
  phase?: PhaseId,
  detail?: string,
) => {
  project.memory.approvalHistory.push({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    action,
    decision,
    phase,
    detail,
  });
  project.memory.approvalHistory = project.memory.approvalHistory.slice(-200);
};

const emptyLock = (sequenceId: string): SequenceContinuityLock => ({
  sequenceId,
  characterIdentity: [],
  face: [],
  age: [],
  body: [],
  hair: [],
  clothing: [],
  accessories: [],
  characterCount: 0,
  creatureIdentity: [],
  creatureCount: 0,
  location: "",
  props: [],
  timeOfDay: "Unspecified",
  lighting: "Unspecified",
  weather: "Unspecified",
  colourTreatment: "Project look",
  cameraDirection: "Maintain established axis",
  screenDirection: "Maintain entrance and exit direction",
  physicalPosition: [],
  damage: [],
  wounds: [],
  carriedObjects: [],
  vehicleState: [],
  animalState: [],
  currentSequenceBeginning: "",
});

export const refreshProjectMemory = (project: MovieProject, phase: PhaseId) => {
  if (phase === "assets") {
    const manifest = project.artifacts.assets as AssetManifestArtifact | undefined;
    const locked = manifest?.assets.filter((asset) => asset.locked) ?? [];
    project.memory.approvedAssets = locked.map((asset) => asset.id);
    project.memory.lockedCharacters = locked.filter((asset) => asset.type === "character").map((asset) => asset.id);
    project.memory.lockedWardrobe = locked.filter((asset) => asset.type === "wardrobe").map((asset) => asset.id);
    project.memory.lockedCreatures = locked.filter((asset) => asset.type === "creature").map((asset) => asset.id);
    project.memory.lockedLocations = locked.filter((asset) => asset.type === "location").map((asset) => asset.id);
    project.memory.lockedProps = locked.filter((asset) => asset.type === "prop").map((asset) => asset.id);
  }
  if (phase === "frame_plans" || phase === "sequences") {
    const sequences = project.artifacts.sequences as SequencesArtifact | undefined;
    const frames = project.artifacts.frame_plans as FramePlanArtifact | undefined;
    for (const sequence of sequences?.sequences ?? []) {
      const plan = frames?.plans.find((item) => item.sequenceId === sequence.id);
      const existing = project.memory.sequenceContinuity[sequence.id] ?? emptyLock(sequence.id);
      const characters = sequence.assetIds.filter((id) => id.startsWith("CHAR_"));
      const creatures = sequence.assetIds.filter((id) => id.startsWith("CREATURE_"));
      const props = sequence.assetIds.filter((id) => id.startsWith("PROP_"));
      const previous = sequences?.sequences[sequence.number - 2];
      const previousEnd = previous
        ? frames?.plans.find((item) => item.sequenceId === previous.id)?.states.find((state) => state.state === "end")?.visual
        : undefined;
      project.memory.sequenceContinuity[sequence.id] = {
        ...existing,
        characterIdentity: characters,
        characterCount: characters.length,
        creatureIdentity: creatures,
        creatureCount: creatures.length,
        location: sequence.locationId,
        props,
        carriedObjects: props,
        lighting: plan?.states[0]?.lighting ?? existing.lighting,
        previousSequenceEnding: previousEnd,
        currentSequenceBeginning: plan?.states[0]?.visual ?? sequence.synopsis,
      };
    }
  }
};

export const continuityPreflight = (project: MovieProject, phase: PhaseId) => {
  if (!["frame_plans", "prompts", "continuity"].includes(phase)) return [];
  const sequences = project.artifacts.sequences as SequencesArtifact | undefined;
  if (!sequences?.sequences.length) return ["Sequence plan is missing."];
  const issues: string[] = [];
  for (const sequence of sequences.sequences) {
    if (!sequence.locationId) issues.push(`${sequence.id} has no location lock.`);
    if (!sequence.assetIds.length) issues.push(`${sequence.id} has no asset references.`);
  }
  return issues;
};
