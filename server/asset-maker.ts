import type {
  ApprovalState,
  AssetEntity,
  ContinuitySheet,
  ImageGenerationJob,
  ImageGenerationTarget,
  MovieProject,
  ProductionAssetCategory,
  ProductionAssetRecord,
  SceneAsset,
  SequencesArtifact,
  StoryboardFrameAsset,
} from "../src/types.js";
import type { ImageGenerationProvider } from "./image-generation/provider.js";
import { LocalReferenceImageProvider } from "./image-generation/local-provider.js";
import { lockedMovieDnaPrompt } from "./production-workflow.js";
import { newAttemptId, syncManifestRuntime } from "./asset-manifest.js";
import { permanentAssetFilename, projectImageNumberLabel } from "./asset-storage.js";
import type { ProjectStore } from "./store.js";

const stamp = () => new Date().toISOString();
const fileToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
const manifestCategoryFor = (asset: AssetEntity): ProductionAssetCategory => {
  if (asset.manifestCategory) return asset.manifestCategory;
  if (asset.category === "character") return "character";
  if (asset.category === "creature") return "creature";
  if (asset.category === "animal") return "animal";
  if (["location", "interior", "building", "room"].includes(asset.category)) return asset.category === "interior" ? "set" : asset.category as ProductionAssetCategory;
  if (asset.category === "vehicle") return "vehicle";
  if (asset.category === "weapon") return "weapon";
  if (["wardrobe", "costume"].includes(asset.category)) return "costume";
  if (asset.category === "accessory") return "accessory";
  if (asset.category === "effect") return "vfx";
  if (["object", "tool", "tack"].includes(asset.category)) return "prop";
  return "other";
};

export class AssetMaker {
  constructor(
    private readonly store: ProjectStore,
    provider?: ImageGenerationProvider,
  ) {
    this.provider = provider ?? new LocalReferenceImageProvider();
  }

  private readonly provider: ImageGenerationProvider;

