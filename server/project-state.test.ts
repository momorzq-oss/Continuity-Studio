import { describe, expect, it } from "vitest";
import type { MovieProject, ProjectConfig } from "../src/types.js";
import { createProductionWorkflow } from "./production-workflow.js";
import { applyProjectSetup, calculateSequenceCount } from "./project-state.js";

const config: ProjectConfig = {
  title: "Desert Film Project",
  movieTitle: "The Last Camp",
  idea: "A traveller finds an impossible camp in the 1965 UAE desert.",
  genre: "Folk Horror",
  runtimeMinutes: 6,
  sequenceCount: 45,
  language: "Arabic",
  visualStyle: "Grounded cinematic realism",
  mode: "phases",
  storyMode: "AI_FIRST",
  era: "1965 UAE",
  aspectRatio: "2.39:1",
  sequenceDurationSeconds: 8,
  resolution: "4K UHD",
  filmLanguage: "English",
  dialogueLanguage: "Arabic",
  audienceRating: "PG-13",
  targetPlatform: "Seedance",
  narrationEnabled: false,
  dialogueEnabled: true,
  musicEnabled: true,
  subtitlesEnabled: true,
  autoGenerateAssets: false,
  autoGenerateScenes: false,
  autoGenerateStoryboard: false,
};

const project = () => ({
  ...structuredClone(config),
  id: "desert-film-project-12345678",
  production: createProductionWorkflow(config),
}) as MovieProject;

describe("project state service", () => {
  it("calculates deterministic sequence counts with production limits", () => {
    expect(calculateSequenceCount(6, 30)).toBe(12);
    expect(calculateSequenceCount(180, 1)).toBe(120);
  });

  it("autosaves setup without locking and locks only on an explicit command", () => {
    const value = project();
    applyProjectSetup(value, { runtimeMinutes: 6, sequenceDurationSeconds: 30, dialogueLanguage: "Arabic" });
    expect(value.sequenceCount).toBe(12);
    expect(value.language).toBe("English / Arabic");
    expect(value.production.gates.find((gate) => gate.stage === "project_setup")?.status).toBe("READY");

    applyProjectSetup(value, {}, { lock: true });
    expect(value.production.gates.find((gate) => gate.stage === "project_setup")?.status).toBe("LOCKED");
    expect(value.production.currentStage).toBe("movie_dna");
  });
});
