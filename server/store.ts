import { randomUUID } from "node:crypto";
import {
  copyFile,
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

const PROJECT_FOLDERS = [
  "film_bible",
  "story",
  "sequences",
  "assets",
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
  "rules",
  "generations",
  "review",
  "generated_images",
  "generated_images/assets",
  "generated_images/scenes",
  "generated_images/storyboards",
  "generated_video",
  "continuity",
  "audio",
  "final",
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
  assets: ["assets"],
  sequences: ["sequences"],
  frame_plans: ["frame_plans"],
  prompts: ["prompts"],
  continuity: ["continuity"],
  export: ["final/EXPORT_READY.md"],
};

export class ProjectStore {
  private readonly saveQueues = new Map<string, Promise<void>>();

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
    const { brain: selectedBrain = "local", ...config } = input;
    const projectId = `${slugify(input.title)}-${randomUUID().slice(0, 8)}`;
    const project: MovieProject = {
      ...config,
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      id: projectId,
      status: "draft",
      phases: createPhaseProgress(),
      artifacts: {},
      messages: [
        {
          id: randomUUID(),
          role: "agent",
          content:
            "Project created. Tell me what to make, choose Full production or Phase by phase, then start the production run.",
          createdAt: now,
        },
      ],
      provider,
      brain: createProjectBrain(selectedBrain),
      memory: createProjectMemory(projectId),
      preStorySetup: {
        mode: config.storyMode,
        completed: config.storyMode === "AI_FIRST",
        completedAt: config.storyMode === "AI_FIRST" ? now : undefined,
        sheetCreation: "AUTO",
        blockingIssues: [],
      },
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
      if (migration.changed) {
        const backup = path.join(
          projectRoot,
          `project.json.backup-v${migration.fromVersion}-${Date.now()}`,
        );
        await copyFile(filePath, backup);
        await this.atomicWrite(filePath, json(migration.project));
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
            const completed = project.phases.filter((phase) => phase.state === "completed").length;
            return {
              id: project.id,
              title: project.title,
              genre: project.genre,
              status: project.status,
              mode: project.mode,
              brain: project.brain.selected,
              updatedAt: project.updatedAt,
              progress: Math.round((completed / project.phases.length) * 100),
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
    project.updatedAt = new Date().toISOString();
    const filePath = path.join(root, "project.json");
    const previous = this.saveQueues.get(project.id) ?? Promise.resolve();
    const save = previous
      .catch(() => undefined)
      .then(() => this.atomicWrite(filePath, json(project)));
    this.saveQueues.set(project.id, save);
    try {
      await save;
      await this.writeProductionDatabase(project);
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
