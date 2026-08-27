import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CreateProjectInput, SequencesArtifact } from "../src/types.js";
import { PlatformPromptCompiler } from "./platform-prompt-compiler.js";
import { filmRuleEngine } from "./rule-engine.js";
import { ProjectStore } from "./store.js";

const roots: string[] = [];
const input: CreateProjectInput = { title: "Compiler Test", idea: "Two people cross a location in a reference compiler test.", genre: "Drama", runtimeMinutes: 1, sequenceCount: 1, language: "English", visualStyle: "Cinematic", mode: "phases", brain: "local", storyMode: "AI_FIRST", era: "Now", aspectRatio: "16:9", autoGenerateAssets: false, autoGenerateScenes: false, autoGenerateStoryboard: false };
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("PlatformPromptCompiler", () => {
  it("keeps stable IDs separate from provider tags and blocks rather than silently dropping critical references", async () => {
    const root = path.join(tmpdir(), `continuity-compiler-${Date.now()}-${Math.random().toString(16).slice(2)}`); roots.push(root);
    const store = new ProjectStore(root); const project = await store.createProject(input, { kind: "builtin", label: "test", available: true });
    filmRuleEngine.registerManifest(project, { assets: [
      { id: "CHAR_ONE_001", name: "One", type: "character", description: "Identity one", locked: false, continuityNotes: [] },
      { id: "CHAR_TWO_001", name: "Two", type: "character", description: "Identity two", locked: false, continuityNotes: [] },
    ], counts: { character: 2 } });
    for (const asset of project.memory.database.assets) { asset.generatedImagePath = `generated_images/assets/${asset.id}.png`; asset.referenceImages = [asset.generatedImagePath]; asset.approvalState = "APPROVED"; }
    project.artifacts.sequences = { targetRuntimeSeconds: 8, sequences: [{ id: "SEQ_001", number: 1, title: "Two identities", durationSeconds: 8, synopsis: "Two people meet.", locationId: "CHAR_ONE_001", assetIds: ["CHAR_ONE_001", "CHAR_TWO_001"], emotionalBeat: "recognition", status: "ready" }] } satisfies SequencesArtifact;
    const compiler = new PlatformPromptCompiler();
    const prompts = compiler.compile(project, ["minimax-s2v-01", "seedance-2.5"]);
    const minimax = prompts.find((item) => item.model === "minimax-s2v-01")!;
    const seedance = prompts.find((item) => item.model === "seedance-2.5")!;
    expect(minimax.compilation?.blockingIssues.join(" ")).toContain("Never silently drop");
    expect(minimax.compilation?.excludedReferences[0]?.assetId).toBe("CHAR_TWO_001");
    expect(seedance.compilation?.mappings[0]?.promptTag).toBe("@Image 1");
    expect(seedance.compilation?.mappings[0]?.assetId).toBe("CHAR_ONE_001");
    expect(project.memory.database.providerReferenceMappings.every((mapping) => mapping.assetId.startsWith("CHAR_") && !mapping.assetId.startsWith("@"))).toBe(true);
  });
});
