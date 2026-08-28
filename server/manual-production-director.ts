import type {
  ManualGuidedRecommendation,
  ManualGuidedStepId,
  MovieProject,
  TargetPlatform,
} from "../src/types.js";
import { MANUAL_GUIDED_STEP_IDS } from "../src/types.js";
import { AssetMaker } from "./asset-maker.js";
import { FilmBibleService } from "./film-bible.js";
import { MovieDnaService } from "./movie-dna-service.js";
import { applyProjectSetup } from "./project-state.js";
import {
  analyzeCharacters,
  approveAssets,
  approveCharacters,
  approveFilmBible,
  approveStory,
  buildAssetManifest,
  lockMovieDna,
  planSequences,
} from "./production-workflow.js";
import { rebuildProductionMemory, updateAudioBible } from "./production-memory.js";
import {
  approveProductionScript,
  generateProductionScript,
  setDialogueApproval,
  syncLegacySequences,
} from "./script-workflow.js";
import { compileAllSequencePrompts } from "./sequence-workspace.js";
import { StoryBrain } from "./story-brain.js";
import type { ProjectStore } from "./store.js";

const stamp = () => new Date().toISOString();
const isApproved = (status?: string) => status === "APPROVED" || status === "LOCKED";

export class ManualProductionConflictError extends Error {}

export class ManualProductionDirector {
  constructor(
    private readonly store: ProjectStore,
    private readonly movieDna: MovieDnaService,
    private readonly storyBrain: StoryBrain,
    private readonly filmBible: FilmBibleService,
    private readonly assetMaker: AssetMaker,
  ) {}

  async start(projectId: string) {
    const project = await this.store.getProject(projectId);
    if (project.status === "running") throw new ManualProductionConflictError("Wait for the current production task before starting Manual Guided Mode.");
    project.controlMode = "manual";
    project.mode = "phases";
    const state = project.manualProduction;
    state.status = "ACTIVE";
    state.currentStep = "project_setup";
    state.completedSteps = [];
    state.visitedSteps = ["project_setup"];
    state.briefCompletedAt ??= stamp();
    if (!project.production.movieDna.recommendation && project.production.movieDna.status !== "LOCKED") {
      await this.movieDna.recommend(project, project.idea);
      this.movieDna.applyRecommendation(project);
    }
    this.applyRecommendations(project);
    state.recommendations = this.recommendationSummary(project);
    state.recommendationCreatedAt = stamp();
    state.updatedAt = state.recommendationCreatedAt;
    state.lastSavedAt = state.updatedAt;
    project.messages.push({
      id: crypto.randomUUID(), role: "agent",
      content: "Manual Guided Mode analysed the movie brief and prepared editable Project Setup and Visual Movie DNA recommendations. Review each stage, then use the guided BACK, SAVE, and NEXT controls.",
      createdAt: state.updatedAt,
    });
    await this.store.saveProject(project);
    return project;
  }

  async action(projectId: string, action: "back" | "save" | "next") {
    const project = await this.store.getProject(projectId);
    if (project.controlMode !== "manual") throw new ManualProductionConflictError("Switch this project to Manual Mode before using the guided controls.");
    if (project.status === "running") throw new ManualProductionConflictError("Wait for the current production task before continuing.");
    if (action === "back") this.moveBack(project);
    else if (action === "save") this.markSaved(project);
    else await this.moveNext(project);
    await this.store.saveProject(project);
    return project;
  }

  private applyRecommendations(project: MovieProject) {
    const selection = project.production.movieDna.selections;
    const platform = project.manualProduction.preferredPlatform ?? this.selectPlatform(project);
    const durationChoices = project.production.platformProfiles[platform].durationSupport.filter((value) => value <= project.production.platformProfiles[platform].maxDurationSeconds);
    const sequenceDurationSeconds = durationChoices.sort((left, right) => Math.abs(left - project.sequenceDurationSeconds) - Math.abs(right - project.sequenceDurationSeconds))[0] ?? project.sequenceDurationSeconds;
    applyProjectSetup(project, {
      genre: selection.genre?.label || project.genre,
      era: selection.historicalPeriod?.label || project.era,
      aspectRatio: selection.aspectRatio?.label || project.aspectRatio,
      targetPlatform: platform,
      sequenceDurationSeconds,
    });
    project.visualStyle = [
      selection.cinematography?.label,
      selection.photography?.label,
      selection.cameraMovement?.label,
      selection.lensStyle?.label,
      selection.colorGrade?.label,
      selection.lighting?.label,
      selection.texture?.label,
      selection.realism?.label,
    ].filter(Boolean).join(" · ") || project.visualStyle;
  }

