import { access, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { MovieProject, TargetPlatform } from "../src/types.js";
import { approveContinuitySnapshot, reviseContinuitySnapshot } from "./production-memory.js";
import { lockMovieDna, runFullProductionWorkflow } from "./production-workflow.js";
import {
  compileSequencePrompt,
  parseNormalSections,
  refreshPromptOutdatedState,
  resolvePromptChange,
  sequenceReferenceManifest,
  sequenceReferencePackage,
  setReferenceLimitMode,
  updatePromptFromJson,
  updatePromptFromNormal,
} from "./sequence-workspace.js";
import { generateProductionScript, setDialogueApproval } from "./script-workflow.js";
import { ProjectStore } from "./store.js";
import { attachStoryboardGridReference, setSequenceStoryboardGrid } from "./storyboard-grid.js";

const roots: string[] = [];
const platforms: TargetPlatform[] = ["Seedance", "Higgsfield", "MiniMax", "Veo", "Kling", "Runway", "Sora", "Custom"];

const createProject = async () => {
  const root = path.join(tmpdir(), `continuity-sequence-workspace-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  roots.push(root);
  const store = new ProjectStore(root);
  const project = await store.createProject({
    title: "Sequence Workspace Production Test",
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

const makeReferencesUsable = (project: MovieProject, sequenceId: string) => {
  const sequence = project.memory.productionMemory.script.sequences.find((item) => item.id === sequenceId)!;
  const ids = new Set([...sequence.assetRequirements.map((item) => item.assetId), ...sequence.characterIds, ...sequence.characterStateIds, sequence.locationId]);
  let sparseIndex = 0;
  const sparseNumbers = [1, 17, 28, 33, 41, 56, 71, 88, 97];
  for (const asset of project.production.assets) {
    if (!ids.has(asset.id)) continue;
    asset.number = sparseNumbers[sparseIndex++] ?? asset.number;
    asset.filename = `${String(asset.number).padStart(2, "0")}_${asset.name.replace(/[^a-z0-9]+/gi, "_")}.png`;
    asset.imagePath = `generated_images/assets/${asset.filename}`;
    asset.thumbnailPath = asset.imagePath;
    asset.status = "APPROVED";
  }
  const location = project.production.assets.find((asset) => asset.id === sequence.locationId);
  if (location) location.imagePath = `generated_images/assets/${location.filename}`;
};

const replaceSection = (prompt: string, id: string, value: string) => {
  const sections = parseNormalSections(prompt);
  expect(sections[id]).toBeDefined();
  return prompt.replace(new RegExp(`(\\[\\[SECTION:${id}\\]\\]\\r?\\n)[\\s\\S]*?(?=\\r?\\n\\r?\\n\\[\\[SECTION:|$)`), `$1${value}`);
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Sequence Workspace v3", () => {
  it("builds one complete Prompt State and renders Normal and JSON from the same real sources", async () => {
    const { project } = await createProject();
    makeReferencesUsable(project, "SEQ_01");
    const record = compileSequencePrompt(project, "SEQ_01", "Seedance");
    const parsed = JSON.parse(record.jsonPrompt);

    expect(record.state.projectId).toBe(project.id);
    expect(record.state.sequenceId).toBe("SEQ_01");
    expect(record.state.movieDnaVisuals.length).toBeGreaterThan(20);
    expect(record.state.location.id).toBe(project.memory.productionMemory.script.sequences[0]!.locationId);
    expect(record.state.location.imagePath).toBeTruthy();
    expect(record.state.shots.length).toBeGreaterThan(0);
    expect(record.state.shots.reduce((sum, shot) => sum + shot.durationSeconds, 0)).toBe(30);
    expect(record.normalPrompt).toContain("[[SECTION:STORY_CONTEXT]]");
    expect(record.normalPrompt).toContain("[[SECTION:START_MID_END]]");
    expect(parsed.final_prompt).toBe(record.normalPrompt);
    expect(parsed.actions).toEqual(record.state.actions);
    expect(parsed.dialogue).toEqual(record.state.dialogue);
    expect(parsed.references).toEqual(record.state.references);
    expect(record.state.characters.every((character) => character.identityAnchor.length > 0)).toBe(true);
    expect(record.state.styleAnchor).toContain("aspect ratio 2.39:1");
    expect(record.state.knowledgeSourceIds).toContain("KNOWLEDGE_AI_FILMMAKING_VISUAL_GUIDE_V1");
  });

  it("integrates durable guide rules while keeping provider limits inside versioned Platform Profiles", async () => {
    const { project } = await createProject();
    const source = project.production.knowledgeSources.find((item) => item.id === "KNOWLEDGE_AI_FILMMAKING_VISUAL_GUIDE_V1");
    expect(source?.sourceSha256).toBe("fc621f014cf54a2796a8b185b3ecaaa15c42cc79e46e6c1d0ec66ff76b9ee958");
    expect(source?.principles.some((item) => item.id === "VISUAL_GUIDE_VERSION_PLATFORM_LIMITS")).toBe(true);
    expect(project.memory.database.rules.some((rule) => rule.id === "GUIDE_NEUTRAL_CHARACTER_SHEET")).toBe(true);
    expect(project.production.platformProfiles.Seedance.version).toBeGreaterThanOrEqual(2);
    expect(project.production.platformProfiles.Seedance.maxDurationSeconds).toBe(30);
    expect(project.production.platformProfiles.MiniMax.maxDurationSeconds).toBe(10);

    const seedance = compileSequencePrompt(project, "SEQ_01", "Seedance");
    const minimax = compileSequencePrompt(project, "SEQ_01", "MiniMax");
    expect(seedance.state.validation.issues.some((issue) => issue.code === "PLATFORM_DURATION_EXCEEDED")).toBe(false);
    expect(minimax.state.validation.issues.some((issue) => issue.code === "PLATFORM_DURATION_EXCEEDED")).toBe(true);
  });

  it("adds an optional nine-panel Storyboard Grid without replacing the Shot Planner", async () => {
    const { project } = await createProject();
    makeReferencesUsable(project, "SEQ_01");
    const shotIds = [...project.memory.productionMemory.script.sequences[0]!.shotIds];
    let grid = setSequenceStoryboardGrid(project, "SEQ_01", true);
    expect(grid.panels).toHaveLength(9);
    expect(new Set(grid.panels.map((panel) => panel.shotId)).size).toBeGreaterThan(0);
    expect(grid.generationPrompt).not.toMatch(/\[[A-Z][A-Z _-]+\]/);
    expect(project.memory.productionMemory.script.sequences[0]!.shotIds).toEqual(shotIds);

    grid = attachStoryboardGridReference(project, "SEQ_01", { referenceId: "REF_STORYBOARD_GRID_01", imagePath: "references/uploads/storyboard-grid-01.png" });
    const record = compileSequencePrompt(project, "SEQ_01", "Seedance");
    const gridReference = record.state.references.find((reference) => reference.assetId === grid.id);
    expect(gridReference?.promptTag).toMatch(/^@Image \d+$/);
    expect(new Set(record.state.references.filter((reference) => reference.selected).map((reference) => reference.promptTag)).size).toBe(record.state.references.filter((reference) => reference.selected).length);
    expect(record.normalPrompt).toContain("[[SECTION:STORYBOARD_GRID]]");
    expect(JSON.parse(record.jsonPrompt).storyboard_grid.panels).toHaveLength(9);
    expect(project.memory.productionMemory.script.sequences[0]!.shotIds).toEqual(shotIds);
  });

  it("synchronizes safe Normal action edits into Prompt State and JSON", async () => {
    const { project } = await createProject();
    const original = compileSequencePrompt(project, "SEQ_01", "Seedance");
    const editedAction = "1. Rashid runs toward the tent while looking behind him.";
    const updated = updatePromptFromNormal(project, "SEQ_01", "Seedance", replaceSection(original.normalPrompt, "ACTIONS", editedAction));
    const parsed = JSON.parse(updated.jsonPrompt);

    expect(updated.pendingChange).toBeUndefined();
    expect(updated.state.actions).toEqual(["Rashid runs toward the tent while looking behind him."]);
    expect(parsed.actions).toEqual(updated.state.actions);
    expect(updated.normalPrompt).toContain(editedAction);
    expect(updated.state.sequenceOverrides.ACTIONS).toBe(editedAction);
  });

  it("synchronizes editable JSON emotion, performance, camera, and lighting into Normal", async () => {
    const { project } = await createProject();
    const record = compileSequencePrompt(project, "SEQ_01", "Seedance");
    const parsed = JSON.parse(record.jsonPrompt);
    parsed.performance.emotion = "terrified but controlled";
    parsed.performance.instructions = ["Rashid hides his fear, but his breathing accelerates."];
    parsed.camera.language = "A cautious handheld push follows Rashid.";
    parsed.lighting.style = "Cold moonlight cut by amber firelight.";
    const updated = updatePromptFromJson(project, "SEQ_01", "Seedance", JSON.stringify(parsed));

    expect(updated.state.emotion).toBe("terrified but controlled");
    expect(updated.state.performance).toEqual(["Rashid hides his fear, but his breathing accelerates."]);
    expect(updated.normalPrompt).toContain("Overall emotion: terrified but controlled");
    expect(updated.normalPrompt).toContain("A cautious handheld push follows Rashid.");
    expect(updated.normalPrompt).toContain("Cold moonlight cut by amber firelight.");
    expect(JSON.parse(updated.jsonPrompt).performance.emotion).toBe("terrified but controlled");
  });

  it("holds ambiguous and protected edits for review and never rewrites locked dialogue", async () => {
    const { project } = await createProject();
    const line = project.memory.productionMemory.script.dialogue[0]!;
    setDialogueApproval(project, line.id, "LOCK");
    const exact = line.exactDialogue;
    const record = compileSequencePrompt(project, line.sequenceId, "Seedance");

    const ambiguous = updatePromptFromNormal(project, line.sequenceId, "Seedance", "Rewrite everything as a bright comedy.");
    expect(ambiguous.pendingChange?.likelyAffectedField).toBe("normal_prompt");
    resolvePromptChange(project, line.sequenceId, "Seedance", "CANCEL");

    const protectedEdit = replaceSection(record.normalPrompt, "DIALOGUE", "Rashid [changed] — EXACT: rewritten words");
    const reviewed = updatePromptFromNormal(project, line.sequenceId, "Seedance", protectedEdit);
    expect(reviewed.pendingChange?.likelyAffectedField).toBe("DIALOGUE");
    expect(reviewed.pendingChange?.conflict).toMatch(/locked dialogue/i);
    expect(() => resolvePromptChange(project, line.sequenceId, "Seedance", "KEEP_OVERRIDE")).toThrow(/locked dialogue/i);
    expect(project.memory.productionMemory.script.dialogue.find((item) => item.id === line.id)?.exactDialogue).toBe(exact);
    expect(reviewed.state.dialogue.find((item) => item.id === line.id)?.exactDialogue).toBe(exact);
  });

  it("preserves narrative, character, dialogue, shots, and continuity across all platform compilers", async () => {
    const { project } = await createProject();
    makeReferencesUsable(project, "SEQ_01");
    const seedance = compileSequencePrompt(project, "SEQ_01", "Seedance");
    updatePromptFromNormal(project, "SEQ_01", "Seedance", replaceSection(seedance.normalPrompt, "ACTIONS", "1. Rashid moves toward the fire while keeping the camel in view."));
    const records = platforms.map((platform) => compileSequencePrompt(project, "SEQ_01", platform));
    const canonical = records[0]!.state;

    expect(Object.keys(project.production.platformProfiles).sort()).toEqual([...platforms].sort());
    for (const record of records) {
      expect(record.state.actions).toEqual(canonical.actions);
      expect(record.state.characters).toEqual(canonical.characters);
      expect(record.state.characterStates).toEqual(canonical.characterStates);
      expect(record.state.dialogue).toEqual(canonical.dialogue);
      expect(record.state.shots).toEqual(canonical.shots);
      expect(record.state.continuity).toEqual(canonical.continuity);
      expect(record.state.actions).toContain("Rashid moves toward the fire while keeping the camel in view.");
      expect(project.production.platformProfiles[record.platform].version).toBeGreaterThan(0);
      expect(record.normalPrompt).toContain(`${record.platform} profile v`);
    }
    expect(records.find((item) => item.platform === "Seedance")?.normalPrompt).toContain("@Image 1");
    expect(records.find((item) => item.platform === "Higgsfield")?.normalPrompt).toContain("Element 1");
    expect(records.find((item) => item.platform === "MiniMax")?.normalPrompt).toContain("[Image 1]");
  });

  it("maps sparse permanent project numbers into temporary platform upload order and export files", async () => {
    const { project } = await createProject();
    makeReferencesUsable(project, "SEQ_01");
    const before = new Map(project.production.assets.map((asset) => [asset.id, { number: asset.number, filename: asset.filename }]));
    const record = compileSequencePrompt(project, "SEQ_01", "Seedance");
    const selected = record.state.references.filter((item) => item.selected);
    const manifest = sequenceReferenceManifest(record);
    const bundle = sequenceReferencePackage(project, "SEQ_01", "Seedance");

    expect(selected.map((item) => item.platformUploadPosition)).toEqual(selected.map((_, index) => index + 1));
    expect(selected.map((item) => item.promptTag)).toEqual(selected.map((_, index) => `@Image ${index + 1}`));
    expect(selected.every((item) => item.packageFilename?.startsWith(String(item.platformUploadPosition).padStart(2, "0")))).toBe(true);
    expect(manifest.references.map((item) => item.permanentProjectImageNumber)).toEqual(selected.map((item) => item.permanentProjectImageNumber));
    expect(bundle.folderName).toBe("Sequence_01_Seedance");
    expect(bundle.files.map((item) => item.packageFilename)).toEqual(selected.filter((item) => !item.missing).map((item) => item.packageFilename));
    for (const asset of project.production.assets) expect({ number: asset.number, filename: asset.filename }).toEqual(before.get(asset.id));
  });

  it("blocks over-limit mappings and missing images until the user chooses an explicit safe mode", async () => {
    const { project } = await createProject();
    makeReferencesUsable(project, "SEQ_01");
    project.production.platformProfiles.Seedance.maxReferences = 1;
    let record = compileSequencePrompt(project, "SEQ_01", "Seedance");
    expect(record.state.validation.issues.some((issue) => issue.code === "REFERENCE_LIMIT_WARNING")).toBe(true);
    expect(record.state.validation.status).toBe("BLOCKED");

    record = setReferenceLimitMode(project, "SEQ_01", "Seedance", "RECOMMENDED");
    expect(record.state.references.filter((item) => item.selected)).toHaveLength(1);
    expect(record.state.validation.issues.some((issue) => issue.code === "REFERENCE_LIMIT_WARNING")).toBe(false);

    const missing = record.state.references[0]!;
    const source = project.production.assets.find((asset) => asset.id === missing.assetId)!;
    source.imagePath = undefined;
    record = compileSequencePrompt(project, "SEQ_01", "Seedance");
    expect(record.state.validation.issues.some((issue) => issue.code === "MISSING_REQUIRED_ASSET" && issue.sourceId === missing.assetId)).toBe(true);
    expect(sequenceReferencePackage(project, "SEQ_01", "Seedance").files.some((file) => file.packageFilename === missing.packageFilename)).toBe(false);
  });

  it("inherits the approved dropped-knife state without restoring a knife action or reference", async () => {
    const { project } = await createProject();
    const character = project.production.characters[0]!;
    const knife = project.production.assets.find((asset) => /knife|weapon/i.test(`${asset.name} ${asset.id}`));
    const knifeId = knife?.id ?? "PROP_KNIFE_001";
    const end = reviseContinuitySnapshot(project, { sequenceId: "SEQ_03", anchor: "END", reason: "Rashid drops the knife before Sequence 04.", patches: [
      { entityId: character.id, entityType: "character", fields: { propsCarried: [], clothing: "Dusty white kandura" } },
      { entityId: knifeId, entityType: "prop", fields: { ownerId: undefined, dropped: true, lost: true, location: "Camp floor" } },
    ] }).snapshot;
    approveContinuitySnapshot(project, end.id);
    generateProductionScript(project, "Rebuild Sequence 04 against approved knife state");
    const record = compileSequencePrompt(project, "SEQ_04", "Seedance");

    expect(record.state.startState).toMatch(/knife.*(?:missing|dropped|lost)|(?:missing|dropped|lost|no).*knife/i);
    expect(record.state.actions.join(" ")).not.toMatch(/(?:carries|holds|has|grabs).*knife/i);
    expect(record.state.weapons.join(" ")).not.toMatch(/knife/i);
    expect(record.state.references.filter((item) => item.selected).map((item) => item.assetName).join(" ")).not.toMatch(/knife/i);
    expect(record.normalPrompt).toContain(record.state.startState);
    expect(JSON.parse(record.jsonPrompt).sequence.start_state).toBe(record.state.startState);
  });

  it("keeps protected versions and marks prompts outdated when an upstream source changes", async () => {
    const { project } = await createProject();
    let record = compileSequencePrompt(project, "SEQ_01", "Seedance");
    record = updatePromptFromNormal(project, "SEQ_01", "Seedance", replaceSection(record.normalPrompt, "PERFORMANCE", "1. Rashid conceals his panic behind deliberate stillness."));
    expect(record.versions).toHaveLength(2);
    const priorPrompts = record.versions.map((version) => version.normalPrompt);
    const referencedAsset = project.production.assets.find((asset) => record.state.references.some((reference) => reference.assetId === asset.id));
    expect(referencedAsset).toBeDefined();
    referencedAsset!.version += 1;
    refreshPromptOutdatedState(project);

    expect(record.outdatedReasons).toContain("assets changed");
    expect(record.state.status).toBe("PROMPT_OUTDATED");
    expect(record.versions.map((version) => version.normalPrompt)).toEqual(priorPrompts);
  });

  it("persists Prompt State, synchronized output, versions, platform selection, overrides, and reference mapping across reload", async () => {
    const { root, store, project } = await createProject();
    makeReferencesUsable(project, "SEQ_01");
    let record = compileSequencePrompt(project, "SEQ_01", "Higgsfield");
    record = updatePromptFromNormal(project, "SEQ_01", "Higgsfield", replaceSection(record.normalPrompt, "ACTIONS", "1. Rashid circles the tent without turning his back to the camp."));
    record = setReferenceLimitMode(project, "SEQ_01", "Higgsfield", "RECOMMENDED");
    await store.saveProject(project);

    const restored = await store.getProject(project.id);
    const persisted = restored.production.promptWorkspace.records["SEQ_01:Higgsfield"]!;
    expect(restored.production.promptWorkspace.selectedPlatforms.SEQ_01).toBe("Higgsfield");
    expect(persisted.state.sequenceOverrides.ACTIONS).toContain("circles the tent");
    expect(JSON.parse(persisted.jsonPrompt).actions).toEqual(persisted.state.actions);
    expect(persisted.versions).toHaveLength(record.versions.length);
    expect(persisted.state.references.map((item) => item.promptTag)).toEqual(record.state.references.map((item) => item.promptTag));
    await access(path.join(root, project.id, "platform_prompts", "prompt_workspace.json"));
    expect(JSON.parse(await readFile(path.join(root, project.id, "platform_prompts", "prompt_states.json"), "utf8"))["SEQ_01:Higgsfield"].sequenceId).toBe("SEQ_01");
    expect(JSON.parse(await readFile(path.join(root, project.id, "platform_prompts", "prompt_versions.json"), "utf8"))["SEQ_01:Higgsfield"]).toHaveLength(record.versions.length);
  });
});
