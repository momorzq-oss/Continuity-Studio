import { randomUUID } from "node:crypto";
import type {
  FilmBibleArtifact,
  FilmBibleSourceContext,
  FilmBibleVersionRecord,
  MovieProject,
  ProductionFilmBible,
  ProductionStage,
  WorkflowGateStatus,
} from "../src/types.js";
import type { PhaseEngine } from "./engine.js";

const now = () => new Date().toISOString();

const setGate = (project: MovieProject, stage: ProductionStage, status: WorkflowGateStatus, note?: string) => {
  const gate = project.production.gates.find((item) => item.stage === stage);
  if (gate) Object.assign(gate, { status, note, updatedAt: now() });
  else project.production.gates.push({ stage, status, note, updatedAt: now() });
  project.production.updatedAt = now();
};

const requireSources = (project: MovieProject) => {
  if (!project.production.story.approvedVersion || !["APPROVED", "LOCKED", "CHANGED_AFTER_PRODUCTION"].includes(project.production.story.status)) {
    throw new Error("Approve the structured Story before generating the Film Bible.");
  }
  if (project.production.movieDna.status !== "LOCKED") throw new Error("Lock Movie DNA before generating the Film Bible.");
  if (!project.production.story.contracts?.filmBible) throw new Error("The approved Story does not contain a Film Bible contract yet.");
};

const sourceContext = (project: MovieProject): FilmBibleSourceContext => ({
  storyId: project.production.story.storyId,
  storyVersion: project.production.story.approvedVersion ?? project.production.story.version,
  approvedStoryVersion: project.production.story.approvedVersion ?? project.production.story.version,
  movieDnaVersion: project.production.movieDna.version,
  projectTitle: project.movieTitle ?? project.title,
  era: project.era,
  generatedAt: now(),
});

export const buildFilmBibleSections = (project: MovieProject, artifact?: FilmBibleArtifact): Record<string, string> => {
  const story = project.production.story;
  const approved = story.history.find((item) => item.version === story.approvedVersion);
  const sections = approved?.sections ?? story.sections;
  const characters = approved?.characters ?? story.contracts!.filmBible.characterCandidates;
  const arcs = approved?.characterArcs ?? story.characterArcs;
  const timeline = approved?.timeline ?? story.contracts!.filmBible.timeline;
  const locations = approved?.locations ?? story.contracts!.filmBible.locations;
  const objects = approved?.objects ?? story.contracts!.filmBible.objects;
  const sectionContent = (id: string) => sections.find((item) => item.id === id)?.content ?? "";
  const artifactWorld = artifact?.worldRules?.join("\n") ?? "";
  const artifactCharacters = artifact?.characterContinuity?.join("\n") ?? "";
  const artifactLocations = artifact?.locationContinuity?.join("\n") ?? "";
  const artifactRules = artifact?.movieRules?.join("\n") ?? "";
  return {
    canonicalSummary: approved?.summary ?? (story.summary || story.logline),
    premiseAndNarrativeLaw: `${approved?.premise ?? story.premise}\n\nStory sections and beats are the narrative source of truth. Movie DNA controls tone and visual treatment but never changes narrative cause and effect.`,
    opening: sectionContent("opening"),
    beginning: sectionContent("beginning"),
    development: sectionContent("development"),
    middle: sectionContent("middle"),
    escalation: sectionContent("escalation"),
    climax: sectionContent("climax"),
    ending: sectionContent("ending"),
    characterIdentityLaw: [artifactCharacters, ...characters.map((character) => `${character.id} · ${character.name} · ${character.role}: ${character.description}. Goal: ${character.goal}. Motivation: ${character.motivation}. Conflict: ${character.conflict}.`)].filter(Boolean).join("\n"),
    characterArcsAndRelationships: arcs.map((arc) => `${arc.characterId} · ${arc.name}: ${arc.startingEmotionalState} → ${arc.endingState}. ${arc.relationships.join(" ")}`).join("\n"),
    worldRules: [artifactWorld, `${project.era}. Cause and effect, geography, time, weather, culture, and technology obey the approved Story world.`].filter(Boolean).join("\n"),
    historicalAndCulturalLaw: [...new Set([...locations.flatMap((location) => location.historicalRequirements), project.era])].filter(Boolean).join("\n"),
    timelineLaw: timeline.map((event) => `${event.time} · ${event.timeOfDay} · ${event.weather} · ${event.locationId} · ${event.events.join(", ")}`).join("\n"),
    locationsAndGeography: [artifactLocations, ...locations.map((location) => `${location.id} · ${location.name}: ${location.description}. Historical and geography requirements: ${location.historicalRequirements.join(" ") || "Preserve the approved Story geography."}`)].filter(Boolean).join("\n"),
    objectsPropsAndVehicles: objects.map((object) => `${object.id} · ${object.name} · ${object.category}: ${object.description}`).join("\n"),
    costumesAndPhysicalState: "Every costume, carried object, injury, dirt, wear, and physical change uses a named story or sequence state. Changes occur only through documented events.",
    environmentAndWeather: "Weather, ground disturbance, sun direction, shadows, haze, practical light, ambient sound, and physical damage transfer between contiguous timeline events.",
    visualLanguage: artifact?.visualLanguage ?? Object.values(project.production.movieDna.selections).map((selection) => `${selection.key}: ${selection.label}. ${selection.technicalDescription}`).join("\n"),
    vfxAndCreatureLaw: "VFX, creatures, and animals preserve scale, anatomy, identity, equipment, movement logic, interaction, lens response, lighting, texture, and damage state.",
    audioAndDialogueLaw: Object.entries(project.production.audioBible).map(([key, value]) => `${key}: ${value}`).join("\n"),
    continuityAndProductionRestrictions: [artifactRules, ...project.production.permanentNegativeRules, "Only approved or locked outputs update canonical production state. Rejected generations never change continuity history."].filter(Boolean).join("\n"),
  };
};

