import { randomUUID } from "node:crypto";
import type {
  MovieProject,
  ProjectConfig,
  StoryAiProposal,
  StoryArtifact,
  StoryAssetCandidate,
  StoryChangeSource,
  StoryCharacterArc,
  StoryCharacterCandidate,
  StoryDevelopmentState,
  StoryDownstreamContracts,
  StoryEvent,
  StoryGenerationContext,
  StoryLocationCandidate,
  StorySection,
  StorySectionId,
  StorySequenceBreakdownEntry,
  StoryStatus,
  StoryTimelineEvent,
  StoryVersionRecord,
} from "../src/types.js";
import { STORY_SECTION_IDS } from "../src/types.js";
import type { PhaseEngine } from "./engine.js";

const now = () => new Date().toISOString();
const pad = (value: number) => String(value).padStart(2, "0");
const sectionTitles: Record<StorySectionId, string> = {
  opening: "Opening",
  beginning: "Beginning",
  development: "Development",
  middle: "Middle",
  escalation: "Escalation",
  climax: "Climax",
  ending: "Ending",
};
const sectionEmotions: Record<StorySectionId, string> = {
  opening: "Curiosity → unease",
  beginning: "Purpose → uncertainty",
  development: "Suspicion → pressure",
  middle: "Discovery → dread",
  escalation: "Fear → determination",
  climax: "Crisis → choice",
  ending: "Consequence → transformation",
};
const sectionConflicts: Record<StorySectionId, string> = {
  opening: "The ordinary world contains an unsettling contradiction.",
  beginning: "The practical goal collides with the first obstacle.",
  development: "New evidence makes the original plan unsafe.",
  middle: "The central truth changes what the protagonist believes.",
  escalation: "Pressure removes the safe choices.",
  climax: "The protagonist must make an irreversible decision.",
  ending: "The new world state reveals the cost of the choice.",
};

const formatTime = (seconds: number) => {
  const value = Math.max(0, Math.round(seconds));
  return `${pad(Math.floor(value / 60))}:${pad(value % 60)}`;
};

const identifier = (value: string, prefix: string) => `${prefix}_${value
  .normalize("NFKD")
  .replace(/[^a-zA-Z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .toUpperCase()
  .slice(0, 28) || "ITEM"}`;

const cleanText = (value: string) => value.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
const sentences = (value: string) => cleanText(value).split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);

const distributeText = (value: string) => {
  const paragraphs = cleanText(value).split(/\n{2,}/).map((item) => item.replace(/^ACT\s+[IVX]+[^\n]*\n?/i, "").trim()).filter(Boolean);
  const units = paragraphs.length >= STORY_SECTION_IDS.length ? paragraphs : sentences(value);
  const buckets = STORY_SECTION_IDS.map(() => [] as string[]);
  units.forEach((unit, index) => buckets[Math.min(STORY_SECTION_IDS.length - 1, Math.floor((index * STORY_SECTION_IDS.length) / Math.max(1, units.length)))]!.push(unit));
  return Object.fromEntries(STORY_SECTION_IDS.map((id, index) => [id, buckets[index]!.join("\n\n")])) as Record<StorySectionId, string>;
};

const fallbackArtifact = (project: MovieProject, input: string): StoryArtifact => {
  const premise = cleanText(input) || cleanText(project.idea);
  const protagonist = premise.match(/\b([A-Z][a-z]{2,})\s+(?:finds|discovers|must|enters|returns|travels|crosses)\b/)?.[1] ?? "The Protagonist";
  const locationName = /desert|camp|uae|gulf/i.test(premise) ? "Desert Camp" : project.era;
  return {
    logline: `${protagonist} pursues a practical goal inside ${premise.replace(/[.!?]+$/, "").toLowerCase()}, then must face the truth that the journey exposes.`,
    synopsis: `${protagonist} enters a world shaped by ${project.era}. A practical need becomes a test of knowledge, relationships, and courage. Each escalation changes what can be safely believed until one irreversible choice creates a permanent new state.`,
    fullStory: [
      `${premise} The opening image establishes the protagonist's practical goal and quietly reveals the emotional risk of failure.`,
      `${protagonist} crosses the first threshold. The environment and the people within it withhold an ordinary explanation, forcing closer observation.`,
      `Evidence accumulates. A relationship becomes necessary but difficult, an important object changes hands, and the original plan becomes unsafe.`,
      `At the midpoint, ${protagonist} learns the hidden rule behind the central conflict. Knowledge solves one question while creating a more dangerous choice.`,
      `The pressure intensifies across the world, relationships, and physical state. Retreat now carries a cost equal to continuing.`,
      `${protagonist} makes an irreversible decision that resolves the dramatic question through visible action rather than explanation.`,
      `The final image echoes the opening but shows the permanent cost, the changed relationship, and the new emotional state.`,
    ].join("\n\n"),
    acts: [
      { title: "Beginning", summary: "The goal, world, and first contradiction are established." },
      { title: "Middle", summary: "The hidden rule is revealed and pressure removes safe choices." },
      { title: "Ending", summary: "An irreversible choice creates the final world and emotional state." },
    ],
    characters: [{ id: identifier(protagonist, "CHAR"), name: protagonist, role: "Lead", description: "The central point of view whose choices drive every narrative state change.", relationships: ["Connected to the central conflict"] }],
    locations: [{ id: identifier(locationName, "LOC"), name: locationName, description: `${project.era}; the principal story world and continuity geography.` }],
    dialogueExcerpt: project.dialogueEnabled ? `${protagonist.toUpperCase()}\nWe cannot leave without knowing what happened.` : "Dialogue is disabled for this project.",
  };
};

