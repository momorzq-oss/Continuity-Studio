import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { MovieProject, StoryArtifact } from "../src/types.js";
import type { PhaseEngine } from "./engine.js";
import { assessChangeImpact } from "./change-impact.js";
import { createEmptyFilmBibleState } from "./film-bible.js";
import { lockMovieDna } from "./production-workflow.js";
import { ProjectStore } from "./store.js";
import {
  applyStoryProposal,
  approveStructuredStory,
  generateStoryOffline,
  lockStructuredStory,
  proposeStoryModification,
  saveStoryEdits,
  StoryBrain,
} from "./story-brain.js";

const roots: string[] = [];

const artifact: StoryArtifact = {
  logline: "Rashid enters a silent desert camp and must break its final ritual before dawn.",
  synopsis: "A guarded courier discovers an impossible camp, mistrusts its only inhabitant, learns that the night repeats, and chooses to free them both.",
  fullStory: [
    "Rashid crosses the last road at dusk while a loose camel bell rings behind him.",
    "He finds a silent camp with hot coffee and no visible hosts.",
    "An old man knows his name and warns him not to drink from the silver dallah.",
    "The coffee reveals that the camp repeats the night it was abandoned.",
    "A presence beneath the sand chases Rashid back toward the fire as he loses the old man's knife.",
    "Rashid returns the dallah and refuses the ritual cup while dawn tears through the tent.",
    "The camp disappears, leaving two lines of footprints and a changed traveller.",
  ].join("\n\n"),
  acts: [
    { title: "Arrival", summary: "Rashid discovers the camp." },
    { title: "The loop", summary: "Rashid learns the hidden rule." },
    { title: "Refusal", summary: "Rashid breaks the ritual." },
  ],
  characters: [
    { id: "CHAR_RASHID", name: "Rashid", role: "Lead", description: "A guarded desert courier.", relationships: ["Mistrusts the Old Man", "Protects the camel"] },
    { id: "CHAR_OLD_MAN", name: "Old Man", role: "Guide", description: "The last inhabitant of the repeating camp.", relationships: ["Needs Rashid to refuse the cup"] },
  ],
  locations: [
    { id: "LOC_DESERT_ROAD", name: "Desert Road", description: "A 1965 UAE salt-flat route." },
    { id: "LOC_SILENT_CAMP", name: "Silent Camp", description: "A fixed Bedouin camp that repeats its final night." },
  ],
  dialogueExcerpt: "RASHID\nWhy do you know my name?",
};