export const createEmptyFilmBibleState = (createdAt = now()): ProductionFilmBible => ({
  filmBibleId: randomUUID(),
  status: "PENDING",
  version: 0,
  sections: {},
  history: [],
  createdAt,
  updatedAt: createdAt,
});

const snapshot = (bible: ProductionFilmBible, source: FilmBibleVersionRecord["source"], changedSections: string[], instruction?: string): FilmBibleVersionRecord => ({
  version: bible.version,
  status: bible.status,
  source,
  sections: structuredClone(bible.sections),
  changedSections: [...changedSections],
  instruction,
  provider: bible.generationProvider,
  sourceContext: bible.sourceContext ? structuredClone(bible.sourceContext) : undefined,
  createdAt: now(),
  approvedAt: bible.approvedAt,
  lockedAt: bible.lockedAt,
});

const writeSnapshot = (bible: ProductionFilmBible, record: FilmBibleVersionRecord) => {
  const index = bible.history.findIndex((item) => item.version === record.version);
  if (index >= 0) bible.history[index] = record;
  else bible.history.push(record);
  bible.history.sort((left, right) => left.version - right.version);
};

const syncArtifact = (project: MovieProject, artifact?: FilmBibleArtifact) => {
  const sections = project.production.filmBible.sections;
  project.artifacts.film_bible = {
    title: project.movieTitle ?? project.title,
    genre: project.genre,
    tone: artifact?.tone ?? project.production.movieDna.selections.genre?.label ?? project.genre,
    visualLanguage: sections.visualLanguage ?? artifact?.visualLanguage ?? project.visualStyle,
    worldRules: [sections.worldRules, sections.historicalAndCulturalLaw, sections.timelineLaw].filter(Boolean),
    characterContinuity: [sections.characterIdentityLaw, sections.characterArcsAndRelationships, sections.costumesAndPhysicalState].filter(Boolean),
    locationContinuity: [sections.locationsAndGeography, sections.environmentAndWeather].filter(Boolean),
    movieRules: [sections.continuityAndProductionRestrictions, sections.vfxAndCreatureLaw, sections.audioAndDialogueLaw].filter(Boolean),
  } satisfies FilmBibleArtifact;
};

