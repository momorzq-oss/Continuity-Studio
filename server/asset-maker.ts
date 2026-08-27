import type {
  ApprovalState,
  AssetEntity,
  ContinuitySheet,
  ImageGenerationJob,
  ImageGenerationTarget,
  MovieProject,
  SceneAsset,
  SequencesArtifact,
  StoryboardFrameAsset,
} from "../src/types.js";
import type { ImageGenerationProvider } from "./image-generation/provider.js";
import { LocalReferenceImageProvider } from "./image-generation/local-provider.js";
import type { ProjectStore } from "./store.js";

const stamp = () => new Date().toISOString();
const fileToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");

export class AssetMaker {
  constructor(
    private readonly store: ProjectStore,
    private readonly provider: ImageGenerationProvider = new LocalReferenceImageProvider(),
  ) {}

  reconcileProtectedReferences(project: MovieProject) {
    const database = project.memory.database;
    const mainId = project.preStorySetup.mainCharacterReferenceId;
    const main = mainId ? database.projectReferences.find((item) => item.id === mainId) : undefined;
    const protagonist = database.characters[0];
    if (main && protagonist) {
      if (!main.linkedAssetIds.includes(protagonist.id)) main.linkedAssetIds.push(protagonist.id);
      protagonist.sourceReferenceIds = [...new Set([...protagonist.sourceReferenceIds, main.id])];
      protagonist.referenceImages = [...new Set([main.sourcePath, ...protagonist.referenceImages])];
      protagonist.generatedImagePath ??= main.sourcePath;
      protagonist.thumbnailPath ??= main.thumbnailPath;
      protagonist.critical = true;
      database.storyAssetRequirements.find((item) => item.id === "REQ_MAIN_CHARACTER_SOURCE")!.assetId = protagonist.id;
      if (!database.assetLineage.some((item) => item.assetId === protagonist.id && item.operation === "UPLOAD")) {
        database.assetLineage.push({ id: `LINEAGE_${protagonist.id}_UPLOAD`, assetId: protagonist.id, sourceReferenceIds: [main.id], operation: "UPLOAD", createdAt: stamp() });
      }
    }
    for (const reference of database.projectReferences) {
      if (reference === main) continue;
      const asset = database.assets.find((item) => item.category === reference.type && !item.sourceReferenceIds.length);
      if (!asset) continue;
      reference.linkedAssetIds = [...new Set([...reference.linkedAssetIds, asset.id])];
      asset.sourceReferenceIds = [...new Set([...asset.sourceReferenceIds, reference.id])];
      asset.referenceImages = [...new Set([reference.sourcePath, ...asset.referenceImages])];
    }
  }

  preview(project: MovieProject) {
    const database = project.memory.database;
    const assetJobs = database.assets.filter((asset) => !asset.generatedImagePath || ["REGENERATE", "GENERATION_FAILED"].includes(asset.approvalState)).length;
    const sheetJobs = database.assets.reduce((sum, asset) => sum + this.sheetAngles(asset).length, 0);
    const sceneJobs = database.sceneAssets.filter((scene) => !scene.masterImagePath).length * 4;
    const storyboardJobs = database.storyboardFrames.filter((frame) => !frame.imagePath).length;
    const count = assetJobs + sheetJobs + sceneJobs + storyboardJobs;
    return {
      provider: this.provider.id,
      model: this.provider.model,
      paid: this.provider.paid,
      requiresApproval: this.provider.paid,
      assetJobs,
      sheetJobs,
      sceneJobs,
      storyboardJobs,
      totalJobs: count,
      estimatedCost: 0,
      message: this.provider.paid ? "Approval is required before any paid generation starts." : "Built-in local reference rendering costs no provider credits.",
    };
  }

  async generateAllAssets(project: MovieProject, force = false) {
    this.reconcileProtectedReferences(project);
    for (const asset of project.memory.database.assets) {
      if (force || !asset.generatedImagePath) await this.generateAsset(project, asset.id, force);
      await this.generateContinuitySheet(project, asset.id, force);
    }
    return project;
  }

