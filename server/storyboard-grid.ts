import type {
  MovieProject,
  ProductionCharacter,
  ScriptProductionSequence,
  SequenceStoryboardGrid,
  StoryboardGridPanel,
} from "../src/types.js";
import { permanentAssetFilename } from "./asset-storage.js";

const now = () => new Date().toISOString();
const pad = (value: number) => String(value).padStart(2, "0");

const clean = (value: string) => value
  .replace(/\[[^\]]*\]/g, "")
  .replace(/\s+/g, " ")
  .replace(/^[-–—:;,.\s]+|[-–—:;,\s]+$/g, "")
  .trim();

const words = (value: string, limit: number) => {
  const tokens = clean(value).split(" ").filter(Boolean);
  return `${tokens.slice(0, limit).join(" ")}${tokens.length > limit ? "…" : ""}`;
};
export const characterIdentityAnchor = (character: ProductionCharacter) => words([
  character.name,
  character.ageRange,
  character.description,
].filter(Boolean).join(", "), 42);

const sequenceSource = (project: MovieProject, sequenceId: string) => {
  const sequence = project.memory.productionMemory.script.sequences.find((item) => item.id === sequenceId);
  if (!sequence) throw new Error(`Formal sequence ${sequenceId} was not found. Generate Full Script v2 and Sequence Planner first.`);
  return sequence;
};

const panelsFromShots = (project: MovieProject, sequence: ScriptProductionSequence): StoryboardGridPanel[] => {
  const script = project.memory.productionMemory.script;
  const shots = script.shots.filter((shot) => sequence.shotIds.includes(shot.id)).sort((left, right) => left.number - right.number);
  if (!shots.length) return [];
  return Array.from({ length: 9 }, (_, index) => {
    const shot = shots[Math.min(shots.length - 1, Math.floor(index * shots.length / 9))]!;
    const hasDialogue = shot.dialogueIds.length > 0;
    const annotationType: StoryboardGridPanel["annotationType"] = hasDialogue ? "VOICE" : /fight|strike|run|chase|attack|lunge/i.test(shot.subjectAction) ? "STYLE" : "MOOD";
    const dialogue = script.dialogue.find((line) => shot.dialogueIds.includes(line.id));
    const annotation = annotationType === "VOICE"
      ? words(dialogue?.exactDialogue ?? shot.continuityPurpose, 6)
      : annotationType === "STYLE"
        ? words(shot.subjectAction, 6)
        : words(shot.continuityPurpose || sequence.emotion, 6);
    return {
      number: index + 1,
      row: Math.floor(index / 3) + 1,
      column: (index % 3) + 1,
      shotId: shot.id,
      beat: words(shot.subjectAction, 12),
      camera: words(`${shot.shotType}. ${shot.framing}. ${shot.cameraAngle}`, 10).toUpperCase(),
      movement: words(shot.cameraMovement, 8).toUpperCase(),
      annotationType,
      annotation: annotation.toUpperCase(),
    };
  });
};

const promptForGrid = (project: MovieProject, sequence: ScriptProductionSequence, panels: StoryboardGridPanel[]) => {
  const characters = sequence.characterIds
    .map((id) => project.production.characters.find((character) => character.id === id))
    .filter((character): character is ProductionCharacter => Boolean(character))
    .map(characterIdentityAnchor);
  const panelText = panels.map((panel) => `Panel ${panel.number}: ${panel.beat}. CAM: ${panel.camera}. MOVE: ${panel.movement}. ${panel.annotationType}: ${panel.annotation}.`).join("\n");
  return [
    `Create one cinematic 3x3 Storyboard Grid for ${sequence.id}, read left-to-right and top-to-bottom as one continuous scene.`,
    `Aspect ratio inside every panel: ${project.aspectRatio}. Use clean, legible annotation strips outside the image area.`,
    `IDENTITY LOCK: ${characters.join(" | ") || "Use approved project character identities."}`,
    `CONTINUITY LOCK: preserve geography, lighting, staging, screen direction, wardrobe, props, injuries, and ordered time across all nine panels.`,
    panelText,
    "No unrelated panels, identity drift, duplicate people, scene contamination, embedded captions, logos, or unresolved placeholders.",
  ].join("\n");
};

export const storyboardGridForSequence = (project: MovieProject, sequenceId: string): SequenceStoryboardGrid => {
  const stored = project.production.storyboardGrids[sequenceId];
  if (stored) return stored;
  const sequence = sequenceSource(project, sequenceId);
  const timestamp = now();
  return {
    id: `STORYBOARD_GRID_${sequenceId}`,
    sequenceId,
    sequenceNumber: sequence.number,
    enabled: false,
    status: "DISABLED",
    source: "SHOT_PLANNER",
    panels: [],
    generationPrompt: "",
    version: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const setSequenceStoryboardGrid = (project: MovieProject, sequenceId: string, enabled: boolean) => {
  const sequence = sequenceSource(project, sequenceId);
  const current = storyboardGridForSequence(project, sequenceId);
  if (enabled && current.projectImageNumber === undefined) {
    current.projectImageNumber = project.production.nextProjectImageNumber;
    project.production.nextProjectImageNumber += 1;
    current.permanentFilename = permanentAssetFilename(current.projectImageNumber, `Sequence_${pad(sequence.number)}_Storyboard_Grid`, "png");
  }
  current.enabled = enabled;
  current.panels = enabled ? panelsFromShots(project, sequence) : current.panels;
  current.generationPrompt = enabled ? promptForGrid(project, sequence, current.panels) : current.generationPrompt;
  current.status = enabled ? (current.imagePath ? "REFERENCE_READY" : "PLANNED") : "DISABLED";
  current.version += 1;
  current.updatedAt = now();
  project.production.storyboardGrids[sequenceId] = current;
  project.production.updatedAt = current.updatedAt;
  return current;
};

export const attachStoryboardGridReference = (project: MovieProject, sequenceId: string, input: { referenceId: string; imagePath: string; thumbnailPath?: string }) => {
  const grid = setSequenceStoryboardGrid(project, sequenceId, true);
  grid.referenceId = input.referenceId;
  grid.imagePath = input.imagePath;
  grid.thumbnailPath = input.thumbnailPath;
  grid.status = "REFERENCE_READY";
  grid.version += 1;
  grid.updatedAt = now();
  return grid;
};