  private recommendationSummary(project: MovieProject): ManualGuidedRecommendation[] {
    const selection = project.production.movieDna.selections;
    const item = (label: string, value: string | undefined, reason: string): ManualGuidedRecommendation => ({ label, value: value || "Story-defined", reason });
    return [
      item("Genre", selection.genre?.label, "Matched to the conflict, tone, and audience signals in the brief."),
      item("Genre combination", selection.genre?.optionIds?.length && selection.genre.optionIds.length > 1 ? selection.genre.label : "Single focused genre", "Multiple genres are combined only when the brief contains strong compatible signals."),
      item("Cinematic Style", selection.cinematography?.label, "Supports the requested dramatic feeling without changing the story."),
      item("Photography", selection.photography?.label, "Provides a repeatable image-capture language."),
      item("Camera style", selection.cameraMovement?.label || selection.framing?.label, "Keeps movement and framing coherent across sequences."),
      item("Lens", selection.lensStyle?.label, "Creates a stable perspective and depth signature."),
      item("Color Grade", selection.colorGrade?.label, "Carries the intended emotional palette through the film."),
      item("Lighting", selection.lighting?.label, "Matches the environment and time cues in the brief."),
      item("Image Feel", [selection.texture?.label, selection.realism?.label].filter(Boolean).join(" · "), "Combines surface texture with the chosen realism level."),
      item("Period", selection.historicalPeriod?.label || project.era, "Keeps technology, wardrobe, and production design period-correct."),
      item("Environment", selection.environment?.label, "Uses the world described by the brief without imposing a default country."),
      item("Aspect ratio", project.aspectRatio, "Fits the recommended visual composition and delivery profile."),
      item("Sequence duration", `${project.sequenceDurationSeconds} seconds`, "Uses a duration supported by the selected versioned Platform Profile."),
      item("Audio settings", `${project.dialogueEnabled ? `${project.dialogueLanguage} dialogue` : "No dialogue"}; ${project.musicEnabled ? "music enabled" : "no music"}; ${project.narrationEnabled ? "narration enabled" : "no narration"}`, "Preserves the language and track choices supplied in the brief."),
      item("Platform profile", project.targetPlatform, project.manualProduction.preferredPlatform ? "Uses the optional platform requested by the user." : "Best fit among the current versioned Platform Profiles."),
    ];
  }

  private selectPlatform(project: MovieProject): TargetPlatform {
    const profiles = Object.values(project.production.platformProfiles).filter((profile) => profile.platform !== "Custom");
    const scored = profiles.map((profile) => ({
      platform: profile.platform,
      score: (profile.maxDurationSeconds >= project.sequenceDurationSeconds ? 50 : -100)
        + (profile.durationSupport.includes(project.sequenceDurationSeconds) ? 10 : 0)
        + (profile.aspectRatioSupport.includes(project.aspectRatio) ? 5 : 0)
        + profile.maxReferences,
    })).sort((left, right) => right.score - left.score);
    return scored[0]?.platform ?? project.targetPlatform;
  }

  private moveBack(project: MovieProject) {
    const state = project.manualProduction;
    const index = MANUAL_GUIDED_STEP_IDS.indexOf(state.currentStep);
    if (index <= 0) return this.markSaved(project);
    state.currentStep = MANUAL_GUIDED_STEP_IDS[index - 1];
    state.visitedSteps = [...new Set([...state.visitedSteps, state.currentStep])];
    state.updatedAt = stamp();
  }

  private markSaved(project: MovieProject) {
    project.manualProduction.lastSavedAt = stamp();
    project.manualProduction.updatedAt = project.manualProduction.lastSavedAt;
  }

  private advance(project: MovieProject) {
    const state = project.manualProduction;
    const index = MANUAL_GUIDED_STEP_IDS.indexOf(state.currentStep);
    if (!state.completedSteps.includes(state.currentStep)) state.completedSteps.push(state.currentStep);
    if (index >= MANUAL_GUIDED_STEP_IDS.length - 1) {
      state.status = "COMPLETE";
      state.currentStep = "export";
    } else {
      state.currentStep = MANUAL_GUIDED_STEP_IDS[index + 1];
      state.visitedSteps = [...new Set([...state.visitedSteps, state.currentStep])];
    }
    state.lastSavedAt = stamp();
    state.updatedAt = state.lastSavedAt;
  }

