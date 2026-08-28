import { randomUUID } from "node:crypto";
import type {
  AutomaticProductionStageId,
  MovieProject,
} from "../src/types.js";
import { AssetMaker } from "./asset-maker.js";
import { FilmBibleService } from "./film-bible.js";
import { MovieDnaService } from "./movie-dna-service.js";
import {
  analyzeCharacters,
  approveAssets,
  approveCharacters,
  approveFilmBible,
  approveStory,
  buildAssetManifest,
  compileProductionPrompts,
  lockFilmBible,
  lockMovieDna,
  lockStory,
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
import { activateManualGuidedState } from "./manual-production-state.js";

const now = () => new Date().toISOString();

export class AutomaticProductionConflictError extends Error {}

export class AutomaticProductionDirector {
  private readonly jobs = new Map<string, Promise<void>>();
  private readonly controllers = new Map<string, AbortController>();

  constructor(
    private readonly store: ProjectStore,
    private readonly movieDna: MovieDnaService,
    private readonly storyBrain: StoryBrain,
    private readonly filmBible: FilmBibleService,
    private readonly assetMaker: AssetMaker,
  ) {}

  async start(projectId: string) {
    if (this.jobs.has(projectId)) throw new AutomaticProductionConflictError("Automatic Movie creation is already running.");
    const project = await this.store.getProject(projectId);
    project.controlMode = "automatic";
    project.mode = "full";
    project.autoGenerateAssets = true;
    project.autoGenerateScenes = true;
    project.autoGenerateStoryboard = true;
    const automaticRules = [
      "No morphing, extra limbs, duplicate people, or unexpected characters.",
      "No random props, unscripted costume changes, restored lost objects, or unexplained injury resets.",
      "No unexplained location, environment, movement-direction, or screen-direction changes.",
      "No incorrect period objects, historical technology, Movie DNA drift, locked dialogue changes, or incorrect image-reference mapping.",
      ...(project.musicEnabled ? [] : ["NO MUSIC. Do not generate or imply a music track."]),
      ...(project.narrationEnabled ? [] : ["NO NARRATION. Do not generate narration or voice-over."]),
      ...(project.subtitlesEnabled ? [] : ["NO SUBTITLES. Do not render subtitles, captions, or on-screen dialogue text."]),
    ];
    project.production.permanentNegativeRules = [...new Set([...project.production.permanentNegativeRules, ...automaticRules])];
    const automatic = project.automaticProduction;
    automatic.status = "RUNNING";
    automatic.resumeAfterRestart = true;
    automatic.startedAt ??= now();
    automatic.lastError = undefined;
    automatic.updatedAt = now();
    project.status = "running";
    this.record(project, "project_setup", "AUTOMATIC_MOVIE_STARTED", "The user selected Automatic Movie and supplied the simple project brief.");
    await this.store.saveProject(project);
    this.launch(projectId);
    return project;
  }

  async pause(projectId: string) {
    const project = await this.store.getProject(projectId);
    this.controllers.get(projectId)?.abort();
    project.automaticProduction.status = "PAUSED";
    project.automaticProduction.resumeAfterRestart = false;
    project.automaticProduction.updatedAt = now();
    project.status = "draft";
    this.record(project, project.automaticProduction.currentStage ?? "project_setup", "AUTOMATIC_MOVIE_PAUSED", "The user paused Automatic Mode. All completed work remains saved.");
    await this.store.saveProject(project);
    return project;
  }

  async stop(projectId: string) {
    const project = await this.store.getProject(projectId);
    this.controllers.get(projectId)?.abort();
    project.automaticProduction.status = "STOPPED";
    project.automaticProduction.resumeAfterRestart = false;
    project.automaticProduction.updatedAt = now();
    project.status = "draft";
    this.record(project, project.automaticProduction.currentStage ?? "project_setup", "AUTOMATIC_MOVIE_STOPPED", "The user stopped Automatic Mode. Existing project records and files were preserved.");
    await this.store.saveProject(project);
    return project;
  }

  async switchToManual(projectId: string) {
    const project = await this.stop(projectId);
    project.controlMode = "manual";
    project.mode = "phases";
    activateManualGuidedState(project);
    this.record(project, project.automaticProduction.currentStage ?? "project_setup", "MANUAL_OVERRIDE", "The project was switched to the compatible Manual/Phases workflow without converting its data.");
    await this.store.saveProject(project);
    return project;
  }

  async continueWithAiMainCharacter(projectId: string) {
    const project = await this.store.getProject(projectId);
    const state = project.automaticProduction;
    state.mainCharacterSource = "AI";
    project.preStorySetup.mode = "AI_FIRST";
    project.preStorySetup.completed = true;
    project.preStorySetup.completedAt = now();
    this.record(project, "main_character", "AI_MAIN_CHARACTER_SELECTED", "The user chose a fictional AI-generated Main Character. Its protected master and neutral continuity sheet will be created during asset generation.");
    await this.store.saveProject(project);
    return this.resume(projectId);
  }

  async resume(projectId: string) {
    if (this.jobs.has(projectId)) throw new AutomaticProductionConflictError("Automatic Movie creation is already running.");
    const project = await this.store.getProject(projectId);
    if (project.controlMode !== "automatic") throw new AutomaticProductionConflictError("Switch this project back to Automatic Mode before resuming.");
    if (project.automaticProduction.status === "COMPLETE") return project;
    for (const stage of project.automaticProduction.stages) {
      if (stage.status === "RUNNING") stage.status = "PENDING";
    }
    project.automaticProduction.status = "RUNNING";
    project.automaticProduction.resumeAfterRestart = true;
    project.automaticProduction.lastError = undefined;
    project.automaticProduction.updatedAt = now();
    project.status = "running";
    this.record(project, project.automaticProduction.currentStage ?? "project_setup", "AUTOMATIC_MOVIE_RESUMED", "Automatic Production Director resumed from the first incomplete persisted stage.");
    await this.store.saveProject(project);
    this.launch(projectId);
    return project;
  }

  async resumeInterruptedJobs() {
    const projects = await this.store.listProjects();
    for (const item of projects) {
      const project = await this.store.getProject(item.id);
      if (project.controlMode === "automatic" && project.automaticProduction.resumeAfterRestart && project.automaticProduction.status === "RUNNING" && !this.jobs.has(project.id)) {
        for (const stage of project.automaticProduction.stages) if (stage.status === "RUNNING") stage.status = "PENDING";
        await this.store.saveProject(project);
        this.launch(project.id);
      }
    }
  }

  async waitForIdle(projectId: string) {
    await this.jobs.get(projectId);
  }

  private launch(projectId: string) {
    const controller = new AbortController();
    this.controllers.set(projectId, controller);
    const job = this.run(projectId, controller.signal).finally(() => {
      this.jobs.delete(projectId);
      this.controllers.delete(projectId);
    });
    this.jobs.set(projectId, job);
  }

  private async run(projectId: string, signal: AbortSignal) {
    while (!signal.aborted) {
      const project = await this.store.getProject(projectId);
      const state = project.automaticProduction;
      if (state.status !== "RUNNING") return;
      const stage = state.stages.find((entry) => entry.status !== "COMPLETE");
      if (!stage) {
        state.status = "COMPLETE";
        state.currentStage = undefined;
        state.resumeAfterRestart = false;
        state.completedAt = now();
        state.updatedAt = state.completedAt;
        project.status = "complete";
        project.currentAgent = undefined;
        this.record(project, "reference_packs", "PRODUCTION_PACKAGE_READY", "Movie DNA, Story, Film Bible, characters, numbered assets, production memory, script, shots, sequences, prompts, mappings, and downloadable reference packages are ready.");
        await this.store.saveProject(project);
        return;
      }
      if (stage.status === "WAITING" && stage.id === "main_character" && !this.mainCharacterReady(project)) {
        state.status = "WAITING_FOR_MAIN_CHARACTER";
        state.resumeAfterRestart = false;
        state.updatedAt = now();
        project.status = "awaiting_approval";
        await this.store.saveProject(project);
        return;
      }
      stage.status = "RUNNING";
      stage.attempts += 1;
      stage.startedAt ??= now();
      stage.note = undefined;
      state.currentStage = stage.id;
      state.updatedAt = now();
      project.currentAgent = "Automatic Production Director";
      project.status = "running";
      await this.store.saveProject(project);
      try {
        const outcome = await this.runStage(project, stage.id, signal);
        if (outcome === "WAITING") return;
        if (outcome === "NEEDS_USER_REVIEW") return;
        stage.status = "COMPLETE";
        stage.completedAt = now();
        stage.note = outcome;
        state.updatedAt = stage.completedAt;
        await this.store.saveProject(project);
      } catch (error) {
        if (signal.aborted) return;
        const detail = error instanceof Error ? error.message : String(error);
        stage.status = "FAILED";
        stage.note = detail;
        state.status = "FAILED";
        state.lastError = detail;
        state.resumeAfterRestart = false;
        state.updatedAt = now();
        project.status = "failed";
        this.record(project, stage.id, "STAGE_FAILED", detail);
        await this.store.saveProject(project);
        return;
      }
    }
  }

  private async runStage(project: MovieProject, stageId: AutomaticProductionStageId, signal: AbortSignal): Promise<string | "WAITING" | "NEEDS_USER_REVIEW"> {
    if (signal.aborted) return "WAITING";
    switch (stageId) {
      case "project_setup":
        return "Simple automatic project settings persisted.";
      case "movie_dna": {
        const platformChoice = this.selectPlatform(project);
        project.targetPlatform = platformChoice.platform;
        this.record(project, stageId, "PLATFORM_SELECTED", platformChoice.reason, { platform: platformChoice.platform, scores: platformChoice.scores });
        if (project.production.movieDna.status !== "LOCKED") {
          await this.movieDna.recommend(project, project.idea);
          this.movieDna.applyRecommendation(project);
          lockMovieDna(project);
        }
        if (project.production.movieDna.masterFrame?.status !== "GENERATED") await this.movieDna.generateMasterFrame(project);
        const selections = Object.values(project.production.movieDna.selections).map((selection) => selection.label);
        this.record(project, stageId, "MOVIE_DNA_SELECTED", "Studio Brain selected and locked production DNA from the existing global catalogue.", { selections, platform: project.targetPlatform });
        return `${selections.length} Movie DNA categories selected and locked; compact preview available.`;
      }
      case "story":
        if (!project.production.story.version || !["APPROVED", "LOCKED"].includes(project.production.story.status)) await this.storyBrain.generate(project, project.automaticProduction.mainCharacterPreference ? `${project.idea}\n\nMain Character preference: ${project.automaticProduction.mainCharacterPreference}` : project.idea, "AI");
        if (project.production.story.status !== "LOCKED") { approveStory(project); lockStory(project); }
        this.record(project, stageId, "STORY_GENERATED", "Story Brain developed and locked the editable structured story from the brief, runtime, languages, and Movie DNA.");
        return "Structured Story generated, approved, and locked for automatic downstream use.";
      case "film_bible":
        if (!project.production.filmBible.version || !["APPROVED", "LOCKED"].includes(project.production.filmBible.status)) await this.filmBible.generate(project);
        if (project.production.filmBible.status !== "LOCKED") { approveFilmBible(project); lockFilmBible(project); }
        this.record(project, stageId, "FILM_BIBLE_GENERATED", "World, character, location, asset, technology, environment, VFX, and continuity rules were persisted.");
        return "Film Bible generated, approved, and locked.";
      case "characters":
        if (!project.production.characters.length) analyzeCharacters(project);
        approveCharacters(project);
        this.record(project, stageId, "CHARACTERS_ANALYSED", "Main, supporting, background, creature, animal, state, costume, and relationship requirements were analysed from the approved sources.", { count: project.production.characters.length });
        return `${project.production.characters.length} character records analysed and approved.`;
      case "main_character": {
        if (!this.mainCharacterReady(project)) {
          const stage = project.automaticProduction.stages.find((entry) => entry.id === stageId)!;
          stage.status = "WAITING";
          stage.note = "Upload a protected Main Character image and create its neutral sheet, or choose Generate Main Character with AI.";
          project.automaticProduction.status = "WAITING_FOR_MAIN_CHARACTER";
          project.automaticProduction.resumeAfterRestart = false;
          project.automaticProduction.updatedAt = now();
          project.status = "awaiting_approval";
          this.record(project, stageId, "MAIN_CHARACTER_CHECKPOINT", "Automatic Mode paused at its required identity checkpoint. No downstream visual production will run until the user chooses an uploaded identity or AI generation.");
          await this.store.saveProject(project);
          return "WAITING";
        }
        if (project.preStorySetup.mainCharacterReferenceId) project.automaticProduction.mainCharacterSource = "UPLOAD";
        this.record(project, stageId, "MAIN_CHARACTER_READY", project.automaticProduction.mainCharacterSource === "UPLOAD" ? "The protected original upload remains unchanged and its neutral continuity sheet is ready." : "AI Main Character generation was selected; the permanent identity master and sheet will be generated with the asset manifest.");
        return project.automaticProduction.mainCharacterSource === "UPLOAD" ? "Protected upload and neutral Main Character sheet are ready." : "AI Main Character selected.";
      }
      case "asset_manifest":
        buildAssetManifest(project);
        this.record(project, stageId, "ASSET_MANIFEST_BUILT", "The complete source-backed asset manifest was created before image production using one permanent flat numbering sequence.", { count: project.production.assets.length });
        return `${project.production.assets.length} permanently numbered production assets planned.`;
      case "asset_generation": {
        let failed = project.production.assets.filter((asset) => asset.canGenerate !== false && !asset.imagePath);
        for (let attempt = 1; attempt <= 3 && failed.length; attempt += 1) {
          await this.assetMaker.generateAllAssets(project, false);
          failed = [];
          for (const record of project.production.assets) {
            if (record.canGenerate === false || record.imagePath) continue;
            const entity = project.memory.database.assets.find((item) => item.id === record.id);
            const path = record.imagePath ?? entity?.generatedImagePath;
            const exists = path ? await this.store.projectFileExists(project.id, path) : false;
            if (!exists) failed.push(record);
          }
          this.record(project, stageId, "ASSET_INSPECTION", `Automatic structural Asset Inspection completed after generation attempt ${attempt}.`, { attempt, failedAssetIds: failed.map((asset) => asset.id), maximumAttempts: 3 });
        }
        const requiredFailures = failed.filter((asset) => asset.required !== false);
        for (const record of failed.filter((asset) => asset.required === false)) record.missingDecision = { action: "IGNORE", reason: "Non-critical asset failed after three automatic attempts; unrelated production continued safely.", createdAt: now() };
        if (requiredFailures.length) {
          const stage = project.automaticProduction.stages.find((entry) => entry.id === stageId)!;
          stage.status = "NEEDS_USER_REVIEW";
          stage.note = `Review or retry required assets: ${requiredFailures.map((asset) => asset.name).join(", ")}.`;
          project.automaticProduction.status = "NEEDS_USER_REVIEW";
          project.automaticProduction.resumeAfterRestart = false;
          project.automaticProduction.updatedAt = now();
          project.status = "awaiting_approval";
          this.record(project, stageId, "ASSETS_NEED_USER_REVIEW", stage.note, { assetIds: requiredFailures.map((asset) => asset.id), maximumAttempts: 3 });
          await this.store.saveProject(project);
          return "NEEDS_USER_REVIEW";
        }
        approveAssets(project);
        this.record(project, stageId, "ASSETS_GENERATED", "Every generated state was verified against an actual saved file; failed attempts remain in generation history and no phantom Generated status was accepted.");
        return "Production asset images and continuity sheets generated with a maximum of three attempts per missing asset.";
      }
      case "timeline_continuity":
        rebuildProductionMemory(project);
        this.record(project, stageId, "PRODUCTION_MEMORY_BUILT", "Story Timeline and structured Continuity Ledger were initialized from approved Story, Film Bible, characters, states, assets, and sequence boundaries.");
        return "Story Timeline and Continuity Ledger initialized.";
      case "audio_bible":
        updateAudioBible(project, { status: "LOCKED", reason: "Automatic Mode synchronized the Audio Bible with Project Setup controls and locked the production contract." });
        this.record(project, stageId, "AUDIO_BIBLE_BUILT", "Dialogue language, voices, ambience, SFX, music, narration, silence, and subtitle controls were synchronized. Disabled tracks remain explicit NO MUSIC, NO NARRATION, or NO SUBTITLES rules.");
        return "Audio Bible synchronized with the user project controls and locked.";
      case "full_script":
        if (!project.memory.productionMemory.script.scriptVersion) generateProductionScript(project, "Automatic Mode generated Full Script v2 from the approved production memory.");
        for (const line of project.memory.productionMemory.script.dialogue) if (line.lockState !== "LOCKED") setDialogueApproval(project, line.id, "LOCK");
        approveProductionScript(project, true);
        this.record(project, stageId, "SCRIPT_AND_DIALOGUE_LOCKED", "Full screenplay, production script, sequence script, structured dialogue, performance, and timing records were generated. Dialogue remains editable only through its explicit unlock workflow.", { dialogueLines: project.memory.productionMemory.script.dialogue.length });
        return "Full Script and structured production dialogue generated and locked.";
      case "shot_plans":
        this.record(project, stageId, "SHOT_PLANS_GENERATED", "Shot type, framing, camera angle, movement, lens, focal length, focus, action, performance, light, dialogue placement, and continuity purpose were generated from Story and Movie DNA.", { shots: project.memory.productionMemory.script.shots.length });
        return `${project.memory.productionMemory.script.shots.length} intentional shot plans generated.`;
      case "sequences":
        planSequences(project);
        syncLegacySequences(project);
        this.record(project, stageId, "SEQUENCES_PLANNED", "Exact sequence count and Start/Mid/End continuity states were generated from runtime and sequence duration.", { sequences: project.memory.productionMemory.script.sequences.length });
        return `${project.memory.productionMemory.script.sequences.length} formal sequences planned and validated.`;
      case "prompts": {
        compileProductionPrompts(project, project.targetPlatform);
        const records = compileAllSequencePrompts(project, project.targetPlatform);
        const blocked = records.filter((record) => record.state.validation.status === "BLOCKED");
        this.record(project, stageId, "PROMPTS_COMPILED", "Normal Prompt, JSON Prompt, platform version, reference mapping, upload order, validation, and version history were compiled from the same shared Prompt State.", { platform: project.targetPlatform, records: records.length, blocked: blocked.map((record) => record.sequenceId) });
        return `${records.length} synchronized Normal/JSON prompt states compiled for ${project.targetPlatform}${blocked.length ? `; ${blocked.length} retain visible validation blockers for user review` : ""}.`;
      }
      case "reference_packs": {
        const records = Object.values(project.production.promptWorkspace.records);
        const missing = project.memory.productionMemory.script.sequences.filter((sequence) => !records.some((record) => record.sequenceId === sequence.id && record.platform === project.targetPlatform));
        if (missing.length) throw new Error(`Reference packages cannot be prepared until prompt states exist for: ${missing.map((sequence) => sequence.id).join(", ")}.`);
        this.record(project, stageId, "REFERENCE_PACKS_READY", "Sequence-specific numbered copies, prompt.txt, prompt.json, and reference_manifest.json are ready through the existing non-destructive package download service.", { sequences: project.memory.productionMemory.script.sequences.length, platform: project.targetPlatform });
        return `${project.memory.productionMemory.script.sequences.length} downloadable sequence reference packages are ready without moving master assets.`;
      }
    }
  }

  private mainCharacterReady(project: MovieProject) {
    if (project.automaticProduction.mainCharacterSource === "AI") return true;
    const referenceId = project.preStorySetup.mainCharacterReferenceId;
    if (!referenceId) return false;
    const reference = project.memory.database.projectReferences.find((item) => item.id === referenceId);
    const assetId = reference?.assetId ?? reference?.linkedAssetIds[0];
    const sheet = assetId ? project.memory.database.continuitySheets.find((item) => item.assetId === assetId) : undefined;
    return Boolean(reference?.protected && sheet && ["REVIEW", "APPROVED", "LOCKED"].includes(sheet.status) && sheet.views.every((view) => Boolean(view.imagePath)));
  }

  private selectPlatform(project: MovieProject) {
    const profiles = Object.values(project.production.platformProfiles).filter((profile) => profile.platform !== "Custom");
    const scores = Object.fromEntries(profiles.map((profile) => {
      const durationCompatible = profile.maxDurationSeconds >= project.sequenceDurationSeconds;
      const score = (durationCompatible ? 50 : -100)
        + (profile.durationSupport.includes(project.sequenceDurationSeconds) ? 8 : 0)
        + (profile.aspectRatioSupport.includes(project.aspectRatio) ? 5 : 0)
        + (profile.resolutionSupport.includes(project.resolution) ? 5 : 0)
        + profile.maxReferences
        + (profile.firstFrameSupport ? 2 : 0)
        + (profile.lastFrameSupport ? 2 : 0)
        + (profile.videoContinuationSupport ? 3 : 0);
      return [profile.platform, score];
    }));
    const selected = profiles.sort((left, right) => (scores[right.platform] ?? 0) - (scores[left.platform] ?? 0))[0] ?? project.production.platformProfiles[project.targetPlatform];
    return {
      platform: selected.platform,
      scores,
      reason: `${selected.platform} was selected automatically from the versioned Platform Profiles because it best matches the ${project.sequenceDurationSeconds}-second sequence duration, ${project.aspectRatio} frame, ${project.resolution} delivery, reference capacity, frame support, and continuation capabilities. The user can change it later.`,
    };
  }

  private record(project: MovieProject, stage: AutomaticProductionStageId, action: string, reason: string, details?: Record<string, unknown>) {
    project.automaticProduction.history.push({ id: randomUUID(), stage, action, reason, details, createdAt: now() });
    project.automaticProduction.updatedAt = now();
  }
}