const isStoryArtifact = (value: unknown): value is StoryArtifact => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<StoryArtifact>;
  return typeof item.logline === "string" && typeof item.synopsis === "string" && typeof item.fullStory === "string" && Array.isArray(item.characters) && Array.isArray(item.locations);
};

export const createEmptyStoryState = (config: ProjectConfig): StoryDevelopmentState => {
  const createdAt = now();
  return {
    storyId: randomUUID(),
    mode: "AI",
    input: config.idea,
    title: config.movieTitle ?? config.title,
    premise: config.idea,
    logline: "",
    summary: "",
    content: "",
    sections: [],
    beats: [],
    timeline: [],
    characters: [],
    characterArcs: [],
    locations: [],
    objects: [],
    events: [],
    sequenceBreakdown: [],
    historicalRequirements: [],
    emotionalProgression: [],
    status: "DRAFT",
    version: 0,
    history: [],
    impactDecisions: [],
    createdAt,
    updatedAt: createdAt,
  };
};

export const buildStoryGenerationContext = (project: MovieProject): StoryGenerationContext => {
  const dna = project.production.movieDna;
  if (dna.status !== "LOCKED") throw new Error("Movie DNA must be locked before Story generation.");
  const selections = Object.fromEntries(Object.entries(dna.selections).map(([key, selection]) => [key, {
    label: selection.label,
    promptDescription: selection.promptDescription ?? selection.technicalDescription,
    technicalValues: selection.technicalValues ?? {},
  }]));
  return {
    projectSettings: {
      movieTitle: project.movieTitle ?? project.title,
      runtimeMinutes: project.runtimeMinutes,
      sequenceDurationSeconds: project.sequenceDurationSeconds,
      sequenceCount: project.sequenceCount,
      genreCombination: dna.selections.genre?.label ?? project.genre,
      historicalPeriod: dna.selections.historicalPeriod?.label ?? project.era,
      filmLanguage: project.filmLanguage,
      dialogueLanguage: project.dialogueLanguage,
      audienceRating: project.audienceRating,
      narrationEnabled: project.narrationEnabled,
      dialogueEnabled: project.dialogueEnabled,
      musicEnabled: project.musicEnabled,
      subtitlesEnabled: project.subtitlesEnabled,
    },
    movieDna: {
      version: dna.version,
      locked: true,
      selections,
      masterFrameReferenceId: dna.masterFrameReferenceId,
      tonalDirection: Object.values(dna.selections).map((selection) => selection.promptDescription ?? selection.technicalDescription).filter(Boolean).join(" "),
    },
    requestedAt: now(),
  };
};

const sectionForRatio = (ratio: number): StorySectionId => {
  if (ratio < .09) return "opening";
  if (ratio < .25) return "beginning";
  if (ratio < .41) return "development";
  if (ratio < .57) return "middle";
  if (ratio < .73) return "escalation";
  if (ratio < .89) return "climax";
  return "ending";
};

const buildSections = (project: MovieProject, artifact: StoryArtifact, mode: StoryDevelopmentState["mode"], input: string): StorySection[] => {
  const totalSeconds = Math.round(project.runtimeMinutes * 60);
  const distributed = distributeText(mode === "AI" ? artifact.fullStory : input);
  if (mode === "AI") {
    const fallback = distributeText(fallbackArtifact(project, input).fullStory);
    STORY_SECTION_IDS.forEach((id) => { if (!distributed[id]) distributed[id] = fallback[id]; });
  }
  const duration = Math.max(1, project.sequenceDurationSeconds);
  const ratios = [0, 1 / 12, 3 / 12, 5 / 12, 7 / 12, 9 / 12, 11 / 12, 1];
  const boundaries = ratios.map((ratio, index) => index === ratios.length - 1 ? totalSeconds : Math.min(totalSeconds, Math.round((totalSeconds * ratio) / duration) * duration));
  return STORY_SECTION_IDS.map((id, index) => ({
    id,
    title: sectionTitles[id],
    content: distributed[id],
    order: index + 1,
    approximateStartSeconds: boundaries[index]!,
    approximateEndSeconds: boundaries[index + 1]!,
  }));
};

const buildCharacters = (artifact: StoryArtifact, sequenceCount: number): StoryCharacterCandidate[] => {
  const unique = new Map<string, StoryArtifact["characters"][number]>();
  artifact.characters.forEach((character) => unique.set(character.id || identifier(character.name, "CHAR"), character));
  return [...unique.entries()].map(([id, character], index) => ({
    id,
    name: character.name,
    role: character.role,
    importance: index === 0 ? "MAIN" : "SUPPORTING",
    description: character.description,
    goal: index === 0 ? "Resolve the central practical need without losing personal integrity." : "Fulfil the story function represented by the relationship.",
    motivation: index === 0 ? "Protect what matters while understanding the hidden truth." : "Advance or resist the protagonist's transformation.",
    conflict: index === 0 ? "The safest immediate action conflicts with the necessary moral choice." : "Their need and the protagonist's goal cannot remain aligned.",
    fear: index === 0 ? "Losing control before understanding the danger." : "The truth will make the current relationship impossible.",
    relationships: character.relationships ?? [],
    relatedBeatIds: Array.from({ length: sequenceCount }, (_, beat) => `BEAT_${pad(beat + 1)}`),
    relatedSequenceIds: Array.from({ length: sequenceCount }, (_, sequence) => `SEQ_${pad(sequence + 1)}`),
    suggestedStates: ["Opening state", "Midpoint knowledge state", "Climax decision state", "Ending state"],
    referencePriority: index === 0 ? "REQUIRED" : "HIGH",
  }));
};