  private ensureProductionRecord(project: MovieProject, asset: AssetEntity): ProductionAssetRecord {
    const existing = project.production.assets.find((item) => item.id === asset.id);
    if (existing) return existing;
    const timestamp = stamp();
    const number = project.production.nextProjectImageNumber++;
    const category = manifestCategoryFor(asset);
    const record: ProductionAssetRecord = {
      id: asset.id,
      number,
      filename: permanentAssetFilename(number, asset.name, "png"),
      name: asset.name,
      category,
      description: asset.description,
      continuityNotes: [...asset.notes],
      sequenceIds: [...(asset.sequenceIds ?? [])],
      referenceIds: [...asset.sourceReferenceIds],
      version: Math.max(1, asset.version),
      status: asset.approvalState,
      previousVersions: [],
      storyPurpose: asset.storyPurpose ?? "Registered production image required by the active asset manifest.",
      sourceStoryVersion: project.production.story.approvedVersion ?? project.production.story.version,
      sourceFilmBibleVersion: project.production.filmBible.approvedVersion ?? project.production.filmBible.version,
      movieDnaVersion: project.production.movieDna.version,
      dependencyIds: [...(asset.dependencyIds ?? [])],
      referenceRoles: [category === "character" ? "IDENTITY" : category === "location" ? "LOCATION" : "CONTINUITY"],
      sourceType: "STORY",
      required: asset.critical,
      canGenerate: true,
      generationPrompt: asset.generationPrompt,
      negativePrompt: asset.negativePrompt,
      generationAttempts: [],
      versionHistory: [],
      referenceUsage: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    project.production.assets.push(record);
    asset.projectNumber = number;
    asset.permanentFilename = record.filename;
    asset.manifestCategory = category;
    return record;
  }

  reconcileProtectedReferences(project: MovieProject) {
    const database = project.memory.database;
    const mainId = project.preStorySetup.mainCharacterReferenceId;
    const main = mainId ? database.projectReferences.find((item) => item.id === mainId) : undefined;
    const protagonist = database.characters[0];
    if (main && protagonist) {
      if (!main.linkedAssetIds.includes(protagonist.id)) main.linkedAssetIds.push(protagonist.id);
      protagonist.sourceReferenceIds = [...new Set([...protagonist.sourceReferenceIds, main.id])];
      protagonist.referenceImages = [...new Set([main.sourcePath, ...protagonist.referenceImages])];
      protagonist.critical = true;
      database.storyAssetRequirements.find((item) => item.id === "REQ_MAIN_CHARACTER_SOURCE")!.assetId = protagonist.id;
      if (!database.assetLineage.some((item) => item.assetId === protagonist.id && item.operation === "UPLOAD")) {
        database.assetLineage.push({ id: `LINEAGE_${protagonist.id}_UPLOAD`, assetId: protagonist.id, sourceReferenceIds: [main.id], operation: "UPLOAD", createdAt: stamp() });
      }
    }
    for (const reference of database.projectReferences) {
      if (reference === main) continue;
      const asset = database.assets.find((item) => item.id === reference.assetId)
        ?? database.assets.find((item) => item.category === reference.type && !item.sourceReferenceIds.length);
      if (!asset) continue;
      reference.linkedAssetIds = [...new Set([...reference.linkedAssetIds, asset.id])];
      asset.sourceReferenceIds = [...new Set([...asset.sourceReferenceIds, reference.id])];
      asset.referenceImages = [...new Set([reference.sourcePath, ...asset.referenceImages])];
    }
  }

  preview(project: MovieProject) {
    const database = project.memory.database;
    const generatable = database.assets.filter((asset) => project.production.assets.find((record) => record.id === asset.id)?.canGenerate !== false);
    const assetJobs = generatable.filter((asset) => !asset.generatedImagePath || ["REGENERATE", "GENERATION_FAILED"].includes(asset.approvalState)).length;
    const sheetJobs = generatable.reduce((sum, asset) => sum + this.sheetAngles(project, asset).length, 0);
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
      const record = project.production.assets.find((item) => item.id === asset.id);
      if (record?.canGenerate === false) continue;
      if (force && record?.status === "LOCKED" && asset.generatedImagePath) continue;
      const activeFileExists = asset.generatedImagePath
        ? await this.store.projectFileExists(project.id, asset.generatedImagePath)
        : false;
      const needsMaster = force
        || !asset.generatedImagePath
        || !activeFileExists
        || asset.approvalState === "GENERATION_FAILED"
        || record?.status === "GENERATION_FAILED";
      if (needsMaster) await this.generateAsset(project, asset.id, force);
      if (asset.generatedImagePath && !record?.pendingVersion) await this.generateContinuitySheet(project, asset.id, force);
    }
    syncManifestRuntime(project);
    return project;
  }

