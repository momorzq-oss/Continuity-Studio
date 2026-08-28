import { access, mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { MovieProject } from "../src/types.js";
import { startContinuityServer, type StartedContinuityServer } from "./runtime.js";

const roots: string[] = [];
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

const json = async <T>(response: Response): Promise<T> => {
  const value = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(value.error || `Request failed: ${response.status}`);
  return value;
};

const waitFor = async (url: string, projectId: string, statuses: string[], timeoutMs = 90_000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const project = await json<MovieProject>(await fetch(`${url}/api/projects/${projectId}`));
    if (statuses.includes(project.automaticProduction.status)) return project;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Automatic production did not reach ${statuses.join(" or ")} within ${timeoutMs}ms.`);
};

const describeEndToEnd = process.env.CONTINUITY_E2E === "1" ? describe : describe.skip;

describeEndToEnd("Automatic Production Director end-to-end", () => {
  it("survives a server restart, pauses for an uploaded identity, and completes the production package", async () => {
    const root = path.join(tmpdir(), `continuity-automatic-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    await mkdir(path.join(root, "dist"), { recursive: true });
    const options = {
      workspaceRoot: process.cwd(),
      dataRoot: path.join(root, "projects"),
      settingsPath: path.join(root, "settings.json"),
      logsRoot: path.join(root, "logs"),
      distRoot: path.join(root, "dist"),
      production: true,
      version: "automatic-test",
      host: "127.0.0.1",
      port: 0,
    } as const;
    let server: StartedContinuityServer | undefined;
    try {
      server = await startContinuityServer(options);
      const created = await json<MovieProject>(await fetch(`${server.url}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Neon Memory Production",
          movieTitle: "Neon Memory",
          idea: "A Japanese cyberpunk detective in near-future Tokyo discovers that a stolen memory can prevent a citywide artificial-intelligence disaster. Make it emotional, tense, globally cinematic, and end with a hopeful sacrifice.",
          genre: "Studio Brain selection",
          runtimeMinutes: 0.5,
          sequenceCount: 4,
          language: "Japanese / English",
          visualStyle: "Studio Brain selection from the movie brief",
          mode: "full",
          controlMode: "automatic",
          brain: "hybrid",
          storyMode: "AI_FIRST",
          era: "Studio Brain selection",
          aspectRatio: "2.39:1",
          sequenceDurationSeconds: 8,
          resolution: "4K UHD",
          filmLanguage: "Japanese",
          dialogueLanguage: "Japanese",
          audienceRating: "PG-13",
          targetPlatform: "Seedance",
          narrationEnabled: false,
          dialogueEnabled: true,
          musicEnabled: true,
          subtitlesEnabled: true,
          autoGenerateAssets: true,
          autoGenerateScenes: true,
          autoGenerateStoryboard: true,
          mainCharacterPreference: "Japanese woman detective in her thirties; ask for my identity image",
        }),
      }));
      await json<MovieProject>(await fetch(`${server.url}/api/projects/${created.id}/automatic/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
      const waiting = await waitFor(server.url, created.id, ["WAITING_FOR_MAIN_CHARACTER", "FAILED"]);
      expect(waiting.automaticProduction.status, waiting.automaticProduction.lastError).toBe("WAITING_FOR_MAIN_CHARACTER");
      expect(waiting.production.movieDna.status).toBe("LOCKED");
      expect(waiting.production.story.status).toBe("LOCKED");
      expect(waiting.production.filmBible.status).toBe("LOCKED");
      expect(waiting.production.characters.length).toBeGreaterThan(0);
      expect(waiting.production.movieDna.selections.location?.label).toMatch(/Japan|Tokyo/i);
      expect(`${waiting.production.movieDna.selections.location?.label} ${waiting.production.movieDna.selections.environment?.label}`).not.toMatch(/United Arab Emirates|Desert/i);

      const completedBeforeRestart = waiting.automaticProduction.stages.filter((stage) => stage.status === "COMPLETE").map((stage) => stage.id);
      await server.close();
      server = await startContinuityServer(options);
      const reopened = await json<MovieProject>(await fetch(`${server.url}/api/projects/${created.id}`));
      expect(reopened.automaticProduction.status).toBe("WAITING_FOR_MAIN_CHARACTER");
      expect(reopened.automaticProduction.stages.filter((stage) => stage.status === "COMPLETE").map((stage) => stage.id)).toEqual(completedBeforeRestart);

      const uploaded = await json<MovieProject>(await fetch(`${server.url}/api/projects/${created.id}/references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "main-character.png", mimeType: "image/png", base64: png, name: "Aiko", type: "character", mainCharacter: true, storyUsage: "REQUIRED", roles: ["IDENTITY"] }),
      }));
      const referenceId = uploaded.preStorySetup.mainCharacterReferenceId!;
      await json<MovieProject>(await fetch(`${server.url}/api/projects/${created.id}/references/${referenceId}/generate-sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      }));
      const completed = await waitFor(server.url, created.id, ["COMPLETE", "FAILED", "NEEDS_USER_REVIEW"], 120_000);
      expect(completed.automaticProduction.status, completed.automaticProduction.lastError || completed.automaticProduction.stages.find((stage) => stage.status !== "COMPLETE")?.note).toBe("COMPLETE");
      expect(completed.status).toBe("complete");
      expect(completed.automaticProduction.stages.every((stage) => stage.status === "COMPLETE")).toBe(true);
      expect(completed.automaticProduction.history.map((entry) => entry.action)).toEqual(expect.arrayContaining(["MOVIE_DNA_SELECTED", "MAIN_CHARACTER_CHECKPOINT", "MAIN_CHARACTER_READY", "ASSET_INSPECTION", "PROMPTS_COMPILED", "REFERENCE_PACKS_READY", "PRODUCTION_PACKAGE_READY"]));

      const reference = completed.memory.database.projectReferences.find((item) => item.id === referenceId)!;
      expect(reference.protected).toBe(true);
      await access(server.store.resolveProjectFile(completed.id, reference.sourcePath));
      const mainAssetId = reference.assetId ?? reference.linkedAssetIds[0]!;
      const sheet = completed.memory.database.continuitySheets.find((item) => item.assetId === mainAssetId)!;
      expect(sheet.views.map((view) => view.angle)).toEqual(expect.arrayContaining(["FULL_BODY_FRONT", "FULL_BODY_SIDE", "FULL_BODY_BACK", "FRONT", "LEFT_PROFILE", "THREE_QUARTER", "CLOSE_FACE", "NEUTRAL_EXPRESSION"]));
      expect(sheet.views.every((view) => Boolean(view.imagePath))).toBe(true);
      const sheetJobs = completed.memory.database.imageGenerationJobs.filter((job) => job.targetType === "SHEET_VIEW" && job.targetId.startsWith(sheet.id));
      expect(sheetJobs.every((job) => /neutral character-sheet lighting/i.test(job.prompt))).toBe(true);

      const numbered = completed.production.assets.map((asset) => asset.number);
      expect(new Set(numbered).size).toBe(numbered.length);
      expect(numbered.every((number) => Number.isInteger(number) && number > 0)).toBe(true);
      expect(completed.production.assets.filter((asset) => asset.status === "GENERATION_FAILED")).toHaveLength(0);
      const flatAssets = await readdir(path.join(server.store.projectPath(completed.id), "assets"));
      expect(flatAssets.some((filename) => /^\d+_/.test(filename))).toBe(true);

      expect(completed.memory.productionMemory.storyTimeline.status).toBe("READY");
      expect(completed.memory.productionMemory.continuity.snapshots.length).toBeGreaterThan(0);
      expect(completed.memory.productionMemory.audioBible.status).toBe("LOCKED");
      expect(completed.memory.productionMemory.script.status).toBe("LOCKED");
      expect(completed.memory.productionMemory.script.dialogue.every((line) => line.lockState === "LOCKED")).toBe(true);
      expect(completed.memory.productionMemory.script.shots.length).toBeGreaterThan(0);
      expect(completed.memory.productionMemory.script.sequences).toHaveLength(completed.sequenceCount);
      expect(Object.values(completed.production.promptWorkspace.records)).toHaveLength(completed.sequenceCount);
      expect(Object.values(completed.production.promptWorkspace.records).every((record) => record.normalPrompt.length > 0 && record.jsonPrompt.length > 0 && record.state.references.filter((referenceEntry) => referenceEntry.selected).every((referenceEntry, index) => referenceEntry.platformUploadPosition === index + 1))).toBe(true);

      const packageResponse = await fetch(`${server.url}/api/projects/${completed.id}/sequences/reference-packages?platform=${completed.targetPlatform}`);
      expect(packageResponse.ok).toBe(true);
      expect((await packageResponse.arrayBuffer()).byteLength).toBeGreaterThan(100);
    } finally {
      await server?.close().catch(() => undefined);
    }
  }, 150_000);
});
