import { createHash } from "node:crypto";
import path from "node:path";
import type {
  AssetEntity,
  AssetItem,
  AssetManifestArtifact,
  MovieProject,
  ProjectReference,
  ReferenceAssetType,
  ReferenceRole,
  StoryReferenceUsage,
} from "../src/types.js";
import type { ProjectStore } from "./store.js";

const allowed: Record<string, { extension: string; mime: "image/png" | "image/jpeg" | "image/webp" }> = {
  "image/png": { extension: ".png", mime: "image/png" },
  "image/jpeg": { extension: ".jpg", mime: "image/jpeg" },
  "image/webp": { extension: ".webp", mime: "image/webp" },
};

const defaultRoles = (type: ReferenceAssetType): ReferenceRole[] => {
  if (type === "character") return ["IDENTITY"];
  if (type === "creature") return ["CREATURE", "IDENTITY"];
  if (type === "animal") return ["ANIMAL", "IDENTITY"];
  if (["location", "building", "room"].includes(type)) return ["LOCATION"];
  if (["wardrobe", "costume", "accessory"].includes(type)) return ["WARDROBE"];
  if (["prop", "weapon", "vehicle", "object"].includes(type)) return ["PROP"];
  if (type === "style") return ["STYLE"];
  if (type === "composition") return ["COMPOSITION"];
  if (type === "camera") return ["CAMERA"];
  if (type === "lighting") return ["LIGHTING"];
  if (type === "audio") return ["AUDIO"];
  if (type === "voice") return ["VOICE"];
  return ["STYLE"];
};

const safeToken = (value: string) => value
  .normalize("NFKD")
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .slice(0, 28) || "ASSET";

const assetCategory = (type: ReferenceAssetType): AssetEntity["category"] => {
  if (["character", "creature", "animal", "location", "building", "room", "vehicle", "prop", "weapon", "wardrobe", "costume", "accessory", "object"].includes(type)) {
    return type as AssetEntity["category"];
  }
  return "period_reference";
};

const assetPrefix: Partial<Record<ReferenceAssetType, string>> = {
  character: "CHAR",
  creature: "CREATURE",
  animal: "ANIMAL",
  location: "LOC",
  building: "BUILDING",
  room: "ROOM",
  vehicle: "VEHICLE",
  prop: "PROP",
  weapon: "WEAPON",
  wardrobe: "WARDROBE",
  costume: "COSTUME",
  accessory: "ACCESSORY",
  object: "OBJECT",
};

const identityLocks = [
  "faceShape", "hair", "hairline", "skinTone", "eyes", "eyebrows", "nose", "mouth", "jaw", "neck",
  "ageAppearance", "heightImpression", "bodyProportions", "bodyBuild", "facialHair", "uniqueFacialFeatures",
  "clothing", "shoes", "accessories", "headCovering", "characterColourPalette",
];

