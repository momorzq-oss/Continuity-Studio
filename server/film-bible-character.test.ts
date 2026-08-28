import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { FilmBibleArtifact, PhaseId, ProviderInfo } from "../src/types.js";
import type { PhaseEngine, PhaseResult } from "./engine.js";
import { assessChangeImpact } from "./change-impact.js";
import { FilmBibleService, approveFilmBibleVersion, lockFilmBibleVersion, saveFilmBibleSection } from "./film-bible.js";
import { analyzeCharacters, lockMovieDna } from "./production-workflow.js";
import { ReferenceManager } from "./reference-manager.js";
import { ProjectStore } from "./store.js";
import { approveStructuredStory, generateStoryOffline } from "./story-brain.js";

const roots: string[] = [];
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

class FilmBibleEngine implements PhaseEngine {
  readonly providerInfo: ProviderInfo = { kind: "builtin", label: "Film Bible Test Brain", available: true };
  calls: PhaseId[] = [];
  async generate(phase: PhaseId): Promise<PhaseResult> {
    this.calls.push(phase);
    const artifact: FilmBibleArtifact = {
      title: "The Fire Beyond the Dunes",
      genre: "Folk Horror",
      tone: "Patient dread and grounded consequence.",
      visualLanguage: "Locked 1965 Gulf realism with motivated practical firelight.",
      worldRules: ["The camp repeats physical clues but never resets character knowledge."],
      characterContinuity: ["Rashid retains identity, knowledge, possessions, and injury state."],
      locationContinuity: ["Tent, fire, tracks, and horizon preserve fixed geography."],
      movieRules: ["No unexplained reset or identity drift."],
    };
    return { artifact, summary: "Structured canonical Film Bible generated.", provider: "Studio Intelligence Test Brain" };
  }
}

const createApprovedStory = async () => {
  const root = path.join(tmpdir(), `continuity-film-bible-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  roots.push(root);
  const store = new ProjectStore(root);
  const project = await store.createProject({
    title: "Film Bible Test", movieTitle: "The Fire Beyond the Dunes", idea: "Rashid enters a silent 1965 desert camp and must break its repeating ritual before dawn.", genre: "Folk Horror", runtimeMinutes: 1, sequenceCount: 2, sequenceDurationSeconds: 30, language: "English", filmLanguage: "Arabic", dialogueLanguage: "Arabic", visualStyle: "Grounded 1965 Gulf cinema", mode: "phases", brain: "local", storyMode: "AI_FIRST", era: "1965 UAE", aspectRatio: "2.39:1", autoGenerateAssets: false, autoGenerateScenes: false, autoGenerateStoryboard: false,
  }, { kind: "builtin", label: "test", available: true });
  lockMovieDna(project);
  generateStoryOffline(project, project.idea, "AI");
  approveStructuredStory(project);
  return { root, store, project };
};

describe("Film Bible and permanent character integration", () => {
  it("uses Studio Intelligence, stores exact source contracts, and protects approved/locked versions", async () => {
    const { project } = await createApprovedStory();
    const engine = new FilmBibleEngine();
    const service = new FilmBibleService(engine);
    await service.generate(project);
    expect(engine.calls).toEqual(["film_bible"]);
    expect(project.production.filmBible.sourceContext).toMatchObject({ approvedStoryVersion: 1, movieDnaVersion: 1 });
    expect(project.production.filmBible.generationProvider).toBe("Studio Intelligence Test Brain");
    expect(project.production.filmBible.sections.characterIdentityLaw).toContain("CHAR_");
    approveFilmBibleVersion(project);
    lockFilmBibleVersion(project);
    const locked = structuredClone(project.production.filmBible.history.find((item) => item.version === 1));
    await service.generate(project, "Create a new draft with clearer environmental law.");
    expect(project.production.filmBible.version).toBe(2);
    expect(project.production.filmBible.approvedVersion).toBe(1);
    expect(project.production.filmBible.lockedVersion).toBe(1);
    expect(project.production.filmBible.history.find((item) => item.version === 1)).toEqual(locked);
  });

  it("creates a new draft for protected manual edits and restores Film Bible history after restart", async () => {
    const { root, store, project } = await createApprovedStory();
    const service = new FilmBibleService(new FilmBibleEngine());
    await service.generate(project);
    approveFilmBibleVersion(project);
    lockFilmBibleVersion(project);
    const approvedRule = project.production.filmBible.sections.ending;
    saveFilmBibleSection(project, "ending", `${approvedRule}\nThe final tracks remain as permanent physical evidence.`);
    expect(project.production.filmBible).toMatchObject({ version: 2, approvedVersion: 1, lockedVersion: 1, status: "CHANGED_AFTER_PRODUCTION" });
    expect(project.production.filmBible.history.find((item) => item.version === 1)?.sections.ending).toBe(approvedRule);
    expect(assessChangeImpact(project, "story").items).toContainEqual(expect.objectContaining({ kind: "film_bible", protection: "LOCKED", label: expect.stringContaining("v1 production source") }));
    await store.saveProject(project);
    const restored = await store.getProject(project.id);
    expect(restored.production.filmBible.history).toHaveLength(2);
    expect(restored.production.filmBible.sections.ending).toContain("permanent physical evidence");
    await expect(readFile(path.join(root, project.id, "film_bible", "versions.json"), "utf8")).resolves.toContain("CHANGED_AFTER_PRODUCTION");
    await expect(readFile(path.join(root, project.id, "film_bible", "source_context.json"), "utf8")).resolves.toContain("movieDnaVersion");
  });

  it("links each uploaded identity only to its permanent character and derives real Story states", async () => {
    const { store, project } = await createApprovedStory();
    const main = project.production.story.contracts!.characterAnalysis.candidates[0]!;
    const support = {
      ...structuredClone(main), id: "CHAR_GUIDE", name: "The Guide", role: "Witness", importance: "SUPPORTING" as const,
      description: "The camp's only witness.", goal: "End the loop", motivation: "Remember the lost", conflict: "Cannot leave", fear: "Being forgotten", relatedSequenceIds: ["SEQ_02"], referencePriority: "HIGH" as const,
    };
    project.production.story.contracts!.characterAnalysis.candidates = [main, support];
    project.production.story.characters = [main, support];
    const manager = new ReferenceManager(store);
    const mainReference = await manager.upload(project, { filename: "rashid.png", mimeType: "image/png", base64: png, name: main.name, type: "character", mainCharacter: true });
    const guideReference = await manager.upload(project, { filename: "guide.png", mimeType: "image/png", base64: png, name: support.name, type: "character", assetId: support.id });
    const service = new FilmBibleService(new FilmBibleEngine());
    await service.generate(project);
    approveFilmBibleVersion(project);
    analyzeCharacters(project);
    const rashid = project.production.characters.find((item) => item.category === "main")!;
    const guide = project.production.characters.find((item) => item.storyCandidateId === support.id)!;
    expect(rashid.id).toBe("CHAR_MAIN_001");
    expect(rashid.referenceIds).toEqual([mainReference.id]);
    expect(guide.referenceIds).toEqual([guideReference.id]);
    expect(rashid.referenceIds).not.toContain(guideReference.id);
    expect(guide.referenceIds).not.toContain(mainReference.id);
    expect(rashid.states.length).toBeGreaterThan(0);
    expect(rashid.states.every((state) => state.sourceStoryVersion === project.production.story.approvedVersion && state.timeRange && state.locationId)).toBe(true);
    expect(project.memory.database.characters.map((item) => item.id)).toEqual(expect.arrayContaining([rashid.id, guide.id]));
  });
});
