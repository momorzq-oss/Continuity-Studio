import { randomUUID } from "node:crypto";
import {
  copyFile,
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type {
  AssetManifestArtifact,
  ContinuityArtifact,
  CreateProjectInput,
  ExportArtifact,
  FilmBibleArtifact,
  FramePlanArtifact,
  MovieProject,
  ProjectConfig,
  PhaseId,
  ProjectListItem,
  PromptArtifact,
  ProviderInfo,
  SequencesArtifact,
  StoryArtifact,
} from "../src/types.js";
import { createPhaseProgress } from "./phases.js";
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  createProjectBrain,
  createProjectMemory,
  migrateProject,
} from "./project-schema.js";
import { createAutomaticProductionState } from "./automatic-production-state.js";
import { createManualProductionState } from "./manual-production-state.js";
import { createProductionWorkflow } from "./production-workflow.js";
import {
  activeAssetManifest,
  assetHistoryManifest,
  flatAssetRelativePath,
  normalizePermanentAssetFilename,
} from "./asset-storage.js";

const PROJECT_FOLDERS = [
  "film_bible",
  "movie_dna",
  "story",
  "script",
  "sequences",
  "assets",
  "asset_history/generated",
  "asset_history/sheets",
  "asset_history/thumbnails",
  "references/uploads",
  "references/thumbnails",
  "model_profiles",
  "character_sheets",
  "creature_sheets",
  "locations",
  "props",
  "frame_plans",
  "frames",
  "prompts",
  "platform_prompts",
  "rules",
  "generations",
  "review",
  "generated_images",
  "generated_images/assets",
  "generated_images/scenes",
  "generated_images/storyboards",
  "generated_video",
  "continuity",
  "timeline",
  "audio",
  "final",
] as const;

const LEGACY_ASSET_CATEGORY_FOLDERS = [
  "movie_dna", "main_character", "characters", "character_states", "creatures", "animals", "locations", "sets",
  "buildings", "rooms", "props", "vehicles", "weapons", "costumes", "accessories", "makeup", "vfx", "environment", "objects", "other",
] as const;

export class ProjectNotFoundError extends Error {}

const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44) || "movie";

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const renderStory = (story: StoryArtifact) => `# Story\n\n## Logline\n\n${story.logline}\n\n## Synopsis\n\n${story.synopsis}\n\n## Full story\n\n${story.fullStory}\n\n## Characters\n\n${story.characters
  .map((character) => `### ${character.name} · ${character.id}\n\n${character.description}\n\n**Role:** ${character.role}\n\n**Relationships:** ${character.relationships.join("; ")}`)
  .join("\n\n")}\n\n## Locations\n\n${story.locations
  .map((location) => `- **${location.name} · ${location.id}:** ${location.description}`)
  .join("\n")}\n\n## Dialogue excerpt\n\n\`\`\`text\n${story.dialogueExcerpt}\n\`\`\`\n`;

const renderBible = (bible: FilmBibleArtifact) => `# ${bible.title} · Film Bible\n\n**Genre:** ${bible.genre}\n\n## Tone\n\n${bible.tone}\n\n## Visual language\n\n${bible.visualLanguage}\n\n## World rules\n\n${bible.worldRules.map((rule) => `- ${rule}`).join("\n")}\n\n## Character continuity\n\n${bible.characterContinuity.map((rule) => `- ${rule}`).join("\n")}\n\n## Location continuity\n\n${bible.locationContinuity.map((rule) => `- ${rule}`).join("\n")}\n`;

const renderRules = (bible: FilmBibleArtifact) =>
  `# MOVIE RULES\n\n${bible.movieRules.map((rule, index) => `${index + 1}. ${rule}`).join("\n")}\n`;

const renderAssets = (manifest: AssetManifestArtifact) =>
  `# Asset Manifest\n\n${manifest.assets
    .map(
      (asset) =>
        `## ${asset.name} · ${asset.id}\n\n- Type: ${asset.type}\n- Locked: ${asset.locked ? "Yes" : "No"}\n- Description: ${asset.description}\n- Continuity: ${asset.continuityNotes.join("; ")}`,
    )
    .join("\n\n")}\n`;

const renderContinuity = (report: ContinuityArtifact) =>
  `# Continuity Report\n\n**Score:** ${report.score}/100  \n**Rules checked:** ${report.checkedRules}\n\n## Issues\n\n${
    report.issues.length
      ? report.issues
          .map(
            (issue) =>
              `- **${issue.severity.toUpperCase()} · ${issue.title}:** ${issue.detail} ${issue.suggestion}`,
          )
          .join("\n")
      : "No continuity issues detected."
  }\n\n## Passed\n\n${report.passed.map((item) => `- ${item}`).join("\n")}\n`;