const createProject = async () => {
  const root = path.join(tmpdir(), `continuity-story-v2-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  roots.push(root);
  const store = new ProjectStore(root);
  const project = await store.createProject({
    title: "Story V2 Test",
    movieTitle: "The Last Camp",
    idea: "Rashid discovers a silent desert camp that repeats its final night.",
    genre: "Folk Horror / Drama",
    runtimeMinutes: 6,
    sequenceCount: 12,
    sequenceDurationSeconds: 30,
    language: "Arabic / English",
    filmLanguage: "English",
    dialogueLanguage: "Gulf Arabic",
    visualStyle: "Grounded 1965 desert realism",
    mode: "phases",
    storyMode: "AI_FIRST",
    era: "1965 UAE",
    aspectRatio: "2.39:1",
    resolution: "4K UHD",
    audienceRating: "PG-13",
    targetPlatform: "Seedance",
    narrationEnabled: false,
    dialogueEnabled: true,
    musicEnabled: true,
    subtitlesEnabled: true,
    autoGenerateAssets: false,
    autoGenerateScenes: false,
    autoGenerateStoryboard: false,
  }, { kind: "builtin", label: "Built-in", available: true });
  lockMovieDna(project);
  await store.saveProject(project);
  return { root, store, project };
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Story v2 structured intelligence", () => {
  it("injects Project Setup and locked Movie DNA into Studio Intelligence and builds all shared views", async () => {
    const { project } = await createProject();
    let requestProject: MovieProject | undefined;
    const engine: PhaseEngine = {
      providerInfo: { kind: "builtin", label: "Story test brain", available: true },
      async generate(_phase, value) {
        requestProject = structuredClone(value);
        return { artifact, summary: "Story generated.", provider: "Story test brain" };
      },
    };

    await new StoryBrain(engine).generate(project, project.idea, "AI");

    const context = requestProject?.production.story.generationContext;
    expect(context?.projectSettings).toMatchObject({ movieTitle: "The Last Camp", runtimeMinutes: 6, sequenceDurationSeconds: 30, sequenceCount: 12, genreCombination: expect.any(String), historicalPeriod: expect.any(String), filmLanguage: "English", dialogueLanguage: "Gulf Arabic", audienceRating: "PG-13", narrationEnabled: false, dialogueEnabled: true, musicEnabled: true, subtitlesEnabled: true });
    expect(context?.movieDna.locked).toBe(true);
    expect(Object.keys(context?.movieDna.selections ?? {}).length).toBeGreaterThan(20);
    expect(project.production.story.movieDnaVersionUsed).toBe(project.production.movieDna.version);
    expect(project.production.story.sections.map((section) => section.id)).toEqual(["opening", "beginning", "development", "middle", "escalation", "climax", "ending"]);
    expect(project.production.story.beats).toHaveLength(12);
    expect(project.production.story.timeline).toHaveLength(12);
    expect(project.production.story.characterArcs).toHaveLength(2);
    expect(project.production.story.sequenceBreakdown).toHaveLength(12);
    expect(project.production.story.sequenceBreakdown[0]?.timeRange).toBe("00:00–00:30");
    expect(project.production.story.sequenceBreakdown[11]?.timeRange).toBe("05:30–06:00");
    expect(project.production.story.contracts?.filmBible.movieDnaVersion).toBe(project.production.movieDna.version);
    expect(project.production.story.contracts?.script.sequenceBreakdown).toHaveLength(12);
  });

  it("previews and applies a scoped AI edit without changing the protected ending", async () => {
    const { project } = await createProject();
    generateStoryOffline(project, project.idea, "AI");
    const opening = project.production.story.sections.find((section) => section.id === "opening")!.content;
    const ending = project.production.story.sections.find((section) => section.id === "ending")!.content;
    const beforeVersion = project.production.story.version;

    const proposal = proposeStoryModification(project, "Make the opening scarier but keep the ending unchanged.");
    expect(proposal.affectedSectionIds).toEqual(["opening"]);
    expect(proposal.changes[0]?.currentText).toBe(opening);
    expect(project.production.story.sections.find((section) => section.id === "opening")?.content).toBe(opening);

    applyStoryProposal(project, "APPLY", proposal.affectedBeatIds);

    expect(project.production.story.version).toBe(beforeVersion + 1);
    expect(project.production.story.sections.find((section) => section.id === "opening")?.content).not.toBe(opening);
    expect(project.production.story.sections.find((section) => section.id === "ending")?.content).toBe(ending);
    expect(project.production.story.history.at(-1)?.instruction).toBe("Make the opening scarier but keep the ending unchanged.");
    expect(project.production.story.history.at(-1)?.affectedSectionIds).toEqual(["opening"]);
  });

  it("preserves approved and locked versions when regeneration or later edits create drafts", async () => {
    const { project } = await createProject();
    generateStoryOffline(project, project.idea, "AI");
    saveStoryEdits(project, [{ id: "middle", content: `${project.production.story.sections.find((section) => section.id === "middle")?.content} A new midpoint detail.` }]);
    approveStructuredStory(project);
    const approvedVersion = project.production.story.version;
    const approvedContent = project.production.story.content;
    lockStructuredStory(project);

    expect(() => saveStoryEdits(project, [{ id: "ending", content: "A replacement ending that must not silently overwrite the lock." }])).toThrow(/review affected production/i);

    saveStoryEdits(project, [{ id: "ending", content: "A replacement ending that becomes a protected draft." }], { confirmedImpact: true, impactAction: "FUTURE_ONLY" });
    expect(project.production.story.status).toBe("CHANGED_AFTER_PRODUCTION");
    expect(project.production.story.approvedVersion).toBe(approvedVersion);
    expect(project.production.story.lockedVersion).toBe(approvedVersion);
    expect(project.production.story.history.find((record) => record.version === approvedVersion)?.content).toBe(approvedContent);
    expect(project.production.story.history.find((record) => record.version === approvedVersion)?.approved).toBe(true);
    expect(project.production.story.impactDecisions.at(-1)?.action).toBe("FUTURE_ONLY");

    generateStoryOffline(project, "Regenerate the same approved premise as a new draft.", "AI", "REGENERATE");
    expect(project.production.story.version).toBeGreaterThan(approvedVersion);
    expect(project.production.story.approvedVersion).toBe(approvedVersion);
    expect(project.production.story.history.find((record) => record.version === approvedVersion)?.content).toBe(approvedContent);
  });

  it("persists Story text, beats, timeline, arcs, versions, contracts, and impact decisions across restart", async () => {
    const { root, store, project } = await createProject();
    generateStoryOffline(project, project.idea, "AI");
    approveStructuredStory(project);
    lockStructuredStory(project);
    const proposal = proposeStoryModification(project, "Extend the chase but keep the ending unchanged.");
    applyStoryProposal(project, "FUTURE_ONLY", proposal.affectedSequenceIds);
    await store.saveProject(project);

    const restartedStore = new ProjectStore(root);
    const restored = await restartedStore.getProject(project.id);
    expect(restored.production.story.sections).toEqual(project.production.story.sections);
    expect(restored.production.story.beats).toEqual(project.production.story.beats);
    expect(restored.production.story.timeline).toEqual(project.production.story.timeline);
    expect(restored.production.story.characterArcs).toEqual(project.production.story.characterArcs);
    expect(restored.production.story.sequenceBreakdown).toEqual(project.production.story.sequenceBreakdown);
    expect(restored.production.story.history).toEqual(project.production.story.history);
    expect(restored.production.story.approvedVersion).toBe(project.production.story.approvedVersion);
    expect(restored.production.story.lockedVersion).toBe(project.production.story.lockedVersion);
    expect(restored.production.story.impactDecisions).toEqual(project.production.story.impactDecisions);
    expect(restored.production.story.contracts).toEqual(project.production.story.contracts);
    await expect(readFile(path.join(root, project.id, "story", "beats.json"), "utf8")).resolves.toContain("BEAT_01");
    await expect(readFile(path.join(root, project.id, "story", "sequence_breakdown.json"), "utf8")).resolves.toContain("05:30–06:00");
    await expect(readFile(path.join(root, project.id, "story", "change_impact_decisions.json"), "utf8")).resolves.toContain("FUTURE_ONLY");
  });

  it("reports real downstream Story dependencies without inventing absent checks", async () => {
    const { project } = await createProject();
    generateStoryOffline(project, project.idea, "AI");
    approveStructuredStory(project);
    const timestamp = new Date().toISOString();
    project.production.filmBible = { ...createEmptyFilmBibleState(timestamp), status: "APPROVED", version: 1, approvedVersion: 1, sections: { summary: "Approved facts" }, approvedAt: timestamp };
    project.production.characters = [{ id: "CHAR_RASHID", storyCandidateId: "CHAR_RASHID", number: 1, name: "Rashid", category: "main", importance: "MAIN", role: "Lead", description: "Lead", occupation: "Courier", personality: "Guarded", backstory: "Story-defined", goal: "Escape", motivation: "Survive", conflict: "The camp", fear: "The dark", relationships: [], relatedBeatIds: [], relatedSequenceIds: ["SEQ_01"], referencePriority: "REQUIRED", identitySource: "STORY_DEFINED", referenceIds: [], sheetStatus: "PLANNED", states: [{ id: "CHARSTATE_RASHID_01", sequenceId: "SEQ_01", timeRange: "00:00–00:30", locationId: "LOC_CAMP", physical: "Clean", emotional: "Guarded", wardrobe: "Robe", injuries: "None", possessions: [], knowledge: "Arrival", relationshipState: "Unknown", damage: [], sourceStoryVersion: 1, updatedAt: timestamp }], version: 1, status: "LOCKED", history: [], createdAt: timestamp, updatedAt: timestamp }];
    const report = assessChangeImpact(project, "story");
    expect(report.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "film_bible", id: "FILM_BIBLE", protection: "APPROVED" }),
      expect.objectContaining({ kind: "character", id: "CHAR_RASHID", protection: "LOCKED" }),
      expect.objectContaining({ kind: "character_state", id: "CHAR_RASHID:SEQ_01", protection: "LOCKED" }),
      expect.objectContaining({ kind: "audio_bible", id: "AUDIO_BIBLE" }),
    ]));
    expect(report.lockedCount).toBeGreaterThan(0);
    expect(report.approvedCount).toBeGreaterThan(0);
  });
});
