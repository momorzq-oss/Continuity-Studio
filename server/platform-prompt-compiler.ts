import type {
  AssetEntity,
  CanonicalPrompt,
  CanonicalPromptReference,
  GenerationPromptEntity,
  ModelProfile,
  MovieProject,
  PlatformPromptCompilation,
  ProviderReferenceMapping,
  ReferenceRole,
  SequenceItem,
  SequencesArtifact,
} from "../src/types.js";

const now = () => new Date().toISOString();
const safe = (value: string) => value.replace(/[^A-Z0-9_]+/gi, "_").toUpperCase();

const rolesFor = (asset: AssetEntity): ReferenceRole[] => {
  if (asset.category === "character") return ["IDENTITY"];
  if (asset.category === "wardrobe") return ["WARDROBE"];
  if (asset.category === "creature") return ["CREATURE", "IDENTITY"];
  if (asset.category === "animal") return ["ANIMAL", "IDENTITY"];
  if (asset.category === "location" || asset.category === "interior") return ["LOCATION"];
  return ["PROP"];
};

const stateText = (state: MovieProject["memory"]["database"]["continuityStates"][number] | undefined) => {
  if (!state) return "State not yet planned.";
  return [
    `characters ${state.characters.join(", ") || "none"}`,
    `location ${state.locationId}`,
    `positions ${Object.entries(state.characterPositions).map(([id, value]) => `${id}: ${value}`).join("; ") || "unassigned"}`,
    `environment ${state.environmentState}`,
    `time ${state.timeOfDay}`,
    `lighting ${state.lighting}`,
    `weather ${state.weather}`,
    `camera ${state.cameraPosition}`,
  ].join("; ");
};

export class ReferenceTaggingEngine {
  assign(project: MovieProject, canonical: CanonicalPrompt, profile: ModelProfile): PlatformPromptCompilation {
    const rank = (reference: CanonicalPromptReference) => {
      const roleRank = Math.min(...reference.roles.map((role) => {
        const index = profile.rolePriority.indexOf(role);
        return index < 0 ? profile.rolePriority.length : index;
      }));
      return (reference.critical ? -10_000 : 0) + roleRank * 100 - reference.priority;
    };
    const sorted = [...canonical.references].sort((a, b) => rank(a) - rank(b));
    const maximum = profile.maxImageReferences ?? Number.POSITIVE_INFINITY;
    const included = sorted.slice(0, maximum);
    const excluded = sorted.slice(maximum).map((item) => ({ ...item, reason: `Excluded by editable ${profile.displayName} image-reference limit (${maximum}).` }));
    const blockingIssues: string[] = [];
    const warnings: string[] = [];
    const missingCritical = sorted.filter((item) => item.critical && !item.sourcePath);
    if (missingCritical.length) blockingIssues.push(`Critical visual references are missing files: ${missingCritical.map((item) => item.assetId).join(", ")}.`);
    const excludedCritical = excluded.filter((item) => item.critical || item.roles.includes("IDENTITY"));
    if (excludedCritical.length) blockingIssues.push(`${profile.displayName} cannot fit all critical references. Never silently drop: ${excludedCritical.map((item) => item.assetId).join(", ")}. Split the shot or change the model profile.`);
    if (canonical.durationSeconds > (profile.maxDurationSeconds ?? Number.POSITIVE_INFINITY)) blockingIssues.push(`Sequence duration ${canonical.durationSeconds}s exceeds the editable ${profile.displayName} limit of ${profile.maxDurationSeconds}s.`);
    if (excluded.length && !excludedCritical.length) warnings.push(`${excluded.length} lower-priority reference(s) are explicitly excluded by the profile limit.`);

    const mappings: ProviderReferenceMapping[] = included.map((reference, index) => ({
      id: `MAP_${safe(profile.id)}_${safe(canonical.sequenceId)}_${String(index + 1).padStart(2, "0")}`,
      projectId: project.id,
      assetId: reference.assetId,
      provider: profile.provider,
      model: profile.model,
      referenceType: reference.roles[0] ?? "STYLE",
      promptTag: profile.tagTemplate.replace("{position}", String(index + 1)),
      uploadPosition: index + 1,
      version: project.memory.database.assets.find((item) => item.id === reference.assetId)?.version ?? 1,
      status: reference.sourcePath ? "ACTIVE" : "MISSING",
    }));
    const prompt = this.render(canonical, profile, mappings);
    return {
      profileId: profile.id,
      provider: profile.provider,
      model: profile.model,
      prompt,
      negativePrompt: canonical.negativeConstraints.join(", "),
      mappings,
      includedReferences: included,
      excludedReferences: excluded,
      blockingIssues,
      warnings,
      settings: {
        durationSeconds: canonical.durationSeconds,
        imageReferenceCount: included.length,
        maxImageReferences: Number.isFinite(maximum) ? maximum : "unlimited",
        supportsStartFrame: profile.supportsStartFrame,
        supportsEndFrame: profile.supportsEndFrame,
      },
    };
  }