const buildLocations = (artifact: StoryArtifact, project: MovieProject, sequenceCount: number): StoryLocationCandidate[] => artifact.locations.map((location, index) => ({
  id: location.id || identifier(location.name, "LOC"),
  name: location.name,
  description: location.description,
  historicalRequirements: [`Preserve ${project.era} architecture, materials, technology, geography, and cultural details.`],
  relatedBeatIds: Array.from({ length: sequenceCount }, (_, beat) => `BEAT_${pad(beat + 1)}`).filter((_, beat) => beat % Math.max(1, artifact.locations.length) === index),
  relatedSequenceIds: Array.from({ length: sequenceCount }, (_, sequence) => `SEQ_${pad(sequence + 1)}`).filter((_, sequence) => sequence % Math.max(1, artifact.locations.length) === index),
}));

const extractAssets = (project: MovieProject, source: string, characters: StoryCharacterCandidate[], locations: StoryLocationCandidate[], sequenceCount: number): StoryAssetCandidate[] => {
  const sequences = Array.from({ length: sequenceCount }, (_, index) => `SEQ_${pad(index + 1)}`);
  const beats = Array.from({ length: sequenceCount }, (_, index) => `BEAT_${pad(index + 1)}`);
  const candidates: StoryAssetCandidate[] = [
    ...characters.map((character) => ({ id: character.id, name: character.name, category: "character" as const, description: character.description, importance: "CRITICAL" as const, referencePriority: character.referencePriority === "NORMAL" ? "NORMAL" as const : character.referencePriority, relatedBeatIds: character.relatedBeatIds, relatedSequenceIds: character.relatedSequenceIds })),
    ...locations.map((location) => ({ id: location.id, name: location.name, category: "location" as const, description: location.description, importance: "CRITICAL" as const, referencePriority: "HIGH" as const, relatedBeatIds: location.relatedBeatIds, relatedSequenceIds: location.relatedSequenceIds })),
  ];
  const rules: Array<[RegExp, string, StoryAssetCandidate["category"], StoryAssetCandidate["importance"], StoryAssetCandidate["referencePriority"]]> = [
    [/\bcamel\b/i, "Camel", "animal", "CRITICAL", "REQUIRED"],
    [/\b(jinn|creature|monster|presence)\b/i, "Story Creature", "creature", "CRITICAL", "HIGH"],
    [/\b(knife|sword|rifle|weapon)\b/i, "Story Weapon", "weapon", "CRITICAL", "HIGH"],
    [/\b(dallah|coffee pot|cup|key|letter|book|object)\b/i, "Important Story Object", "prop", "CRITICAL", "HIGH"],
    [/\b(car|truck|boat|vehicle)\b/i, "Story Vehicle", "vehicle", "SUPPORTING", "HIGH"],
  ];
  rules.forEach(([pattern, name, category, importance, referencePriority]) => {
    if (pattern.test(source)) candidates.push({ id: identifier(name, category.toUpperCase()), name, category, description: `Extracted from the structured Story as a ${category} continuity requirement.`, importance, referencePriority, relatedBeatIds: beats, relatedSequenceIds: sequences });
  });
  candidates.push({ id: "ENV_STORY_WORLD", name: `${project.era} Environment`, category: "environment", description: "Weather, terrain, light direction, atmosphere, ground disturbance, and environment changes described by the Story.", importance: "ATMOSPHERIC", referencePriority: "NORMAL", relatedBeatIds: beats, relatedSequenceIds: sequences });
  if (!/contemporary/i.test(project.era)) candidates.push({ id: "COSTUME_PERIOD_001", name: `${project.era} Costumes`, category: "costume", description: "Period-correct wardrobe, fabric, wear, accessories, and state changes.", importance: "SUPPORTING", referencePriority: "HIGH", relatedBeatIds: beats, relatedSequenceIds: sequences });
  return [...new Map(candidates.map((candidate) => [candidate.id, candidate])).values()];
};

