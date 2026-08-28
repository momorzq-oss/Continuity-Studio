import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assessChangeImpact } from "./change-impact.js";
import { approveContinuitySnapshot, reviseContinuitySnapshot } from "./production-memory.js";
import { lockMovieDna, runFullProductionWorkflow } from "./production-workflow.js";
import {
  addShot,
  applyScriptChange,
  approveProductionScript,
  deleteShot,
  duplicateShot,
  generateProductionScript,
  proposeDialogueChange,
  proposeScriptChange,
  refreshScriptReadiness,
  renderScriptExport,
  reorderShots,
  setDialogueApproval,
  setScriptSequenceApproval,
  updateDialogueLine,
  updateScriptScene,
  updateShot,
} from "./script-workflow.js";
import { ProjectStore } from "./store.js";

const roots: string[] = [];

const createProject = async () => {
  const root = path.join(tmpdir(), `continuity-script-workflow-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  roots.push(root);
  const store = new ProjectStore(root);
  const project = await store.createProject({
    title: "Full Script Production Test",
    movieTitle: "The Last Camp",
    idea: "Rashid crosses the desert, finds a silent camp, drops his knife, and faces the ritual before dawn.",
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

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Full Script v2 production workflow", () => {
  it("builds one structured, source-linked Script State with exact Project Setup timing", async () => {
    const { project } = await createProject();
    const script = project.memory.productionMemory.script;
    expect(script.projectId).toBe(project.id);
    expect(script.scriptVersion).toBe(1);
    expect(script.storyVersion).toBe(project.production.story.approvedVersion);
    expect(script.filmBibleVersion).toBe(project.production.filmBible.approvedVersion);
    expect(script.movieDnaVersion).toBe(project.production.movieDna.version);
    expect(script.sequences).toHaveLength(project.sequenceCount);
    expect(script.scenes).toHaveLength(project.sequenceCount);
    expect(script.sequences.map((sequence) => sequence.id)).toEqual(["SEQ_01", "SEQ_02", "SEQ_03", "SEQ_04"]);
    expect(script.sequences.map((sequence) => sequence.timeRange)).toEqual(["00:00–00:30", "00:30–01:00", "01:00–01:30", "01:30–02:00"]);
    expect(script.sequences.reduce((sum, sequence) => sum + sequence.durationSeconds, 0)).toBe(120);
    expect(script.sourceManifest.runtimeSeconds).toBe(120);
    expect(script.sourceManifest.sequenceDurationSeconds).toBe(30);
    expect(script.sourceManifest.storyTimelineEventIds).toHaveLength(project.memory.productionMemory.storyTimeline.events.length);
    expect(script.sourceManifest.continuitySnapshotIds).toHaveLength(project.memory.productionMemory.continuity.snapshots.length);
    expect(script.sourceManifest.characterIds).toEqual(project.production.characters.map((character) => character.id));
    expect(script.sourceManifest.assetIds).toEqual(project.production.assets.map((asset) => asset.id));
    for (const sequence of script.sequences) {
      const shots = script.shots.filter((shot) => shot.sequenceId === sequence.id);
      expect(shots.reduce((sum, shot) => sum + shot.durationSeconds, 0)).toBe(sequence.durationSeconds);
      expect(shots.at(-1)?.endSeconds).toBe(sequence.durationSeconds);
      expect(sequence.characterStateIds.length).toBeGreaterThan(0);
      expect(sequence.continuityRequirements.length).toBeGreaterThan(0);
      expect(sequence.audioRequirements.length).toBeGreaterThan(0);
      expect(sequence.negativeRules).toContain("No duplicate characters");
      expect(shots.every((shot) => Boolean(shot.continuityState.screenDirection && shot.continuityState.characterPosition && shot.continuityState.props && shot.continuityState.cameraRelationship))).toBe(true);
      for (const requirement of sequence.assetRequirements) {
        const asset = project.production.assets.find((item) => item.id === requirement.assetId);
        if (asset?.category === "character_state") expect(asset.sequenceIds).toContain(sequence.id);
      }
    }
    expect(script.dialogue.every((line) => !line.timingWarning)).toBe(true);
    expect(project.production.sequences.every((sequence) => sequence.compiledPrompt === "" && Object.keys(sequence.promptSections).length === 0)).toBe(true);
  });

  it("preserves approved versions and exact locked dialogue across scene edits and regeneration", async () => {
    const { project } = await createProject();
    const script = project.memory.productionMemory.script;
    const line = script.dialogue[0]!;
    const exactWords = line.exactDialogue;
    approveProductionScript(project);
    setDialogueApproval(project, line.id, "LOCK");
    updateScriptScene(project, script.scenes[0]!.id, { action: `${script.scenes[0]!.action} A longer silence settles over the camp.` }, "Scoped scene action test");
    expect(script.scriptVersion).toBe(2);
    expect(script.versions.find((version) => version.version === 1)?.approved).toBe(true);
    expect(script.dialogue.find((item) => item.id === line.id)?.exactDialogue).toBe(exactWords);
    expect(() => updateDialogueLine(project, line.id, { exactDialogue: "Changed words" }, "Should be blocked")).toThrow(/unlock/i);

    generateProductionScript(project, "Protected regeneration test");
    expect(project.memory.productionMemory.script.scriptVersion).toBe(3);
    expect(project.memory.productionMemory.script.dialogue.find((item) => item.sequenceId === line.sequenceId)?.exactDialogue).toBe(exactWords);
    expect(project.memory.productionMemory.script.dialogue.find((item) => item.sequenceId === line.sequenceId)?.lockState).toBe("LOCKED");
    expect(project.memory.productionMemory.script.versions.map((version) => version.version)).toEqual(expect.arrayContaining([1, 2]));
  });

  it("creates visible dialogue timing warnings while retaining permanent voice identity", async () => {
    const { project } = await createProject();
    const line = project.memory.productionMemory.script.dialogue[0]!;
    const voice = project.memory.productionMemory.audioBible.voiceProfiles.find((profile) => profile.characterId === line.speakerCharacterId);
    expect(line.audioVoiceProfileId).toBe(voice?.id);
    updateDialogueLine(project, line.id, {
      exactDialogue: "This deliberately long dialogue sentence cannot be spoken naturally inside a tiny one second performance window.",
      timing: { startSeconds: 2, endSeconds: 3, label: "" },
    }, "Dialogue timing validation test");
    expect(line.timingWarning).toMatch(/TIMING WARNING/);
    expect(project.memory.productionMemory.script.sequences.find((sequence) => sequence.id === line.sequenceId)?.warnings.some((warning) => warning.includes("DIALOGUE TIMING WARNING"))).toBe(true);
    expect(project.memory.productionMemory.script.sequences.find((sequence) => sequence.id === line.sequenceId)?.status).toBe("BLOCKED");
  });

  it("keeps shot order and timing deterministic through add, duplicate, reorder, delete, and manual mismatch", async () => {
    const { project } = await createProject();
    const script = project.memory.productionMemory.script;
    const sequence = script.sequences[0]!;
    const initial = script.shots.filter((shot) => shot.sequenceId === sequence.id).sort((a, b) => a.number - b.number);
    const added = addShot(project, sequence.id, { shotType: "Insert", subjectAction: "Knife settles in the sand.", storyPurpose: "Clarify the prop state." }, 1);
    let shots = script.shots.filter((shot) => shot.sequenceId === sequence.id).sort((a, b) => a.number - b.number);
    expect(shots.reduce((sum, shot) => sum + shot.durationSeconds, 0)).toBe(sequence.durationSeconds);
    const duplicate = duplicateShot(project, initial[0]!.id);
    shots = script.shots.filter((shot) => shot.sequenceId === sequence.id).sort((a, b) => a.number - b.number);
    expect(shots.reduce((sum, shot) => sum + shot.durationSeconds, 0)).toBe(sequence.durationSeconds);
    const reversed = shots.map((shot) => shot.id).reverse();
    reorderShots(project, sequence.id, reversed);
    shots = script.shots.filter((shot) => shot.sequenceId === sequence.id).sort((a, b) => a.number - b.number);
    expect(shots.map((shot) => shot.id)).toEqual(reversed);
    expect(shots.every((shot, index) => shot.startSeconds === shots.slice(0, index).reduce((sum, item) => sum + item.durationSeconds, 0))).toBe(true);
    deleteShot(project, added.id);
    shots = script.shots.filter((shot) => shot.sequenceId === sequence.id).sort((a, b) => a.number - b.number);
    expect(shots.reduce((sum, shot) => sum + shot.durationSeconds, 0)).toBe(sequence.durationSeconds);
    updateShot(project, shots[0]!.id, { durationSeconds: shots[0]!.durationSeconds + 2 }, "Deliberate shot timing mismatch");
    expect(sequence.warnings.some((warning) => warning.includes("SHOT TIMING WARNING"))).toBe(true);
    expect(sequence.status).toBe("BLOCKED");
  });

  it("inherits an approved dropped-knife END state into the next formal sequence and exposes conflicts", async () => {
    const { project } = await createProject();
    const character = project.production.characters[0]!;
    const knifeId = project.production.assets.find((asset) => /knife|weapon/i.test(`${asset.name} ${asset.id}`))?.id ?? "PROP_KNIFE_001";
    const end = reviseContinuitySnapshot(project, { sequenceId: "SEQ_03", anchor: "END", reason: "Rashid drops the knife before Sequence 04.", patches: [
      { entityId: character.id, entityType: "character", fields: { propsCarried: [], clothing: "Dusty white kandura" } },
      { entityId: knifeId, entityType: "prop", fields: { ownerId: undefined, dropped: true, lost: true, location: "Camp floor" } },
    ] }).snapshot;
    approveContinuitySnapshot(project, end.id);
    const conflict = reviseContinuitySnapshot(project, { sequenceId: "SEQ_04", anchor: "START", reason: "Deliberate contradiction for script warning coverage.", patches: [
      { entityId: character.id, entityType: "character", fields: { propsCarried: [knifeId] } },
    ] });
    expect(conflict.warnings.length).toBeGreaterThan(0);
    generateProductionScript(project, "Rebuild against approved knife state");
    const sequence4 = project.memory.productionMemory.script.sequences.find((sequence) => sequence.id === "SEQ_04")!;
    expect(sequence4.startState).toContain("carries no props");
    expect(sequence4.startState).toContain("dropped");
    expect(sequence4.continuityRequirements.some((rule) => rule.includes("source SEQ_03"))).toBe(true);
    const sequence4Shots = project.memory.productionMemory.script.shots.filter((shot) => shot.sequenceId === "SEQ_04");
    expect(sequence4Shots.every((shot) => !/carries? (?:the )?knife/i.test(shot.subjectAction))).toBe(true);
    expect(sequence4Shots[0]?.continuityState.props).toContain("carries no props");
    const scene4 = project.memory.productionMemory.script.scenes.find((scene) => scene.sequenceId === "SEQ_04")!;
    updateScriptScene(project, scene4.id, { action: "Rashid carries the knife toward the camel." }, "Deliberate knife contradiction");
    expect(sequence4.warnings.some((warning) => warning.includes("SCRIPT CONTINUITY WARNING") && warning.includes("knife"))).toBe(true);
    expect(sequence4.status).toBe("BLOCKED");
  });

  it("blocks readiness for a missing required asset and reports downstream script impact", async () => {
    const { project } = await createProject();
    const script = project.memory.productionMemory.script;
    const sequence = script.sequences.find((item) => item.assetRequirements.length > 0)!;
    const requirement = sequence.assetRequirements.find((item) => item.required)!;
    const asset = project.production.assets.find((item) => item.id === requirement.assetId)!;
    asset.status = "REVIEW";
    asset.missingDecision = undefined;
    refreshScriptReadiness(project);
    expect(sequence.status).toBe("BLOCKED");
    expect(sequence.warnings).toContain(`MISSING REQUIRED ASSET · ${asset.id}`);
    const impact = assessChangeImpact(project, "script", sequence.id);
    expect(impact.items.some((item) => item.kind === "dialogue")).toBe(true);
    expect(impact.items.some((item) => item.kind === "shot")).toBe(true);
    expect(impact.items.some((item) => item.kind === "sequence")).toBe(true);
  });

  it("returns a scoped AI proposal without mutating the screenplay until explicit acceptance", async () => {
    const { project } = await createProject();
    const script = project.memory.productionMemory.script;
    const sequence = script.sequences[0]!;
    const scene = script.scenes[0]!;
    const before = scene.action;
    const proposal = proposeScriptChange(project, sequence.id, "Add a reaction shot and increase fear without changing locked dialogue");
    expect(proposal.sequenceId).toBe(sequence.id);
    expect(proposal.preservesLockedDialogue).toBe(true);
    expect(scene.action).toBe(before);
    expect(proposal.proposedSection).not.toBe(before);
  });

  it("previews and applies a line-level AI rewrite while refusing to rewrite locked dialogue", async () => {
    const { project } = await createProject();
    const line = project.memory.productionMemory.script.dialogue[0]!;
    const before = line.exactDialogue;
    const proposal = proposeDialogueChange(project, line.id, "Shorten this dialogue while preserving the meaning");
    expect(proposal.currentSection).toBe(before);
    expect(proposal.proposedSection).not.toBe(before);
    expect(proposal.affectedDialogueIds).toEqual([line.id]);
    expect(line.exactDialogue).toBe(before);
    applyScriptChange(project);
    expect(line.exactDialogue).toBe(proposal.proposedSection);
    setDialogueApproval(project, line.id, "LOCK");
    expect(() => proposeDialogueChange(project, line.id, "Change it again")).toThrow(/unlock/i);
  });

  it("applies targeted AI shot changes without altering exact locked dialogue", async () => {
    const { project } = await createProject();
    const script = project.memory.productionMemory.script;
    const sequence = script.sequences[0]!;
    const line = script.dialogue.find((item) => item.sequenceId === sequence.id)!;
    setDialogueApproval(project, line.id, "LOCK");
    const exactWords = line.exactDialogue;
    proposeScriptChange(project, sequence.id, "Make Shot 03 a close-up and use an 85mm lens for this reaction.");
    applyScriptChange(project);
    const shot = script.shots.find((item) => item.sequenceId === sequence.id && item.number === 3)!;
    expect(shot.shotType).toBe("Close Up");
    expect(shot.focalLength).toBe("85mm");
    expect(line.exactDialogue).toBe(exactWords);
    expect(line.lockState).toBe("LOCKED");
  });

  it("keeps permanent character and audio identity links stable across every sequence", async () => {
    const { project } = await createProject();
    const script = project.memory.productionMemory.script;
    for (const sequence of script.sequences) {
      for (const characterId of sequence.characterIds) {
        expect(project.production.characters.some((character) => character.id === characterId)).toBe(true);
        for (const stateId of sequence.characterStateIds) {
          const owner = project.production.characters.find((character) => character.states.some((state) => state.id === stateId));
          expect(owner?.id).toBeTruthy();
          expect(sequence.characterIds).toContain(owner!.id);
        }
      }
    }
    const bySpeaker = new Map<string, typeof script.dialogue>();
    for (const line of script.dialogue) bySpeaker.set(line.speakerCharacterId, [...(bySpeaker.get(line.speakerCharacterId) ?? []), line]);
    for (const lines of bySpeaker.values()) {
      expect(new Set(lines.map((line) => line.audioVoiceProfileId)).size).toBe(1);
      expect(lines[0]?.audioVoiceProfileId).toBeTruthy();
    }
  });

  it("approves and locks only ready formal sequence plans", async () => {
    const { project } = await createProject();
    const sequence = project.memory.productionMemory.script.sequences.find((item) => item.status === "READY")!;
    expect(sequence).toBeTruthy();
    setScriptSequenceApproval(project, sequence.id, "APPROVE");
    expect(sequence.status).toBe("APPROVED");
    expect(sequence.approvalState).toBe("APPROVED");
    setScriptSequenceApproval(project, sequence.id, "LOCK");
    expect(sequence.status).toBe("LOCKED");
    expect(sequence.lockState).toBe("LOCKED");
  });

  it("persists the complete Script State and renders each supported export after restart", async () => {
    const { store, project } = await createProject();
    approveProductionScript(project);
    setDialogueApproval(project, project.memory.productionMemory.script.dialogue[0]!.id, "LOCK");
    await store.saveProject(project);
    const reopened = await store.getProject(project.id);
    const script = reopened.memory.productionMemory.script;
    expect(script.scriptVersion).toBe(1);
    expect(script.status).toBe("APPROVED");
    expect(script.scenes).toHaveLength(4);
    expect(script.dialogue[0]?.lockState).toBe("LOCKED");
    expect(script.shots.length).toBeGreaterThanOrEqual(16);
    expect(script.sequences.at(-1)?.endSeconds).toBe(120);
    for (const format of ["full", "production", "dialogue", "shots", "sequences", "json"] as const) {
      const result = renderScriptExport(reopened, format);
      expect(result.body.length).toBeGreaterThan(50);
      expect(result.filename).toContain(project.id);
      if (format === "production") expect(result.body).toContain("Camera / lens / focal / depth / framing / movement");
    }
  });
});
