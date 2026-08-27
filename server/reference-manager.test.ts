import { access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CreateProjectInput, StoryArtifact } from "../src/types.js";
import { ReferenceManager } from "./reference-manager.js";
import { filmRuleEngine } from "./rule-engine.js";
import { ProjectStore } from "./store.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("ReferenceManager", () => {
  it("protects a main source, gates reference-first setup, and reconciles it as the only protagonist", async () => {
    const root = path.join(tmpdir(), `continuity-reference-${Date.now()}-${Math.random().toString(16).slice(2)}`); roots.push(root);
    const store = new ProjectStore(root);
    const input: CreateProjectInput = { title: "Reference Test", idea: "A person crosses a desert in a complete short film.", genre: "Drama", runtimeMinutes: 1, sequenceCount: 1, language: "English", visualStyle: "Cinema", mode: "phases", brain: "local", storyMode: "REFERENCE_FIRST", era: "1965", aspectRatio: "2.39:1", autoGenerateAssets: false, autoGenerateScenes: false, autoGenerateStoryboard: false };
    const project = await store.createProject(input, { kind: "builtin", label: "test", available: true });
    const manager = new ReferenceManager(store);
    expect(() => manager.completeSetup(project)).toThrow(/requires at least one/i);
    const reference = await manager.upload(project, { filename: "rashid.png", mimeType: "image/png", base64: png, name: "Rashid", type: "character", mainCharacter: true });
    manager.completeSetup(project);
    expect(reference.id).toBe("CHAR_MAIN_001_SOURCE");
    expect(reference.protected).toBe(true);
    await access(store.resolveProjectFile(project.id, reference.sourcePath));
    const story = filmRuleEngine.enforcePhaseArtifact(project, "story", { logline: "Test", synopsis: "Test", fullStory: "Test", acts: [], characters: [{ id: "CHAR_OTHER_001", name: "Someone", role: "Protagonist", description: "A person", relationships: [] }, { id: "CHAR_DUP_001", name: "Rashid", role: "Other protagonist", description: "Duplicate", relationships: [] }], locations: [], dialogueExcerpt: "" } satisfies StoryArtifact) as StoryArtifact;
    expect(story.characters.filter((item) => /protagonist/i.test(item.role))).toHaveLength(1);
    expect(story.characters[0]).toMatchObject({ id: "CHAR_MAIN_001", name: "Rashid" });
  });
});
