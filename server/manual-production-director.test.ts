import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { MovieProject } from "../src/types.js";
import { startContinuityServer, type StartedContinuityServer } from "./runtime.js";

const roots: string[] = [];
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

afterEach(async () => {
  for (const root of roots.splice(0)) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try { await rm(root, { recursive: true, force: true }); break; }
      catch { await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1))); }
    }
  }
});

const json = async <T>(response: Response): Promise<T> => {
  const value = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(value.error || `Request failed: ${response.status}`);
  return value;
};

const describeEndToEnd = process.env.CONTINUITY_MANUAL_E2E === "1" ? describe : describe.skip;

describeEndToEnd("Manual Guided Production", () => {
  it("prefills recommendations, preserves a user DNA change, and resumes the exact incomplete stage after restart", async () => {
    const root = path.join(tmpdir(), `continuity-manual-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    await mkdir(path.join(root, "dist"), { recursive: true });
    const options = {
      workspaceRoot: process.cwd(), dataRoot: path.join(root, "projects"), settingsPath: path.join(root, "settings.json"),
      logsRoot: path.join(root, "logs"), distRoot: path.join(root, "dist"), production: true,
      version: "manual-test", host: "127.0.0.1", port: 0,
    } as const;
    let server: StartedContinuityServer | undefined;
    try {
      server = await startContinuityServer(options);
      const created = await json<MovieProject>(await fetch(`${server.url}/api/projects`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Desert Camp Production", movieTitle: "Desert Camp", idea: "A supernatural thriller about a man who gets lost in the desert at night and discovers a strange camp. It is tense, realistic, cinematic, and around six minutes.",
          genre: "Studio Brain selection", runtimeMinutes: 0.5, sequenceCount: 4, language: "English", visualStyle: "Studio Brain selection from the movie brief",
          mode: "phases", controlMode: "manual", brain: "hybrid", storyMode: "AI_FIRST", era: "Studio Brain selection", aspectRatio: "2.39:1",
          sequenceDurationSeconds: 8, resolution: "4K UHD", filmLanguage: "English", dialogueLanguage: "Arabic", audienceRating: "PG-13", targetPlatform: "Seedance",
          narrationEnabled: false, dialogueEnabled: true, musicEnabled: true, subtitlesEnabled: true, autoGenerateAssets: true, autoGenerateScenes: true, autoGenerateStoryboard: true,
        }),
      }));
      let project = await json<MovieProject>(await fetch(`${server.url}/api/projects/${created.id}/manual/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
      expect(project.manualProduction.currentStep).toBe("project_setup");
      expect(project.manualProduction.recommendations.map((item) => item.label)).toEqual(expect.arrayContaining(["Genre", "Cinematic Style", "Photography", "Camera style", "Lens", "Color Grade", "Lighting", "Image Feel", "Period", "Environment", "Aspect ratio", "Sequence duration", "Audio settings", "Platform profile"]));
      expect(Object.keys(project.production.movieDna.selections).length).toBeGreaterThan(10);
      expect(project.genre).not.toBe("Studio Brain selection");

      const manual = async (action: "back" | "save" | "next") => json<MovieProject>(await fetch(`${server!.url}/api/projects/${created.id}/manual/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }));
      project = await manual("next");
      expect(project.manualProduction.currentStep).toBe("movie_dna");
      project = await json<MovieProject>(await fetch(`${server.url}/api/projects/${created.id}/workflow/actions`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_dna", payload: { key: "cameraMovement", optionIds: ["move_handheld"] } }),
      }));
      expect(project.production.movieDna.selections.cameraMovement?.optionIds).toEqual(["move_handheld"]);
      project = await manual("next");
      expect(project.manualProduction.currentStep).toBe("movie_dna_board");
      project = await manual("next");
      expect(project.production.movieDna.status).toBe("LOCKED");
      expect(project.manualProduction.currentStep).toBe("story");
      project = await manual("next");
      expect(project.manualProduction.currentStep).toBe("story");
      expect(project.production.story.version).toBeGreaterThan(0);
      project = await manual("next");
      expect(project.manualProduction.currentStep).toBe("film_bible");
      project = await manual("next");
      expect(project.production.filmBible.version).toBeGreaterThan(0);
      project = await manual("next");
      expect(project.manualProduction.currentStep).toBe("characters");
      project = await manual("next");
      expect(project.production.characters.length).toBeGreaterThan(0);
      project = await manual("next");
      expect(project.manualProduction.currentStep).toBe("character_sheets");

      const blocked = await fetch(`${server.url}/api/projects/${created.id}/manual/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "next" }) });
      expect(blocked.status).toBe(409);
      expect((await blocked.json() as { error: string }).error).toMatch(/Main Character reference or Generate Main Character is required/);

      project = await json<MovieProject>(await fetch(`${server.url}/api/projects/${created.id}/references`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "main-character.png", mimeType: "image/png", base64: png, name: "The Traveller", type: "character", mainCharacter: true, storyUsage: "REQUIRED", roles: ["IDENTITY"] }),
      }));
      expect(project.preStorySetup.mainCharacterReferenceId).toBeTruthy();

      await server.close();
      server = await startContinuityServer(options);
      const reopened = await json<MovieProject>(await fetch(`${server.url}/api/projects/${created.id}`));
      expect(reopened.controlMode).toBe("manual");
      expect(reopened.manualProduction.currentStep).toBe("character_sheets");
      expect(reopened.production.movieDna.selections.cameraMovement?.optionIds).toEqual(["move_handheld"]);
      expect(reopened.preStorySetup.mainCharacterReferenceId).toBeTruthy();
      const resumed = await json<MovieProject>(await fetch(`${server.url}/api/projects/${created.id}/manual/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "next" }) }));
      expect(resumed.manualProduction.currentStep).toBe("asset_manifest");
    } finally {
      await server?.close().catch(() => undefined);
    }
  }, 60_000);
});

describeEndToEnd("Manual Guided Production end-to-end", () => {
  it("moves from one brief through every guided production stage and completes at Export", async () => {
    const root = path.join(tmpdir(), `continuity-manual-e2e-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    await mkdir(path.join(root, "dist"), { recursive: true });
    const options = {
      workspaceRoot: process.cwd(), dataRoot: path.join(root, "projects"), settingsPath: path.join(root, "settings.json"),
      logsRoot: path.join(root, "logs"), distRoot: path.join(root, "dist"), production: true,
      version: "manual-e2e", host: "127.0.0.1", port: 0,
    } as const;
    const server = await startContinuityServer(options);
    try {
      const created = await json<MovieProject>(await fetch(`${server.url}/api/projects`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Guided Film Production", movieTitle: "Guided Film", idea: "A tense cinematic mystery about a traveller who discovers an abandoned observatory and must prevent a dangerous signal before sunrise.",
          genre: "Studio Brain selection", runtimeMinutes: 0.5, sequenceCount: 4, language: "English", visualStyle: "Studio Brain selection from the movie brief",
          mode: "phases", controlMode: "manual", brain: "hybrid", storyMode: "AI_FIRST", era: "Studio Brain selection", aspectRatio: "2.39:1",
          sequenceDurationSeconds: 8, resolution: "4K UHD", filmLanguage: "English", dialogueLanguage: "English", audienceRating: "PG-13", targetPlatform: "Seedance",
          narrationEnabled: false, dialogueEnabled: true, musicEnabled: true, subtitlesEnabled: true, autoGenerateAssets: true, autoGenerateScenes: true, autoGenerateStoryboard: true,
        }),
      }));
      let project = await json<MovieProject>(await fetch(`${server.url}/api/projects/${created.id}/manual/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
      const visited = new Set<string>([project.manualProduction.currentStep]);
      for (let iteration = 0; iteration < 35 && project.manualProduction.status !== "COMPLETE"; iteration += 1) {
        if (project.manualProduction.currentStep === "character_sheets" && !project.preStorySetup.mainCharacterReferenceId) {
          project = await json<MovieProject>(await fetch(`${server.url}/api/projects/${created.id}/references`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: "main-character.png", mimeType: "image/png", base64: png, name: "The Traveller", type: "character", mainCharacter: true, storyUsage: "REQUIRED", roles: ["IDENTITY"] }),
          }));
        }
        project = await json<MovieProject>(await fetch(`${server.url}/api/projects/${created.id}/manual/actions`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "next" }),
        }));
        visited.add(project.manualProduction.currentStep);
      }
      expect(project.manualProduction.status, `Stopped at ${project.manualProduction.currentStep}; assets ${project.production.assets.filter((asset) => asset.imagePath).length}/${project.production.assets.length}; script ${project.memory.productionMemory.script.status}; prompts ${Object.keys(project.production.promptWorkspace.records).length}`).toBe("COMPLETE");
      expect(project.manualProduction.currentStep).toBe("export");
      expect(project.status).toBe("complete");
      expect([...visited]).toEqual(expect.arrayContaining(["project_setup", "movie_dna", "movie_dna_board", "story", "film_bible", "characters", "character_sheets", "asset_manifest", "asset_generation", "story_timeline", "continuity_ledger", "audio_bible", "full_script", "dialogue", "shot_planner", "sequence_planner", "sequence_workspace", "export"]));
      expect(project.production.assets.filter((asset) => asset.required !== false && asset.canGenerate !== false).every((asset) => Boolean(asset.imagePath) && ["APPROVED", "LOCKED"].includes(asset.status))).toBe(true);
      expect(project.memory.productionMemory.storyTimeline.events.length).toBeGreaterThan(0);
      expect(project.memory.productionMemory.continuity.snapshots.length).toBeGreaterThan(0);
      expect(project.memory.productionMemory.script.status).toBe("APPROVED");
      expect(project.memory.productionMemory.script.dialogue.every((line) => line.lockState === "LOCKED")).toBe(true);
      expect(project.memory.productionMemory.script.shots.length).toBeGreaterThan(0);
      expect(project.memory.productionMemory.script.sequences).toHaveLength(project.sequenceCount);
      expect(Object.values(project.production.promptWorkspace.records)).toHaveLength(project.sequenceCount);
      const exportResponse = await fetch(`${server.url}/api/projects/${created.id}/export`);
      expect(exportResponse.ok).toBe(true);
      expect(exportResponse.headers.get("content-type")).toMatch(/application\/zip/);
      expect((await exportResponse.arrayBuffer()).byteLength).toBeGreaterThan(1_000);
    } finally {
      await server.close();
    }
  }, 180_000);
});
