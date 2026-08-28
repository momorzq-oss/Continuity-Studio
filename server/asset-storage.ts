import path from "node:path";
import type { MovieProject, ProductionAssetRecord } from "../src/types.js";

export const PROJECT_IMAGE_DIGITS = 3;
export const SEQUENCE_UPLOAD_DIGITS = 2;

export const projectImageNumberLabel = (value: number) => String(value).padStart(PROJECT_IMAGE_DIGITS, "0");
export const sequenceUploadNumberLabel = (value: number) => String(value).padStart(SEQUENCE_UPLOAD_DIGITS, "0");

const filenameToken = (value: string) => value
  .normalize("NFKD")
  .replace(/[^a-z0-9]+/gi, "_")
  .replace(/^_+|_+$/g, "") || "Asset";

const safeExtension = (value?: string) => {
  const extension = String(value ?? "png").replace(/^\.+/, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  return extension || "png";
};

export const permanentAssetFilename = (number: number, name: string, extension?: string) =>
  `${projectImageNumberLabel(number)}_${filenameToken(name)}.${safeExtension(extension)}`;

export const normalizePermanentAssetFilename = (number: number, filename: string | undefined, name: string) => {
  const basename = path.basename(filename || "");
  const extension = safeExtension(path.extname(basename).slice(1) || "png");
  const withoutExtension = basename.slice(0, basename.length - (path.extname(basename).length || 0));
  const suffix = withoutExtension.replace(/^\d+[_-]*/, "").trim();
  return permanentAssetFilename(number, suffix || name, extension);
};

export const flatAssetRelativePath = (filename: string) => `assets/${path.basename(filename).replaceAll("\\", "_")}`;

export const activeAssetManifest = (project: MovieProject, records: ProductionAssetRecord[] = project.production.assets) => ({
  projectId: project.id,
  storageModel: "FLAT_PERMANENT_PROJECT_IMAGES",
  nextProjectImageNumber: project.production.nextProjectImageNumber,
  assets: [...records].sort((left, right) => left.number - right.number).map((record) => ({
    projectImageNumber: record.number,
    assetId: record.id,
    exactFilename: record.filename,
    assetName: record.name,
    category: record.category,
    referenceRoles: [...(record.referenceRoles ?? [])],
    currentVersion: record.version,
    approvalState: record.status,
    lockState: record.status === "LOCKED" ? "LOCKED" : "UNLOCKED",
    sequencesUsed: [...record.sequenceIds],
    imagePath: record.imagePath,
  })),
});

export const assetHistoryManifest = (project: MovieProject) => ({
  projectId: project.id,
  note: "Historical generation metadata and staged files are separate from the flat active assets folder.",
  assets: [...project.production.assets].sort((left, right) => left.number - right.number).map((record) => ({
    projectImageNumber: record.number,
    assetId: record.id,
    exactFilename: record.filename,
    currentVersion: record.version,
    previousVersions: record.previousVersions,
    versionHistory: record.versionHistory ?? [],
    generationAttempts: record.generationAttempts ?? [],
    pendingVersion: record.pendingVersion,
  })),
});