  async generateAsset(project: MovieProject, assetId: string, force = false, impactMode?: "FUTURE_ONLY" | "APPLY_ALL") {
    const asset = project.memory.database.assets.find((item) => item.id === assetId);
    if (!asset) throw new Error(`Asset ${assetId} was not found.`);
    const record = this.ensureProductionRecord(project, asset);
    if (record.canGenerate === false) throw new Error(`${record.name} is a protected source asset and cannot be generated or overwritten.`);
    const activeFileExists = asset.generatedImagePath ? await this.store.projectFileExists(project.id, asset.generatedImagePath) : false;
    if (!force && activeFileExists) return asset;
    const stagedReplacement = Boolean(force && activeFileExists);
    const targetVersion = stagedReplacement ? Math.max(asset.version + 1, (record?.pendingVersion?.version ?? 0) + 1) : Math.max(1, asset.version);
    if (!stagedReplacement) {
      asset.approvalState = "GENERATING";
      asset.generationError = undefined;
      if (record) {
        record.status = "GENERATING";
        record.generationError = undefined;
      }
    }
    const attempt = record ? {
      id: newAttemptId(),
      version: targetVersion,
      status: "GENERATING" as const,
      prompt: record.generationPrompt || asset.generationPrompt,
      createdAt: stamp(),
    } : undefined;
    if (attempt) (record!.generationAttempts ??= []).push(attempt);
    const outputBase = `asset_history/generated/${record ? projectImageNumberLabel(record.number) : "unmanaged"}_${fileToken(asset.id)}-v${targetVersion}`;
    const dependencyPaths = (record?.dependencyIds ?? []).flatMap((dependencyId) => {
      const dependencyRecord = project.production.assets.find((item) => item.id === dependencyId);
      const dependencyEntity = project.memory.database.assets.find((item) => item.id === dependencyId);
      return [dependencyRecord?.imagePath, dependencyEntity?.generatedImagePath];
    }).filter((value): value is string => Boolean(value));
    const candidateReferencePaths = [...asset.referenceImages, ...dependencyPaths];
    const referencePaths = (await Promise.all(candidateReferencePaths.map(async (referencePath) => ({
      referencePath,
      exists: await this.store.projectFileExists(project.id, referencePath),
    })))).filter((item) => item.exists).map((item) => item.referencePath);
    const job = await this.runJob(project, {
      targetType: "ASSET_MASTER",
      targetId: asset.id,
      prompt: record?.generationPrompt || asset.generationPrompt,
      negativePrompt: asset.negativePrompt,
      referenceIds: asset.sourceReferenceIds,
      referencePaths,
      width: 512,
      height: 512,
      outputBase,
      label: asset.name,
    });
    asset.generationJobIds.push(job.id);
    if (attempt) Object.assign(attempt, {
      status: job.status === "GENERATED" ? "GENERATED" : "GENERATION_FAILED",
      provider: job.provider,
      model: job.model,
      imagePath: job.resultPath,
      thumbnailPath: job.thumbnailPath,
      error: job.error,
      completedAt: stamp(),
    });
    if (job.status === "GENERATION_FAILED") {
      const error = job.error || `Image generation failed for ${asset.id}.`;
      if (!stagedReplacement) {
        asset.approvalState = "GENERATION_FAILED";
        asset.generationError = error;
      }
      if (record) {
        record.generationError = error;
        if (!stagedReplacement) record.status = "GENERATION_FAILED";
        record.updatedAt = stamp();
      }
      asset.updatedAt = stamp();
      return asset;
    }
    if (stagedReplacement && record) {
      const previousCandidate = record.pendingVersion;
      record.pendingVersion = {
        version: targetVersion,
        prompt: record.generationPrompt || asset.generationPrompt,
        imagePath: job.resultPath!,
        thumbnailPath: job.thumbnailPath,
        provider: job.provider,
        model: job.model,
        generationJobId: job.id,
        impactMode,
        createdAt: stamp(),
      };
      record.generationError = undefined;
      record.updatedAt = stamp();
      if (previousCandidate && previousCandidate.imagePath !== job.resultPath) {
        await this.store.removeProjectFile(project.id, previousCandidate.imagePath);
        if (previousCandidate.thumbnailPath) await this.store.removeProjectFile(project.id, previousCandidate.thumbnailPath);
      }
      return asset;
    }
    const activePath = record
      ? await this.store.activateProductionAssetFile(project.id, record.filename, job.resultPath!)
      : job.resultPath;
    asset.version = targetVersion;
    asset.generatedImagePath = activePath;
    asset.thumbnailPath = job.thumbnailPath;
    asset.referenceImages = [...new Set([...(asset.sourceReferenceIds.length ? asset.referenceImages : []), activePath!])];
    asset.provider = job.provider;
    asset.model = job.model;
    asset.generationError = undefined;
    asset.approvalState = project.mode === "full" ? "LOCKED" : "REVIEW";
    asset.updatedAt = stamp();
    if (record) {
      record.version = targetVersion;
      record.imagePath = activePath;
      record.thumbnailPath = job.thumbnailPath;
      record.provider = job.provider;
      record.model = job.model;
      record.generationError = undefined;
      record.status = asset.approvalState;
      record.updatedAt = asset.updatedAt;
      (record.versionHistory ??= []).push({
        version: targetVersion,
        description: record.description,
        prompt: record.generationPrompt || asset.generationPrompt,
        imagePath: job.resultPath,
        thumbnailPath: job.thumbnailPath,
        provider: job.provider,
        model: job.model,
        generationJobId: job.id,
        status: asset.approvalState,
        createdAt: asset.updatedAt,
        activatedAt: asset.updatedAt,
        fileRetained: true,
      });
    }
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
    syncManifestRuntime(project);
    return asset;
  }