const phasePaths: Record<PhaseId, string[]> = {
  story: ["story"],
  film_bible: ["film_bible", "MOVIE_RULES.md"],
  assets: ["assets/manifest.json", "assets/manifest.md"],
  sequences: ["sequences"],
  frame_plans: ["frame_plans"],
  prompts: ["prompts"],
  continuity: ["continuity"],
  export: ["final/EXPORT_READY.md"],
};

export class ProjectStore {
  private readonly saveQueues = new Map<string, Promise<void>>();
  private readonly pendingActiveAssetPaths = new Map<string, Set<string>>();

  constructor(readonly rootDir: string) {}

  async initialize() {
    await mkdir(this.rootDir, { recursive: true });
  }

  projectPath(projectId: string) {
    if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(projectId)) {
      throw new ProjectNotFoundError("Invalid project ID.");
    }
    const resolved = path.resolve(this.rootDir, projectId);
    const root = path.resolve(this.rootDir);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
      throw new ProjectNotFoundError("Invalid project path.");
    }
    return resolved;
  }

  async createProject(input: CreateProjectInput, provider: ProviderInfo) {
    await this.initialize();
    const now = new Date().toISOString();
    const { brain: selectedBrain = "local", mainCharacterReference: _pendingReference, preferredPlatform, ...rawConfig } = input;
    const config: ProjectConfig = {
      ...rawConfig,
      controlMode: rawConfig.controlMode ?? "manual",
      movieTitle: rawConfig.movieTitle?.trim() || rawConfig.title,
      sequenceDurationSeconds: rawConfig.sequenceDurationSeconds ?? Math.max(1, Math.round((rawConfig.runtimeMinutes * 60) / Math.max(1, rawConfig.sequenceCount))),
      resolution: rawConfig.resolution ?? "4K UHD",
      filmLanguage: rawConfig.filmLanguage ?? rawConfig.language,
      dialogueLanguage: rawConfig.dialogueLanguage ?? rawConfig.language,
      audienceRating: rawConfig.audienceRating ?? "General / PG-13",
      targetPlatform: rawConfig.targetPlatform ?? "Seedance",
      narrationEnabled: rawConfig.narrationEnabled ?? false,
      dialogueEnabled: rawConfig.dialogueEnabled ?? true,
      musicEnabled: rawConfig.musicEnabled ?? true,
      subtitlesEnabled: rawConfig.subtitlesEnabled ?? true,
    };
    const projectId = `${slugify(input.title)}-${randomUUID().slice(0, 8)}`;
    const project: MovieProject = {
      ...config,
      controlMode: config.controlMode ?? "manual",
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      id: projectId,
      status: "draft",
      phases: createPhaseProgress(),
      artifacts: {},
      messages: [
        {
          id: randomUUID(),
          role: "agent",
          content: config.controlMode === "automatic"
            ? "Automatic Movie project created. Studio Brain will build the production and pause only at the protected Main Character checkpoint or when an important problem needs your review."
            : "Project created. Tell me what to make, choose Full production or Phase by phase, then start the production run.",
          createdAt: now,
        },
      ],
      provider,
      brain: createProjectBrain(selectedBrain),
      memory: createProjectMemory(projectId, config),
      preStorySetup: {
        mode: config.storyMode,
        completed: config.storyMode === "AI_FIRST",
        completedAt: config.storyMode === "AI_FIRST" ? now : undefined,
        sheetCreation: "AUTO",
        blockingIssues: [],
      },
      production: createProductionWorkflow(config),
      automaticProduction: createAutomaticProductionState(config.controlMode === "automatic", config.mainCharacterPreference),
      manualProduction: createManualProductionState(config.controlMode === "manual", preferredPlatform),
      createdAt: now,
      updatedAt: now,
    };

    const root = this.projectPath(project.id);
    await mkdir(root, { recursive: false });
    await Promise.all(
      PROJECT_FOLDERS.map((folder) => mkdir(path.join(root, folder), { recursive: true })),
    );
    await this.saveProject(project);
    return project;
  }

  async getProject(projectId: string): Promise<MovieProject> {
    try {
      const projectRoot = this.projectPath(projectId);
      const filePath = path.join(projectRoot, "project.json");
      const file = await readFile(filePath, "utf8");
      const migration = migrateProject(JSON.parse(file));
      const storageChanged = await this.syncFlatProductionAssets(migration.project);
      if (migration.changed || storageChanged) {
        const backup = path.join(
          projectRoot,
          `project.json.backup-v${migration.fromVersion}-${Date.now()}`,
        );
        await copyFile(filePath, backup);
        await this.atomicWrite(filePath, json(migration.project));
        await Promise.all([
          this.writeProductionDatabase(migration.project),
          this.writeProductionWorkflow(migration.project),
        ]);
      }
      return migration.project;
    } catch (error) {
      if (error instanceof ProjectNotFoundError) throw error;
      throw new ProjectNotFoundError(`Project ${projectId} was not found.`);
    }
  }

  async listProjects(): Promise<ProjectListItem[]> {
    await this.initialize();
    const entries = await readdir(this.rootDir, { withFileTypes: true });
    const projects = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          try {
            const project = await this.getProject(entry.name);
            const progressStages = ["project_setup", "movie_dna", "story", "film_bible", "characters", "asset_manifest", "sequences", "platform_prompts", "video_review", "export"];
            const completed = project.production.gates.filter((gate) => progressStages.includes(gate.stage) && ["APPROVED", "LOCKED"].includes(gate.status)).length;
            return {
              id: project.id,
              title: project.title,
              genre: project.genre,
              status: project.status,
              mode: project.mode,
              brain: project.brain.selected,
              updatedAt: project.updatedAt,
              progress: project.status === "complete" ? 100 : Math.round((completed / progressStages.length) * 100),
            } satisfies ProjectListItem;
          } catch {
            return undefined;
          }
        }),
    );
    return projects
      .filter((project): project is ProjectListItem => Boolean(project))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveProject(project: MovieProject) {
    const root = this.projectPath(project.id);
    await mkdir(root, { recursive: true });
    await this.syncFlatProductionAssets(project);
    project.updatedAt = new Date().toISOString();
    const filePath = path.join(root, "project.json");
    const previous = this.saveQueues.get(project.id) ?? Promise.resolve();
    const save = previous
      .catch(() => undefined)
      .then(() => this.atomicWrite(filePath, json(project)));
    this.saveQueues.set(project.id, save);
    try {
      await save;
      await Promise.all([
        this.writeProductionDatabase(project),
        this.writeProductionWorkflow(project),
      ]);
    } finally {
      if (this.saveQueues.get(project.id) === save) {
        this.saveQueues.delete(project.id);
      }
    }
  }

  private async writeProductionDatabase(project: MovieProject) {
    const root = this.projectPath(project.id);
    const database = project.memory.database;
    if (!database) return;
    await Promise.all([
      this.atomicWrite(path.join(root, "rules", "effective_rules.json"), json(database.rules)),
      this.atomicWrite(path.join(root, "rules", "profiles.json"), json(database.ruleProfiles)),
      this.atomicWrite(path.join(root, "assets", "registry.json"), json(database.assets)),
      this.atomicWrite(path.join(root, "assets", "relationships.json"), json(database.relationships)),
      this.atomicWrite(path.join(root, "references", "registry.json"), json(database.projectReferences)),
      this.atomicWrite(path.join(root, "references", "continuity_sheets.json"), json(database.continuitySheets)),
      this.atomicWrite(path.join(root, "assets", "lineage.json"), json(database.assetLineage)),
      this.atomicWrite(path.join(root, "assets", "dependencies.json"), json(database.assetDependencies)),
      this.atomicWrite(path.join(root, "assets", "scenes.json"), json(database.sceneAssets)),
      this.atomicWrite(path.join(root, "frames", "storyboard.json"), json(database.storyboardFrames)),
      this.atomicWrite(path.join(root, "generations", "image_jobs.json"), json(database.imageGenerationJobs)),
      this.atomicWrite(path.join(root, "generations", "provider_reference_mappings.json"), json(database.providerReferenceMappings)),
      this.atomicWrite(path.join(root, "model_profiles", "profiles.json"), json(database.modelProfiles)),
      this.atomicWrite(path.join(root, "frames", "index.json"), json(database.frames)),
      this.atomicWrite(path.join(root, "frames", "shots.json"), json(database.shots)),
      this.atomicWrite(path.join(root, "continuity", "states.json"), json(database.continuityStates)),
      this.atomicWrite(path.join(root, "generations", "prompts.json"), json(database.generationPrompts)),
      this.atomicWrite(path.join(root, "generations", "results.json"), json(database.generationResults)),
      this.atomicWrite(path.join(root, "review", "validation_issues.json"), json(database.validationIssues)),
      this.atomicWrite(path.join(root, "review", "approvals.json"), json(database.approvals)),
    ]);
  }

  private async writeProductionWorkflow(project: MovieProject) {
    const root = this.projectPath(project.id);
    const workflow = project.production;
    if (!workflow) return;
    const productionMemory = project.memory.productionMemory;
    await Promise.all([
      this.atomicWrite(path.join(root, "movie_dna", "movie_dna.json"), json(workflow.movieDna)),
      this.atomicWrite(path.join(root, "story", "development.json"), json(workflow.story)),
      this.atomicWrite(path.join(root, "story", "structured_story.json"), json({ storyId: workflow.story.storyId, title: workflow.story.title, premise: workflow.story.premise, logline: workflow.story.logline, summary: workflow.story.summary, sections: workflow.story.sections, characters: workflow.story.characters, locations: workflow.story.locations, objects: workflow.story.objects, events: workflow.story.events, status: workflow.story.status, version: workflow.story.version, approvedVersion: workflow.story.approvedVersion, lockedVersion: workflow.story.lockedVersion, movieDnaVersionUsed: workflow.story.movieDnaVersionUsed })),
      this.atomicWrite(path.join(root, "story", "beats.json"), json(workflow.story.beats)),
      this.atomicWrite(path.join(root, "story", "timeline.json"), json(workflow.story.timeline)),
      this.atomicWrite(path.join(root, "story", "character_arcs.json"), json(workflow.story.characterArcs)),
      this.atomicWrite(path.join(root, "story", "sequence_breakdown.json"), json(workflow.story.sequenceBreakdown)),
      this.atomicWrite(path.join(root, "story", "versions.json"), json(workflow.story.history)),
      this.atomicWrite(path.join(root, "story", "change_impact_decisions.json"), json(workflow.story.impactDecisions)),
      this.atomicWrite(path.join(root, "story", "downstream_contracts.json"), json(workflow.story.contracts ?? {})),
      this.atomicWrite(path.join(root, "film_bible", "production_bible.json"), json(workflow.filmBible)),
      this.atomicWrite(path.join(root, "film_bible", "versions.json"), json(workflow.filmBible.history)),
      this.atomicWrite(path.join(root, "film_bible", "source_context.json"), json(workflow.filmBible.sourceContext ?? {})),
      this.atomicWrite(path.join(root, "assets", "numbered_manifest.json"), json(workflow.assets)),
      this.atomicWrite(path.join(root, "assets", "asset_manifest.json"), json(activeAssetManifest(project))),
      this.atomicWrite(path.join(root, "asset_history", "asset_history.json"), json(assetHistoryManifest(project))),
      this.atomicWrite(path.join(root, "character_sheets", "characters.json"), json(workflow.characters)),
      this.atomicWrite(path.join(root, "character_sheets", "identity_registry.json"), json(workflow.characters.map((character) => ({ id: character.id, storyCandidateId: character.storyCandidateId, name: character.name, category: character.category, identitySource: character.identitySource, referenceIds: character.referenceIds, sheetId: character.sheetId, sheetStatus: character.sheetStatus, version: character.version, status: character.status })))),
      this.atomicWrite(path.join(root, "character_sheets", "story_states.json"), json(workflow.characters.flatMap((character) => character.states.map((state) => ({ characterId: character.id, ...state }))))),
      this.atomicWrite(path.join(root, "sequences", "production_plans.json"), json(workflow.sequences)),
      this.atomicWrite(path.join(root, "timeline", "continuity_ledger.json"), json(workflow.continuityLedger)),
      this.atomicWrite(path.join(root, "audio", "audio_bible.json"), json(workflow.audioBible)),
      this.atomicWrite(path.join(root, "platform_prompts", "profiles.json"), json(workflow.platformProfiles)),
      this.atomicWrite(path.join(root, "rules", "filmmaking_knowledge_sources.json"), json(workflow.knowledgeSources)),
      this.atomicWrite(path.join(root, "frames", "storyboard_grids.json"), json(workflow.storyboardGrids)),
      this.atomicWrite(path.join(root, "platform_prompts", "compiled.json"), json(workflow.sequences.map((sequence) => ({ sequenceId: sequence.id, referenceSlots: sequence.referenceSlots, sections: sequence.promptSections, prompt: sequence.compiledPrompt, negativePrompt: sequence.negativePrompt })) )),
      this.atomicWrite(path.join(root, "platform_prompts", "prompt_workspace.json"), json(workflow.promptWorkspace)),
      this.atomicWrite(path.join(root, "platform_prompts", "prompt_states.json"), json(Object.fromEntries(Object.entries(workflow.promptWorkspace.records).map(([key, record]) => [key, record.state])))),
      this.atomicWrite(path.join(root, "platform_prompts", "prompt_versions.json"), json(Object.fromEntries(Object.entries(workflow.promptWorkspace.records).map(([key, record]) => [key, record.versions])))),
      this.atomicWrite(path.join(root, "platform_prompts", "reference_manifests.json"), json(Object.fromEntries(Object.entries(workflow.promptWorkspace.records).map(([key, record]) => [key, record.state.references])))),
      this.atomicWrite(path.join(root, "continuity", "permanent_negative_rules.json"), json(workflow.permanentNegativeRules)),
      this.atomicWrite(path.join(root, "timeline", "production_story_timeline.json"), json(productionMemory.storyTimeline)),
      this.atomicWrite(path.join(root, "continuity", "ledger.json"), json(productionMemory.continuity)),
      this.atomicWrite(path.join(root, "continuity", "snapshots.json"), json(productionMemory.continuity.snapshots)),
      this.atomicWrite(path.join(root, "continuity", "warnings.json"), json(productionMemory.continuity.warnings)),
      this.atomicWrite(path.join(root, "continuity", "history.json"), json(productionMemory.continuity.history)),
      this.atomicWrite(path.join(root, "audio", "production_audio_bible.json"), json(productionMemory.audioBible)),
      this.atomicWrite(path.join(root, "script", "full_script.json"), json(productionMemory.script)),
      this.atomicWrite(path.join(root, "script", "versions.json"), json(productionMemory.script.versions)),
      this.atomicWrite(path.join(root, "script", "dialogue.json"), json(productionMemory.script.dialogue)),
      this.atomicWrite(path.join(root, "script", "shots.json"), json(productionMemory.script.shots)),
      this.atomicWrite(path.join(root, "sequences", "formal_sequence_plans.json"), json(productionMemory.script.sequences)),
      this.atomicWrite(path.join(root, "script", "change_history.json"), json(productionMemory.script.history)),
      this.atomicWrite(path.join(root, "review", "workflow_gates.json"), json(workflow.gates)),
    ]);
  }

  async clearPhaseFiles(projectId: string, phases: PhaseId[]) {
    const root = this.projectPath(projectId);
    for (const phase of phases) {
      for (const relative of phasePaths[phase]) {
        const target = path.resolve(root, relative);
        if (!target.startsWith(`${root}${path.sep}`)) continue;
        await rm(target, { recursive: true, force: true });
      }
    }
    await Promise.all(
      PROJECT_FOLDERS.map((folder) => mkdir(path.join(root, folder), { recursive: true })),
    );
  }

  async writePhaseArtifact(project: MovieProject, phase: PhaseId, artifact: unknown) {
    const root = this.projectPath(project.id);
    await this.clearPhaseFiles(project.id, [phase]);

    switch (phase) {
      case "story": {
        const value = artifact as StoryArtifact;
        await this.atomicWrite(path.join(root, "story", "story.json"), json(value));
        await this.atomicWrite(path.join(root, "story", "story.md"), renderStory(value));
        break;
      }
      case "film_bible": {
        const value = artifact as FilmBibleArtifact;
        await this.atomicWrite(path.join(root, "film_bible", "film_bible.json"), json(value));
        await this.atomicWrite(path.join(root, "film_bible", "film_bible.md"), renderBible(value));
        await this.atomicWrite(path.join(root, "MOVIE_RULES.md"), renderRules(value));
        break;
      }
      case "assets": {
        const value = artifact as AssetManifestArtifact;
        await this.atomicWrite(path.join(root, "assets", "manifest.json"), json(value));
        await this.atomicWrite(path.join(root, "assets", "manifest.md"), renderAssets(value));
        break;
      }
      case "sequences": {
        const value = artifact as SequencesArtifact;
        await this.atomicWrite(path.join(root, "sequences", "index.json"), json(value));
        await Promise.all(
          value.sequences.map((sequence) =>
            this.atomicWrite(
              path.join(root, "sequences", `${sequence.id.toLowerCase()}.json`),
              json(sequence),
            ),
          ),
        );
        break;
      }
      case "frame_plans": {
        const value = artifact as FramePlanArtifact;
        await this.atomicWrite(path.join(root, "frame_plans", "index.json"), json(value));
        await Promise.all(
          value.plans.map((plan) =>
            this.atomicWrite(
              path.join(root, "frame_plans", `${plan.sequenceId.toLowerCase()}.json`),
              json(plan),
            ),
          ),
        );
        break;
      }
      case "prompts": {
        const value = artifact as PromptArtifact;
        await this.atomicWrite(path.join(root, "prompts", "index.json"), json(value));
        await Promise.all(
          value.prompts.map((prompt) =>
            this.atomicWrite(
              path.join(root, "prompts", `${prompt.sequenceId.toLowerCase()}.md`),
              `# ${prompt.sequenceId}\n\n${prompt.prompt}\n\n## Negative prompt\n\n${prompt.negativePrompt}\n\n## References\n\n${prompt.references.map((item) => `- ${item}`).join("\n")}\n`,
            ),
          ),
        );
        break;
      }
      case "continuity": {
        const value = artifact as ContinuityArtifact;
        await this.atomicWrite(path.join(root, "continuity", "report.json"), json(value));
        await this.atomicWrite(path.join(root, "continuity", "report.md"), renderContinuity(value));
        break;
      }
      case "export": {
        const value = artifact as ExportArtifact;
        await this.atomicWrite(
          path.join(root, "final", "EXPORT_READY.md"),
          `# Export ready\n\n${value.note}\n\n## Included files\n\n${value.files.map((file) => `- ${file}`).join("\n")}\n`,
        );
      }
    }
  }

  async projectExists(projectId: string) {
    try {
      return (await stat(path.join(this.projectPath(projectId), "project.json"))).isFile();
    } catch {
      return false;
    }
  }

  resolveProjectFile(projectId: string, relativePath: string) {
    const root = this.projectPath(projectId);
    const normalized = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
    const target = path.resolve(root, normalized);
    if (!target.startsWith(`${root}${path.sep}`)) throw new ProjectNotFoundError("Invalid project file path.");
    return target;
  }

  async writeProjectBinary(projectId: string, relativePath: string, contents: Buffer) {
    const target = this.resolveProjectFile(projectId, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents);
    return relativePath.replaceAll("\\", "/");
  }

  async readProjectBinary(projectId: string, relativePath: string) {
    return readFile(this.resolveProjectFile(projectId, relativePath));
  }

  async projectFileExists(projectId: string, relativePath: string) {
    try {
      return (await stat(this.resolveProjectFile(projectId, relativePath))).isFile();
    } catch {
      return false;
    }
  }

  async removeProjectFile(projectId: string, relativePath: string) {
    await rm(this.resolveProjectFile(projectId, relativePath), { force: true });
  }

  async activateProductionAssetFile(projectId: string, filename: string, sourcePath: string) {
    const targetPath = flatAssetRelativePath(filename);
    const source = this.resolveProjectFile(projectId, sourcePath);
    const target = this.resolveProjectFile(projectId, targetPath);
    const pending = this.pendingActiveAssetPaths.get(projectId) ?? new Set<string>();
    pending.add(targetPath);
    this.pendingActiveAssetPaths.set(projectId, pending);
    if (source !== target) {
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(source, target);
    }
    return targetPath;
  }

  async archiveProductionAssetFile(projectId: string, filename: string, version: number, sourcePath: string) {
    const extension = path.extname(filename) || path.extname(sourcePath) || ".png";
    const stem = path.basename(filename, path.extname(filename));
    const historyPath = `asset_history/generated/${stem}-v${version}-archived${extension}`;
    const source = this.resolveProjectFile(projectId, sourcePath);
    const target = this.resolveProjectFile(projectId, historyPath);
    if (source !== target) {
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(source, target);
    }
    return historyPath;
  }

  private async syncFlatProductionAssets(project: MovieProject) {
    let changed = false;
    const records = [...project.production.assets].sort((left, right) => left.number - right.number);
    await mkdir(path.join(this.projectPath(project.id), "assets"), { recursive: true });

    for (const record of records) {
      const entity = project.memory.database.assets.find((item) => item.id === record.id);
      const normalizedFilename = normalizePermanentAssetFilename(record.number, record.filename, record.name);
      if (record.filename !== normalizedFilename) {
        record.filename = normalizedFilename;
        changed = true;
      }
      const targetPath = flatAssetRelativePath(record.filename);
      const sourcePath = record.imagePath ?? entity?.generatedImagePath;
      if (sourcePath && sourcePath !== targetPath && await this.projectFileExists(project.id, sourcePath)) {
        await this.activateProductionAssetFile(project.id, record.filename, sourcePath);
      }
      const targetExists = await this.projectFileExists(project.id, targetPath);
      if (sourcePath && targetExists) {
        this.pendingActiveAssetPaths.get(project.id)?.delete(targetPath);
        if (record.imagePath !== targetPath) {
          record.imagePath = targetPath;
          changed = true;
        }
        if (entity) {
          if (entity.generatedImagePath !== targetPath) changed = true;
          entity.generatedImagePath = targetPath;
          entity.referenceImages = [...new Set([...entity.referenceImages, targetPath])];
        }
      } else if (!sourcePath && targetExists) {
        // A long-running generation can write the flat active file before its
        // metadata commit. A concurrent read may therefore observe an older
        // project snapshot with no sourcePath. Reads must never archive or
        // delete a permanent production image; explicit asset/version actions
        // own lifecycle changes. The next committed read reconnects the file.
        continue;
      }
      if (entity) {
        if (entity.projectNumber !== record.number || entity.permanentFilename !== record.filename) changed = true;
        entity.projectNumber = record.number;
        entity.permanentFilename = record.filename;
      }
      const master = project.production.movieDna.masterFrame;
      if (master?.assetId === record.id) {
        if (master.projectNumber !== record.number || master.filename !== record.filename || (record.imagePath && master.path !== record.imagePath)) changed = true;
        master.projectNumber = record.number;
        master.filename = record.filename;
        if (record.imagePath) master.path = record.imagePath;
      }
    }

    for (const grid of Object.values(project.production.storyboardGrids)) {
      if (grid.projectImageNumber === undefined || !grid.permanentFilename) continue;
      const normalizedFilename = normalizePermanentAssetFilename(grid.projectImageNumber, grid.permanentFilename, `Sequence_${String(grid.sequenceNumber).padStart(2, "0")}_Storyboard_Grid`);
      if (grid.permanentFilename !== normalizedFilename) {
        grid.permanentFilename = normalizedFilename;
        changed = true;
      }
      const targetPath = flatAssetRelativePath(grid.permanentFilename);
      if (grid.imagePath && grid.imagePath !== targetPath && await this.projectFileExists(project.id, grid.imagePath)) {
        await this.activateProductionAssetFile(project.id, grid.permanentFilename, grid.imagePath);
      }
      if (await this.projectFileExists(project.id, targetPath) && grid.imagePath !== targetPath) {
        grid.imagePath = targetPath;
        changed = true;
      }
    }

    const projectRoot = this.projectPath(project.id);
    for (const folder of LEGACY_ASSET_CATEGORY_FOLDERS) {
      const source = path.join(projectRoot, "assets", folder);
      try {
        if (!(await stat(source)).isDirectory()) continue;
      } catch {
        continue;
      }
      const destination = path.join(projectRoot, "asset_history", "legacy", folder);
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(source, destination, { recursive: true, force: false, errorOnExist: false });
      await rm(source, { recursive: true, force: true });
      changed = true;
    }

    const legacyFolders = new Set<string>(LEGACY_ASSET_CATEGORY_FOLDERS);
    const rewriteLegacyPath = (value: string | undefined) => {
      if (!value) return value;
      const normalized = value.replaceAll("\\", "/");
      const match = normalized.match(/^assets\/([^/]+)\/(.+)$/);
      if (!match || !legacyFolders.has(match[1]!)) return value;
      changed = true;
      return `asset_history/legacy/${match[1]}/${match[2]}`;
    };
    for (const record of records) {
      record.thumbnailPath = rewriteLegacyPath(record.thumbnailPath);
      for (const version of record.versionHistory ?? []) {
        version.imagePath = rewriteLegacyPath(version.imagePath);
        version.thumbnailPath = rewriteLegacyPath(version.thumbnailPath);
      }
      for (const attempt of record.generationAttempts ?? []) {
        attempt.imagePath = rewriteLegacyPath(attempt.imagePath);
        attempt.thumbnailPath = rewriteLegacyPath(attempt.thumbnailPath);
      }
      if (record.pendingVersion) {
        record.pendingVersion.imagePath = rewriteLegacyPath(record.pendingVersion.imagePath)!;
        record.pendingVersion.thumbnailPath = rewriteLegacyPath(record.pendingVersion.thumbnailPath);
      }
      const entity = project.memory.database.assets.find((item) => item.id === record.id);
      if (entity) {
        entity.thumbnailPath = rewriteLegacyPath(entity.thumbnailPath);
        entity.referenceImages = [...new Set(entity.referenceImages.map((item) => rewriteLegacyPath(item)!))];
      }
    }
    for (const sheet of project.memory.database.continuitySheets) {
      for (const view of sheet.views) view.imagePath = rewriteLegacyPath(view.imagePath);
    }
    for (const job of project.memory.database.imageGenerationJobs) {
      job.resultPath = rewriteLegacyPath(job.resultPath);
      job.thumbnailPath = rewriteLegacyPath(job.thumbnailPath);
      job.referencePaths = job.referencePaths.map((item) => rewriteLegacyPath(item)!);
    }
    for (const prompt of project.memory.database.generationPrompts) {
      if (!prompt.canonicalPrompt) continue;
      for (const reference of prompt.canonicalPrompt.references) reference.sourcePath = rewriteLegacyPath(reference.sourcePath);
    }
    const master = project.production.movieDna.masterFrame;
    if (master) master.thumbnailPath = rewriteLegacyPath(master.thumbnailPath);
    for (const grid of Object.values(project.production.storyboardGrids)) grid.thumbnailPath = rewriteLegacyPath(grid.thumbnailPath);
    for (const promptRecord of Object.values(project.production.promptWorkspace.records)) {
      for (const reference of promptRecord.state.references) {
        const active = records.find((item) => item.id === reference.assetId);
        if (active) {
          reference.permanentProjectImageNumber = active.number;
          reference.permanentFilename = active.filename;
          reference.sourcePath = active.imagePath;
          reference.thumbnailPath = active.thumbnailPath;
        } else {
          reference.sourcePath = rewriteLegacyPath(reference.sourcePath);
          reference.thumbnailPath = rewriteLegacyPath(reference.thumbnailPath);
        }
      }
    }
    return changed;
  }

  private async atomicWrite(filePath: string, contents: string) {
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${randomUUID()}.tmp`;
    await writeFile(temporary, contents, "utf8");
    try {
      for (let attempt = 0; ; attempt += 1) {
        try {
          await rename(temporary, filePath);
          return;
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          const retryable = code === "EPERM" || code === "EACCES" || code === "EBUSY";
          if (!retryable || attempt >= 7) {
            // Some Windows sync/antivirus tools temporarily deny atomic replacement.
            // copyFile still replaces the destination while preserving the complete temp file.
            await copyFile(temporary, filePath);
            return;
          }
          await delay(25 * (attempt + 1));
        }
      }
    } finally {
      await rm(temporary, { force: true });
    }
  }
}