const buildStructure = (project: MovieProject, sections: StorySection[], characters: StoryCharacterCandidate[], locations: StoryLocationCandidate[], objects: StoryAssetCandidate[]) => {
  const totalSeconds = Math.round(project.runtimeMinutes * 60);
  const duration = Math.max(1, project.sequenceDurationSeconds);
  const count = Math.max(1, Math.min(120, Math.ceil(totalSeconds / duration)));
  const leadIds = characters.slice(0, 2).map((character) => character.id);
  const beats = [] as StoryDevelopmentState["beats"];
  const events = [] as StoryEvent[];
  const sequenceBreakdown = [] as StorySequenceBreakdownEntry[];
  const timeline = [] as StoryTimelineEvent[];
  for (let index = 0; index < count; index += 1) {
    const number = index + 1;
    const startSeconds = index * duration;
    const endSeconds = Math.min(totalSeconds, (index + 1) * duration);
    const ratio = ((startSeconds + endSeconds) / 2) / Math.max(1, totalSeconds);
    const sectionId = sectionForRatio(ratio);
    const section = sections.find((item) => item.id === sectionId)!;
    const sequenceId = `SEQ_${pad(number)}`;
    const beatId = `BEAT_${pad(number)}`;
    const eventId = `EVENT_${pad(number)}`;
    const location = locations[index % Math.max(1, locations.length)];
    const assetIds = objects.filter((asset) => asset.category !== "character" && asset.category !== "location").slice(0, 3).map((asset) => asset.id);
    const description = section.content || `${section.title} story material remains to be written.`;
    events.push({ id: eventId, name: `${section.title} event ${number}`, description: description.slice(0, 260), sectionId, approximateTimeSeconds: startSeconds, characterIds: leadIds, locationIds: location ? [location.id] : [], objectIds: assetIds });
    beats.push({ id: beatId, name: `${section.title} · ${pad(number)}`, description: description.slice(0, 260), storyPurpose: sectionConflicts[sectionId], approximateTimeSeconds: startSeconds, sectionId, characterIds: leadIds, locationIds: location ? [location.id] : [], importantAssetIds: assetIds, emotion: sectionEmotions[sectionId], conflict: sectionConflicts[sectionId], eventIds: [eventId], relatedSequenceIds: [sequenceId] });
    sequenceBreakdown.push({ id: sequenceId, sequenceNumber: number, timeRange: `${formatTime(startSeconds)}–${formatTime(endSeconds)}`, startSeconds, endSeconds, storyPurpose: sectionConflicts[sectionId], events: [description.slice(0, 260)], characterIds: leadIds, locationId: location?.id ?? "LOCATION_TBD", emotion: sectionEmotions[sectionId], conflict: sectionConflicts[sectionId], importantAssetIds: assetIds, requiredEndingCondition: `End with a visible ${section.title.toLowerCase()} state change that Sequence ${pad(number + 1)} can inherit.`, relatedBeatIds: [beatId] });
    timeline.push({ id: `TIME_${pad(number)}`, approximateTimeSeconds: startSeconds, date: project.era, time: formatTime(startSeconds), timeOfDay: ratio < .18 ? "Opening period" : ratio > .82 ? "Ending period" : "Story time", weather: project.production.movieDna.selections.environment?.label ?? "Continuity-controlled weather", locationId: location?.id ?? "LOCATION_TBD", characterIds: leadIds, characterKnowledge: Object.fromEntries(leadIds.map((id) => [id, `Knowledge state after ${beatId}`])), relationshipState: Object.fromEntries(leadIds.map((id) => [id, sectionEmotions[sectionId]])), events: [eventId], objectsAcquired: index === Math.floor(count / 3) ? assetIds.slice(0, 1) : [], objectsLost: index === Math.floor((count * 2) / 3) ? assetIds.slice(0, 1) : [], injuries: ratio > .72 ? ["Climax physical state must be tracked"] : [], damage: ratio > .56 ? ["Wardrobe and environment damage may accumulate"] : [], environmentChanges: [`${section.title} environment state at ${formatTime(startSeconds)}`], relatedSequenceIds: [sequenceId] });
  }
  return { beats, events, sequenceBreakdown, timeline };
};

const buildCharacterArcs = (characters: StoryCharacterCandidate[], beats: StoryDevelopmentState["beats"]): StoryCharacterArc[] => characters.map((character, index) => ({
  characterId: character.id,
  name: character.name,
  role: character.role,
  startingEmotionalState: index === 0 ? "Guarded and practical" : "Committed to the current relationship state",
  goal: character.goal,
  motivation: character.motivation,
  conflict: character.conflict,
  fear: character.fear,
  relationships: character.relationships,
  majorDecisions: beats.filter((_, beat) => beat % Math.max(1, Math.ceil(beats.length / 3)) === 0).map((beat) => beat.description),
  majorChanges: ["Opening belief is challenged", "Midpoint knowledge changes the goal", "Climax choice creates the ending state"],
  endingState: index === 0 ? "Changed by the irreversible choice; the practical and emotional goals are reconciled." : "Relationship and knowledge state updated by the protagonist's decision.",
  relatedBeatIds: character.relatedBeatIds,
  relatedSequenceIds: character.relatedSequenceIds,
}));

const readableContent = (sections: StorySection[]) => sections.filter((section) => section.content.trim()).map((section) => `${section.title.toUpperCase()}\n${section.content.trim()}`).join("\n\n");

const buildContracts = (project: MovieProject, story: StoryDevelopmentState): StoryDownstreamContracts => {
  const context = story.generationContext ?? buildStoryGenerationContext(project);
  const worldRules = [
    "Movie DNA controls visual and tonal direction; Story controls narrative cause and effect.",
    "Character knowledge, relationships, possessions, injuries, damage, and environment states may only advance through stored timeline events.",
    "Approved or locked production records are never overwritten by a Story draft.",
  ];
  return {
    filmBible: { approvedStoryVersion: story.approvedVersion, movieDnaVersion: story.movieDnaVersionUsed ?? project.production.movieDna.version, projectSettings: context.projectSettings, characterCandidates: structuredClone(story.characters), locations: structuredClone(story.locations), objects: structuredClone(story.objects), worldRules, timeline: structuredClone(story.timeline), historicalConstraints: [...story.historicalRequirements], narrativeRules: ["Story sections and beats are the narrative source of truth.", "Sequence suggestions are planning data, not production prompts."] },
    characterAnalysis: { storyVersion: story.approvedVersion ?? story.version, candidates: structuredClone(story.characters) },
    assetAnalysis: { storyVersion: story.approvedVersion ?? story.version, candidates: structuredClone(story.objects) },
    script: { storyVersion: story.approvedVersion ?? story.version, sections: structuredClone(story.sections), beats: structuredClone(story.beats), sequenceBreakdown: structuredClone(story.sequenceBreakdown) },
  };
};

const snapshot = (story: StoryDevelopmentState, changeSource: StoryChangeSource, instruction: string | undefined, affectedSectionIds: StorySectionId[]): StoryVersionRecord => ({
  version: story.version,
  storyId: story.storyId,
  title: story.title,
  premise: story.premise,
  logline: story.logline,
  summary: story.summary,
  content: story.content,
  sections: structuredClone(story.sections),
  beats: structuredClone(story.beats),
  timeline: structuredClone(story.timeline),
  characters: structuredClone(story.characters),
  characterArcs: structuredClone(story.characterArcs),
  locations: structuredClone(story.locations),
  objects: structuredClone(story.objects),
  events: structuredClone(story.events),
  sequenceBreakdown: structuredClone(story.sequenceBreakdown),
  status: story.status,
  changeSource,
  instruction,
  affectedSectionIds,
  movieDnaVersionUsed: story.movieDnaVersionUsed,
  approved: story.approvedVersion === story.version,
  locked: story.lockedVersion === story.version,
  createdAt: now(),
});

