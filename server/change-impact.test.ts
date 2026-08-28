import { describe, expect, it } from "vitest";
import type { MovieProject, ProductionAssetRecord, ProjectConfig } from "../src/types.js";
import { assessChangeImpact } from "./change-impact.js";
import { createProductionWorkflow } from "./production-workflow.js";

const config: ProjectConfig = {
  title: "Impact Test", movieTitle: "Impact Test", idea: "A complete narrative idea for impact testing.", genre: "Drama", runtimeMinutes: 1, sequenceCount: 2,
  language: "English", visualStyle: "Natural", mode: "phases", storyMode: "AI_FIRST", era: "1965", aspectRatio: "2.39:1", sequenceDurationSeconds: 30,
  resolution: "4K UHD", filmLanguage: "English", dialogueLanguage: "English", audienceRating: "PG-13", targetPlatform: "Seedance",
  narrationEnabled: false, dialogueEnabled: true, musicEnabled: true, subtitlesEnabled: true, autoGenerateAssets: false, autoGenerateScenes: false, autoGenerateStoryboard: false,
};

describe("change impact engine", () => {
  it("reports downstream sequence and continuity dependencies", () => {
    const project = { ...config, id: "impact-test-12345678", production: createProductionWorkflow(config) } as MovieProject;
    project.production.sequences = [
      { id: "SEQ-01", number: 1, title: "One", timeRange: "00:00–00:30", durationSeconds: 30, synopsis: "", startState: "", middleState: "", endState: "", shots: [], script: "", dialogue: [], assetIds: [], referenceSlots: [], promptSections: {}, compiledPrompt: "compiled", negativePrompt: "", status: "APPROVED", inspectionNotes: [], generationHistory: [] },
      { id: "SEQ-02", number: 2, title: "Two", timeRange: "00:30–01:00", durationSeconds: 30, synopsis: "", startState: "", middleState: "", endState: "", shots: [], script: "", dialogue: [], assetIds: [], referenceSlots: [], promptSections: {}, compiledPrompt: "compiled", negativePrompt: "", status: "LOCKED", inspectionNotes: [], generationHistory: [] },
    ];
    project.production.continuityLedger = [{ id: "LEDGER-02", sequenceId: "SEQ-02", entityId: "CHAR-01", state: "injured", source: "LOCKED", createdAt: new Date().toISOString() }];
    const report = assessChangeImpact(project, "sequence", "SEQ-01");
    expect(report.requiresReview).toBe(true);
    expect(report.items.some((item) => item.kind === "sequence" && item.id === "SEQ-02")).toBe(true);
    expect(report.items.some((item) => item.kind === "continuity" && item.id === "LEDGER-02")).toBe(true);
    expect(report.lockedCount).toBeGreaterThan(0);
  });

  it("reports manifest sequence and reference mappings before Sequence Workspace exists", () => {
    const project = { ...config, id: "impact-asset-12345678", production: createProductionWorkflow(config) } as MovieProject;
    project.production.assets = [{
      id: "PROP_LOCKED_001", number: 7, filename: "07_Locked_Prop.png", name: "Locked Prop", category: "prop",
      description: "Canonical story prop", continuityNotes: [], sequenceIds: ["SEQ_04", "SEQ_05"], referenceIds: [],
      dependencyIds: [], referenceRoles: ["PROP"], version: 1, status: "LOCKED", previousVersions: [], sourceType: "STORY",
      generationAttempts: [], versionHistory: [], referenceUsage: [
        { sequenceId: "SEQ_04", required: true, role: "Prop Reference" },
        { sequenceId: "SEQ_05", required: true, role: "Prop Reference" },
      ],
    } as ProductionAssetRecord];
    const report = assessChangeImpact(project, "asset", "PROP_LOCKED_001");
    expect(report.items.filter((item) => item.kind === "sequence").map((item) => item.id)).toEqual(["SEQ_04", "SEQ_05"]);
    expect(report.items.filter((item) => item.kind === "reference_pack")).toHaveLength(2);
  });
});