  async generateAsset(project: MovieProject, assetId: string, force = false) {
    const asset = project.memory.database.assets.find((item) => item.id === assetId);
    if (!asset) throw new Error(`Asset ${assetId} was not found.`);
    if (!force && asset.generatedImagePath) return asset;
    if (force) asset.version += 1;
    asset.approvalState = "GENERATING";
    const outputBase = `generated_images/assets/${fileToken(asset.id)}-v${asset.version}`;
    const job = await this.runJob(project, {
      targetType: "ASSET_MASTER",
      targetId: asset.id,
      prompt: asset.generationPrompt,
      negativePrompt: asset.negativePrompt,
      referenceIds: asset.sourceReferenceIds,
      referencePaths: asset.referenceImages,
      width: 1024,
      height: 1024,
      outputBase,
      label: asset.name,
    });
    asset.generationJobIds.push(job.id);
    if (job.status === "GENERATION_FAILED") {
      asset.approvalState = "GENERATION_FAILED";
      throw new Error(job.error || `Image generation failed for ${asset.id}.`);
    }
    asset.generatedImagePath = job.resultPath;
    asset.thumbnailPath = job.thumbnailPath;
    asset.referenceImages = [...new Set([...(asset.sourceReferenceIds.length ? asset.referenceImages : []), job.resultPath!])];
    asset.provider = job.provider;
    asset.model = job.model;
    asset.approvalState = project.mode === "full" ? "LOCKED" : "REVIEW";
    asset.updatedAt = stamp();
    const artifact = project.artifacts.assets as { assets?: Array<{ id: string; approvalState?: ApprovalState; locked: boolean; version?: number; referenceImages?: string[] }> } | undefined;
    const item = artifact?.assets?.find((entry) => entry.id === asset.id);
    if (item) {
      item.approvalState = asset.approvalState;
      item.locked = asset.approvalState === "LOCKED";
      item.version = asset.version;
      item.referenceImages = asset.referenceImages;
    }
    project.memory.database.assetLineage.push({
      id: `LINEAGE_${fileToken(asset.id).toUpperCase()}_${asset.version}_${project.memory.database.assetLineage.length + 1}`,
      assetId: asset.id,
      sourceReferenceIds: [...asset.sourceReferenceIds],
      operation: force ? "REGENERATE" : "GENERATE",
      createdAt: stamp(),
    });
    return asset;
  }

  async generateContinuitySheet(project: MovieProject, assetId: string, force = false) {
    const database = project.memory.database;
    const asset = database.assets.find((item) => item.id === assetId);
    if (!asset) throw new Error(`Asset ${assetId} was not found.`);
    if (!asset.generatedImagePath && !asset.sourceReferenceIds.length) throw new Error(`${asset.id} needs a master image before its continuity sheet.`);
    let sheet = database.continuitySheets.find((item) => item.assetId === asset.id);
    if (!sheet) {
      sheet = this.createSheet(project, asset);
      database.continuitySheets.push(sheet);
      asset.sheetId = sheet.id;
    }
    for (const view of sheet.views) {
      if (view.imagePath && !force) continue;
      const base = `generated_images/assets/${fileToken(asset.id)}-sheet-${view.angle.toLowerCase()}-v${sheet.version}`;
      const job = await this.runJob(project, {
        targetType: "SHEET_VIEW",
        targetId: view.id,
        prompt: `${asset.generationPrompt} Continuity sheet ${view.name}; ${view.angle.toLowerCase()} view; preserve the exact master identity and design.`,
        negativePrompt: asset.negativePrompt,
        referenceIds: asset.sourceReferenceIds,
        referencePaths: [asset.generatedImagePath!, ...asset.referenceImages].filter(Boolean),
        width: 1024,
        height: 1024,
        outputBase: base,
        label: `${asset.name} ${view.name}`,
      });
      view.imagePath = job.resultPath;
      view.status = job.status === "GENERATED" ? "REVIEW" : job.status;
      asset.generationJobIds.push(job.id);
      database.assetLineage.push({ id: `LINEAGE_${view.id}_${sheet.version}`, assetId: asset.id, sourceReferenceIds: [...asset.sourceReferenceIds], operation: "SHEET_VIEW", createdAt: stamp() });
    }
    sheet.status = sheet.views.every((view) => Boolean(view.imagePath)) ? (project.mode === "full" ? "LOCKED" : "REVIEW") : "GENERATION_FAILED";
    sheet.updatedAt = stamp();
    return sheet;
  }

