import type {
  AssetEntity,
  ContinuityState,
  MovieProject,
  ReferenceManifestItem,
  RuleDefinition,
  SequenceItem,
} from "../src/types.js";

export interface ModelPromptInput {
  project: MovieProject;
  sequence: SequenceItem;
  start: ContinuityState;
  mid: ContinuityState;
  end: ContinuityState;
  assets: AssetEntity[];
  references: ReferenceManifestItem[];
  rules: RuleDefinition[];
}

export interface CompiledModelPrompt {
  model: "seedance-2.5" | "minimax-h3";
  prompt: string;
  negativePrompt: string;
  referenceManifest: ReferenceManifestItem[];
  ruleIds: string[];
}

const compactState = (state: ContinuityState) =>
  JSON.stringify({
    anchor: state.anchor,
    location: state.locationId,
    characters: state.characters,
    positions: state.characterPositions,
    screenDirection: state.screenDirection,
    travel: state.directionOfTravel,
    wardrobe: state.wardrobe,
    propsHeld: state.propsHeld,
    injuries: state.injuries,
    creatureState: state.creatureState,
    animalState: state.animalState,
    vehicleState: state.vehicleState,
    environment: state.environmentState,
    timeOfDay: state.timeOfDay,
    lighting: state.lighting,
    weather: state.weather,
    camera: state.cameraPosition,
    visibleAssets: state.assetVisibility,
    damage: state.damage,
    storyFacts: state.storyFacts,
  });

const timestamp = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const negatives = [
  "no duplicate character",
  "no extra character",
  "no missing required character",
  "no face drift",
  "no identity swap",
  "no wardrobe change",
  "no character morphing",
  "no wrong or disappearing prop",
  "no wrong animal or tack",
  "no architecture blending",
  "no wound or damage reset",
  "no teleportation",
  "no unexplained screen-direction reversal",
  "no unexplained time, lighting, weather, exposure, or colour jump",
];

export class Seedance25Adapter {
  readonly id = "seedance-2.5" as const;

  compile(input: ModelPromptInput): CompiledModelPrompt {
    const { project, sequence, start, mid, end, assets, references, rules } = input;
    const third = sequence.durationSeconds / 3;
    const hardLocks = assets
      .map((asset) => `${asset.id}: ${Object.values(asset.lockedTraits).join(", ") || asset.description}`)
      .join("\n");
    const referenceMap = references
      .map((reference, index) => `@Image ${index + 1}: ${reference.assetId} — ${reference.roles.join(", ")} — v${reference.stateVersion}`)
      .join("\n");
    const prompt = `# Film\n${project.title}\n\n# Sequence\n${sequence.number} · ${sequence.durationSeconds}s · ${project.visualStyle}\n\n# Continuity Source\n${start.previousSequenceEnding || "Project opening state"}\n\n# Active References\n${referenceMap}\n\n# Hard Locks\n${hardLocks}\nExactly ${start.characters.length} registered character(s). Preserve every permanent asset ID.\n\n# START · ${timestamp(0)}–${timestamp(third)}\n${compactState(start)}\n${sequence.beginning || sequence.synopsis}\n\n# MID · ${timestamp(third)}–${timestamp(third * 2)}\n${compactState(mid)}\n${sequence.middle || sequence.synopsis}\n\n# END · ${timestamp(third * 2)}–${timestamp(sequence.durationSeconds)}\n${compactState(end)}\n${sequence.ending || sequence.synopsis}\n\n# Camera\n${sequence.cameraPlan || "Preserve the established axis and project lens language."}\n\n# Lighting and Visual Treatment\n${sequence.lightingPlan || project.visualStyle}\n\n# Dialogue\n${sequence.dialogue?.join("\n") || "No dialogue assigned."}\n\n# Sound\n${sequence.soundPlan || "Preserve project sound rules."}\n\n# Strict Continuity Rules\n${negatives.join("; ")}`;
    return {
      model: this.id,
      prompt,
      negativePrompt: negatives.join(", "),
      referenceManifest: references,
      ruleIds: rules.map((rule) => rule.id),
    };
  }
}

export class MiniMaxH3Adapter {
  readonly id = "minimax-h3" as const;

  compile(input: ModelPromptInput): CompiledModelPrompt {
    const { project, sequence, start, mid, end, assets, references, rules } = input;
    const prompt = `# ROLE\nAct as the Sequence Agent for Continuity Studio. Return production data for ${sequence.id}.\n\n# PROJECT\n${project.title}: ${project.idea}\n\n# PROJECT LAW\nPreserve approved identities, wardrobe, permanent IDs, damage, injuries, and registered assets. Do not invent permanent IDs.\n\n# CONTINUITY INPUT\n${start.previousSequenceEnding || "Project opening state"}\n\n# ACTIVE REFERENCES\n${references.map((item) => `${item.assetId}: ${item.roles.join(", ")} v${item.stateVersion}`).join("\n")}\n\n# ACTIVE ASSETS\n${assets.map((asset) => `${asset.id} [${asset.approvalState}] ${asset.description}`).join("\n")}\n\n# CURRENT SEQUENCE\n${sequence.id}, ${sequence.durationSeconds}s\n${sequence.synopsis}\n\n# START\n${compactState(start)}\n\n# MIDDLE\n${compactState(mid)}\n\n# END\n${compactState(end)}\n\n# CAMERA AND VISUAL LANGUAGE\n${sequence.cameraPlan || project.visualStyle}\n${sequence.lightingPlan || "Preserve Film Bible lighting."}\n\n# DIALOGUE AND AUDIO\n${sequence.dialogue?.join("\n") || "No dialogue assigned."}\n${sequence.soundPlan || "Preserve Film Bible sound rules."}\n\n# CONTINUITY RESTRICTIONS\n${negatives.join("; ")}\n\n# OUTPUT CONTRACT\nReturn only data matching the Continuity Studio schema. New recurring assets must be PROPOSED and require approval.`;
    return {
      model: this.id,
      prompt,
      negativePrompt: negatives.join(", "),
      referenceManifest: references,
      ruleIds: rules.map((rule) => rule.id),
    };
  }
}
