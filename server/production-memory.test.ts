import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ContinuitySnapshot, MovieProject } from "../src/types.js";
import { assessChangeImpact } from "./change-impact.js";
import {
  approveContinuitySnapshot,
  rebuildProductionMemory,
  reviseContinuitySnapshot,
  updateAudioBible,
  updateVoiceProfile,
} from "./production-memory.js";
import { lockMovieDna, runFullProductionWorkflow } from "./production-workflow.js";
import { ProjectStore } from "./store.js";

const roots: string[] = [];

const createProject = async () => {
  const root = path.join(tmpdir(), `continuity-production-memory-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  roots.push(root);
  const store = new ProjectStore(root);
  const project = await store.createProject({
    title: "Production Memory Film",
    movieTitle: "The Last Camp",
    idea: "Rashid crosses a desert with his camel, finds a silent camp, drops a knife, and must decide whether to break its ritual.",
    genre: "Folk Horror / Drama",
    runtimeMinutes: 2,
    sequenceCount: 4,
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
  runFullProductionWorkflow(project);
  return { root, store, project };
};

const latest = (project: MovieProject, sequenceId: string, anchor: ContinuitySnapshot["anchor"]) => project.memory.productionMemory.continuity.snapshots
  .filter((snapshot) => snapshot.sequenceId === sequenceId && snapshot.anchor === anchor)
  .sort((a, b) => b.version - a.version)[0]!;

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("permanent production-memory layer", () => {
  it("generates a complete runtime-aligned timeline from approved Story and Film Bible records", async () => {
    const { project } = await createProject();
    const timeline = project.memory.productionMemory.storyTimeline;
    expect(timeline.status).toBe("READY");
    expect(timeline.runtimeSeconds).toBe(120);
    expect(timeline.events).toHaveLength(4);
    expect(timeline.events.map((event) => event.movieTime.label)).toEqual(["00:00–00:30", "00:30–01:00", "01:00–01:30", "01:30–02:00"]);
    expect(timeline.events.every((event) => event.importantActions.length > 0 && event.storyBeat && event.storyConsequence)).toBe(true);
    expect(timeline.events.every((event) => event.sourceStoryVersion === project.production.story.approvedVersion && event.sourceFilmBibleVersion === project.production.filmBible.approvedVersion)).toBe(true);
    expect(timeline.events.every((event) => Object.keys(event.characterKnowledge).length > 0)).toBe(true);
  });

  it("inherits only approved end states and flags the deliberate dropped-knife conflict with its source", async () => {
    const { project } = await createProject();
    const character = project.production.characters[0]!;
    const knifeId = project.production.assets.find((asset) => /knife|weapon/i.test(`${asset.name} ${asset.id}`))?.id ?? "PROP_KNIFE_001";

    const seq1 = reviseContinuitySnapshot(project, { sequenceId: "SEQ_01", anchor: "END", reason: "Sequence 01: clean clothing and carries a knife.", patches: [{ entityId: character.id, entityType: "character", fields: { clothing: "Clean white kandura", dirt: "Clean", propsCarried: [knifeId], injuries: [] } }] }).snapshot;
    approveContinuitySnapshot(project, seq1.id);

    const seq2 = reviseContinuitySnapshot(project, { sequenceId: "SEQ_02", anchor: "END", reason: "Sequence 02: Rashid becomes dusty.", patches: [{ entityId: character.id, entityType: "character", fields: { clothing: "Dusty white kandura", dirt: "Dusty", propsCarried: [knifeId] } }] }).snapshot;
    approveContinuitySnapshot(project, seq2.id);

    const seq3 = reviseContinuitySnapshot(project, { sequenceId: "SEQ_03", anchor: "END", reason: "Sequence 03: Rashid drops the knife.", patches: [
      { entityId: character.id, entityType: "character", fields: { clothing: "Dusty white kandura", dirt: "Dusty", propsCarried: [] } },
      { entityId: knifeId, entityType: "prop", fields: { ownerId: undefined, dropped: true, lost: true, location: "Main tent floor" } },
      { entityId: "VEHICLE_TEST_001", entityType: "vehicle", fields: { location: "Camp entrance", direction: "left to right", condition: "Intact" } },
    ] }).snapshot;
    approveContinuitySnapshot(project, seq3.id);

    const seq4Start = latest(project, "SEQ_04", "START");
    const inheritedCharacter = seq4Start.entities.find((state) => state.entityId === character.id)!;
    expect(seq4Start.inheritedFromSnapshotId).toBe(seq3.id);
    expect(inheritedCharacter.clothing).toContain("Dusty");
    expect(inheritedCharacter.propsCarried).not.toContain(knifeId);

    const conflict = reviseContinuitySnapshot(project, { sequenceId: "SEQ_04", anchor: "START", reason: "Deliberately add the knife back for the critical test.", patches: [
      { entityId: character.id, entityType: "character", fields: { propsCarried: [knifeId] } },
      { entityId: knifeId, entityType: "prop", fields: { ownerId: character.id, dropped: false, lost: false } },
      { entityId: "VEHICLE_TEST_001", entityType: "vehicle", fields: { location: "Other side of camp", direction: "right to left" } },
    ] });
    expect(conflict.warnings.some((warning) => warning.entityId === character.id && warning.field === "propsCarried")).toBe(true);
    expect(conflict.warnings.every((warning) => warning.sourceSequenceId === "SEQ_03" && warning.sourceSnapshotId === seq3.id)).toBe(true);
    expect(conflict.warnings.some((warning) => warning.entityId === "VEHICLE_TEST_001" && warning.field === "location")).toBe(true);
    expect(conflict.warnings.flatMap((warning) => warning.affectedFutureSequenceIds)).toEqual([]);
  });

  it("tracks knowledge, injury, costume, location, prop, and history changes as structured conflicts", async () => {
    const { project } = await createProject();
    const character = project.production.characters[0]!;
    const location = project.memory.productionMemory.storyTimeline.events[2]!.locationId;
    const expected = reviseContinuitySnapshot(project, { sequenceId: "SEQ_03", anchor: "END", reason: "Establish approved character and location state.", patches: [
      { entityId: character.id, entityType: "character", fields: { knowledge: ["Knows the warning"], injuries: ["Left hand cut"], clothing: "Dusty kandura", propsCarried: [], characterStateId: "CHARSTATE_TEST_SEQ_03" } },
      { entityId: location, entityType: "location", fields: { weather: "Still night", lighting: "Moon and fire", damage: ["Tent rope torn"] } },
    ] }).snapshot;
    approveContinuitySnapshot(project, expected.id);
    const revised = reviseContinuitySnapshot(project, { sequenceId: "SEQ_04", anchor: "START", reason: "Create deliberate continuity regressions.", patches: [
      { entityId: character.id, entityType: "character", fields: { knowledge: [], injuries: [], clothing: "Clean kandura", propsCarried: ["PROP_KNIFE_001"], characterStateId: "CHARSTATE_TEST_SEQ_04" } },
      { entityId: location, entityType: "location", fields: { weather: "Bright daylight", lighting: "Hard sun", damage: [] } },
    ] });
    const fields = new Set(revised.warnings.map((warning) => warning.field));
    for (const field of ["knowledge", "injuries", "clothing", "propsCarried", "weather", "lighting", "damage"]) expect(fields.has(field)).toBe(true);
    const identity = revised.snapshot.entities.find((state) => state.entityId === character.id)!;
    expect(identity.identityId).toBe(character.id);
    expect(identity.characterStateId).toBe("CHARSTATE_TEST_SEQ_04");
    expect(project.memory.productionMemory.continuity.history.some((entry) => entry.snapshotId === revised.snapshot.id && entry.version === revised.snapshot.version)).toBe(true);
    const impact = assessChangeImpact(project, "continuity", "SEQ_03");
    expect(impact.items.some((item) => item.kind === "character_state")).toBe(true);
    expect(impact.items.some((item) => item.kind === "sequence")).toBe(true);
  });

  it("persists timeline, snapshots, warnings, voice identity, narration, music, and silence through restart", async () => {
    const { store, project } = await createProject();
    const character = project.production.characters[0]!;
    const profile = updateVoiceProfile(project, {
      characterId: character.id,
      voiceDescription: "Warm, restrained Emirati male voice with controlled urgency.",
      language: "Gulf Arabic",
      accent: "Emirati",
      ageImpression: "Early 30s",
      pitch: "Low-mid",
      tone: "Grounded",
      speakingSpeed: "Measured",
      emotionRange: ["guarded", "urgent"],
      deliveryStyle: "Natural dramatic delivery",
      pronunciationRules: ["Preserve Rashid and kandura pronunciation"],
      volumeTendencies: "Quiet until danger",
      status: "LOCKED",
    });
    updateAudioBible(project, {
      settings: { narrationEnabled: true },
      narrator: { id: "NARRATOR_001", identity: "Story narrator", language: "English", accent: "Neutral", tone: "Low and intimate", style: "Restrained", delivery: "Continuous", pacing: "Measured", status: "APPROVED" },
      musicRules: ["Traditional instruments only", "No music beneath the old man's warning"],
      intentionalSilenceRules: ["Silence when the wind stops"],
      status: "APPROVED",
      reason: "Critical audio persistence test",
    });
    const conflict = reviseContinuitySnapshot(project, { sequenceId: "SEQ_02", anchor: "START", reason: "Persist a warning.", patches: [{ entityId: character.id, entityType: "character", fields: { knowledge: ["Impossible future knowledge"] } }] });
    expect(conflict.snapshot.version).toBeGreaterThan(1);
    await store.saveProject(project);

    const reopened = await store.getProject(project.id);
    expect(reopened.memory.productionMemory.storyTimeline.events).toHaveLength(4);
    expect(reopened.memory.productionMemory.continuity.snapshots.length).toBe(project.memory.productionMemory.continuity.snapshots.length);
    expect(reopened.memory.productionMemory.continuity.warnings.length).toBe(project.memory.productionMemory.continuity.warnings.length);
    expect(reopened.memory.productionMemory.audioBible.voiceProfiles.find((item) => item.characterId === character.id)?.id).toBe(profile.id);
    expect(reopened.memory.productionMemory.audioBible.voiceProfiles.find((item) => item.characterId === character.id)?.status).toBe("LOCKED");
    expect(reopened.memory.productionMemory.audioBible.narrator?.id).toBe("NARRATOR_001");
    expect(reopened.memory.productionMemory.audioBible.musicRules).toContain("Traditional instruments only");
    expect(reopened.memory.productionMemory.audioBible.intentionalSilenceRules).toContain("Silence when the wind stops");
    expect(reopened.production.audioBible.voices).toContain(profile.id);
  });

  it("rebuilds timeline versions without erasing approved continuity history", async () => {
    const { project } = await createProject();
    const approved = latest(project, "SEQ_01", "END");
    approveContinuitySnapshot(project, approved.id);
    const historyLength = project.memory.productionMemory.continuity.history.length;
    const version = project.memory.productionMemory.storyTimeline.version;
    rebuildProductionMemory(project);
    expect(project.memory.productionMemory.storyTimeline.version).toBe(version + 1);
    expect(project.memory.productionMemory.continuity.snapshots.some((snapshot) => snapshot.id === approved.id && snapshot.status === "APPROVED")).toBe(true);
    expect(project.memory.productionMemory.continuity.history.length).toBeGreaterThanOrEqual(historyLength);
  });
});
