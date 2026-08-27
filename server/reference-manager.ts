import { createHash } from "node:crypto";
import path from "node:path";
import type {
  MovieProject,
  ProjectReference,
  ReferenceAssetType,
  ReferenceRole,
  StoryReferenceUsage,
} from "../src/types.js";
import type { ProjectStore } from "./store.js";

const allowed: Record<string, { extension: string; mime: string }> = {
  "image/png": { extension: ".png", mime: "image/png" },
  "image/jpeg": { extension: ".jpg", mime: "image/jpeg" },
  "image/webp": { extension: ".webp", mime: "image/webp" },
};

const defaultRoles = (type: ReferenceAssetType): ReferenceRole[] => {
  if (type === "character") return ["IDENTITY"];
  if (type === "creature") return ["CREATURE", "IDENTITY"];
  if (type === "animal") return ["ANIMAL", "IDENTITY"];
  if (type === "location") return ["LOCATION"];
  if (type === "wardrobe") return ["WARDROBE"];
  if (type === "prop") return ["PROP"];
  if (type === "style") return ["STYLE"];
  if (type === "composition") return ["COMPOSITION"];
  if (type === "camera") return ["CAMERA"];
  if (type === "lighting") return ["LIGHTING"];
  if (type === "audio") return ["AUDIO"];
  if (type === "voice") return ["VOICE"];
  return [];
};

export class ReferenceManager {
  constructor(private readonly store: ProjectStore) {}

  async upload(project: MovieProject, input: {
    filename: string;
    mimeType: string;
    base64: string;
    name: string;
    type: ReferenceAssetType;
    roles?: ReferenceRole[];
    storyUsage?: StoryReferenceUsage;
    mainCharacter?: boolean;
  }) {
    const media = allowed[input.mimeType];
    if (!media) throw new Error("Reference must be a PNG, JPEG, or WebP image.");
    const encoded = input.base64.includes(",") ? input.base64.slice(input.base64.indexOf(",") + 1) : input.base64;
    const buffer = Buffer.from(encoded, "base64");
    if (!buffer.length || buffer.length > 12 * 1024 * 1024) throw new Error("Reference image must be between 1 byte and 12 MB.");
    if (media.mime === "image/png" && !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("The uploaded PNG is invalid.");
    if (media.mime === "image/jpeg" && !(buffer[0] === 0xff && buffer[1] === 0xd8)) throw new Error("The uploaded JPEG is invalid.");
    if (media.mime === "image/webp" && buffer.subarray(8, 12).toString("ascii") !== "WEBP") throw new Error("The uploaded WebP is invalid.");

    const database = project.memory.database;
    const index = database.projectReferences.length + 1;
    const id = input.mainCharacter ? "CHAR_MAIN_001_SOURCE" : `REF_${input.type.toUpperCase()}_${String(index).padStart(3, "0")}`;
    if (input.mainCharacter && database.projectReferences.some((item) => item.id === id)) throw new Error("The main character source already exists. It is protected; add another reference as a supporting reference.");
    const fingerprint = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
    const relative = path.posix.join("references", "uploads", `${id.toLowerCase()}-${fingerprint}${media.extension}`);
    await this.store.writeProjectBinary(project.id, relative, buffer);
    const timestamp = new Date().toISOString();
    const reference: ProjectReference = {
      id,
      projectId: project.id,
      name: input.name.trim() || input.filename,
      type: input.type,
      roles: input.roles?.length ? input.roles : defaultRoles(input.type),
      storyUsage: input.mainCharacter ? "REQUIRED" : (input.storyUsage ?? "PREFERRED"),
      source: "USER_UPLOAD",
      sourcePath: relative,
      mimeType: media.mime,
      originalFilename: path.basename(input.filename),
      priority: input.mainCharacter ? 1000 : 700,
      protected: true,
      linkedAssetIds: [],
      analysis: {
        dominantColours: [],
        visualTraits: ["Protected user-authored visual reference"],
        suggestedRoles: input.roles?.length ? input.roles : defaultRoles(input.type),
        confidence: 1,
        analyzedAt: timestamp,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    database.projectReferences.push(reference);
    if (input.mainCharacter) {
      project.preStorySetup.mainCharacterReferenceId = id;
      database.storyAssetRequirements.push({
        id: "REQ_MAIN_CHARACTER_SOURCE",
        assetId: id,
        sourceReferenceId: id,
        usage: "REQUIRED",
        instruction: "The uploaded person is the protagonist. Preserve this identity and do not create a duplicate protagonist.",
        satisfied: true,
      });
    }
    return reference;
  }

  completeSetup(project: MovieProject) {
    const issues: string[] = [];
    if (project.preStorySetup.mode === "REFERENCE_FIRST" && !project.memory.database.projectReferences.length) {
      issues.push("Reference-first mode requires at least one uploaded reference.");
    }
    project.preStorySetup.blockingIssues = issues;
    if (issues.length) throw new Error(issues.join(" "));
    project.preStorySetup.completed = true;
    project.preStorySetup.completedAt = new Date().toISOString();
    return project;
  }
}