  private mainCharacterReady(project: MovieProject) {
    if (project.preStorySetup.mainCharacterReferenceId) return true;
    return project.production.assets.some((asset) => asset.category === "main_character" && Boolean(asset.imagePath));
  }

  private async moveNext(project: MovieProject) {
    const state = project.manualProduction;
    const stay = () => this.markSaved(project);
    switch (state.currentStep) {
      case "project_setup":
        applyProjectSetup(project, {}, { lock: true });
        return this.advance(project);
      case "movie_dna":
        if (!Object.keys(project.production.movieDna.selections).length) throw new ManualProductionConflictError("NEXT unavailable. Apply at least one Visual Movie DNA recommendation first.");
        return this.advance(project);
      case "movie_dna_board":
        if (project.production.movieDna.status !== "LOCKED") lockMovieDna(project);
        return this.advance(project);
      case "story":
        if (!project.production.story.version) {
          await this.storyBrain.generate(project, project.idea, "AI");
          return stay();
        }
        if (!isApproved(project.production.story.status)) approveStory(project);
        return this.advance(project);
      case "film_bible":
        if (!project.production.filmBible.version) {
          await this.filmBible.generate(project);
          return stay();
        }
        if (!isApproved(project.production.filmBible.status)) approveFilmBible(project);
        return this.advance(project);
      case "characters":
        if (!project.production.characters.length) {
          analyzeCharacters(project);
          return stay();
        }
        if (!project.production.characters.every((character) => isApproved(character.status))) approveCharacters(project);
        return this.advance(project);
      case "character_sheets":
        if (!this.mainCharacterReady(project)) throw new ManualProductionConflictError("NEXT unavailable. Main Character reference or Generate Main Character is required.");
        return this.advance(project);
      case "asset_manifest":
        if (!project.production.assets.length) {
          buildAssetManifest(project);
          return stay();
        }
        return this.advance(project);
      case "asset_generation": {
        const required = project.production.assets.filter((asset) => asset.required !== false && asset.canGenerate !== false);
        const missing = required.filter((asset) => !asset.imagePath);
        if (missing.length) {
          await this.assetMaker.generateAllAssets(project, false);
          return stay();
        }
        if (!required.every((asset) => isApproved(asset.status))) approveAssets(project);
        return this.advance(project);
      }
      case "story_timeline":
        if (!project.memory.productionMemory.storyTimeline.events.length) rebuildProductionMemory(project);
        return this.advance(project);
      case "continuity_ledger":
        if (!project.memory.productionMemory.continuity.snapshots.length) rebuildProductionMemory(project);
        return this.advance(project);
      case "audio_bible":
        if (!isApproved(project.memory.productionMemory.audioBible.status)) updateAudioBible(project, { status: "APPROVED", reason: "User approved the Studio Brain audio recommendations in Manual Guided Mode." });
        return this.advance(project);
      case "full_script":
        if (!project.memory.productionMemory.script.scriptVersion) {
          generateProductionScript(project, "User requested Full Script generation from Manual Guided Mode.");
          return stay();
        }
        if (!isApproved(project.memory.productionMemory.script.status)) approveProductionScript(project, false);
        return this.advance(project);
      case "dialogue":
        for (const line of project.memory.productionMemory.script.dialogue) if (line.lockState !== "LOCKED") setDialogueApproval(project, line.id, "LOCK");
        return this.advance(project);
      case "shot_planner":
        if (!project.memory.productionMemory.script.shots.length) throw new ManualProductionConflictError("NEXT unavailable. Generate Full Script first so the Shot Planner has intentional shots to review.");
        return this.advance(project);
      case "sequence_planner":
        if (!project.memory.productionMemory.script.sequences.length) {
          planSequences(project);
          syncLegacySequences(project);
          return stay();
        }
        return this.advance(project);
      case "sequence_workspace":
        if (!Object.keys(project.production.promptWorkspace.records).length) {
          compileAllSequencePrompts(project, project.targetPlatform);
          return stay();
        }
        return this.advance(project);
      case "export":
        state.status = "COMPLETE";
        if (!state.completedSteps.includes("export")) state.completedSteps.push("export");
        project.status = "complete";
        return stay();
    }
  }
}