  private render(canonical: CanonicalPrompt, profile: ModelProfile, mappings: ProviderReferenceMapping[]) {
    const referenceLines = mappings.map((mapping) => `${mapping.promptTag}: ${mapping.assetId} [${mapping.referenceType}]`).join("\n") || "No visual references assigned.";
    const body = `PROJECT: ${canonical.projectId}\nSEQUENCE: ${canonical.sequenceId}\nDURATION: ${canonical.durationSeconds}s\n\nREFERENCES\n${referenceLines}\n\nCONTINUITY LOCKS\n${canonical.continuityLocks.join("\n")}\n\nSTART\n${canonical.start}\n\nMIDDLE\n${canonical.middle}\n\nEND\n${canonical.end}\n\nACTION\n${canonical.action.join("\n")}\n\nCAMERA\n${canonical.camera}; lens ${canonical.lens}; composition ${canonical.composition}\n\nLIGHT / WEATHER\n${canonical.lighting}; ${canonical.weather}\n\nDIALOGUE\n${canonical.dialogue.join("\n") || "None"}\n\nSOUND\n${canonical.sound}`;
    if (profile.provider === "seedance") return `# Seedance 2.5 compiled prompt\n${body}\n\nUse timestamp-level START/MIDDLE/END control. Treat every @Image tag as the assigned stable asset only.`;
    if (profile.provider === "minimax") return `# MiniMax S2V-01 subject-reference prompt\n${body}\n\nThe selected subject reference owns identity. Describe pose, expression, movement, camera, and lighting in text without inventing another identity.`;
    if (profile.provider === "higgsfield") return `# Higgsfield compiled prompt\n${body}\n\nBind reference Elements and first/last frames exactly as listed; retain camera and motion controls.`;
    return `# Generic structured video prompt\n${body}`;
  }
}

export class PlatformPromptCompiler {
  private readonly tagging = new ReferenceTaggingEngine();

  buildCanonical(project: MovieProject, sequence: SequenceItem): CanonicalPrompt {
    const database = project.memory.database;
    const assets = [...new Set([sequence.locationId, ...sequence.assetIds])]
      .map((id) => database.assets.find((item) => item.id === id))
      .filter((item): item is AssetEntity => Boolean(item));
    const references: CanonicalPromptReference[] = assets.map((asset, index) => ({
      assetId: asset.id,
      referenceId: asset.sourceReferenceIds[0],
      roles: rolesFor(asset),
      priority: asset.sourceReferenceIds.length ? 1000 - index : 500 - index,
      critical: asset.critical,
      sourcePath: asset.generatedImagePath || asset.referenceImages[0],
    }));
    const start = database.continuityStates.find((item) => item.id === `${sequence.id}_START`);
    const mid = database.continuityStates.find((item) => item.id === `${sequence.id}_MID`);
    const end = database.continuityStates.find((item) => item.id === `${sequence.id}_END`);
    const frame = database.frames.find((item) => item.sequenceId === sequence.id);
    return {
      projectId: project.id,
      sequenceId: sequence.id,
      durationSeconds: sequence.durationSeconds,
      assets: assets.map((item) => item.id),
      references,
      start: stateText(start),
      middle: stateText(mid),
      end: stateText(end),
      action: [sequence.beginning, sequence.middle, sequence.ending].filter((item): item is string => Boolean(item)),
      dialogue: sequence.dialogue ?? [],
      camera: sequence.cameraPlan || frame?.camera || "Preserve established axis and motivated cinematic movement.",
      lens: frame?.lens || "Project lens language",
      composition: frame?.composition || "Readable geography and stable screen direction",
      lighting: sequence.lightingPlan || start?.lighting || project.visualStyle,
      weather: start?.weather || "Preserve established weather",
      sound: sequence.soundPlan || "Preserve location tone and motivated production sound",
      continuityLocks: assets.flatMap((asset) => Object.entries(asset.lockedTraits).map(([key, value]) => `${asset.id}.${key}=${value}`)),
      negativeConstraints: [...new Set([...(sequence.negativeRules ?? []), "identity drift", "unregistered recurring asset", "wardrobe drift", "geography drift", "incorrect era", "text", "watermark"])],
    };
  }

  compile(project: MovieProject, profileIds?: string[]) {
    const database = project.memory.database;
    const profiles = database.modelProfiles.filter((profile) => profile.enabled && (!profileIds?.length || profileIds.includes(profile.id)));
    const sequences = (project.artifacts.sequences as SequencesArtifact | undefined)?.sequences ?? [];
    const existingById = new Map(database.generationPrompts.map((item) => [item.id, item]));
    const generated: GenerationPromptEntity[] = [];
    const mappings: ProviderReferenceMapping[] = [];
    for (const sequence of sequences) {
      const canonical = this.buildCanonical(project, sequence);
      for (const profile of profiles) {
        const compilation = this.tagging.assign(project, canonical, profile);
        const id = `PROMPT_${safe(sequence.id)}_${safe(profile.id)}`;
        const existing = existingById.get(id);
        generated.push({
          id,
          projectId: project.id,
          name: `${sequence.id} ${profile.displayName}`,
          approvalState: compilation.blockingIssues.length ? "DRAFT" : (project.mode === "full" ? "APPROVED" : "REVIEW"),
          version: existing?.version ?? 1,
          sequenceId: sequence.id,
          model: profile.id as GenerationPromptEntity["model"],
          prompt: compilation.prompt,
          negativePrompt: compilation.negativePrompt,
          inheritedRuleIds: database.rules.filter((rule) => rule.enabled).map((rule) => rule.id),
          referenceManifest: canonical.references.map((reference) => ({ assetId: reference.assetId, referenceFile: reference.sourcePath ?? "", roles: reference.roles, priority: reference.priority, stateVersion: database.assets.find((item) => item.id === reference.assetId)?.version ?? 1, approved: Boolean(reference.sourcePath) })),
          validationIssueIds: [],
          canonicalPrompt: canonical,
          compilation,
          createdAt: existing?.createdAt ?? now(),
          updatedAt: now(),
        });
        mappings.push(...compilation.mappings);
      }
    }
    database.generationPrompts = generated;
    database.providerReferenceMappings = mappings;
    return generated;
  }
}