  async acceptPendingVersion(project: MovieProject, assetId: string) {
    const asset = project.memory.database.assets.find((item) => item.id === assetId);
    const record = project.production.assets.find((item) => item.id === assetId);
    if (!asset || !record) throw new Error(`Asset ${assetId} was not found.`);
    const candidate = record.pendingVersion;
    if (!candidate) throw new Error(`${record.name} does not have a generated replacement preview.`);
    if (!await this.store.projectFileExists(project.id, candidate.imagePath)) throw new Error("The replacement preview file is missing. Regenerate it before accepting.");
    const previousImage = asset.generatedImagePath;
    const previousThumbnail = asset.thumbnailPath;
    const previousStatus = record.status;
    if (previousImage) {
      record.previousVersions.push({ version: record.version, description: record.description, createdAt: stamp() });
      const history = (record.versionHistory ??= []).find((item) => item.version === record.version && item.fileRetained);
      if (!history) {
        const archivedPath = await this.store.archiveProductionAssetFile(project.id, record.filename, record.version, previousImage);
        record.versionHistory.push({
        version: record.version, description: record.description, prompt: record.generationPrompt || asset.generationPrompt,
          imagePath: archivedPath, thumbnailPath: previousThumbnail, provider: asset.provider, model: asset.model,
          status: previousStatus, createdAt: asset.updatedAt, activatedAt: asset.updatedAt, fileRetained: true,
        });
      }
    }
    const activePath = await this.store.activateProductionAssetFile(project.id, record.filename, candidate.imagePath);
    asset.version = candidate.version;
    asset.generatedImagePath = activePath;
    asset.thumbnailPath = candidate.thumbnailPath;
    asset.provider = candidate.provider;
    asset.model = candidate.model;
    asset.referenceImages = [...new Set([...(asset.sourceReferenceIds.length ? asset.referenceImages.filter((item) => item !== previousImage) : []), activePath])];
    asset.generationError = undefined;
    asset.approvalState = ["APPROVED", "LOCKED"].includes(previousStatus) ? previousStatus : "REVIEW";
    asset.updatedAt = stamp();
    record.version = candidate.version;
    record.imagePath = activePath;
    record.thumbnailPath = candidate.thumbnailPath;
    record.provider = candidate.provider;
    record.model = candidate.model;
    record.generationError = undefined;
    record.status = asset.approvalState;
    record.pendingVersion = undefined;
    record.updatedAt = asset.updatedAt;
    (record.versionHistory ??= []).push({
      version: candidate.version, description: record.description, prompt: candidate.prompt, imagePath: candidate.imagePath,
      thumbnailPath: candidate.thumbnailPath, provider: candidate.provider, model: candidate.model, generationJobId: candidate.generationJobId,
      status: asset.approvalState, createdAt: candidate.createdAt, activatedAt: asset.updatedAt, fileRetained: true,
    });
    project.memory.database.assetLineage.push({
      id: `LINEAGE_${fileToken(asset.id).toUpperCase()}_${candidate.version}_${project.memory.database.assetLineage.length + 1}`,
      assetId: asset.id,
      sourceReferenceIds: [...asset.sourceReferenceIds],
      operation: "REGENERATE",
      createdAt: stamp(),
    });
    const sheet = project.memory.database.continuitySheets.find((item) => item.assetId === assetId);
    if (sheet) {
      sheet.version += 1;
      sheet.status = "PLANNED";
      sheet.views.forEach((view) => { view.imagePath = undefined; view.status = "PLANNED"; });
      sheet.updatedAt = stamp();
    }
    syncManifestRuntime(project);
    return asset;
  }

  async rejectPendingVersion(project: MovieProject, assetId: string) {
    const record = project.production.assets.find((item) => item.id === assetId);
    if (!record) throw new Error(`Asset ${assetId} was not found.`);
    const candidate = record.pendingVersion;
    if (!candidate) return record;
    await this.store.removeProjectFile(project.id, candidate.imagePath);
    if (candidate.thumbnailPath) await this.store.removeProjectFile(project.id, candidate.thumbnailPath);
    record.pendingVersion = undefined;
    record.updatedAt = stamp();
    return record;
  }