  planScenes(project: MovieProject) {
    const sequences = (project.artifacts.sequences as SequencesArtifact | undefined)?.sequences ?? [];
    const database = project.memory.database;
    for (const sequence of sequences) {
      let scene = database.sceneAssets.find((item) => item.sequenceId === sequence.id);
      const nextDependencies = [...new Set([sequence.locationId, ...sequence.assetIds])];
      if (!scene) {
        const timestamp = stamp();
        scene = {
          id: `SCENE_${sequence.id}`,
          projectId: project.id,
          sequenceId: sequence.id,
          name: sequence.title,
          dependencyIds: nextDependencies,
          status: "PLANNED",
          version: 1,
          generationJobIds: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        database.sceneAssets.push(scene);
      } else if (scene.dependencyIds.slice().sort().join("|") !== nextDependencies.slice().sort().join("|")) {
        scene.dependencyIds = nextDependencies;
        scene.masterImagePath = undefined;
        scene.startImagePath = undefined;
        scene.midImagePath = undefined;
        scene.endImagePath = undefined;
        scene.status = "REGENERATE";
        scene.version += 1;
        scene.updatedAt = stamp();
        for (const frame of database.storyboardFrames.filter((item) => item.sceneAssetId === scene!.id)) {
          frame.imagePath = undefined;
          frame.status = "REGENERATE";
          frame.version += 1;
        }
      }
      database.assetDependencies = database.assetDependencies.filter((item) => item.fromId !== scene!.id || nextDependencies.includes(item.toId));
      for (const dependencyId of scene.dependencyIds) {
        const asset = database.assets.find((item) => item.id === dependencyId);
        const id = `DEP_${scene.id}_${dependencyId}`;
        const dependency = database.assetDependencies.find((item) => item.id === id);
        const state = Boolean(asset?.generatedImagePath || asset?.sourceReferenceIds.length);
        if (dependency) dependency.satisfied = state;
        else database.assetDependencies.push({ id, fromId: scene.id, toId: dependencyId, kind: "REQUIRES", required: true, satisfied: state });
      }
    }
    return database.sceneAssets;
  }

  async generateAllScenes(project: MovieProject, force = false) {
    this.planScenes(project);
    for (const scene of project.memory.database.sceneAssets) await this.generateScene(project, scene.id, force);
    return project;
  }

  async generateScene(project: MovieProject, sceneId: string, force = false) {
    const database = project.memory.database;
    const scene = database.sceneAssets.find((item) => item.id === sceneId);
    if (!scene) throw new Error(`Scene ${sceneId} was not found.`);
    if (scene.masterImagePath && !force) return scene;
    const missing = scene.dependencyIds.filter((id) => {
      const asset = database.assets.find((item) => item.id === id);
      return !asset?.generatedImagePath && !asset?.sourceReferenceIds.length;
    });
    if (missing.length) throw new Error(`${scene.id} is blocked by missing visual dependencies: ${missing.join(", ")}.`);
    if (force) scene.version += 1;
    scene.status = "GENERATING";
    const sequence = (project.artifacts.sequences as SequencesArtifact).sequences.find((item) => item.id === scene.sequenceId)!;
    const refs = scene.dependencyIds.map((id) => database.assets.find((item) => item.id === id)?.generatedImagePath).filter((value): value is string => Boolean(value));
    for (const target of ["MASTER", "START", "MID", "END"] as const) {
      const outputBase = `generated_images/scenes/${fileToken(scene.id)}-${target.toLowerCase()}-v${scene.version}`;
      const job = await this.runJob(project, {
        targetType: `SCENE_${target}` as ImageGenerationTarget,
        targetId: scene.id,
        prompt: `${project.visualStyle}. ${sequence.synopsis}. ${target} continuity scene image. Location ${sequence.locationId}. Assets ${scene.dependencyIds.join(", ")}. ${sequence.cameraPlan || "Readable cinematic composition"}.`,
        negativePrompt: (sequence.negativeRules ?? []).join(", ") || "identity drift, missing asset, extra character, incorrect geography, text, watermark",
        referenceIds: scene.dependencyIds,
        referencePaths: refs,
        width: 1280,
        height: 536,
        outputBase,
        label: `${scene.name} ${target}`,
      });
      scene.generationJobIds.push(job.id);
      if (target === "MASTER") scene.masterImagePath = job.resultPath;
      if (target === "START") scene.startImagePath = job.resultPath;
      if (target === "MID") scene.midImagePath = job.resultPath;
      if (target === "END") scene.endImagePath = job.resultPath;
    }
    scene.status = project.mode === "full" ? "LOCKED" : "REVIEW";
    scene.updatedAt = stamp();
    database.assetLineage.push({ id: `LINEAGE_${scene.id}_${scene.version}`, assetId: scene.id, sourceReferenceIds: [], operation: "SCENE_COMPOSE", createdAt: stamp() });
    return scene;
  }

  planStoryboard(project: MovieProject) {
    const database = project.memory.database;
    for (const scene of database.sceneAssets) {
      for (const anchor of ["START", "MID", "END"] as const) {
        const id = `BOARD_${scene.sequenceId}_${anchor}`;
        if (database.storyboardFrames.some((item) => item.id === id)) continue;
        const timestamp = stamp();
        database.storyboardFrames.push({ id, projectId: project.id, sequenceId: scene.sequenceId, sceneAssetId: scene.id, anchor, status: "PLANNED", version: 1, createdAt: timestamp, updatedAt: timestamp });
        database.assetDependencies.push({ id: `DEP_${id}_${scene.id}`, fromId: id, toId: scene.id, kind: "FRAME_OF", required: true, satisfied: Boolean(scene.masterImagePath) });
      }
    }
    return database.storyboardFrames;
  }

  async generateStoryboard(project: MovieProject, force = false) {
    this.planStoryboard(project);
    const database = project.memory.database;
    for (const frame of database.storyboardFrames) {
      if (frame.imagePath && !force) continue;
      const scene = database.sceneAssets.find((item) => item.id === frame.sceneAssetId)!;
      if (!scene.masterImagePath) throw new Error(`${frame.id} is blocked until ${scene.id} has generated scene images.`);
      if (force) frame.version += 1;
      const source = frame.anchor === "START" ? scene.startImagePath : frame.anchor === "MID" ? scene.midImagePath : scene.endImagePath;
      const job = await this.runJob(project, {
        targetType: "STORYBOARD_FRAME",
        targetId: frame.id,
        prompt: `Storyboard frame for ${scene.name}, ${frame.anchor} anchor. Preserve the scene master, cast identity, geography, props, and screen direction.`,
        negativePrompt: "identity drift, geography drift, missing prop, text, watermark",
        referenceIds: [scene.id],
        referencePaths: [source || scene.masterImagePath],
        width: 1280,
        height: 720,
        outputBase: `generated_images/storyboards/${fileToken(frame.id)}-v${frame.version}`,
        label: frame.id,
      });
      frame.generationJobId = job.id;
      frame.imagePath = job.resultPath;
      frame.status = project.mode === "full" ? "LOCKED" : "REVIEW";
      frame.updatedAt = stamp();
      database.assetLineage.push({ id: `LINEAGE_${frame.id}_${frame.version}`, assetId: frame.id, sourceReferenceIds: [], operation: "STORYBOARD_FRAME", createdAt: stamp() });
    }
    return project;
  }

  private sheetAngles(asset: AssetEntity): Array<ContinuitySheet["views"][number]["angle"]> {
    if (["character", "creature", "animal"].includes(asset.category)) return ["MASTER", "FRONT", "PROFILE", "THREE_QUARTER", "DETAIL"];
    if (["location", "interior"].includes(asset.category)) return ["MASTER", "FRONT", "DETAIL"];
    return ["MASTER", "FRONT", "DETAIL"];
  }

  private createSheet(project: MovieProject, asset: AssetEntity): ContinuitySheet {
    const timestamp = stamp();
    const sheetId = `SHEET_${asset.id}`;
    return {
      id: sheetId,
      projectId: project.id,
      assetId: asset.id,
      referenceIds: [...asset.sourceReferenceIds],
      views: this.sheetAngles(asset).map((angle, index) => ({ id: `${sheetId}_${angle}`, sheetId, name: `${angle.replace("_", " ")} view`, angle, priority: 100 - index, status: "PLANNED" })),
      status: "PLANNED",
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private async runJob(project: MovieProject, input: {
    targetType: ImageGenerationTarget;
    targetId: string;
    prompt: string;
    negativePrompt: string;
    referenceIds: string[];
    referencePaths: string[];
    width: number;
    height: number;
    outputBase: string;
    label: string;
  }) {
    const database = project.memory.database;
    const timestamp = stamp();
    const job: ImageGenerationJob = {
      id: `IMGJOB_${String(database.imageGenerationJobs.length + 1).padStart(5, "0")}`,
      projectId: project.id,
      targetType: input.targetType,
      targetId: input.targetId,
      provider: this.provider.id,
      model: this.provider.model,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      referenceIds: [...input.referenceIds],
      referencePaths: [...new Set(input.referencePaths.filter(Boolean))],
      width: input.width,
      height: input.height,
      estimatedCost: 0,
      requiresApproval: this.provider.paid,
      approvedToSpend: !this.provider.paid,
      attempt: 1,
      status: "GENERATING",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    database.imageGenerationJobs.push(job);
    try {
      if (job.requiresApproval && !job.approvedToSpend) throw new Error("Paid generation requires explicit approval.");
      const result = await this.provider.generate({ id: job.id, prompt: job.prompt, negativePrompt: job.negativePrompt, width: job.width, height: job.height, referencePaths: job.referencePaths, label: input.label, kind: job.targetType });
      job.resultPath = await this.store.writeProjectBinary(project.id, `${input.outputBase}.png`, result.image);
      job.thumbnailPath = await this.store.writeProjectBinary(project.id, `${input.outputBase}-thumb.png`, result.thumbnail);
      job.provider = result.provider;
      job.model = result.model;
      job.status = "GENERATED";
    } catch (error) {
      job.status = "GENERATION_FAILED";
      job.error = error instanceof Error ? error.message : "Unknown image generation failure.";
    }
    job.updatedAt = stamp();
    return job;
  }
}
