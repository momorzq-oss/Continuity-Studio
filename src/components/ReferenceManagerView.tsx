import { useState } from "react";
import { Check, Image as ImageIcon, LockKeyhole, RefreshCw, Trash2, WandSparkles } from "lucide-react";
import { api } from "../api";
import type { MovieProject, ReferenceAssetType, ReferenceUploadInput } from "../types";
import { ReferenceImagePicker, type PendingReferenceImage } from "./ReferenceImagePicker";

const categories: Array<{ value: ReferenceAssetType; label: string }> = [
  { value: "character", label: "Supporting Character" },
  { value: "creature", label: "Creature" },
  { value: "location", label: "Location" },
  { value: "building", label: "Building" },
  { value: "room", label: "Room" },
  { value: "vehicle", label: "Vehicle" },
  { value: "prop", label: "Prop" },
  { value: "weapon", label: "Weapon" },
  { value: "animal", label: "Animal" },
  { value: "costume", label: "Costume" },
  { value: "accessory", label: "Accessory" },
  { value: "object", label: "Important Object" },
  { value: "wardrobe", label: "Wardrobe" },
  { value: "style", label: "Visual Style" },
  { value: "composition", label: "Composition" },
  { value: "lighting", label: "Lighting" },
];

type UpdateInput = { roles?: string[]; storyUsage?: string; priority?: number; sequenceIds?: string[]; label?: string; name?: string };