const updateArtifact = (project: MovieProject) => {
  const story = project.production.story;
  project.artifacts.story = {
    logline: story.logline,
    synopsis: story.summary,
    fullStory: story.content,
    acts: [
      { title: "Beginning", summary: story.sections.filter((section) => ["opening", "beginning"].includes(section.id)).map((section) => section.content).join(" ") },
      { title: "Middle", summary: story.sections.filter((section) => ["development", "middle", "escalation"].includes(section.id)).map((section) => section.content).join(" ") },
      { title: "Ending", summary: story.sections.filter((section) => ["climax", "ending"].includes(section.id)).map((section) => section.content).join(" ") },
    ],
    characters: story.characters.map((character) => ({ id: character.id, name: character.name, role: character.role, description: character.description, relationships: character.relationships })),
    locations: story.locations.map((location) => ({ id: location.id, name: location.name, description: location.description })),
    dialogueExcerpt: project.dialogueEnabled ? "Dialogue remains controlled by the later structured Script and Dialogue systems." : "Dialogue is disabled for this project.",
  } satisfies StoryArtifact;
};

const setStoryGate = (project: MovieProject, status: "READY" | "REVIEW" | "APPROVED" | "LOCKED", note: string) => {
  const gate = project.production.gates.find((item) => item.stage === "story");
  if (gate) Object.assign(gate, { status, note, updatedAt: now() });
  project.production.updatedAt = now();
};

export const commitStoryArtifact = (project: MovieProject, artifactInput: unknown, input: string, mode: StoryDevelopmentState["mode"], provider: string, source: StoryChangeSource = mode === "AI" ? "AI" : mode) => {
  const artifact = isStoryArtifact(artifactInput) ? artifactInput : fallbackArtifact(project, input);
  const story = project.production.story;
  const generationContext = buildStoryGenerationContext(project);
  const totalSeconds = Math.round(project.runtimeMinutes * 60);
  const sequenceCount = Math.max(1, Math.min(120, Math.ceil(totalSeconds / Math.max(1, project.sequenceDurationSeconds))));
  const sections = buildSections(project, artifact, mode, input);
  const characters = buildCharacters(artifact, sequenceCount);
  const locations = buildLocations(artifact, project, sequenceCount);
  const objects = extractAssets(project, `${input}\n${artifact.fullStory}`, characters, locations, sequenceCount);
  const structure = buildStructure(project, sections, characters, locations, objects);
  story.mode = mode;
  story.input = cleanText(input);
  story.title = project.movieTitle ?? project.title;
  story.premise = cleanText(input);
  story.logline = cleanText(artifact.logline);
  story.summary = cleanText(artifact.synopsis);
  story.sections = sections;
  story.beats = structure.beats;
  story.timeline = structure.timeline;
  story.characters = characters;
  story.characterArcs = buildCharacterArcs(characters, structure.beats);
  story.locations = locations;
  story.objects = objects;
  story.events = structure.events;
  story.sequenceBreakdown = structure.sequenceBreakdown;
  story.historicalRequirements = [`Preserve ${project.era} technology, architecture, materials, clothing, language, and cultural behavior.`, `Dialogue language: ${project.dialogueLanguage}. Film language: ${project.filmLanguage}.`];
  story.emotionalProgression = STORY_SECTION_IDS.map((id) => `${sectionTitles[id]}: ${sectionEmotions[id]}`);
  story.content = readableContent(sections);
  story.status = mode === "AI" ? "GENERATED" : "EDITED";
  story.version += 1;
  story.pendingProposal = undefined;
  story.generationContext = generationContext;
  story.generationProvider = provider;
  story.movieDnaVersionUsed = generationContext.movieDna.version;
  story.updatedAt = now();
  story.contracts = buildContracts(project, story);
  story.history.push(snapshot(story, source, source === "REGENERATE" ? "Regenerate Story" : undefined, [...STORY_SECTION_IDS]));
  updateArtifact(project);
  setStoryGate(project, "REVIEW", `Story v${story.version} created from ${mode === "AI" ? provider : mode.toLowerCase()} and is waiting for review.`);
  project.production.currentStage = "story";
  project.status = "awaiting_approval";
  return story;
};

export const generateStoryOffline = (project: MovieProject, input?: string, mode: StoryDevelopmentState["mode"] = "AI", source?: StoryChangeSource) => {
  if (project.production.movieDna.status !== "LOCKED") throw new Error("Movie DNA must be locked before Story generation.");
  const value = cleanText(input ?? project.production.story.input ?? project.idea);
  return commitStoryArtifact(project, fallbackArtifact(project, value), value, mode, mode === "AI" ? "Built-in Studio Intelligence" : mode === "PASTE" ? "Pasted story" : "Manual editor", source ?? (mode === "AI" ? "AI" : mode));
};

export class StoryBrain {
  constructor(private readonly engine: PhaseEngine) {}