const decodeImage = (input: { mimeType: string; base64: string }) => {
  const media = allowed[input.mimeType];
  if (!media) throw new Error("Reference must be a PNG, JPG, JPEG, or WebP image.");
  const encoded = input.base64.includes(",") ? input.base64.slice(input.base64.indexOf(",") + 1) : input.base64;
  const buffer = Buffer.from(encoded, "base64");
  if (!buffer.length || buffer.length > 12 * 1024 * 1024) throw new Error("Reference image must be between 1 byte and 12 MB.");
  if (media.mime === "image/png" && !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("The uploaded PNG is invalid.");
  if (media.mime === "image/jpeg" && !(buffer[0] === 0xff && buffer[1] === 0xd8)) throw new Error("The uploaded JPEG is invalid.");
  if (media.mime === "image/webp" && buffer.subarray(8, 12).toString("ascii") !== "WEBP") throw new Error("The uploaded WebP is invalid.");
  return { buffer, media };
};

const toArtifactAsset = (asset: AssetEntity): AssetItem => ({
  id: asset.id,
  name: asset.name,
  type: (["character", "animal", "creature", "location", "building", "room", "prop", "weapon", "wardrobe", "costume", "accessory", "object", "vehicle"].includes(asset.category)
    ? asset.category
    : "prop") as AssetItem["type"],
  description: asset.description,
  locked: asset.approvalState === "LOCKED",
  continuityNotes: asset.notes,
  approvalState: asset.approvalState,
  version: asset.version,
  referenceImages: asset.referenceImages,
  lockedTraits: asset.lockedTraits,
  mutableTraits: asset.mutableTraits,
  currentState: asset.currentState,
  notes: asset.notes,
});

export class ReferenceManager {
  constructor(private readonly store: ProjectStore) {}

  async upload(project: MovieProject, input: {
    filename: string;
    mimeType: string;
    base64: string;
    name: string;
    type: ReferenceAssetType;
    label?: string;
    roles?: ReferenceRole[];
    storyUsage?: StoryReferenceUsage;
    mainCharacter?: boolean;
    assetId?: string;
  }) {
    const { buffer, media } = decodeImage(input);
    const database = project.memory.database;
    if (input.mainCharacter && project.preStorySetup.mainCharacterReferenceId) {
      throw new Error("The main character source already exists. Use Replace Image on the existing protected source.");
    }
    const matchingAsset = input.assetId
      ?? database.projectReferences.find((item) => item.type === input.type && item.name.trim().toLowerCase() === input.name.trim().toLowerCase())?.assetId;
    const existingMainCharacterId = project.production.characters.find((item) => item.category === "main")?.id;
    const targetAssetId = input.mainCharacter
      ? existingMainCharacterId ?? "CHAR_MAIN_001"
      : matchingAsset ?? `${assetPrefix[input.type] ?? "ASSET"}_${safeToken(input.name)}_${String(database.projectReferences.filter((item) => item.type === input.type).length + 1).padStart(3, "0")}`;
    const baseId = input.mainCharacter ? "CHAR_MAIN_001_SOURCE" : `REF_${safeToken(input.type)}_${safeToken(input.name)}`;
    let id = baseId;
    for (let suffix = 2; database.projectReferences.some((item) => item.id === id); suffix += 1) id = `${baseId}_${suffix}`;
    const fingerprint = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
    const relative = path.posix.join("references", "uploads", `${id.toLowerCase()}-v1-${fingerprint}${media.extension}`);
    await this.store.writeProjectBinary(project.id, relative, buffer);
    const timestamp = new Date().toISOString();
    const roles = input.roles?.length ? input.roles : defaultRoles(input.type);
    const reference: ProjectReference = {
      id,
      projectId: project.id,
      name: input.name.trim() || input.filename,
      type: input.type,
      label: input.label?.trim() || undefined,
      roles,
      storyUsage: input.mainCharacter ? "REQUIRED" : (input.storyUsage ?? "PREFERRED"),
      source: "USER_UPLOAD",
      sourcePath: relative,
      mimeType: media.mime,
      originalFilename: path.basename(input.filename),
      priority: input.mainCharacter ? 1000 : 700,
      protected: true,
      linkedAssetIds: [targetAssetId],
      assetId: targetAssetId,
      sequenceIds: [],
      versions: [{ version: 1, sourcePath: relative, mimeType: media.mime, originalFilename: path.basename(input.filename), createdAt: timestamp }],
      analysis: {
        dominantColours: [],
        visualTraits: ["Protected user-authored visual reference", "Original source remains separate from generated continuity sheets"],
        suggestedRoles: roles,
        confidence: 1,
        analyzedAt: timestamp,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    database.projectReferences.push(reference);
    const existingAsset = database.assets.find((asset) => asset.id === targetAssetId);
    if (existingAsset) this.attachReference(existingAsset, reference);
    if (input.mainCharacter) {
      project.preStorySetup.mainCharacterReferenceId = id;
      const existingRequirement = database.storyAssetRequirements.find((item) => item.id === "REQ_MAIN_CHARACTER_SOURCE");
      const requirement = {
        id: "REQ_MAIN_CHARACTER_SOURCE",
        assetId: targetAssetId,
        sourceReferenceId: id,
        usage: "REQUIRED" as const,
        instruction: "The uploaded person is the protagonist. Preserve this exact identity and do not create a generic replacement or duplicate protagonist.",
        satisfied: true,
      };
      if (existingRequirement) Object.assign(existingRequirement, requirement);
      else database.storyAssetRequirements.push(requirement);
    }
    if (input.type === "character") {
      this.ensureAsset(project, reference.id);
      const character = project.production.characters.find((item) => item.id === targetAssetId || (input.mainCharacter && item.category === "main"));
      if (character) {
        character.referenceIds = [...new Set([...character.referenceIds, reference.id])];
        character.identitySource = character.identitySource === "STORY_DEFINED" ? "HYBRID" : "UPLOADED_REFERENCE";
        character.status = "REVIEW";
        character.version += 1;
        character.updatedAt = timestamp;
        character.history.push({ version: character.version, source: "REFERENCE", name: character.name, role: character.role, description: character.description, changedFields: ["referenceIds", "identitySource"], createdAt: timestamp });
      }
    }
    return reference;
  }

  async replace(project: MovieProject, referenceId: string, input: { filename: string; mimeType: string; base64: string }) {
    const reference = project.memory.database.projectReferences.find((item) => item.id === referenceId);
    if (!reference) throw new Error(`Reference ${referenceId} was not found.`);
    const { buffer, media } = decodeImage(input);
    const version = Math.max(0, ...reference.versions.map((item) => item.version)) + 1;
    const fingerprint = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
    const relative = path.posix.join("references", "uploads", `${reference.id.toLowerCase()}-v${version}-${fingerprint}${media.extension}`);
    await this.store.writeProjectBinary(project.id, relative, buffer);
    const previousPath = reference.sourcePath;
    const timestamp = new Date().toISOString();
    reference.sourcePath = relative;
    reference.mimeType = media.mime;
    reference.originalFilename = path.basename(input.filename);
    reference.versions.push({ version, sourcePath: relative, mimeType: media.mime, originalFilename: reference.originalFilename, createdAt: timestamp });
    reference.updatedAt = timestamp;
    for (const asset of project.memory.database.assets.filter((item) => item.sourceReferenceIds.includes(reference.id))) {
      asset.referenceImages = [relative, ...asset.referenceImages.filter((item) => item !== previousPath && item !== relative)];
      asset.generatedImagePath = undefined;
      asset.thumbnailPath = undefined;
      asset.approvalState = "REGENERATE";
      asset.generationError = undefined;
      asset.version += 1;
      asset.updatedAt = timestamp;
      const sheet = project.memory.database.continuitySheets.find((item) => item.assetId === asset.id);
      if (sheet) {
        sheet.version += 1;
        sheet.status = "REGENERATE";
        sheet.updatedAt = timestamp;
        sheet.views.forEach((view) => { view.imagePath = undefined; view.status = "REGENERATE"; });
      }
    }
    this.syncArtifact(project);
    const character = project.production.characters.find((item) => item.referenceIds.includes(reference.id));
    if (character) {
      character.version += 1;
      character.status = "REVIEW";
      character.sheetStatus = "REGENERATE";
      character.updatedAt = timestamp;
      character.history.push({ version: character.version, source: "REFERENCE", name: character.name, role: character.role, description: character.description, changedFields: ["referenceVersion", "sheetStatus"], createdAt: timestamp });
    }
    return reference;
  }

  async remove(project: MovieProject, referenceId: string) {
    const database = project.memory.database;
    const reference = database.projectReferences.find((item) => item.id === referenceId);
    if (!reference) throw new Error(`Reference ${referenceId} was not found.`);
    const referencePaths = new Set(reference.versions.map((item) => item.sourcePath));
    for (const asset of database.assets.filter((item) => item.sourceReferenceIds.includes(reference.id))) {
      asset.sourceReferenceIds = asset.sourceReferenceIds.filter((item) => item !== reference.id);
      asset.referenceImages = asset.referenceImages.filter((item) => !referencePaths.has(item));
      asset.generatedImagePath = undefined;
      asset.thumbnailPath = undefined;
      asset.approvalState = "PROMPT_READY";
      asset.generationError = undefined;
      asset.updatedAt = new Date().toISOString();
      database.continuitySheets = database.continuitySheets.filter((item) => item.assetId !== asset.id);
    }
    database.projectReferences = database.projectReferences.filter((item) => item.id !== reference.id);
    database.assetLineage = database.assetLineage.filter((item) => !item.sourceReferenceIds.includes(reference.id));
    if (project.preStorySetup.mainCharacterReferenceId === reference.id) {
      project.preStorySetup.mainCharacterReferenceId = undefined;
      project.preStorySetup.completed = project.preStorySetup.mode === "AI_FIRST";
      project.preStorySetup.completedAt = project.preStorySetup.completed ? new Date().toISOString() : undefined;
      database.storyAssetRequirements = database.storyAssetRequirements.filter((item) => item.sourceReferenceId !== reference.id);
    }
    for (const character of project.production.characters.filter((item) => item.referenceIds.includes(reference.id))) {
      character.referenceIds = character.referenceIds.filter((item) => item !== reference.id);
      character.identitySource = character.referenceIds.length ? "HYBRID" : "STORY_DEFINED";
      character.sheetStatus = "REGENERATE";
      character.status = "REVIEW";
      character.version += 1;
      character.updatedAt = new Date().toISOString();
      character.history.push({ version: character.version, source: "REFERENCE", name: character.name, role: character.role, description: character.description, changedFields: ["referenceIds", "sheetStatus"], createdAt: character.updatedAt });
    }
    await Promise.all([...referencePaths].map((relative) => this.store.removeProjectFile(project.id, relative)));
    this.syncArtifact(project);
    return reference;
  }

  ensureAsset(project: MovieProject, referenceId: string) {
    const database = project.memory.database;
    const reference = database.projectReferences.find((item) => item.id === referenceId);
    if (!reference) throw new Error(`Reference ${referenceId} was not found.`);
    const id = reference.assetId ?? reference.linkedAssetIds[0] ?? `${assetPrefix[reference.type] ?? "ASSET"}_${safeToken(reference.name)}_001`;
    let asset = database.assets.find((item) => item.id === id);
    if (!asset) {
      const timestamp = new Date().toISOString();
      const character = reference.type === "character";
      asset = {
        id,
        projectId: project.id,
        name: reference.name,
        category: assetCategory(reference.type),
        description: `${reference.name} continuity asset anchored to protected upload ${reference.id}${reference.label ? ` (${reference.label})` : ""}.`,
        approvalState: "PROMPT_READY",
        version: 1,
        referenceImages: [reference.sourcePath],
        lockedTraits: Object.fromEntries((character ? identityLocks : ["identity", "shape", "materials", "colourPalette", "scale", "distinctiveDetails"]).map((name) => [name, `Preserve exactly from ${reference.id}`])),
        mutableTraits: { storyState: "May change only through an approved story event" },
        currentState: { condition: "Established from protected user reference", visibility: "Available" },
        notes: ["Original upload is the primary source and must never be overwritten", "Generated sheets are derived files and may be regenerated"],
        visualDescription: `Inspect and preserve the exact visual identity in ${reference.id}.`,
        generationPrompt: character
          ? "Create a production-ready movie character identity sheet from the supplied person reference. Preserve the exact same person. Lock face shape, hair, hairline, skin tone, eyes, eyebrows, nose, mouth, jaw, neck, age appearance, height impression, body proportions, body build, facial hair, unique facial features, clothing, shoes, accessories, head covering, and character colour palette. Do not beautify, redesign, or substitute a generic face."
          : `Create a production-ready continuity asset sheet for ${reference.name} from the supplied protected reference. Preserve exact shape, material, scale, layout, colours, wear, and distinctive details.`,
        negativePrompt: "different identity, generic replacement, face drift, changed age, changed body, duplicate subject, changed materials, text, watermark, logo, cropped identity details",
        provider: "configured",
        model: "configured",
        sourceReferenceIds: [reference.id],
        generationJobIds: [],
        critical: ["character", "creature", "animal", "location", "building", "room"].includes(reference.type),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      database.assets.push(asset);
    }
    this.attachReference(asset, reference);
    reference.assetId = asset.id;
    reference.linkedAssetIds = [...new Set([...reference.linkedAssetIds, asset.id])];
    this.syncGroups(project);
    this.syncArtifact(project);
    return asset;
  }

  syncCharacterSheet(project: MovieProject, assetId: string) {
    const character = project.production.characters.find((item) => item.id === assetId);
    if (!character) return;
    const sheet = project.memory.database.continuitySheets.find((item) => item.assetId === assetId);
    if (!sheet) return;
    character.sheetId = sheet.id;
    character.sheetStatus = sheet.status;
    character.updatedAt = new Date().toISOString();
    const gate = project.production.gates.find((item) => item.stage === "character_references");
    if (gate) Object.assign(gate, {
      status: project.production.characters.every((item) => item.sheetStatus === "APPROVED" || item.sheetStatus === "LOCKED" || (item.category === "background" && item.referencePriority === "NORMAL")) ? "APPROVED" : "REVIEW",
      note: `${character.name} continuity sheet is ${sheet.status.toLowerCase()}.`,
      updatedAt: character.updatedAt,
    });
  }

  completeSetup(project: MovieProject) {
    const issues: string[] = [];
    if (project.preStorySetup.mode === "REFERENCE_FIRST" && !project.preStorySetup.mainCharacterReferenceId) {
      issues.push("Story With Main Character Reference requires at least one Main Character upload.");
    }
    project.preStorySetup.blockingIssues = issues;
    if (issues.length) throw new Error(issues.join(" "));
    project.preStorySetup.completed = true;
    project.preStorySetup.completedAt = new Date().toISOString();
    return project;
  }

  private attachReference(asset: AssetEntity, reference: ProjectReference) {
    asset.sourceReferenceIds = [...new Set([...asset.sourceReferenceIds, reference.id])];
    asset.referenceImages = [...new Set([reference.sourcePath, ...asset.referenceImages])];
    asset.updatedAt = new Date().toISOString();
  }

  private syncGroups(project: MovieProject) {
    const database = project.memory.database;
    database.characters = database.assets.filter((asset) => asset.category === "character");
    database.creatures = database.assets.filter((asset) => asset.category === "creature");
    database.animals = database.assets.filter((asset) => asset.category === "animal");
    database.locations = database.assets.filter((asset) => ["location", "building", "room", "interior"].includes(asset.category));
    database.wardrobes = database.assets.filter((asset) => ["wardrobe", "costume"].includes(asset.category));
    database.props = database.assets.filter((asset) => !["character", "creature", "animal", "location", "building", "room", "interior", "wardrobe", "costume"].includes(asset.category));
  }

  private syncArtifact(project: MovieProject) {
    const database = project.memory.database;
    const assets = database.assets.map(toArtifactAsset);
    const counts = assets.reduce<Record<string, number>>((result, asset) => {
      result[asset.type] = (result[asset.type] ?? 0) + 1;
      return result;
    }, {});
    if (assets.length || project.artifacts.assets) project.artifacts.assets = { assets, counts } satisfies AssetManifestArtifact;
    this.syncGroups(project);
  }
}