export function ReferenceManagerView({
  project,
  setup = false,
  onUpload,
  onComplete,
  onUpdate,
  onReplace,
  onRemove,
  onGenerateSheet,
}: {
  project: MovieProject;
  setup?: boolean;
  onUpload: (input: ReferenceUploadInput) => Promise<void>;
  onComplete: () => Promise<void>;
  onUpdate: (referenceId: string, input: UpdateInput) => Promise<void>;
  onReplace: (referenceId: string, input: Pick<ReferenceUploadInput, "filename" | "mimeType" | "base64">) => Promise<void>;
  onRemove: (referenceId: string) => Promise<void>;
  onGenerateSheet: (referenceId: string, force?: boolean) => Promise<void>;
}) {
  const [type, setType] = useState<ReferenceAssetType>("character");
  const [name, setName] = useState("Supporting Character");
  const [label, setLabel] = useState("Primary Reference");
  const [mainCharacter, setMainCharacter] = useState(!project.preStorySetup.mainCharacterReferenceId);
  const [pending, setPending] = useState<PendingReferenceImage>();
  const [busy, setBusy] = useState(false);
  const references = project.memory.database.projectReferences;

  const save = async () => {
    if (!pending || !name.trim()) return;
    setBusy(true);
    try {
      await onUpload({
        ...pending,
        name: name.trim(),
        type,
        label: label.trim() || undefined,
        mainCharacter: type === "character" && mainCharacter,
        storyUsage: type === "character" && mainCharacter ? "REQUIRED" : "PREFERRED",
      });
      setPending(undefined);
      if (type === "character" && mainCharacter) { setMainCharacter(false); setName("Supporting Character"); }
    } finally { setBusy(false); }
  };

  return <div className="artifact-page reference-manager-page">
    {setup ? <section className={`setup-gate ${project.preStorySetup.completed ? "complete" : "pending"}`}>
      <div><span className="eyebrow">Stage 0 · before Story</span><h2>{project.preStorySetup.completed ? "Reference setup complete" : project.preStorySetup.mode === "REFERENCE_FIRST" ? "Story With Main Character Reference" : "Story Without Main Character Reference"}</h2><p>{project.preStorySetup.mode === "REFERENCE_FIRST" ? "Upload and generate the Main Character identity sheet before story production." : "References are optional, but every uploaded source remains protected and receives priority over generated designs."}</p></div>
      {!project.preStorySetup.completed ? <button className="button primary" onClick={() => void onComplete()}>Complete Reference Setup</button> : <span className="approval-pill approved"><Check size={12} /> READY</span>}
    </section> : null}

    <section className="reference-create-panel">
      <div className="reference-create-heading"><div><span className="eyebrow">Reference Manager</span><h2>Upload references for every production asset</h2><p>Add separate supporting characters or multiple exterior, interior, night, and detail references for one asset.</p></div><strong>{references.length} protected source{references.length === 1 ? "" : "s"}</strong></div>
      <div className="reference-create-fields">
        <label>Asset category<select value={type} onChange={(event) => { const next = event.target.value as ReferenceAssetType; setType(next); setMainCharacter(next === "character" && !project.preStorySetup.mainCharacterReferenceId); }}>{categories.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        <label>Asset name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Rashid, Desert Camp, Hero Vehicle…" /></label>
        <label>Reference label<input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Exterior, Interior, Night, Detail…" /></label>
        {type === "character" ? <label className="check-line"><input type="checkbox" checked={mainCharacter} disabled={Boolean(project.preStorySetup.mainCharacterReferenceId)} onChange={(event) => setMainCharacter(event.target.checked)} /> Use as Main Character identity</label> : null}
      </div>
      <ReferenceImagePicker value={pending} onChange={setPending} title={`Drop ${categories.find((item) => item.value === type)?.label ?? "asset"} reference here`} />
      <div className="reference-create-actions"><small>The original is stored in <code>references/uploads</code> and is never overwritten by generation.</small><button className="button primary" disabled={!pending || !name.trim() || busy} onClick={() => void save()}>{busy ? "Saving…" : <><ImageIcon size={14} /> Upload Reference</>}</button></div>
    </section>

    <div className="reference-manager-grid">
      {references.map((reference) => <ManagedReferenceCard key={reference.id} project={project} reference={reference} onUpdate={onUpdate} onReplace={onReplace} onRemove={onRemove} onGenerateSheet={onGenerateSheet} />)}
      {!references.length ? <div className="reference-empty"><ImageIcon size={28} /><strong>No uploaded references yet</strong><span>Use the large upload area above. Supporting assets remain optional.</span></div> : null}
    </div>
  </div>;
}

function ManagedReferenceCard({
  project,
  reference,
  onUpdate,
  onReplace,
  onRemove,
  onGenerateSheet,
}: {
  project: MovieProject;
  reference: MovieProject["memory"]["database"]["projectReferences"][number];
  onUpdate: (referenceId: string, input: UpdateInput) => Promise<void>;
  onReplace: (referenceId: string, input: Pick<ReferenceUploadInput, "filename" | "mimeType" | "base64">) => Promise<void>;
  onRemove: (referenceId: string) => Promise<void>;
  onGenerateSheet: (referenceId: string, force?: boolean) => Promise<void>;
}) {
  const [replacement, setReplacement] = useState<PendingReferenceImage>();
  const [sequenceIds, setSequenceIds] = useState(reference.sequenceIds);
  const [busy, setBusy] = useState<string>();
  const asset = project.memory.database.assets.find((item) => item.id === reference.assetId || reference.linkedAssetIds.includes(item.id));
  const sheet = asset ? project.memory.database.continuitySheets.find((item) => item.assetId === asset.id) : undefined;
  const lastJob = asset ? [...project.memory.database.imageGenerationJobs].reverse().find((item) => item.targetId === asset.id || sheet?.views.some((view) => view.id === item.targetId)) : undefined;
  const sequences = (project.artifacts.sequences as { sequences?: Array<{ id: string; title: string }> } | undefined)?.sequences ?? [];
  const isMain = project.preStorySetup.mainCharacterReferenceId === reference.id;
  const run = async (name: string, operation: () => Promise<void>) => { setBusy(name); try { await operation(); } finally { setBusy(undefined); } };

  return <article className={`managed-reference-card ${isMain ? "main-character" : ""}`}>
    <div className="managed-reference-source"><img src={api.mediaUrl(project.id, reference.sourcePath)} alt={reference.name} /><span>{isMain ? "MAIN IDENTITY · PRIORITY 1000" : `${reference.type.toUpperCase()} · PRIORITY ${reference.priority}`}</span></div>
    <div className="managed-reference-body">
      <div className="managed-reference-title"><div><small>{reference.label || "Primary Reference"}</small><h3>{reference.name}</h3><code>{reference.id}</code></div>{isMain ? <LockKeyhole size={18} /> : null}</div>
      <p>Original upload · version {reference.versions.at(-1)?.version ?? 1} · {reference.originalFilename}</p>
      <div className="reference-status-row"><span className={`generation-state ${(asset?.approvalState ?? "NOT_GENERATED").toLowerCase()}`}>{asset?.approvalState ?? "NOT GENERATED"}</span><span>{sheet ? `${sheet.views.filter((view) => view.imagePath).length}/${sheet.views.length} views` : "Sheet not generated"}</span></div>
      {asset?.generationError || lastJob?.error ? <div className="generation-error"><strong>Generation failed</strong><p>{asset?.generationError || lastJob?.error}</p><button onClick={() => void run("retry", () => onGenerateSheet(reference.id, true))}>Retry</button></div> : null}
      {asset?.generatedImagePath ? <div className="generated-reference-preview"><img src={api.mediaUrl(project.id, asset.generatedImagePath)} alt={`${asset.name} generated master`} /><div><strong>Generated Master</strong><span>{asset.provider} · {asset.model}</span></div></div> : null}
      {sheet?.views.some((view) => view.imagePath) ? <div className="sheet-preview-strip">{sheet.views.filter((view) => view.imagePath).map((view) => <figure key={view.id}><img src={api.mediaUrl(project.id, view.imagePath!)} alt={view.name} /><figcaption>{view.name}</figcaption></figure>)}</div> : null}
      <div className="managed-reference-actions"><button className="button primary" disabled={Boolean(busy)} onClick={() => void run("generate", () => onGenerateSheet(reference.id, Boolean(asset?.generatedImagePath)))}><WandSparkles size={13} /> {asset?.generatedImagePath ? "Regenerate Asset Sheet" : isMain ? "Create Main Character Sheet" : "Generate Asset Sheet"}</button>{replacement ? <button className="button secondary" disabled={Boolean(busy)} onClick={() => void run("replace", async () => { await onReplace(reference.id, replacement); setReplacement(undefined); })}>Save Replacement</button> : null}<button className="button danger" disabled={Boolean(busy)} onClick={() => { if (window.confirm(`Remove ${reference.name} and its stored source versions from this project?`)) void run("remove", () => onRemove(reference.id)); }}><Trash2 size={13} /> Remove Reference</button></div>
      <ReferenceImagePicker compact value={replacement} onChange={setReplacement} title="Replace Reference" detail="A new version is created; generated sheets are invalidated." />
      {sequences.length ? <details className="sequence-assignment"><summary>Assign to sequences · {sequenceIds.length} selected</summary><div>{sequences.map((sequence) => <label key={sequence.id}><input type="checkbox" checked={sequenceIds.includes(sequence.id)} onChange={(event) => setSequenceIds((current) => event.target.checked ? [...new Set([...current, sequence.id])] : current.filter((id) => id !== sequence.id))} /><span>{sequence.id}</span>{sequence.title}</label>)}</div><button className="button secondary" onClick={() => void run("assign", () => onUpdate(reference.id, { sequenceIds }))}>Save sequence assignments</button></details> : <small className="sequence-waiting">Generate sequences to assign this reference to specific scenes.</small>}
    </div>
  </article>;
}