  async generate(project: MovieProject, input?: string, mode: StoryDevelopmentState["mode"] = "AI", source: StoryChangeSource = mode === "AI" ? "AI" : mode) {
    if (project.production.movieDna.status !== "LOCKED") throw new Error("Movie DNA must be locked before Story generation.");
    const value = cleanText(input ?? project.production.story.input ?? project.idea);
    if (mode !== "AI") return generateStoryOffline(project, value, mode, source);
    project.production.story.generationContext = buildStoryGenerationContext(project);
    const originalIdea = project.idea;
    project.idea = value;
    try {
      const result = await this.engine.generate("story", project);
      return commitStoryArtifact(project, result.artifact, value, mode, result.provider, source);
    } finally {
      project.idea = originalIdea;
    }
  }
}

const rebuildAfterSectionChange = (project: MovieProject) => {
  const story = project.production.story;
  const structure = buildStructure(project, story.sections, story.characters, story.locations, story.objects);
  story.beats = structure.beats;
  story.timeline = structure.timeline;
  story.events = structure.events;
  story.sequenceBreakdown = structure.sequenceBreakdown;
  story.characterArcs = buildCharacterArcs(story.characters, story.beats);
  story.content = readableContent(story.sections);
  story.summary = story.sections.map((section) => section.content).filter(Boolean).join(" ").slice(0, 1_800);
  story.contracts = buildContracts(project, story);
  updateArtifact(project);
};

export const saveStoryEdits = (project: MovieProject, updates: Array<{ id: StorySectionId; content: string }>, options: { confirmedImpact?: boolean; impactAction?: "APPLY" | "FUTURE_ONLY"; instruction?: string } = {}) => {
  const story = project.production.story;
  const protectedStory = story.status === "APPROVED" || story.status === "LOCKED";
  if (protectedStory && !options.confirmedImpact) throw new Error("Review affected production items before changing an approved or locked Story.");
  const changed = updates.filter((update) => story.sections.find((section) => section.id === update.id)?.content !== cleanText(update.content));
  if (!changed.length) return story;
  changed.forEach((update) => {
    const section = story.sections.find((item) => item.id === update.id);
    if (section) section.content = cleanText(update.content);
  });
  story.version += 1;
  story.status = protectedStory || story.lockedVersion !== undefined ? "CHANGED_AFTER_PRODUCTION" : "EDITED";
  story.updatedAt = now();
  rebuildAfterSectionChange(project);
  const affected = changed.map((update) => update.id);
  story.history.push(snapshot(story, "MANUAL", options.instruction ?? "Manual Story edit", affected));
  if (protectedStory && options.impactAction) story.impactDecisions.push({ id: randomUUID(), action: options.impactAction, affectedItemIds: [], createdAt: now() });
  setStoryGate(project, "REVIEW", protectedStory ? "Protected Story has a new draft. Approved and locked versions remain unchanged pending explicit approval." : `Story v${story.version} manual edits saved for review.`);
  project.status = "awaiting_approval";
  return story;
};

const affectedSectionsForInstruction = (instruction: string): StorySectionId[] => {
  const value = instruction.toLowerCase();
  const found = new Set<StorySectionId>();
  if (/opening|first scene|start/.test(value)) found.add("opening");
  if (/beginning|earlier|early/.test(value)) found.add("beginning");
  if (/develop|motivation|suspicious/.test(value)) found.add("development");
  if (/middle|midpoint|reveal/.test(value)) found.add("middle");
  if (/escalat|chase|tension/.test(value)) found.add("escalation");
  if (/climax|confront|final choice/.test(value)) found.add("climax");
  if (/ending|end |final image|resolution/.test(value)) found.add("ending");
  if (/dialogue/.test(value) && !found.size) ["development", "middle", "escalation"].forEach((id) => found.add(id as StorySectionId));
  if (/remove character|entire story|throughout|every section/.test(value)) STORY_SECTION_IDS.forEach((id) => found.add(id));
  if (!found.size) ["development", "middle"].forEach((id) => found.add(id as StorySectionId));
  if (/keep (the )?ending unchanged|do not change (the )?ending|ending unchanged/.test(value)) found.delete("ending");
  return [...found];
};

