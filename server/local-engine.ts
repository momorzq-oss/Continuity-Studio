import type {
  AssetItem,
  AssetManifestArtifact,
  ContinuityArtifact,
  ExportArtifact,
  FilmBibleArtifact,
  FramePlanArtifact,
  FrameState,
  MovieProject,
  PhaseId,
  PromptArtifact,
  ProviderInfo,
  SequenceItem,
  SequencesArtifact,
  StoryArtifact,
} from "../src/types.js";
import type { PhaseEngine, PhaseResult } from "./engine.js";

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const cleanSentence = (value: string) => {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "A traveller enters a place where the ordinary rules no longer apply.";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const identifier = (value: string, prefix: string) =>
  `${prefix}_${value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()
    .slice(0, 28) || "PRIMARY"}_001`;

const detectProtagonist = (idea: string) => {
  const match = idea.match(
    /\b([A-Z][a-z]{2,})\s+(?:becomes|travels|finds|discovers|must|is|encounters|returns|follows)\b/,
  );
  return match?.[1] ?? "The Traveller";
};

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.max(0, Math.round(seconds % 60));
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const sequenceTitles = [
  "The ordinary road",
  "A warning in the distance",
  "The last familiar landmark",
  "A threshold with no return",
  "The first impossible sign",
  "What the darkness remembers",
  "A choice under pressure",
  "The hidden rule",
  "A cost is revealed",
  "The night closes in",
  "A final act of courage",
  "The road after dawn",
];

export class LocalPhaseEngine implements PhaseEngine {
  readonly providerInfo: ProviderInfo = {
    kind: "builtin",
    label: "Built-in local production engine",
    available: true,
  };
  private readonly delayMs: number;

  constructor(options: { delayMs?: number } = {}) {
    this.delayMs = options.delayMs ?? 260;
  }

  async generate(phase: PhaseId, project: MovieProject, signal?: AbortSignal): Promise<PhaseResult> {
    if (signal?.aborted) throw new DOMException("Generation cancelled.", "AbortError");
    if (this.delayMs) await wait(this.delayMs);
    if (signal?.aborted) throw new DOMException("Generation cancelled.", "AbortError");

    const generators: Record<PhaseId, () => unknown> = {
      story: () => this.story(project),
      film_bible: () => this.filmBible(project),
      assets: () => this.assets(project),
      sequences: () => this.sequences(project),
      frame_plans: () => this.framePlans(project),
      prompts: () => this.prompts(project),
      continuity: () => this.continuity(project),
      export: () => this.export(project),
    };

    const artifact = generators[phase]();
    return {
      artifact,
      summary: this.summary(phase, project, artifact),
      provider: "Local engine",
    };
  }

  private story(project: MovieProject): StoryArtifact {
    const mainReference = project.preStorySetup.mainCharacterReferenceId
      ? project.memory.database.projectReferences.find((item) => item.id === project.preStorySetup.mainCharacterReferenceId)
      : undefined;
    const protagonist = mainReference?.name || detectProtagonist(project.idea);
    const premise = cleanSentence(project.idea);
    const protagonistId = mainReference ? "CHAR_MAIN_001" : identifier(protagonist, "CHAR");
    const setting = project.visualStyle || "a cinematic, grounded world";
    const desertCamp = /\b(desert|bedouin|camp|uae|emirati)\b/i.test(project.idea);

    return {
      logline: `${premise.replace(/[.!?]$/, "")} — and the only way home is to understand the rule hidden inside the encounter.`,
      synopsis: `${protagonist} begins in a recognizable world shaped by ${setting}. A small disruption becomes an encounter that tests identity, memory, and courage. By the final movement, the protagonist must choose between returning unchanged and accepting the truth the journey has revealed.`,
      fullStory: `ACT I — ARRIVAL\n${premise} ${protagonist} follows a practical goal, but the landscape begins withholding ordinary answers. A warning is noticed too late, and the route back disappears.\n\nACT II — THE HIDDEN RULE\nEvery attempt to regain control reveals a stricter pattern. Objects repeat, distances feel wrong, and a stranger offers help without explaining the price. ${protagonist} learns that survival depends on preserving identity and reading the environment rather than fighting it.\n\nACT III — THE CHOICE\nAt the emotional and visual climax, ${protagonist} uses the discovered rule to confront the force shaping the journey. Dawn returns, but one final image leaves open whether the encounter has ended or merely changed form.`,
      acts: [
        {
          title: "Act I · Arrival",
          summary: "Establish the traveller, the goal, the period, and the first break in reality.",
        },
        {
          title: "Act II · The hidden rule",
          summary: "Escalate the encounter and make continuity details part of the mystery.",
        },
        {
          title: "Act III · The choice",
          summary: "Resolve the practical danger while preserving an unsettling final question.",
        },
      ],
      characters: desertCamp ? [
        {
          id: protagonistId,
          name: protagonist,
          role: "Protagonist",
          description: "A practical desert traveller whose exact face, age, build, and presence remain stable throughout the encounter.",
          relationships: ["Protective bond with the camel", "Uneasy guest of the camp family"],
        },
        { id: "CHAR_OLD_MAN_001", name: "The Old Man", role: "Camp elder", description: "An elderly Bedouin host with a restrained manner and an unreadable knowledge of the desert rule.", relationships: [`Tests ${protagonist}'s judgment`, "Head of the camp family"] },
        { id: "CHAR_WOMAN_001", name: "The Woman", role: "Camp guardian", description: "A watchful adult woman whose controlled gestures reveal the family's fear before dialogue does.", relationships: ["Protects the boy", "Watches the traveller"] },
        { id: "CHAR_BOY_001", name: "The Boy", role: "Witness", description: "A quiet boy who notices the impossible repetition around the campfire first.", relationships: ["Protected by the Woman", `Mirrors ${protagonist}'s growing unease`] },
        { id: "CREATURE_PRESENCE_001", name: "The Presence", role: "Antagonistic force", description: "A desert force first seen through changed geography, repeated sound, and impossible firelight.", relationships: [`Mirrors ${protagonist}'s fear`, "Controls the boundary of the camp"] },
      ] : [
        {
          id: protagonistId,
          name: protagonist,
          role: "Protagonist",
          description: "Observant, practical, and increasingly forced to trust intuition over certainty.",
          relationships: ["Protective bond with the travelling companion", "Uneasy dependence on the guide"],
        },
        {
          id: "CHAR_GUIDE_001",
          name: "The Guide",
          role: "Threshold figure",
          description: "A calm local presence who understands more than they reveal.",
          relationships: [`Tests ${protagonist}'s judgment`, "Knows the rules of the place"],
        },
        {
          id: "CREATURE_PRESENCE_001",
          name: "The Presence",
          role: "Antagonistic force",
          description: "Seen through changed geography, repeated sound, and impossible light before it is seen directly.",
          relationships: [`Mirrors ${protagonist}'s fear`, "Controls the boundary of the location"],
        },
      ],
      locations: desertCamp ? [
        { id: "LOC_DESERT_ROUTE_001", name: "Desert route", description: "A 1965 UAE desert route with stable dunes, travel direction, and horizon landmarks." },
        { id: "LOC_BEDOUIN_CAMP_001", name: "Bedouin camp", description: "A mysterious period-correct camp with fixed tent geography, coffee area, camel position, and central campfire." },
        { id: "LOC_CAMP_EDGE_001", name: "Camp edge", description: "The threshold between firelight and the dark desert, with fixed exits and screen direction." },
      ] : [
        {
          id: "LOC_ROUTE_001",
          name: "The Route",
          description: "A wide exterior whose landmarks gradually stop agreeing with one another.",
        },
        {
          id: "LOC_THRESHOLD_001",
          name: "The Threshold",
          description: "The last place that still feels connected to the ordinary world.",
        },
        {
          id: "LOC_ENCOUNTER_001",
          name: "The Encounter Site",
          description: "A contained practical location where fire, shadow, and sound establish the supernatural rule.",
        },
      ],
      dialogueExcerpt: `GUIDE: The road has not moved. You have.\n${protagonist.toUpperCase()}: Then show me the way back.\nGUIDE: First, remember what you brought with you.`,
    };
  }

  private filmBible(project: MovieProject): FilmBibleArtifact {
    const story = project.artifacts.story as StoryArtifact | undefined;
    return {
      title: project.title,
      genre: project.genre,
      tone: `Restrained ${project.genre.toLowerCase()} with patient tension, tactile detail, and emotion held beneath practical action.`,
      visualLanguage: `${project.visualStyle}. Widescreen compositions, motivated camera movement, consistent exposure, and practical light sources.`,
      worldRules: [
        "The supernatural changes geography and sound before it changes bodies.",
        "Every impossible event leaves one repeatable physical clue.",
        "Characters cannot escape by retracing a route without first understanding the local rule.",
        "Modern objects, materials, and language are excluded when the story specifies a historical period.",
      ],
      characterContinuity: (story?.characters ?? []).map(
        (character) => `${character.id}: preserve face, age, build, wardrobe, and emotional history across every sequence.`,
      ),
      locationContinuity: (story?.locations ?? []).map(
        (location) => `${location.id}: preserve landmark placement, screen geography, light direction, and environmental damage.`,
      ),
      movieRules: [
        "Exactly one instance of every locked character or creature unless the story explicitly requires duplication.",
        "Never change faces, clothing, animal tack, or hero props without a recorded story event.",
        "Use locked asset IDs as the primary identity reference in every downstream prompt.",
        "Every sequence contains a beginning, middle, and end state.",
        "Preserve screen direction, camera geography, lighting, exposure, colour grade, wounds, and damage.",
        "Reject character morphing, duplicate people, unexplained prop changes, and unmotivated time-of-day shifts.",
      ],
    };
  }

  private assets(project: MovieProject): AssetManifestArtifact {
    const story = project.artifacts.story as StoryArtifact | undefined;
    const bible = project.artifacts.film_bible as FilmBibleArtifact | undefined;
    const storyAssets: AssetItem[] = [
      ...(story?.characters ?? []).map((character) => ({
        id: character.id,
        name: character.name,
        type: character.id.startsWith("CREATURE_") ? ("creature" as const) : ("character" as const),
        description: character.description,
        locked: false,
        continuityNotes: ["Lock face and silhouette", "Record wardrobe and damage state"],
      })),
      ...(story?.locations ?? []).map((location) => ({
        id: location.id,
        name: location.name,
        type: "location" as const,
        description: location.description,
        locked: false,
        continuityNotes: ["Lock horizon and landmark geography", "Record sun and practical-light direction"],
      })),
    ];

    const required: AssetItem[] = [
      {
        id: "PROP_LIGHT_001",
        name: "Primary practical light",
        type: "prop",
        description: "The story's repeatable practical light source and supernatural visual anchor.",
        locked: false,
        continuityNotes: ["Preserve position, flame level, soot, and damage"],
      },
      {
        id: "PROP_TRAVEL_001",
        name: "Travel kit",
        type: "prop",
        description: "A compact set of period-appropriate personal travel objects.",
        locked: false,
        continuityNotes: ["Track which items are carried, lost, or damaged"],
      },
      {
        id: "WARDROBE_PROTAGONIST_001",
        name: "Protagonist base wardrobe",
        type: "wardrobe",
        description: "Primary costume with a documented clean-to-damaged progression.",
        locked: false,
        continuityNotes: ["Photograph front, back, profile, footwear, and damage stages"],
      },
    ];

    const assets = [...storyAssets, ...required];
    const counts = assets.reduce<Record<string, number>>((accumulator, asset) => {
      accumulator[asset.type] = (accumulator[asset.type] ?? 0) + 1;
      return accumulator;
    }, {});

    if (bible?.movieRules.length) counts.rulesApplied = bible.movieRules.length;
    return { assets, counts };
  }

  private sequences(project: MovieProject): SequencesArtifact {
    const manifest = project.artifacts.assets as AssetManifestArtifact | undefined;
    const locationIds = manifest?.assets
      .filter((asset) => asset.type === "location")
      .map((asset) => asset.id) ?? ["LOC_ROUTE_001", "LOC_THRESHOLD_001", "LOC_ENCOUNTER_001"];
    const characterIds = manifest?.assets
      .filter((asset) => asset.type === "character" || asset.type === "creature")
      .map((asset) => asset.id) ?? ["CHAR_PRIMARY_001"];
    const supportIds = manifest?.assets
      .filter((asset) => ["animal", "prop", "wardrobe", "vehicle"].includes(asset.type))
      .map((asset) => asset.id) ?? ["PROP_TRAVEL_001"];
    const duration = Math.max(10, Math.round((project.runtimeMinutes * 60) / project.sequenceCount));

    const sequences: SequenceItem[] = Array.from(
      { length: project.sequenceCount },
      (_, index) => {
        const number = index + 1;
        const progress = number / project.sequenceCount;
        const locationId = locationIds[Math.min(locationIds.length - 1, Math.floor(progress * locationIds.length))];
        return {
          id: `SEQ_${String(number).padStart(3, "0")}`,
          number,
          title: sequenceTitles[index] ?? `Sequence ${String(number).padStart(2, "0")}`,
          durationSeconds: duration,
          synopsis: `${progress < 0.34 ? "Set up" : progress < 0.75 ? "Escalate" : "Resolve"} the central encounter through a clear visual objective, a change in the environment, and a decision that pushes the next sequence.`,
          locationId,
          assetIds: [...new Set([
            ...characterIds.slice(0, progress > 0.65 ? characterIds.length : progress > 0.3 ? Math.min(3, characterIds.length) : 1),
            ...supportIds.slice(0, progress > 0.45 ? supportIds.length : Math.min(3, supportIds.length)),
          ])],
          emotionalBeat:
            progress < 0.34 ? "Curiosity becoming unease" : progress < 0.75 ? "Dread becoming recognition" : "Fear becoming resolve",
          status: "draft",
        };
      },
    );

    return {
      targetRuntimeSeconds: project.runtimeMinutes * 60,
      sequences,
    };
  }

  private framePlans(project: MovieProject): FramePlanArtifact {
    const sequenceArtifact = project.artifacts.sequences as SequencesArtifact | undefined;
    const sequences = sequenceArtifact?.sequences ?? [];
    return {
      plans: sequences.map((sequence, index) => {
        const third = sequence.durationSeconds / 3;
        const previous = sequences[index - 1];
        const transition = previous
          ? `Transition from ${previous.id}'s ending through a motivated change in time, angle, or geography; do not copy the prior frame mechanically.`
          : "Open from the project's established visual language.";
        const lock = project.memory.sequenceContinuity[sequence.id];
        const characters = sequence.assetIds.filter((id) => id.startsWith("CHAR_"));
        const props = sequence.assetIds.filter((id) => id.startsWith("PROP_"));
        const states: FrameState[] = [
          {
            state: "beginning",
            timeRange: `${formatTime(0)}–${formatTime(third)}`,
            visual: `${transition} Establish ${sequence.locationId} and the immediate objective before the environment changes.`,
            charactersPresent: characters,
            characterState: ["Match identity, wardrobe, carried objects, wounds, and emotional state from the prior sequence."],
            location: sequence.locationId,
            props,
            camera: "50mm locked composition with a restrained opening move",
            lens: "50mm spherical",
            composition: "Stable geography with readable entrances, exits, and eyelines",
            lighting: "Motivated ambient light; practical source held on screen-left",
            movement: "Restrained establishing move that preserves screen direction",
            sound: "Location tone with one identifiable recurring sound",
            emotion: sequence.emotionalBeat.split(" becoming ")[0] ?? sequence.emotionalBeat,
            continuity: [`Confirm ${sequence.locationId} geography`, "Record entrance screen direction"],
            continuityLocks: lock,
            generationPrompt: `${project.visualStyle}; START FRAME for ${sequence.id}; ${sequence.locationId}; ${characters.join(", ")}; stable identity and geography.`,
            referenceAssets: [sequence.locationId, ...sequence.assetIds],
          },
          {
            state: "middle",
            timeRange: `${formatTime(third)}–${formatTime(third * 2)}`,
            visual: "Reveal the sequence's impossible change without changing locked character identity or costume.",
            charactersPresent: characters,
            characterState: ["Advance emotion and action while preserving physical continuity."],
            location: sequence.locationId,
            props,
            camera: "35mm slow lateral move that preserves the established axis",
            lens: "35mm spherical",
            composition: "Layered mid-wide frame with one clear visual change",
            lighting: "Practical light intensifies without an exposure jump",
            movement: "Slow lateral movement on the established axis",
            sound: "Recurring sound separates from its visible source",
            emotion: sequence.emotionalBeat,
            continuity: ["Preserve action axis", "Match prop hands and wardrobe damage"],
            continuityLocks: lock,
            generationPrompt: `${project.visualStyle}; MID FRAME for ${sequence.id}; reveal escalation; preserve ${sequence.assetIds.join(", ")}.`,
            referenceAssets: [sequence.locationId, ...sequence.assetIds],
          },
          {
            state: "end",
            timeRange: `${formatTime(third * 2)}–${formatTime(sequence.durationSeconds)}`,
            visual: "Land on a decisive image that carries a physical and emotional state into the next sequence.",
            charactersPresent: characters,
            characterState: ["Record the exact outgoing emotion, position, damage, wounds, and carried objects."],
            location: sequence.locationId,
            props,
            camera: "85mm restrained push-in, ending on a stable eyeline",
            lens: "85mm spherical",
            composition: "Controlled close frame with an explicit outgoing eyeline",
            lighting: "Hold colour temperature and practical-light direction",
            movement: "Restrained push-in ending on a stable frame",
            sound: "Cut the ambient bed, leaving the recurring sound alone",
            emotion: sequence.emotionalBeat.split(" becoming ")[1] ?? sequence.emotionalBeat,
            continuity: ["Write the outgoing state to the next sequence", "Preserve damage and carried objects"],
            continuityLocks: lock,
            generationPrompt: `${project.visualStyle}; END FRAME for ${sequence.id}; decisive outgoing state; preserve ${sequence.assetIds.join(", ")}.`,
            referenceAssets: [sequence.locationId, ...sequence.assetIds],
          },
        ];
        return { sequenceId: sequence.id, states };
      }),
    };
  }

  private prompts(project: MovieProject): PromptArtifact {
    const sequenceArtifact = project.artifacts.sequences as SequencesArtifact | undefined;
    const plans = project.artifacts.frame_plans as FramePlanArtifact | undefined;
    return {
      prompts: (sequenceArtifact?.sequences ?? []).map((sequence) => {
        const plan = plans?.plans.find((item) => item.sequenceId === sequence.id);
        return {
          sequenceId: sequence.id,
          prompt: `${project.visualStyle}; ${project.genre}; ${sequence.synopsis} LOCATION=${sequence.locationId}. LOCKED_REFERENCES=${sequence.assetIds.join(", ")}. Beginning: ${plan?.states[0]?.visual} Middle: ${plan?.states[1]?.visual} End: ${plan?.states[2]?.visual} Widescreen cinematic composition, consistent faces, wardrobe, geography, screen direction, lighting, exposure, and colour grade.`,
          negativePrompt:
            "duplicate people, extra limbs, face change, wardrobe change, character morphing, prop duplication, broken screen direction, modern objects, exposure flicker, unmotivated camera jump, text, watermark",
          references: [sequence.locationId, ...sequence.assetIds],
        };
      }),
    };
  }

  private continuity(project: MovieProject): ContinuityArtifact {
    const manifest = project.artifacts.assets as AssetManifestArtifact | undefined;
    const sequences = project.artifacts.sequences as SequencesArtifact | undefined;
    const unlocked = manifest?.assets.filter((asset) => !asset.locked) ?? [];
    const issues: ContinuityArtifact["issues"] = unlocked.slice(0, 3).map((asset, index) => ({
      id: `CONT_${String(index + 1).padStart(3, "0")}`,
      severity: index === 0 ? "warning" : "info",
      sequenceId: sequences?.sequences[Math.min(index, Math.max(0, (sequences?.sequences.length ?? 1) - 1))]?.id,
      title: `${asset.name} is not locked`,
      detail: `${asset.id} has a stable manifest entry but no approved reference sheet yet.`,
      suggestion: `Approve or replace ${asset.id} before sending final provider jobs.`,
    }));
    return {
      score: Math.max(70, 100 - issues.length * 7),
      checkedRules: 18 + (sequences?.sequences.length ?? 0) * 3,
      issues,
      passed: [
        "Every sequence references stable asset IDs.",
        "Every sequence contains beginning, middle, and end states.",
        "Camera geography and screen direction are explicitly recorded.",
        "Lighting, sound, and emotional state are carried through prompts.",
      ],
    };
  }

  private export(project: MovieProject): ExportArtifact {
    return {
      ready: true,
      folders: [
        "film_bible/",
        "story/",
        "sequences/",
        "assets/",
        "character_sheets/",
        "creature_sheets/",
        "locations/",
        "props/",
        "frame_plans/",
        "prompts/",
        "generated_images/",
        "generated_video/",
        "continuity/",
        "audio/",
        "final/",
      ],
      files: [
        "project.json",
        "MOVIE_RULES.md",
        "story/story.md",
        "film_bible/film_bible.md",
        "assets/manifest.json",
        "sequences/index.json",
        "prompts/index.json",
        "continuity/report.json",
      ],
      note: "The planning package is complete. Generated image, video, audio, and final edit folders are ready for connected providers.",
    };
  }

  private summary(phase: PhaseId, project: MovieProject, artifact: unknown) {
    const counts: Partial<Record<PhaseId, number>> = {
      story: (artifact as StoryArtifact).characters?.length,
      assets: (artifact as AssetManifestArtifact).assets?.length,
      sequences: (artifact as SequencesArtifact).sequences?.length,
      frame_plans: (artifact as FramePlanArtifact).plans?.length,
      prompts: (artifact as PromptArtifact).prompts?.length,
      continuity: (artifact as ContinuityArtifact).issues?.length,
      export: (artifact as ExportArtifact).files?.length,
    };
    const count = counts[phase];
    const labels: Record<PhaseId, string> = {
      story: "Story package created",
      film_bible: "Film bible and movie rules locked",
      assets: "Asset manifest created",
      sequences: "Sequence plan created",
      frame_plans: "Three-state frame plans created",
      prompts: "Provider-ready prompt package created",
      continuity: "Continuity audit completed",
      export: "Movie project export prepared",
    };
    return `${labels[phase]}${typeof count === "number" ? ` · ${count} items` : ""} for ${project.title}.`;
  }
}