  async reconcileFileStatus(project: MovieProject) {
    let changed = false;
    for (const record of project.production.assets) {
      const paths = [record.imagePath, record.thumbnailPath].filter((value): value is string => Boolean(value));
      if (!paths.length) continue;
      const imageExists = record.imagePath ? await this.store.projectFileExists(project.id, record.imagePath) : false;
      if (imageExists) continue;
      record.generationError = `The active image file is missing on disk: ${record.imagePath}`;
      record.status = "GENERATION_FAILED";
      record.imagePath = undefined;
      record.thumbnailPath = undefined;
      record.updatedAt = stamp();
      const entity = project.memory.database.assets.find((item) => item.id === record.id);
      if (entity) {
        entity.generatedImagePath = undefined;
        entity.thumbnailPath = undefined;
        entity.generationError = record.generationError;
        entity.approvalState = "GENERATION_FAILED";
        entity.updatedAt = record.updatedAt;
      }
      changed = true;
    }
    if (changed) syncManifestRuntime(project);
    return changed;
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
    } else {
      const requiredAngles = this.sheetAngles(project, asset);
      for (const angle of requiredAngles) {
        if (!sheet.views.some((view) => view.angle === angle)) {
          sheet.views.push({ id: `${sheet.id}_${angle}`, sheetId: sheet.id, name: `${angle.replaceAll("_", " ")} view`, angle, priority: 100 - sheet.views.length, status: "PLANNED" });
        }
      }
    }
    for (const view of sheet.views) {
      if (view.imagePath && !force) continue;
      const base = `asset_history/sheets/${projectImageNumberLabel(asset.projectNumber ?? 0)}_${fileToken(asset.id)}-sheet-${view.angle.toLowerCase()}-v${sheet.version}`;
      const job = await this.runJob(project, {
        targetType: "SHEET_VIEW",
        targetId: view.id,
        prompt: `${asset.generationPrompt} Continuity sheet ${view.name}; ${view.angle.toLowerCase()} view; preserve the exact master identity and design.${asset.category === "character" ? " Professional neutral character-sheet lighting and background. Neutral base identity and clean base costume only. No sequence-specific damage, dirt, blood, weather, dramatic scene lighting, action state, expression drift, face change, body change, duplicate person, collage text, or watermark." : ""}`,
        negativePrompt: asset.negativePrompt,
        referenceIds: asset.sourceReferenceIds,
        referencePaths: [asset.generatedImagePath!, ...asset.referenceImages].filter(Boolean),
        width: 384,
        height: 384,
        outputBase: base,
        label: `${asset.name} ${view.name}`,
      });
      view.imagePath = job.resultPath;
      view.status = job.status === "GENERATED" ? "REVIEW" : job.status;
      if (job.error) asset.generationError = job.error;
      asset.generationJobIds.push(job.id);
      database.assetLineage.push({ id: `LINEAGE_${view.id}_${sheet.version}`, assetId: asset.id, sourceReferenceIds: [...asset.sourceReferenceIds], operation: "SHEET_VIEW", createdAt: stamp() });
    }
    sheet.status = sheet.views.every((view) => Boolean(view.imagePath)) ? (project.mode === "full" ? "LOCKED" : "REVIEW") : "GENERATION_FAILED";
    sheet.updatedAt = stamp();
    const character = project.production.characters.find((item) => item.id === asset.id);
    if (character) {
      character.sheetId = sheet.id;
      character.sheetStatus = sheet.status;
      character.updatedAt = sheet.updatedAt;
    }
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