const applyGeneration = (project: MovieProject, artifact: FilmBibleArtifact | undefined, provider: string, instruction?: string) => {
  const previous = normalizeFilmBibleState(project, project.production.filmBible);
  if (previous.version > 0 && !previous.history.some((item) => item.version === previous.version)) {
    writeSnapshot(previous, snapshot(previous, "MIGRATION", Object.keys(previous.sections)));
  }
  const timestamp = now();
  const next: ProductionFilmBible = {
    ...previous,
    status: "DRAFT",
    version: previous.version + 1,
    sections: buildFilmBibleSections(project, artifact),
    sourceContext: sourceContext(project),
    generationProvider: provider,
    approvedAt: undefined,
    lockedAt: undefined,
    updatedAt: timestamp,
  };
  project.production.filmBible = next;
  writeSnapshot(next, snapshot(next, "AI", Object.keys(next.sections), instruction));
  syncArtifact(project, artifact);
  setGate(project, "film_bible", "REVIEW", `Film Bible v${next.version} generated from approved Story v${next.sourceContext!.approvedStoryVersion} and locked Movie DNA v${next.sourceContext!.movieDnaVersion}.`);
  project.production.currentStage = "film_bible";
  project.status = "awaiting_approval";
  return next;
};

export const generateFilmBibleOffline = (project: MovieProject, instruction?: string) => {
  requireSources(project);
  return applyGeneration(project, undefined, "Continuity Studio structured fallback", instruction);
};

export class FilmBibleService {
  constructor(private readonly engine: PhaseEngine) {}

  async generate(project: MovieProject, instruction?: string) {
    requireSources(project);
    project.production.filmBible.status = "GENERATING";
    const phase = project.phases.find((item) => item.id === "film_bible");
    if (phase) phase.feedback = instruction;
    const currentStory = project.production.story;
    const currentArtifact = project.artifacts.story;
    const approved = currentStory.history.find((item) => item.version === currentStory.approvedVersion);
    if (approved && approved.version !== currentStory.version) {
      project.production.story = {
        ...currentStory,
        title: approved.title,
        premise: approved.premise,
        logline: approved.logline,
        summary: approved.summary,
        content: approved.content,
        sections: structuredClone(approved.sections),
        beats: structuredClone(approved.beats),
        timeline: structuredClone(approved.timeline),
        characters: structuredClone(approved.characters),
        characterArcs: structuredClone(approved.characterArcs),
        locations: structuredClone(approved.locations),
        objects: structuredClone(approved.objects),
        events: structuredClone(approved.events),
        sequenceBreakdown: structuredClone(approved.sequenceBreakdown),
        status: approved.locked ? "LOCKED" : "APPROVED",
        version: approved.version,
        pendingProposal: undefined,
      };
      project.artifacts.story = {
        logline: approved.logline,
        synopsis: approved.summary,
        fullStory: approved.content,
        acts: [],
        characters: approved.characters.map((character) => ({ id: character.id, name: character.name, role: character.role, description: character.description, relationships: character.relationships })),
        locations: approved.locations.map((location) => ({ id: location.id, name: location.name, description: location.description })),
        dialogueExcerpt: "Dialogue remains a downstream Script record.",
      };
    }
    let result;
    try {
      result = await this.engine.generate("film_bible", project);
    } finally {
      project.production.story = currentStory;
      project.artifacts.story = currentArtifact;
    }
    const artifact = result.artifact && typeof result.artifact === "object" ? result.artifact as Partial<FilmBibleArtifact> : undefined;
    const valid = artifact && typeof artifact.title === "string" && Array.isArray(artifact.worldRules) && Array.isArray(artifact.movieRules)
      ? artifact as FilmBibleArtifact
      : undefined;
    return applyGeneration(project, valid, result.provider, instruction);
  }
}