const proposedText = (section: StorySection, instruction: string, variant: number) => {
  const value = instruction.toLowerCase();
  let text = section.content;
  if (/scarier|horror|fright|dread/.test(value)) text = `${text} A sound arrives without a visible source, and the familiar space begins to feel like a trap that has already closed.`;
  else if (/extend.*chase|chase/.test(value)) text = `${text} The pursuit crosses one more physical threshold, forcing a visible loss before escape remains possible.`;
  else if (/more dialogue|add dialogue/.test(value)) text = `${text}\n\n“Tell me what you know,” the protagonist says. The answer changes the danger without explaining it away.`;
  else if (/less dialogue|reduce dialogue/.test(value)) text = text.replace(/[“"][^”"]*[”"]/g, "").replace(/\s{2,}/g, " ").trim();
  else if (/change.*ending|ending/.test(value)) text = `The final decision resolves the immediate danger but preserves its moral cost. The last image returns to the opening composition with one irreversible difference, proving that the protagonist cannot return unchanged.`;
  else if (/suspicious|mistrust/.test(value)) text = `${text} The protagonist notices a precise inconsistency and begins testing every answer instead of accepting the apparent help.`;
  else if (/move.*reveal.*later/.test(value)) text = `${text} The evidence remains incomplete here; the decisive meaning is withheld until the next controlled beat.`;
  else text = `${text} ${instruction.replace(/[.!?]+$/, "")}, expressed through a concrete action and a visible change in story state.`;
  return variant > 1 ? `${text} The alternate pass keeps the same scope while sharpening the cause-and-effect transition.` : text;
};

export const proposeStoryModification = (project: MovieProject, instruction: string, variant = 1): StoryAiProposal => {
  const story = project.production.story;
  if (!story.sections.length) throw new Error("Create a Story before requesting an AI modification.");
  const affectedSectionIds = affectedSectionsForInstruction(instruction);
  const changes = affectedSectionIds.map((sectionId) => {
    const section = story.sections.find((item) => item.id === sectionId)!;
    return { sectionId, currentText: section.content, proposedText: proposedText(section, instruction, variant) };
  });
  const affectedBeats = story.beats.filter((beat) => affectedSectionIds.includes(beat.sectionId));
  const proposal: StoryAiProposal = {
    id: randomUUID(),
    instruction: cleanText(instruction),
    createdAt: now(),
    variant,
    changes,
    affectedSectionIds,
    affectedBeatIds: affectedBeats.map((beat) => beat.id),
    affectedCharacterIds: [...new Set(affectedBeats.flatMap((beat) => beat.characterIds))],
    affectedSequenceIds: [...new Set(affectedBeats.flatMap((beat) => beat.relatedSequenceIds))],
    impactLevel: affectedSectionIds.includes("ending") || affectedSectionIds.length > 3 ? "HIGH" : affectedSectionIds.length > 1 ? "MEDIUM" : "LOW",
  };
  story.pendingProposal = proposal;
  story.updatedAt = now();
  return proposal;
};

export const rejectStoryProposal = (project: MovieProject) => {
  const proposal = project.production.story.pendingProposal;
  if (!proposal) return project.production.story;
  project.production.story.impactDecisions.push({ id: randomUUID(), proposalId: proposal.id, action: "CANCEL", affectedItemIds: [], createdAt: now() });
  project.production.story.pendingProposal = undefined;
  project.production.story.updatedAt = now();
  return project.production.story;
};

export const applyStoryProposal = (project: MovieProject, action: "APPLY" | "FUTURE_ONLY", affectedItemIds: string[] = []) => {
  const story = project.production.story;
  const proposal = story.pendingProposal;
  if (!proposal) throw new Error("Analyze an AI Story change before applying it.");
  proposal.changes.forEach((change) => {
    const section = story.sections.find((item) => item.id === change.sectionId);
    if (section) section.content = change.proposedText;
  });
  if (/remove character/i.test(proposal.instruction)) {
    const number = Number(proposal.instruction.match(/character\s*0*(\d+)/i)?.[1]);
    const removed = Number.isFinite(number) ? story.characters[number - 1] : undefined;
    if (removed) {
      story.characters = story.characters.filter((character) => character.id !== removed.id);
      story.beats.forEach((beat) => { beat.characterIds = beat.characterIds.filter((id) => id !== removed.id); });
    }
  }
  const protectedStory = story.status === "APPROVED" || story.status === "LOCKED" || story.lockedVersion !== undefined;
  story.version += 1;
  story.status = protectedStory ? "CHANGED_AFTER_PRODUCTION" : "EDITED";
  story.updatedAt = now();
  story.pendingProposal = undefined;
  rebuildAfterSectionChange(project);
  story.history.push(snapshot(story, "AI", proposal.instruction, proposal.affectedSectionIds));
  story.impactDecisions.push({ id: randomUUID(), proposalId: proposal.id, action, affectedItemIds, createdAt: now() });
  setStoryGate(project, "REVIEW", protectedStory ? `Story v${story.version} is a protected post-production draft; Story v${story.approvedVersion ?? story.lockedVersion} remains the production source.` : `Scoped AI change created Story v${story.version}.`);
  project.status = "awaiting_approval";
  return story;
};

export const approveStructuredStory = (project: MovieProject) => {
  const story = project.production.story;
  if (!["GENERATED", "EDITED", "REVIEW", "CHANGED_AFTER_PRODUCTION"].includes(story.status)) throw new Error("Generate or edit the Story before approval.");
  story.status = "APPROVED";
  story.approvedVersion = story.version;
  story.approvedAt = now();
  story.updatedAt = story.approvedAt;
  const current = story.history.find((item) => item.version === story.version);
  if (current) Object.assign(current, { status: "APPROVED" as StoryStatus, approved: true });
  story.contracts = buildContracts(project, story);
  setStoryGate(project, "APPROVED", `Story v${story.version} approved as the production narrative source.`);
  const bibleGate = project.production.gates.find((item) => item.stage === "film_bible");
  if (bibleGate) Object.assign(bibleGate, { status: "READY", updatedAt: now(), note: `Film Bible may be generated from approved structured Story v${story.version}.` });
  project.production.currentStage = "film_bible";
  project.status = "draft";
  return story;
};

export const lockStructuredStory = (project: MovieProject) => {
  const story = project.production.story;
  if (story.status !== "APPROVED") throw new Error("Approve the Story before locking it.");
  story.status = "LOCKED";
  story.lockedVersion = story.version;
  story.lockedAt = now();
  story.updatedAt = story.lockedAt;
  const current = story.history.find((item) => item.version === story.version);
  if (current) Object.assign(current, { status: "LOCKED" as StoryStatus, locked: true, approved: true });
  setStoryGate(project, "LOCKED", `Story v${story.version} locked. Later changes require Change Impact review and create a new draft.`);
  return story;
};

export const normalizeStoryDevelopmentState = (project: MovieProject, input: Partial<StoryDevelopmentState> & { history?: unknown[] }): StoryDevelopmentState => {
  const empty = createEmptyStoryState(project);
  const story = { ...empty, ...input, storyId: input.storyId || empty.storyId, impactDecisions: Array.isArray(input.impactDecisions) ? input.impactDecisions : [], createdAt: input.createdAt || project.createdAt || empty.createdAt, updatedAt: input.updatedAt || project.updatedAt || empty.updatedAt } as StoryDevelopmentState;
  if (!Array.isArray(story.sections) || !story.sections.length) {
    const legacyContent = typeof input.content === "string" ? input.content : "";
    if (legacyContent.trim()) {
      const artifact = fallbackArtifact(project, input.input || project.idea);
      artifact.fullStory = legacyContent;
      story.sections = buildSections(project, artifact, input.mode ?? "AI", legacyContent);
      const sequenceCount = Math.max(1, Math.ceil((project.runtimeMinutes * 60) / Math.max(1, project.sequenceDurationSeconds)));
      story.characters = buildCharacters(artifact, sequenceCount);
      story.locations = buildLocations(artifact, project, sequenceCount);
      story.objects = extractAssets(project, legacyContent, story.characters, story.locations, sequenceCount);
      const structure = buildStructure(project, story.sections, story.characters, story.locations, story.objects);
      story.beats = structure.beats;
      story.timeline = structure.timeline;
      story.events = structure.events;
      story.sequenceBreakdown = structure.sequenceBreakdown;
      story.characterArcs = buildCharacterArcs(story.characters, story.beats);
      story.content = readableContent(story.sections);
    }
  }
  if (story.sections.length) {
    const totalSeconds = Math.round(project.runtimeMinutes * 60);
    const duration = Math.max(1, project.sequenceDurationSeconds);
    const ratios = [0, 1 / 12, 3 / 12, 5 / 12, 7 / 12, 9 / 12, 11 / 12, 1];
    const boundaries = ratios.map((ratio, index) => index === ratios.length - 1 ? totalSeconds : Math.min(totalSeconds, Math.round((totalSeconds * ratio) / duration) * duration));
    story.sections.sort((left, right) => left.order - right.order).forEach((section, index) => {
      section.approximateStartSeconds = boundaries[index]!;
      section.approximateEndSeconds = boundaries[index + 1]!;
    });
  }
  story.history = Array.isArray(input.history) && input.history.every((entry) => entry && typeof entry === "object" && "sections" in entry)
    ? input.history as StoryVersionRecord[]
    : story.version > 0 && story.sections.length ? [snapshot(story, story.mode === "AI" ? "AI" : story.mode, "Migrated legacy Story", [...STORY_SECTION_IDS])] : [];
  if (project.production?.movieDna?.status === "LOCKED") {
    story.generationContext ??= buildStoryGenerationContext(project);
    story.movieDnaVersionUsed ??= story.generationContext.movieDna.version;
    if (story.sections.length) story.contracts = buildContracts(project, story);
  }
  return story;
};

export type StoryExportFormat = "full" | "structure" | "timeline" | "arcs" | "sequences" | "json";

export const renderStoryExport = (project: MovieProject, format: StoryExportFormat) => {
  const story = project.production.story;
  const base = (project.movieTitle ?? project.title).replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "Story";
  if (format === "json") return { filename: `${base}_Story_V${pad(story.version)}.json`, contentType: "application/json", body: `${JSON.stringify(story, null, 2)}\n` };
  const headings: Record<Exclude<StoryExportFormat, "json">, string> = { full: "Full Story", structure: "Story Structure", timeline: "Story Timeline", arcs: "Character Arcs", sequences: "Sequence Breakdown" };
  let body = `# ${project.movieTitle ?? project.title} · ${headings[format]}\n\nStory V${pad(story.version)} · ${story.status}\n\n`;
  if (format === "full") body += story.sections.map((section) => `## ${section.title}\n\n${section.content}`).join("\n\n");
  if (format === "structure") body += story.beats.map((beat) => `## ${beat.id} · ${beat.name} · ${formatTime(beat.approximateTimeSeconds)}\n\n${beat.description}\n\n- Purpose: ${beat.storyPurpose}\n- Emotion: ${beat.emotion}\n- Conflict: ${beat.conflict}\n- Sequences: ${beat.relatedSequenceIds.join(", ")}`).join("\n\n");
  if (format === "timeline") body += story.timeline.map((entry) => `## ${formatTime(entry.approximateTimeSeconds)} · ${entry.locationId}\n\n- Date/time: ${entry.date} · ${entry.time} · ${entry.timeOfDay}\n- Weather: ${entry.weather}\n- Events: ${entry.events.join(", ")}\n- Objects acquired: ${entry.objectsAcquired.join(", ") || "None"}\n- Objects lost: ${entry.objectsLost.join(", ") || "None"}\n- Injuries/damage: ${[...entry.injuries, ...entry.damage].join(", ") || "None"}`).join("\n\n");
  if (format === "arcs") body += story.characterArcs.map((arc) => `## ${arc.name} · ${arc.characterId}\n\n- Role: ${arc.role}\n- Start: ${arc.startingEmotionalState}\n- Goal: ${arc.goal}\n- Motivation: ${arc.motivation}\n- Conflict: ${arc.conflict}\n- Fear: ${arc.fear}\n- Ending: ${arc.endingState}\n- Sequences: ${arc.relatedSequenceIds.join(", ")}`).join("\n\n");
  if (format === "sequences") body += story.sequenceBreakdown.map((sequence) => `## Sequence ${pad(sequence.sequenceNumber)} · ${sequence.timeRange}\n\n${sequence.events.join(" ")}\n\n- Purpose: ${sequence.storyPurpose}\n- Emotion: ${sequence.emotion}\n- Conflict: ${sequence.conflict}\n- Characters: ${sequence.characterIds.join(", ")}\n- Location: ${sequence.locationId}\n- Required ending condition: ${sequence.requiredEndingCondition}`).join("\n\n");
  return { filename: `${base}_${headings[format].replaceAll(" ", "_")}_V${pad(story.version)}.md`, contentType: "text/markdown; charset=utf-8", body: `${body}\n` };
};