  private sheetAngles(project: MovieProject, asset: AssetEntity): Array<ContinuitySheet["views"][number]["angle"]> {
    if (asset.manifestCategory === "character_state") return ["MASTER", "FULL_BODY_FRONT", "CLOSE_FACE", "WARDROBE", "STORY_LOOK"];
    if (asset.category === "character") {
      const character = project.production.characters.find((item) => item.id === asset.id);
      const sequenceCount = character?.relatedSequenceIds.length ?? 0;
      const storyText = `${character?.description ?? ""} ${character?.states.map((state) => `${state.wardrobe} ${state.possessions.join(" ")}`).join(" ") ?? ""}`;
      const angles: Array<ContinuitySheet["views"][number]["angle"]> = ["MASTER", "FRONT", "THREE_QUARTER"];
      if (character?.category === "main" || asset.critical) angles.push("LEFT_PROFILE", "RIGHT_PROFILE", "FULL_BODY_FRONT", "FULL_BODY_SIDE", "FULL_BODY_BACK", "CLOSE_FACE", "NEUTRAL_EXPRESSION", "WARDROBE", "STORY_LOOK");
      else if (sequenceCount > 2) angles.push("PROFILE", "FULL_BODY_FRONT", "NEUTRAL_EXPRESSION", "WARDROBE");
      if (/ride|camel|horse|vehicle|weapon|equipment|fight|run|chase/i.test(storyText)) angles.push("ACTION");
      if (/scar|tattoo|mark|ring|amulet|dagger|sword|distinctive/i.test(storyText)) angles.push("DETAIL");
      return [...new Set(angles)];
    }
    if (asset.category === "creature") return ["MASTER", "ANATOMY", "FRONT", "PROFILE", "BACK", "THREE_QUARTER", "ACTION", "DETAIL"];
    if (asset.category === "animal") return ["MASTER", "ANATOMY", "FRONT", "PROFILE", "BACK", "THREE_QUARTER", "EQUIPMENT", "ACTION", "DETAIL"];
    if (["location", "interior", "building", "room"].includes(asset.category)) return ["MASTER", "EXTERIOR", "INTERIOR", "DAY", "NIGHT", "DETAIL"];
    if (asset.category === "vehicle") return ["MASTER", "FRONT", "PROFILE", "BACK", "INTERIOR", "DETAIL"];
    if (["wardrobe", "costume", "accessory"].includes(asset.category)) return ["MASTER", "FRONT", "BACK", "DETAIL", "STORY_LOOK"];
    if (["prop", "object", "weapon", "tool"].includes(asset.category)) return ["MASTER", "FRONT", "PROFILE", "BACK", "SCALE", "DAMAGE", "DETAIL"];
    if (["effect", "period_reference"].includes(asset.category)) return ["MASTER", "DAY", "NIGHT", "DETAIL"];
    return ["MASTER", "FRONT", "PROFILE", "BACK", "DETAIL"];
  }

  private createSheet(project: MovieProject, asset: AssetEntity): ContinuitySheet {
    const timestamp = stamp();
    const sheetId = `SHEET_${asset.id}`;
    return {
      id: sheetId,
      projectId: project.id,
      assetId: asset.id,
      referenceIds: [...asset.sourceReferenceIds],
      views: this.sheetAngles(project, asset).map((angle, index) => ({ id: `${sheetId}_${angle}`, sheetId, name: `${angle.replaceAll("_", " ")} view`, angle, priority: 100 - index, status: "PLANNED" })),
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
    const movieDnaContext = lockedMovieDnaPrompt(project);
    const masterFramePath = project.production.movieDna.masterFrame?.status === "GENERATED" ? project.production.movieDna.masterFrame.path : undefined;
    const prompt = movieDnaContext
      ? `${movieDnaContext}\n\nGENERATION TARGET\n${input.prompt}\n\nPreserve all exact identity references. The Movie DNA Master Frame is a style reference only and must never replace character identity.`
      : input.prompt;
    const referencePaths = [...new Set([...input.referencePaths, ...(masterFramePath ? [masterFramePath] : [])])];
    const job: ImageGenerationJob = {
      id: `IMGJOB_${String(database.imageGenerationJobs.length + 1).padStart(5, "0")}`,
      projectId: project.id,
      targetType: input.targetType,
      targetId: input.targetId,
      provider: this.provider.id,
      model: this.provider.model,
      prompt,
      negativePrompt: input.negativePrompt,
      referenceIds: [...input.referenceIds],
      referencePaths: [...new Set(referencePaths.filter(Boolean))],
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
      // Pressing a Generate/Retry control is the explicit approval for this queued provider call.
      job.approvedToSpend = true;
      const referenceImages = (await Promise.all(job.referencePaths.slice(0, 4).map(async (relative) => {
        try {
          const data = await this.store.readProjectBinary(project.id, relative);
          const extension = relative.toLowerCase().split(".").pop();
          const mimeType = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension === "webp" ? "image/webp" : "image/png";
          return { data, filename: relative.split("/").at(-1) || "reference.png", mimeType };
        } catch {
          return undefined;
        }
      }))).filter((item) => item !== undefined);
      const result = await this.provider.generate({ id: job.id, prompt: job.prompt, negativePrompt: job.negativePrompt, width: job.width, height: job.height, referencePaths: job.referencePaths, referenceImages, label: input.label, kind: job.targetType });
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
