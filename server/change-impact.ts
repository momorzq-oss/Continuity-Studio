import type { ChangeImpactItem, ChangeImpactReport, ChangeSourceType, MovieProject } from "../src/types.js";

const protection = (value?: string): ChangeImpactItem["protection"] =>
  value === "LOCKED" ? "LOCKED" : value === "APPROVED" ? "APPROVED" : "NONE";

const filmBibleProtection = (project: MovieProject): ChangeImpactItem["protection"] =>
  project.production.filmBible.lockedVersion ? "LOCKED" : project.production.filmBible.approvedVersion ? "APPROVED" : protection(project.production.filmBible.status);

const filmBibleLabel = (project: MovieProject) => {
  const bible = project.production.filmBible;
  const productionVersion = bible.lockedVersion ?? bible.approvedVersion;
  return productionVersion && productionVersion !== bible.version
    ? `Film Bible v${productionVersion} production source · v${bible.version} current draft`
    : `Film Bible v${bible.version}`;
};

export const assessChangeImpact = (
  project: MovieProject,
  sourceType: ChangeSourceType,
  sourceId?: string,
): ChangeImpactReport => {
  const found = new Map<string, ChangeImpactItem>();
  const add = (item: ChangeImpactItem) => found.set(`${item.kind}:${item.id}`, item);
  const addSequence = (sequence: MovieProject["production"]["sequences"][number], reason: string) => {
    add({ kind: "sequence", id: sequence.id, label: `Sequence ${String(sequence.number).padStart(2, "0")} · ${sequence.title}`, reason, protection: protection(sequence.status) });
    if (sequence.script) add({ kind: "script", id: sequence.id, label: `${sequence.id} structured script`, reason: "Its action and performance are derived from the Story version.", protection: protection(sequence.status) });
    if (sequence.dialogue.length) add({ kind: "dialogue", id: sequence.id, label: `${sequence.id} dialogue`, reason: "Approved wording, timing, or speaker intent may conflict with the revised Story.", protection: protection(sequence.status) });
    if (sequence.compiledPrompt) add({ kind: "prompt", id: sequence.id, label: `${sequence.id} compiled prompt`, reason: "Its compiled production context may be outdated.", protection: protection(sequence.status) });
    if (sequence.referenceSlots.length) add({ kind: "reference_pack", id: sequence.id, label: `${sequence.id} reference package`, reason: "Reference requirements or roles may need recompilation.", protection: protection(sequence.status) });
  };

  if (sourceType === "movie_dna") {
    if (project.production.story.status !== "DRAFT") add({ kind: "story", id: "STORY", label: "Approved narrative context", reason: "Story and its production interpretation inherit the locked visual period and atmosphere.", protection: protection(project.production.story.status) });
    if (project.production.filmBible.status !== "PENDING") add({ kind: "film_bible", id: "FILM_BIBLE", label: filmBibleLabel(project), reason: "Visual and historical production rules cite Movie DNA.", protection: filmBibleProtection(project) });
    project.production.assets.forEach((asset) => add({ kind: "asset", id: asset.id, label: `${asset.filename} · ${asset.name}`, reason: "Generated appearance inherits Movie DNA.", protection: protection(asset.status) }));
    project.production.sequences.forEach((sequence) => addSequence(sequence, "Camera, lighting, grade, environment, or image texture may change."));
  }

  if (sourceType === "story") {
    if (project.production.filmBible.status !== "PENDING") add({ kind: "film_bible", id: "FILM_BIBLE", label: filmBibleLabel(project), reason: "Canonical facts and world rules were derived from the approved Story.", protection: filmBibleProtection(project) });
    project.production.characters.forEach((character) => {
      add({ kind: "character", id: character.id, label: character.name, reason: "Role, motivation, arc, or required state may change.", protection: protection(character.status) });
      character.states.forEach((state) => add({ kind: "character_state", id: `${character.id}:${state.sequenceId}`, label: `${character.name} · ${state.sequenceId} state`, reason: "Physical, emotional, wardrobe, injury, or possession state may no longer follow the revised event.", protection: protection(character.status) }));
    });
    project.production.assets.forEach((asset) => add({ kind: "asset", id: asset.id, label: `${asset.filename} · ${asset.name}`, reason: "Story purpose, sequence usage, or requirement may change.", protection: protection(asset.status) }));
    project.production.sequences.forEach((sequence) => addSequence(sequence, "Narrative purpose, action, script, dialogue, or timing may change."));
    project.production.continuityLedger.forEach((entry) => add({ kind: "continuity", id: entry.id, label: `${entry.sequenceId} · ${entry.entityId}`, reason: "Approved downstream state may no longer follow the revised event.", protection: entry.source }));
    if (Object.keys(project.production.audioBible).length) add({ kind: "audio_bible", id: "AUDIO_BIBLE", label: "Audio Bible", reason: "Dialogue, narration, music, or ambience intent may need review against the revised Story.", protection: "NONE" });
  }

  if (sourceType === "film_bible") {
    project.production.characters.forEach((character) => add({ kind: "character", id: character.id, label: character.name, reason: "Canonical identity or world facts may change.", protection: protection(character.status) }));
    project.production.assets.forEach((asset) => add({ kind: "asset", id: asset.id, label: `${asset.filename} · ${asset.name}`, reason: "Canonical design, location, prop, costume, or historical facts may change.", protection: protection(asset.status) }));
    project.production.sequences.forEach((sequence) => addSequence(sequence, "The compiled sequence reads Film Bible facts."));
  }

  if (sourceType === "character" && sourceId) {
    project.production.assets.filter((asset) => asset.id === sourceId || asset.referenceIds.includes(sourceId)).forEach((asset) => add({ kind: "asset", id: asset.id, label: `${asset.filename} · ${asset.name}`, reason: "This asset carries the character identity or state.", protection: protection(asset.status) }));
    project.production.sequences.filter((sequence) => sequence.assetIds.includes(sourceId)).forEach((sequence) => addSequence(sequence, "This character appears in the sequence."));
  }

  if (sourceType === "asset" && sourceId) {
    const asset = project.production.assets.find((item) => item.id === sourceId);
    const sequenceIds = new Set([
      ...(asset?.sequenceIds ?? []),
      ...(asset?.referenceUsage?.map((usage) => usage.sequenceId) ?? []),
      ...project.production.sequences.filter((sequence) => sequence.assetIds.includes(sourceId)).map((sequence) => sequence.id),
    ]);
    for (const sequenceId of sequenceIds) {
      const sequence = project.production.sequences.find((item) => item.id === sequenceId);
      if (sequence) addSequence(sequence, "This sequence depends on the selected asset.");
      else add({ kind: "sequence", id: sequenceId, label: sequenceId.replace("SEQ_", "Sequence "), reason: "This approved Story sequence requires the selected asset reference.", protection: "NONE" });
      add({ kind: "reference_pack", id: sequenceId, label: `${sequenceId} reference mapping`, reason: "Future upload position and platform prompt mapping must continue to point to the accepted active version.", protection: sequence ? protection(sequence.status) : "NONE" });
    }
  }

  if (["script", "dialogue"].includes(sourceType)) {
    const script = project.memory.productionMemory.script;
    const selected = script.sequences.filter((sequence) => !sourceId || sequence.id === sourceId || sequence.number === Number(sourceId.match(/(\d+)/)?.[1] ?? 0));
    selected.forEach((sequence) => {
      add({ kind: "script", id: `${script.scriptId}:V${script.scriptVersion}:${sequence.id}`, label: `Script V${script.scriptVersion} · ${sequence.id}`, reason: "The approved screenplay action and production interpretation may change.", protection: protection(script.status) });
      script.dialogue.filter((line) => line.sequenceId === sequence.id).forEach((line) => add({ kind: "dialogue", id: line.id, label: `${line.id} · ${line.speakerCharacterId}`, reason: sourceType === "dialogue" ? "Exact wording, timing, delivery, approval, and lock state are directly affected." : "Dialogue timing or performance may depend on the edited screenplay action.", protection: line.lockState === "LOCKED" ? "LOCKED" : protection(line.approvalState) }));
      script.shots.filter((shot) => shot.sequenceId === sequence.id).forEach((shot) => add({ kind: "shot", id: shot.id, label: `${shot.id} · ${shot.shotType}`, reason: "Shot timing, camera, action, dialogue relationship, or continuity purpose may need review.", protection: protection(sequence.lockState === "LOCKED" ? "LOCKED" : sequence.approvalState) }));
      project.production.sequences.filter((item) => item.number >= sequence.number).forEach((item) => addSequence(item, item.number === sequence.number ? "The formal sequence is produced by this script section." : `Its Start State or chronology may inherit from ${sequence.id}.`));
      project.memory.productionMemory.continuity.snapshots.filter((snapshot) => Number(snapshot.sequenceId.match(/(\d+)/)?.[1] ?? 0) >= sequence.number).forEach((snapshot) => add({ kind: "continuity", id: snapshot.id, label: `${snapshot.sequenceId} ${snapshot.anchor} state`, reason: "Sequence action can change an End State and the next sequence Start State.", protection: protection(snapshot.status) }));
    });
  }

  if (sourceType === "sequence" && sourceId) {
    const source = project.production.sequences.find((sequence) => sequence.id === sourceId);
    if (source) {
      project.production.sequences.filter((sequence) => sequence.number > source.number).forEach((sequence) => addSequence(sequence, `Its Start State may inherit from ${source.id}.`));
      project.production.continuityLedger.filter((entry) => {
        const sequence = project.production.sequences.find((item) => item.id === entry.sequenceId);
        return Boolean(sequence && sequence.number >= source.number);
      }).forEach((entry) => add({ kind: "continuity", id: entry.id, label: `${entry.sequenceId} · ${entry.entityId}`, reason: `Approved continuity at or after ${source.id} may change.`, protection: entry.source }));
    }
  }

  if (sourceType === "continuity") {
    const sourceSnapshot = project.memory.productionMemory.continuity.snapshots.find((snapshot) => snapshot.id === sourceId)
      ?? project.memory.productionMemory.continuity.snapshots.find((snapshot) => snapshot.sequenceId === sourceId && snapshot.anchor === "END");
    const sourceSequenceId = sourceSnapshot?.sequenceId ?? sourceId;
    const sourceNumber = sourceSequenceId ? Number(sourceSequenceId.match(/(\d+)/)?.[1] ?? 0) : 0;
    project.production.sequences
      .filter((sequence) => !sourceSequenceId || sequence.number > sourceNumber)
      .forEach((sequence) => addSequence(sequence, sourceSequenceId ? `Its Start State and compiled constraints inherit continuity after ${sourceSequenceId}.` : "Its Start State and compiled constraints read the Continuity Ledger."));
    const affectedEntityIds = new Set(sourceSnapshot?.entities.map((entity) => entity.entityId) ?? []);
    project.production.characters.filter((character) => affectedEntityIds.has(character.id)).forEach((character) => {
      add({ kind: "character_state", id: character.id, label: `${character.name} continuity states`, reason: "Physical, wardrobe, injury, possession, knowledge, or relationship state may change.", protection: protection(character.status) });
    });
    add({ kind: "continuity", id: sourceSnapshot?.id ?? sourceSequenceId ?? "CONTINUITY", label: sourceSequenceId ? `${sourceSequenceId} continuity state` : "Continuity Ledger", reason: "The permanent current-state memory and future sequence inheritance will change.", protection: sourceSnapshot ? protection(sourceSnapshot.status) : "NONE" });
  }

  if (sourceType === "audio_bible") {
    project.production.sequences.forEach((sequence) => addSequence(sequence, "Dialogue delivery, recurring ambience, sound identity, silence, or music rules may change."));
    add({ kind: "audio_bible", id: "AUDIO_BIBLE", label: `Audio Bible v${project.memory.productionMemory.audioBible.version}`, reason: "Full Script v2 and future sequence audio contracts read this version.", protection: protection(project.memory.productionMemory.audioBible.status) });
  }

  const items = [...found.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label));
  const lockedCount = items.filter((item) => item.protection === "LOCKED").length;
  const approvedCount = items.filter((item) => item.protection === "APPROVED").length;
  return {
    sourceType,
    sourceId,
    summary: items.length ? `${items.length} downstream production item${items.length === 1 ? "" : "s"} require review.` : "No downstream production items are currently affected.",
    requiresReview: items.length > 0,
    lockedCount,
    approvedCount,
    items,
  };
};