export const saveFilmBibleSection = (project: MovieProject, key: string, value: string) => {
  const bible = normalizeFilmBibleState(project, project.production.filmBible);
  if (!bible.version) throw new Error("Generate the Film Bible before editing it.");
  if (bible.sections[key] === value) return bible;
  const protectedVersion = ["APPROVED", "LOCKED", "CHANGED_AFTER_PRODUCTION"].includes(bible.status);
  if (protectedVersion) {
    writeSnapshot(bible, snapshot(bible, "MANUAL", []));
    bible.version += 1;
    bible.status = "CHANGED_AFTER_PRODUCTION";
    bible.approvedAt = undefined;
    bible.lockedAt = undefined;
  } else {
    bible.status = "EDITED";
  }
  bible.sections[key] = value;
  bible.updatedAt = now();
  writeSnapshot(bible, snapshot(bible, "MANUAL", [key], `Edited ${key}`));
  syncArtifact(project);
  setGate(project, "film_bible", "REVIEW", `Film Bible v${bible.version} contains an unapproved edit to ${key}.`);
  project.status = "awaiting_approval";
  return bible;
};

export const approveFilmBibleVersion = (project: MovieProject) => {
  const bible = normalizeFilmBibleState(project, project.production.filmBible);
  if (!bible.version || !["DRAFT", "EDITED", "CHANGED_AFTER_PRODUCTION"].includes(bible.status)) throw new Error("Generate or edit a Film Bible draft before approval.");
  bible.status = "APPROVED";
  bible.approvedVersion = bible.version;
  bible.approvedAt = now();
  bible.updatedAt = bible.approvedAt;
  writeSnapshot(bible, snapshot(bible, bible.history.find((item) => item.version === bible.version)?.source ?? "MANUAL", bible.history.find((item) => item.version === bible.version)?.changedSections ?? []));
  setGate(project, "film_bible", "APPROVED", `Film Bible v${bible.version} is the approved canonical source.`);
  setGate(project, "characters", "READY", "Character analysis may consume the approved Story and Film Bible contracts.");
  project.production.currentStage = "characters";
  project.status = "draft";
  return bible;
};

export const lockFilmBibleVersion = (project: MovieProject) => {
  const bible = normalizeFilmBibleState(project, project.production.filmBible);
  if (bible.status !== "APPROVED") throw new Error("Approve the Film Bible before locking it.");
  bible.status = "LOCKED";
  bible.lockedVersion = bible.version;
  bible.lockedAt = now();
  bible.updatedAt = bible.lockedAt;
  writeSnapshot(bible, snapshot(bible, bible.history.find((item) => item.version === bible.version)?.source ?? "MANUAL", bible.history.find((item) => item.version === bible.version)?.changedSections ?? []));
  setGate(project, "film_bible", "LOCKED", `Film Bible v${bible.version} is locked as canonical world law.`);
  return bible;
};

export const normalizeFilmBibleState = (project: MovieProject, value?: Partial<ProductionFilmBible>): ProductionFilmBible => {
  const timestamp = value?.createdAt ?? value?.approvedAt ?? now();
  const bible: ProductionFilmBible = {
    ...createEmptyFilmBibleState(timestamp),
    ...value,
    filmBibleId: value?.filmBibleId ?? randomUUID(),
    sections: { ...(value?.sections ?? {}) },
    history: Array.isArray(value?.history) ? value.history.map((item) => ({ ...item, sections: { ...item.sections }, changedSections: [...(item.changedSections ?? [])] })) : [],
    createdAt: timestamp,
    updatedAt: value?.updatedAt ?? value?.approvedAt ?? timestamp,
  };
  if (bible.version > 0 && !bible.history.length) {
    writeSnapshot(bible, {
      version: bible.version,
      status: bible.status,
      source: "MIGRATION",
      sections: structuredClone(bible.sections),
      changedSections: Object.keys(bible.sections),
      sourceContext: bible.sourceContext,
      createdAt: bible.updatedAt,
      approvedAt: bible.approvedAt,
      lockedAt: bible.lockedAt,
    });
  }
  project.production.filmBible = bible;
  return bible;
};
