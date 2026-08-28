import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Archive, Check, Download, Eye, FileDown, History, Image as ImageIcon, Link2,
  LockKeyhole, Plus, RefreshCw, Save, Search, ShieldCheck, Trash2, Upload, WandSparkles, X,
} from "lucide-react";
import { api } from "../api";
import type {
  ApprovalState, AssetEntity, ChangeImpactReport, MovieProject, ProductionAssetCategory, ProductionAssetRecord,
  ReferenceAssetType, ReferenceUploadInput,
} from "../types";
import { ReferenceImagePicker, type PendingReferenceImage } from "./ReferenceImagePicker";

const categoryLabels: Array<["all" | ProductionAssetCategory, string]> = [
  ["all", "All Assets"], ["movie_dna", "Movie DNA"], ["main_character", "Main Character"], ["character", "Characters"],
  ["character_state", "Character States"], ["creature", "Creatures"], ["animal", "Animals"], ["location", "Locations"],
  ["set", "Sets"], ["building", "Buildings"], ["room", "Rooms"], ["prop", "Props"], ["vehicle", "Vehicles"],
  ["weapon", "Weapons"], ["costume", "Costumes"], ["accessory", "Accessories"], ["makeup", "Makeup"], ["vfx", "VFX"],
  ["environment", "Environment"], ["story_object", "Story Objects"], ["other", "Other"],
];

const addableCategories = categoryLabels.filter(([category]) => !["all", "movie_dna", "character_state"].includes(category));
type HealthFilter = "all" | "generated" | "approved" | "locked" | "review" | "failed" | "missing" | "missing_required";

const categoryLabel = (category: ProductionAssetCategory) => categoryLabels.find(([id]) => id === category)?.[1] ?? category.replaceAll("_", " ");
const statusClass = (status: ApprovalState) => status.toLowerCase().replaceAll("_", "-");
const productionStatusLabel = (record: ProductionAssetRecord, hasImage: boolean) => {
  if (record.status === "GENERATION_FAILED") return "FAILED";
  if (record.status === "GENERATING") return "GENERATING";
  if (record.status === "GENERATED") return "GENERATED";
  if (["REVIEW", "REGENERATE"].includes(record.status)) return "NEEDS REVIEW";
  if (record.status === "APPROVED") return "APPROVED";
  if (record.status === "LOCKED") return "LOCKED";
  if (!hasImage && ["PLANNED", "PROMPT_READY", "DRAFT"].includes(record.status)) return "NOT GENERATED";
  return record.status.replaceAll("_", " ");
};

const referenceTypeFor = (category: ProductionAssetCategory): ReferenceAssetType => {
  if (["main_character", "character", "character_state"].includes(category)) return "character";
  if (category === "set") return "location";
  if (category === "story_object") return "object";
  if (["makeup", "vfx", "environment", "movie_dna"].includes(category)) return "other";
  return category as ReferenceAssetType;
};

const imagePathFor = (project: MovieProject, record: ProductionAssetRecord, entity?: AssetEntity) => {
  return record.thumbnailPath ?? record.imagePath ?? entity?.thumbnailPath ?? entity?.generatedImagePath;
};

const assetHealth = (_project: MovieProject, record: ProductionAssetRecord, entity?: AssetEntity) => {
  const missingOnDisk = /missing on disk/i.test(record.generationError ?? entity?.generationError ?? "");
  const hasImage = !missingOnDisk && Boolean(record.imagePath || entity?.generatedImagePath);
  return {
    all: true,
    hasImage,
    generated: hasImage,
    missing: !hasImage,
    missing_required: Boolean(record.required && !hasImage && record.missingDecision?.action !== "IGNORE"),
    failed: record.status === "GENERATION_FAILED" || Boolean(record.generationError || entity?.generationError),
    review: ["REVIEW", "GENERATED", "REGENERATE"].includes(record.status) || Boolean(record.pendingVersion),
    approved: ["APPROVED", "LOCKED"].includes(record.status),
    locked: record.status === "LOCKED",
  };
};

export interface AddManifestAssetInput {
  name: string;
  category: Exclude<ProductionAssetCategory, "movie_dna" | "character_state">;
  description: string;
  storyPurpose?: string;
  sequenceIds?: string[];
  referenceRole?: string;
  continuityRequirements?: string[];
}

export function AssetLibraryView({
  project, onAssetState, onGenerateAll, onGenerateAsset, onUploadReference, onReplaceReference, onRemoveReference,
  onRebuildManifest, onAddAsset, onUpdateAsset, onMissingDecision, onAcceptReplacement, onRejectReplacement, onDeleteAsset,
}: {
  project: MovieProject;
  onAssetState: (assetId: string, state: ApprovalState) => Promise<void>;
  onGenerateAll: (force: boolean) => Promise<void>;
  onGenerateAsset: (assetId: string, force: boolean, impactMode?: "FUTURE_ONLY" | "APPLY_ALL") => Promise<void>;
  onUploadReference: (input: ReferenceUploadInput) => Promise<void>;
  onReplaceReference: (referenceId: string, input: Pick<ReferenceUploadInput, "filename" | "mimeType" | "base64">) => Promise<void>;
  onRemoveReference: (referenceId: string) => Promise<void>;
  onRebuildManifest: () => Promise<void>;
  onAddAsset: (input: AddManifestAssetInput) => Promise<string | undefined>;
  onUpdateAsset: (assetId: string, input: { description?: string; storyPurpose?: string; sequenceIds?: string[]; referenceRoles?: string[]; generationPrompt?: string }) => Promise<void>;
  onMissingDecision: (assetId: string, action: "GENERATE" | "UPLOAD" | "IGNORE", reason?: string) => Promise<void>;
  onAcceptReplacement: (assetId: string) => Promise<void>;
  onRejectReplacement: (assetId: string) => Promise<void>;
  onDeleteAsset: (assetId: string) => Promise<void>;
}) {
  const records = [...project.production.assets].sort((left, right) => left.number - right.number);
  const entityById = useMemo(() => new Map(project.memory.database.assets.map((asset) => [asset.id, asset])), [project.memory.database.assets]);
  const [category, setCategory] = useState<"all" | ProductionAssetCategory>("all");
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(records[0]?.id);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [lockedImpact, setLockedImpact] = useState<{ recordId: string; report: ChangeImpactReport; expanded: boolean }>();

  useEffect(() => {
    if (!records.some((record) => record.id === selectedId)) setSelectedId(records[0]?.id);
  }, [records, selectedId]);

  const health = (record: ProductionAssetRecord) => assetHealth(project, record, entityById.get(record.id));
  const counts = useMemo(() => ({
    all: records.length,
    generated: records.filter((record) => assetHealth(project, record, entityById.get(record.id)).generated).length,
    approved: records.filter((record) => assetHealth(project, record, entityById.get(record.id)).approved).length,
    locked: records.filter((record) => assetHealth(project, record, entityById.get(record.id)).locked).length,
    review: records.filter((record) => assetHealth(project, record, entityById.get(record.id)).review).length,
    failed: records.filter((record) => assetHealth(project, record, entityById.get(record.id)).failed).length,
    missing: records.filter((record) => assetHealth(project, record, entityById.get(record.id)).missing).length,
    missing_required: records.filter((record) => assetHealth(project, record, entityById.get(record.id)).missing_required).length,
  }), [records, project, entityById]);
  const filtered = records.filter((record) => {
    const itemHealth = health(record);
    const normalized = query.trim().toLowerCase();
    const matchesCategory = category === "all" || record.category === category;
    const matchesHealth = healthFilter === "all" || itemHealth[healthFilter];
    const matchesQuery = !normalized || [record.id, record.filename, record.name, record.description, record.storyPurpose, ...(record.sequenceIds ?? []), ...(record.referenceRoles ?? [])].join(" ").toLowerCase().includes(normalized) || String(record.number).padStart(2, "0").includes(normalized);
    return matchesCategory && matchesHealth && matchesQuery;
  });
  const selected = records.find((record) => record.id === selectedId) ?? filtered[0];
  const firstMissing = records.find((record) => health(record).missing_required);
  const dnaKeys = ["genre", "photography", "filmStock", "colorGrade", "cameraSystem", "lensStyle", "lighting", "historicalPeriod"];
  const run = async (key: string, operation: () => Promise<void>) => {
    setBusy(key);
    try { await operation(); } finally { setBusy(undefined); }
  };
  const requestGeneration = async (record: ProductionAssetRecord, force: boolean) => {
    if (force && record.status === "LOCKED" && !record.pendingVersion?.impactMode) {
      setBusy(`impact-${record.id}`);
      try {
        const report = await api.changeImpact(project.id, "asset", record.id);
        setLockedImpact({ recordId: record.id, report, expanded: false });
      } finally {
        setBusy(undefined);
      }
      return;
    }
    await run(`generate-${record.id}`, () => onGenerateAsset(record.id, force, record.pendingVersion?.impactMode));
  };

  if (!records.length) return <div className="empty-artifact asset-empty-manifest"><Archive size={30} /><h2>Complete Asset Manifest is ready to build</h2><p>The approved Story, Film Bible, Character Analysis, states, uploaded references, and locked Movie DNA will become permanently numbered production assets.</p><button className="button primary" onClick={() => void run("rebuild", onRebuildManifest)}><WandSparkles size={14} /> Build Complete Asset Manifest</button></div>;

  return <div className="asset-v2-shell">
    <aside className="asset-v2-health-rail">
      <div className="asset-v2-rail-title"><span className="eyebrow">Asset health</span><small>CONTINUITY BRAIN ACTIVE</small></div>
      <div className="asset-v2-health-grid">
        {(["all", "generated", "approved", "locked", "review", "failed", "missing", "missing_required"] as HealthFilter[]).map((item) => <button key={item} className={healthFilter === item ? "active" : ""} onClick={() => setHealthFilter(item)}><strong>{String(counts[item]).padStart(item === "all" ? 1 : 2, "0")}</strong><span>{item === "all" ? "Total assets" : item === "review" ? "Needs review" : item === "missing" ? "Missing images" : item === "missing_required" ? "Missing required" : item}</span></button>)}
      </div>
      {firstMissing ? <section className="asset-v2-blocker"><div><span>Missing required asset</span><b>BLOCKING</b></div><strong>{firstMissing.name}</strong><p>{firstMissing.storyPurpose}</p><small>Required by {firstMissing.sequenceIds.length ? firstMissing.sequenceIds.join(", ") : "the approved production memory"}</small><div><button disabled={Boolean(busy)} onClick={() => void run(`missing-${firstMissing.id}`, () => onMissingDecision(firstMissing.id, "GENERATE"))}>Generate</button><button onClick={() => { setSelectedId(firstMissing.id); setAddOpen(false); }}>Upload</button><button onClick={() => setSelectedId(firstMissing.id)}>Review</button><button onClick={() => { const reason = window.prompt("Why may this required asset be ignored?"); if (reason) void run(`ignore-${firstMissing.id}`, () => onMissingDecision(firstMissing.id, "IGNORE", reason)); }}>Ignore</button></div></section> : <section className="asset-v2-healthy"><ShieldCheck size={18} /><strong>No silent blockers</strong><p>Every required image is present or has a visible decision.</p></section>}
      <section className="asset-v2-brain-note"><span>Continuity Brain</span><p>Inspects source versions and dependency files before downstream prompt compilation.</p></section>
    </aside>

    <main className="asset-v2-main">
      <header className="asset-v2-command"><div><span className="eyebrow">Permanent numbering · visual versioning · sequence-ready references</span><h2>Asset Production Control</h2><p>{records.length} source-backed assets · {counts.generated} generated · {counts.missing} missing images · {counts.missing_required} required blockers · {counts.locked} locked</p></div><div className="asset-v2-command-actions"><label><Search size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search image number, name, ID, role…" /></label><button onClick={() => setAddOpen(true)}><Plus size={13} /> Add Asset</button><a href={api.assetExportUrl(project.id, "approved")}><Download size={13} /> Approved</a><a href={api.assetExportUrl(project.id, "locked")}><LockKeyhole size={13} /> Locked</a><a className={selectedIds.size ? "ready" : ""} href={api.assetExportUrl(project.id, "selected", [...selectedIds])}><FileDown size={13} /> Selected · {selectedIds.size}</a><a className="primary" href={api.assetExportUrl(project.id)}><Archive size={13} /> Download All</a></div></header>

      <section className="asset-v2-dna-strip"><div className="asset-v2-strip-head"><span>Locked Movie DNA controlling every generation</span><small>{project.production.movieDna.status === "LOCKED" ? "LOCKED SOURCE" : "DNA MUST BE LOCKED"}</small></div><div>{dnaKeys.map((key) => { const value = project.production.movieDna.selections[key]; return value ? <article key={key}><span>{key.replace(/([A-Z])/g, " $1")}</span><strong>{value.label}</strong><small>{value.locked ? "LOCKED" : "DRAFT"}</small></article> : null; })}</div></section>

      <section className="asset-v2-filter-strip"><div>{categoryLabels.map(([id, label]) => { const count = id === "all" ? records.length : records.filter((record) => record.category === id).length; return <button key={id} className={category === id ? "active" : ""} onClick={() => setCategory(id)}>{label}<span>{count}</span></button>; })}</div><footer><span className="uploaded">Uploaded reference</span><span className="generated">AI generated</span><span className="approved">Approved / locked</span><span className="review">Needs review</span><span className="failed">Generation failed</span><button disabled={Boolean(busy)} onClick={() => void run("rebuild", onRebuildManifest)}><RefreshCw size={11} /> Sync complete manifest</button><button disabled={Boolean(busy)} onClick={() => void run("generate-all", () => onGenerateAll(false))}><WandSparkles size={11} /> Generate missing assets</button></footer></section>

      <div className="asset-v2-workspace">
        <section className="asset-v2-inventory"><div className="asset-v2-inventory-head"><div><span className="eyebrow">Visual inventory / filtered result</span><h3>{category === "all" ? "All Assets" : categoryLabel(category)} · {filtered.length}</h3></div><small>Multi-select preserves exact permanent filenames inside the ZIP package.</small></div><div className="asset-v2-grid">{filtered.map((record) => <AssetCard key={record.id} project={project} record={record} entity={entityById.get(record.id)} active={selected?.id === record.id} selected={selectedIds.has(record.id)} onOpen={() => setSelectedId(record.id)} onSelect={(checked) => setSelectedIds((current) => { const next = new Set(current); checked ? next.add(record.id) : next.delete(record.id); return next; })} onRegenerate={() => void requestGeneration(record, Boolean(imagePathFor(project, record, entityById.get(record.id))))} />)}{!filtered.length ? <div className="asset-v2-no-results"><Search size={24} /><strong>No assets match these filters</strong><p>Clear the search or select All Assets.</p></div> : null}</div></section>
        <aside className="asset-v2-inspector-panel"><div className="asset-v2-inspector-title"><div><span>Asset Inspector</span><small>COMPLETE SOURCE OF TRUTH</small></div>{selected ? <button onClick={() => setSelectedId(undefined)}><X size={13} /> Close</button> : null}</div>{selected ? <AssetInspector project={project} record={selected} entity={entityById.get(selected.id)} busy={busy} run={run} onAssetState={onAssetState} onRequestGeneration={requestGeneration} onUploadReference={onUploadReference} onReplaceReference={onReplaceReference} onRemoveReference={onRemoveReference} onUpdateAsset={onUpdateAsset} onAcceptReplacement={onAcceptReplacement} onRejectReplacement={onRejectReplacement} onDeleteAsset={onDeleteAsset} /> : <div className="asset-v2-inspector-empty"><Eye size={26} /><p>Select an asset to inspect its permanent identity, source versions, generation prompt, dependencies, and sequence usage.</p></div>}</aside>
      </div>
    </main>
    {addOpen ? <AddAssetModal busy={busy} onClose={() => setAddOpen(false)} onAddAsset={onAddAsset} onGenerateAsset={onGenerateAsset} onUploadReference={onUploadReference} run={run} /> : null}
    {lockedImpact ? <LockedAssetImpactModal record={records.find((record) => record.id === lockedImpact.recordId)!} report={lockedImpact.report} expanded={lockedImpact.expanded} busy={busy} onToggle={() => setLockedImpact((current) => current ? { ...current, expanded: !current.expanded } : current)} onCancel={() => setLockedImpact(undefined)} onProceed={(impactMode) => void run(`locked-regeneration-${lockedImpact.recordId}`, async () => { await onGenerateAsset(lockedImpact.recordId, true, impactMode); setLockedImpact(undefined); })} /> : null}
  </div>;
}

function AssetCard({ project, record, entity, active, selected, onOpen, onSelect, onRegenerate }: { project: MovieProject; record: ProductionAssetRecord; entity?: AssetEntity; active: boolean; selected: boolean; onOpen: () => void; onSelect: (checked: boolean) => void; onRegenerate: () => void }) {
  const imagePath = imagePathFor(project, record, entity);
  const sourceLabel = record.sourceType === "UPLOADED_REFERENCE" ? "UPLOADED REFERENCE" : record.imagePath || entity?.generatedImagePath ? "AI GENERATED" : "NOT GENERATED";
  return <article className={`asset-v2-card ${active ? "active" : ""} ${record.status === "GENERATION_FAILED" ? "failed" : ""}`}><div className="asset-v2-card-image"><button onClick={onOpen}>{imagePath ? <img src={api.mediaUrl(project.id, imagePath)} alt={record.name} /> : <span><ImageIcon size={27} />No image file</span>}</button><label><input type="checkbox" checked={selected} onChange={(event) => onSelect(event.target.checked)} /> SELECT</label><b className={sourceLabel === "UPLOADED REFERENCE" ? "uploaded" : sourceLabel === "AI GENERATED" ? "generated" : "missing"}>{sourceLabel}</b></div><section><div><strong>PROJECT IMAGE {String(record.number).padStart(2, "0")}</strong><span className={statusClass(record.status)}>{productionStatusLabel(record, Boolean(imagePath))} · V{String(record.version).padStart(2, "0")}</span></div><h3>{record.name}</h3><code>{record.filename}</code><dl><div><dt>Category</dt><dd>{categoryLabel(record.category)}</dd></div><div><dt>Role</dt><dd>{record.referenceRoles?.join(", ") || "Continuity"}</dd></div><div><dt>Used in sequences</dt><dd>{record.sequenceIds.join(", ") || "Project-wide"}</dd></div></dl><footer><button onClick={onOpen}><Eye size={11} /> View</button>{imagePath ? <a href={api.assetDownloadUrl(project.id, record.id)}><Download size={11} /> Download</a> : null}{record.canGenerate !== false ? <button onClick={onRegenerate}><RefreshCw size={11} /> {imagePath ? "Regenerate" : "Generate"}</button> : null}</footer></section></article>;
}

function AssetInspector({ project, record, entity, busy, run, onAssetState, onRequestGeneration, onUploadReference, onReplaceReference, onRemoveReference, onUpdateAsset, onAcceptReplacement, onRejectReplacement, onDeleteAsset }: {
  project: MovieProject; record: ProductionAssetRecord; entity?: AssetEntity; busy?: string;
  run: (key: string, operation: () => Promise<void>) => Promise<void>;
  onAssetState: (assetId: string, state: ApprovalState) => Promise<void>;
  onRequestGeneration: (record: ProductionAssetRecord, force: boolean) => Promise<void>;
  onUploadReference: (input: ReferenceUploadInput) => Promise<void>;
  onReplaceReference: (referenceId: string, input: Pick<ReferenceUploadInput, "filename" | "mimeType" | "base64">) => Promise<void>;
  onRemoveReference: (referenceId: string) => Promise<void>;
  onUpdateAsset: (assetId: string, input: { description?: string; storyPurpose?: string; sequenceIds?: string[]; referenceRoles?: string[]; generationPrompt?: string }) => Promise<void>;
  onAcceptReplacement: (assetId: string) => Promise<void>;
  onRejectReplacement: (assetId: string) => Promise<void>;
  onDeleteAsset: (assetId: string) => Promise<void>;
}) {
  const [pending, setPending] = useState<PendingReferenceImage>();
  const [label, setLabel] = useState("Additional Reference");
  const [replaceId, setReplaceId] = useState<string>();
  const [replacement, setReplacement] = useState<PendingReferenceImage>();
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [prompt, setPrompt] = useState(record.generationPrompt ?? entity?.generationPrompt ?? "");
  const references = project.memory.database.projectReferences.filter((reference) => record.referenceIds.includes(reference.id) || reference.assetId === record.id || reference.linkedAssetIds.includes(record.id));
  const sheet = project.memory.database.continuitySheets.find((item) => item.assetId === record.id);
  const currentPath = record.imagePath ?? entity?.generatedImagePath;
  const health = assetHealth(project, record, entity);
  useEffect(() => { setPrompt(record.generationPrompt ?? entity?.generationPrompt ?? ""); setEditingPrompt(false); }, [record.id, record.generationPrompt, entity?.generationPrompt]);
  const upload = async () => {
    if (!pending) return;
    await run(`upload-${record.id}`, async () => {
      await onUploadReference({ ...pending, name: record.name, type: referenceTypeFor(record.category), label, assetId: record.id, storyUsage: "PREFERRED" });
      setPending(undefined);
    });
  };

  return <div className="asset-v2-inspector">
    <div className="asset-v2-inspector-hero"><div className="asset-v2-inspector-image">{currentPath ? <img src={api.mediaUrl(project.id, currentPath)} alt={record.name} /> : <span><ImageIcon size={28} /> Image missing</span>}</div><div><div className="asset-v2-number"><strong>PROJECT IMAGE {String(record.number).padStart(2, "0")}</strong><span className={statusClass(record.status)}>{productionStatusLabel(record, Boolean(currentPath))}</span></div><h2>{record.name}</h2><code>{record.filename}</code><dl><dt>Asset ID</dt><dd>{record.id}</dd><dt>Category</dt><dd>{categoryLabel(record.category)}</dd><dt>Version</dt><dd>V{String(record.version).padStart(2, "0")}</dd><dt>Source</dt><dd>{record.sourceType?.replaceAll("_", " ")}</dd><dt>Provider</dt><dd>{record.provider ?? entity?.provider ?? "Not generated"}</dd><dt>Required</dt><dd>{record.required ? "YES" : "OPTIONAL"}</dd></dl></div></div>
    <section className="asset-v2-source-block"><span>Description / story purpose</span><p>{record.description}</p><small>{record.storyPurpose}</small></section>
    <TypeSpecificMetadata project={project} record={record} entity={entity} references={references} />
    <div className="asset-v2-actions">{currentPath ? <a href={api.assetDownloadUrl(project.id, record.id)}><Download size={12} /> Download</a> : null}{record.canGenerate !== false ? <button disabled={Boolean(busy)} onClick={() => void onRequestGeneration(record, Boolean(currentPath))}><WandSparkles size={12} /> {currentPath ? "Regenerate image" : "Generate image"}</button> : null}{health.hasImage && !["APPROVED", "LOCKED"].includes(record.status) ? <button onClick={() => void run(`approve-${record.id}`, () => onAssetState(record.id, "APPROVED"))}><Check size={12} /> Approve</button> : null}{record.status === "APPROVED" ? <button onClick={() => void run(`lock-${record.id}`, () => onAssetState(record.id, "LOCKED"))}><LockKeyhole size={12} /> Lock</button> : null}<button onClick={() => setEditingPrompt((value) => !value)}><Save size={12} /> Edit prompt</button>{record.sourceType === "MANUAL" ? <button className="danger" onClick={() => { if (window.confirm(`Delete manually added asset ${record.name}? Its permanent number will not be reused.`)) void run(`delete-${record.id}`, () => onDeleteAsset(record.id)); }}><Trash2 size={12} /> Delete</button> : null}</div>
    {record.generationError || entity?.generationError ? <section className="asset-v2-generation-error"><AlertTriangle size={15} /><div><strong>Generation failed or file unavailable</strong><p>{record.generationError || entity?.generationError}</p></div>{record.canGenerate !== false ? <button onClick={() => void onRequestGeneration(record, Boolean(currentPath))}>Retry</button> : null}</section> : null}
    <section className="asset-v2-profile"><div><span>{record.category === "character_state" ? "Character state identity" : `${categoryLabel(record.category)} production profile`}</span><small>{record.identityReferenceId ? "IDENTITY SOURCE PROTECTED" : "CANONICAL SOURCE"}</small></div><dl><dt>Story source</dt><dd>Approved Story V{record.sourceStoryVersion}</dd><dt>Film Bible source</dt><dd>Approved Film Bible V{record.sourceFilmBibleVersion}</dd><dt>Movie DNA</dt><dd>Locked V{record.movieDnaVersion}</dd>{record.characterId ? <><dt>Parent character</dt><dd>{record.characterId}</dd></> : null}{record.characterRelationships?.length ? <><dt>Character relationships</dt><dd>{record.characterRelationships.join(" · ")}</dd></> : null}{record.characterStateId ? <><dt>Character-state ID</dt><dd>{record.characterStateId}</dd></> : null}{record.costumeState ? <><dt>Costume state</dt><dd>{record.costumeState}</dd></> : null}<dt>Dependencies</dt><dd>{record.dependencyIds?.join(", ") || "None"}</dd><dt>Reference roles</dt><dd>{record.referenceRoles?.join(", ") || "Continuity"}</dd><dt>Created</dt><dd>{record.createdAt ? new Date(record.createdAt).toLocaleString() : "Migrated record"}</dd><dt>Modified</dt><dd>{record.updatedAt ? new Date(record.updatedAt).toLocaleString() : "Not modified"}</dd></dl></section>
    <section className="asset-v2-prompt-block"><div><span>Generation prompt / project memory</span><small>MOVIE DNA + STORY + FILM BIBLE</small></div>{editingPrompt ? <><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} /><footer><button onClick={() => { setPrompt(record.generationPrompt ?? ""); setEditingPrompt(false); }}>Cancel</button><button className="primary" disabled={!prompt.trim() || Boolean(busy)} onClick={() => void run(`prompt-${record.id}`, async () => { await onUpdateAsset(record.id, { generationPrompt: prompt }); setEditingPrompt(false); })}><Save size={11} /> Save prompt</button></footer></> : <p>{prompt || "Prompt will be compiled from the approved production sources."}</p>}<div>{record.filmBibleSources?.map((source) => <span key={source}>{source.replace(/([A-Z])/g, " $1")}</span>)}</div></section>
    <section className="asset-v2-generation-history"><div><span>Generation attempts</span><History size={13} /></div>{record.generationAttempts?.length ? <div>{record.generationAttempts.slice().reverse().map((attempt) => <article key={attempt.id}><div><strong>V{String(attempt.version).padStart(2, "0")} · {attempt.status.replace("GENERATION_FAILED", "FAILED")}</strong><small>{attempt.provider ?? "provider pending"} · {attempt.model ?? "model pending"}</small></div><p>{attempt.error ?? attempt.prompt}</p><time>{new Date(attempt.completedAt ?? attempt.createdAt).toLocaleString()}</time></article>)}</div> : <p>No generation attempts yet.</p>}</section>
    {record.pendingVersion ? <section className="asset-v2-regeneration"><div><span>Safe regeneration comparison</span><small>ONLY PROJECT IMAGE {String(record.number).padStart(2, "0")}</small></div><div className="asset-v2-compare"><figure><figcaption>CURRENT · V{String(record.version).padStart(2, "0")} · ACTIVE</figcaption>{currentPath ? <img src={api.mediaUrl(project.id, currentPath)} alt="Current active asset" /> : <span>No current image</span>}</figure><figure><figcaption>NEW GENERATION · V{String(record.pendingVersion.version).padStart(2, "0")} · PREVIEW</figcaption><img src={api.mediaUrl(project.id, record.pendingVersion.thumbnailPath ?? record.pendingVersion.imagePath)} alt="Generated replacement preview" /></figure><div><button className="primary" disabled={Boolean(busy)} onClick={() => void run(`accept-${record.id}`, () => onAcceptReplacement(record.id))}>Use new image</button><button disabled={Boolean(busy)} onClick={() => void onRequestGeneration(record, true)}>Regenerate again</button><button disabled={Boolean(busy)} onClick={() => void run(`reject-${record.id}`, () => onRejectReplacement(record.id))}>Keep current image</button></div></div><p>{record.pendingVersion.impactMode === "FUTURE_ONLY" ? "Future-work replacement reviewed. Existing approved outputs remain historical records. " : record.pendingVersion.impactMode === "APPLY_ALL" ? "Apply-replacement impact reviewed. " : ""}Accepting preserves Project Image {String(record.number).padStart(2, "0")}, {record.filename}, {record.id}, sequence assignments, reference roles, approval state, and lock state.</p></section> : null}
    {sheet?.views.some((view) => view.imagePath) ? <section className="asset-v2-sheet"><div><span>Type-specific continuity sheet</span><small>{sheet.views.filter((view) => view.imagePath).length} / {sheet.views.length} VIEWS</small></div><div>{sheet.views.map((view) => <figure key={view.id}>{view.imagePath ? <img src={api.mediaUrl(project.id, view.imagePath)} alt={view.name} /> : <span><ImageIcon size={17} /></span>}<figcaption>{view.name}</figcaption></figure>)}</div></section> : null}
    <section className="asset-v2-version-history"><div><span>Visual version history</span><History size={13} /></div>{record.versionHistory?.length ? <div>{record.versionHistory.map((version) => <article key={`${version.version}-${version.createdAt}`} className={version.version === record.version ? "active" : ""}>{version.thumbnailPath && version.fileRetained ? <img src={api.mediaUrl(project.id, version.thumbnailPath)} alt={`Version ${version.version}`} /> : <span><History size={14} />{version.fileRetained ? "File" : "Metadata"}</span>}<strong>V{String(version.version).padStart(2, "0")}</strong><small>{version.status} · {new Date(version.createdAt).toLocaleString()}</small></article>)}</div> : <p>No prior generated versions. The permanent number is already reserved.</p>}</section>
    <section className="asset-v2-usage"><div><span>Used in sequences</span><Link2 size={13} /></div><p>{record.sequenceIds.length ? record.sequenceIds.join(" · ") : "Project-wide source"}</p>{record.referenceUsage?.length ? <div>{record.referenceUsage.map((usage, index) => <article key={`${usage.sequenceId}-${usage.slot ?? index}`}><strong>{usage.sequenceId}</strong><span>{usage.role}</span><code>{usage.tag ?? (usage.slot ? `UPLOAD POSITION ${usage.slot}` : "REFERENCE REQUIRED")}</code></article>)}</div> : null}</section>
    <section className="asset-v2-reference-list"><div><span>Uploaded references · {references.length}</span><small>ORIGINAL FILES REMAIN SEPARATE</small></div>{references.map((reference) => <article key={reference.id}><img src={api.mediaUrl(project.id, reference.sourcePath)} alt={reference.name} /><div><strong>{reference.label || reference.name}</strong><small>{reference.originalFilename}</small><code>V{reference.versions.at(-1)?.version ?? 1} · {reference.roles.join(", ")}</code></div><button onClick={() => { setReplaceId(reference.id); setReplacement(undefined); }}><RefreshCw size={11} /> Replace</button><button disabled={reference.id === project.preStorySetup.mainCharacterReferenceId} title={reference.id === project.preStorySetup.mainCharacterReferenceId ? "Protected main identity source cannot be removed" : undefined} onClick={() => { if (window.confirm(`Remove ${reference.label || reference.name}?`)) void onRemoveReference(reference.id); }}><Trash2 size={11} /> Remove</button></article>)}{replaceId ? <div className="asset-v2-upload-box"><strong>Replace reference image</strong><ReferenceImagePicker compact value={replacement} onChange={setReplacement} /><footer><button onClick={() => { setReplaceId(undefined); setReplacement(undefined); }}>Cancel</button><button disabled={!replacement || Boolean(busy)} onClick={() => replacement && void run(`replace-${replaceId}`, async () => { await onReplaceReference(replaceId, replacement); setReplaceId(undefined); setReplacement(undefined); })}>Save replacement</button></footer></div> : null}<div className="asset-v2-upload-box"><strong>Upload another reference</strong><label>Reference label<input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Exterior, Interior, Night, Detail…" /></label><ReferenceImagePicker compact value={pending} onChange={setPending} title="Upload Reference" /><button disabled={!pending || Boolean(busy)} onClick={() => void upload()}><Upload size={12} /> Upload reference</button></div></section>
  </div>;
}

function TypeSpecificMetadata({ project, record, entity, references }: {
  project: MovieProject;
  record: ProductionAssetRecord;
  entity?: AssetEntity;
  references: MovieProject["memory"]["database"]["projectReferences"];
}) {
  const character = project.production.characters.find((item) => item.id === record.characterId || item.id === record.id);
  const identity = references.find((reference) => reference.id === record.identityReferenceId || reference.roles.includes("IDENTITY"));
  const traits = identity?.analysis?.visualTraits ?? [];
  const trait = (pattern: RegExp, fallback: string) => traits.find((item) => pattern.test(item)) ?? fallback;
  const protectedValue = identity?.protected ? `Protected by ${identity.originalFilename}` : "No protected uploaded identity is linked";
  const approvedBibleVersion = project.production.filmBible.lockedVersion ?? project.production.filmBible.approvedVersion;
  const bible = project.production.filmBible.history.find((version) => version.version === approvedBibleVersion)?.sections ?? project.production.filmBible.sections;
  const dna = project.production.movieDna.selections;

  if (["main_character", "character", "character_state", "creature"].includes(record.category)) {
    const costumes = [...new Set(character?.states.map((state) => state.wardrobe).filter(Boolean) ?? (record.costumeState ? [record.costumeState] : []))];
    return <section className="asset-v2-type-metadata"><div><span>Character identity metadata</span><small>{identity?.protected ? "IDENTITY LOCK ACTIVE" : "STORY-DEFINED IDENTITY"}</small></div><dl><dt>Face</dt><dd>{trait(/face|facial|eyes|nose|jaw/i, protectedValue)}</dd><dt>Age</dt><dd>{character?.ageRange ?? `Exact apparent age preserved from ${identity?.originalFilename ?? "approved Story"}`}</dd><dt>Body</dt><dd>{trait(/body|build|height|proportion/i, protectedValue)}</dd><dt>Hair</dt><dd>{trait(/hair/i, protectedValue)}</dd><dt>Skin</dt><dd>{trait(/skin|complexion|tone/i, protectedValue)}</dd><dt>Clothing</dt><dd>{record.costumeState ?? costumes[0] ?? protectedValue}</dd><dt>Accessories</dt><dd>{trait(/accessor|jewel|watch|bag|belt/i, protectedValue)}</dd><dt>Head covering</dt><dd>{trait(/head|cover|hat|scarf|ghutra|keffiyeh/i, protectedValue)}</dd><dt>Identity lock</dt><dd>{identity?.protected ? "LOCKED · original upload remains separate" : record.identityReferenceId ? "Linked identity reference" : "Story-defined canonical identity"}</dd><dt>Character states</dt><dd>{character?.states.length ? character.states.map((state) => state.sequenceId).join(", ") : record.characterStateId ?? "Master identity"}</dd><dt>Costume states</dt><dd>{costumes.join(" · ") || "No separate costume change approved"}</dd></dl></section>;
  }

  if (["location", "set", "building", "room", "environment"].includes(record.category)) {
    return <section className="asset-v2-type-metadata"><div><span>Location and environment metadata</span><small>APPROVED PRODUCTION SOURCES</small></div><dl><dt>Exterior</dt><dd>{record.description}</dd><dt>Interior</dt><dd>{["building", "room", "set"].includes(record.category) ? "Generate only where required by the approved Story and sheet plan" : "No separate interior required by the approved manifest"}</dd><dt>Environment</dt><dd>{bible.environmentAndWeather ?? dna.environment?.label ?? "Approved Story environment"}</dd><dt>Time state</dt><dd>Sequence-defined; preserve each linked sequence state</dd><dt>Lighting state</dt><dd>{dna.lighting?.label ?? "Locked Movie DNA lighting"}</dd><dt>Historical requirements</dt><dd>{bible.historicalAndCulturalLaw ?? project.era}</dd><dt>Production design</dt><dd>{dna.productionDesign?.label ?? bible.visualLanguage ?? project.visualStyle}</dd><dt>Continuity</dt><dd>{record.continuityNotes.join(" · ")}</dd></dl></section>;
  }

  if (["prop", "vehicle", "weapon", "story_object", "costume", "accessory"].includes(record.category)) {
    return <section className="asset-v2-type-metadata"><div><span>Physical production metadata</span><small>{categoryLabel(record.category).toUpperCase()} CONTINUITY</small></div><dl><dt>Physical appearance</dt><dd>{record.description}</dd><dt>Material</dt><dd>Use only materials documented by the approved Story, Film Bible, or uploaded reference</dd><dt>Scale</dt><dd>Preserve exact approved scale relative to characters and environments</dd><dt>Condition</dt><dd>{entity?.currentState.condition ?? record.continuityNotes[0] ?? "Canonical established condition"}</dd><dt>Damage state</dt><dd>{record.continuityNotes.find((note) => /damage|wear|broken|torn|dented/i.test(note)) ?? "No unrecorded damage changes"}</dd><dt>Historical requirements</dt><dd>{bible.historicalAndCulturalLaw ?? project.era}</dd><dt>Sequences</dt><dd>{record.sequenceIds.join(", ") || "Project-wide"}</dd><dt>Continuity state</dt><dd>{Object.values(entity?.currentState ?? {}).join(" · ") || "Tracked by the canonical asset record"}</dd></dl></section>;
  }
  return null;
}

function LockedAssetImpactModal({ record, report, expanded, busy, onToggle, onCancel, onProceed }: {
  record: ProductionAssetRecord;
  report: ChangeImpactReport;
  expanded: boolean;
  busy?: string;
  onToggle: () => void;
  onCancel: () => void;
  onProceed: (mode: "FUTURE_ONLY" | "APPLY_ALL") => void;
}) {
  return <div className="asset-v2-modal asset-v2-impact-modal"><div><header><div><span className="eyebrow">Locked asset change impact</span><h2>Review before regenerating Project Image {String(record.number).padStart(2, "0")}</h2></div><button onClick={onCancel}><X size={16} /></button></header><section><div className="asset-v2-impact-summary"><LockKeyhole size={22} /><div><strong>{report.summary}</strong><p>{record.filename} is locked. Its current active file will remain untouched while a reviewed replacement preview is generated.</p><small>{report.items.length} affected items · {report.approvedCount} approved · {report.lockedCount} locked</small></div></div><button className="asset-v2-impact-review" onClick={onToggle}><Eye size={12} /> Review Affected Items</button>{expanded ? <div className="asset-v2-impact-items">{report.items.map((item) => <article key={`${item.kind}-${item.id}`}><div><strong>{item.label}</strong><span>{item.kind.replaceAll("_", " ")} · {item.protection}</span></div><p>{item.reason}</p></article>)}</div> : null}</section><footer><button onClick={onCancel}>Cancel</button><button disabled={Boolean(busy)} onClick={() => onProceed("FUTURE_ONLY")}>Replace for Future Work</button><button className="primary" disabled={Boolean(busy)} onClick={() => onProceed("APPLY_ALL")}>Apply Replacement</button></footer></div></div>;
}

function AddAssetModal({ busy, onClose, onAddAsset, onGenerateAsset, onUploadReference, run }: { busy?: string; onClose: () => void; onAddAsset: (input: AddManifestAssetInput) => Promise<string | undefined>; onGenerateAsset: (assetId: string, force: boolean) => Promise<void>; onUploadReference: (input: ReferenceUploadInput) => Promise<void>; run: (key: string, operation: () => Promise<void>) => Promise<void> }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AddManifestAssetInput["category"]>("prop");
  const [description, setDescription] = useState("");
  const [storyPurpose, setStoryPurpose] = useState("");
  const [sequences, setSequences] = useState("");
  const [referenceRole, setReferenceRole] = useState("CONTINUITY");
  const [continuityRequirements, setContinuityRequirements] = useState("");
  const [method, setMethod] = useState<"UPLOAD" | "GENERATE">("GENERATE");
  const [pending, setPending] = useState<PendingReferenceImage>();
  const save = async () => {
    if (!name.trim() || !description.trim()) return;
    await run("add-asset", async () => {
      const sequenceIds = sequences.split(",").map((item) => item.trim()).filter(Boolean);
      const requirements = continuityRequirements.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
      const assetId = await onAddAsset({ name, category, description, storyPurpose, sequenceIds, referenceRole, continuityRequirements: requirements });
      if (!assetId) return;
      if (method === "UPLOAD" && pending) await onUploadReference({ ...pending, name, type: referenceTypeFor(category), label: "Primary Reference", roles: referenceRole === "IDENTITY" ? ["IDENTITY"] : undefined, storyUsage: "PREFERRED", assetId });
      if (method === "GENERATE") await onGenerateAsset(assetId, false);
      onClose();
    });
  };
  return <div className="asset-v2-modal"><div><header><div><span className="eyebrow">Add production asset</span><h2>Create a permanent numbered asset</h2></div><button onClick={onClose}><X size={16} /></button></header><section className="asset-v2-add-form"><label>Asset type<select value={category} onChange={(event) => setCategory(event.target.value as AddManifestAssetInput["category"])}>{addableCategories.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label>Name asset<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Rashid Knife" /></label><label className="wide">Describe asset<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Physical appearance, condition, scale, historical details…" /></label><label>Assign story purpose<input value={storyPurpose} onChange={(event) => setStoryPurpose(event.target.value)} placeholder="Required during escape preparation" /></label><label>Assign sequences<input value={sequences} onChange={(event) => setSequences(event.target.value)} placeholder="SEQ_04, SEQ_05, SEQ_06" /></label><label className="wide">Continuity requirements<textarea value={continuityRequirements} onChange={(event) => setContinuityRequirements(event.target.value)} placeholder="Exact materials and scale&#10;No unexplained damage changes&#10;Preserve the approved colour" /></label><label>Assign reference role<select value={referenceRole} onChange={(event) => setReferenceRole(event.target.value)}><option>CONTINUITY</option><option>IDENTITY</option><option>CHARACTER_SHEET</option><option>LOCATION</option><option>PROP</option><option>WARDROBE</option><option>CREATURE</option><option>ANIMAL</option><option>VEHICLE</option><option>LIGHTING</option><option>STYLE</option></select></label><fieldset><legend>Creation method</legend><button className={method === "UPLOAD" ? "active" : ""} onClick={() => setMethod("UPLOAD")}><Upload size={12} /> Upload image</button><button className={method === "GENERATE" ? "active" : ""} onClick={() => setMethod("GENERATE")}><WandSparkles size={12} /> Generate with AI</button></fieldset>{method === "UPLOAD" ? <div className="wide"><ReferenceImagePicker compact value={pending} onChange={setPending} title="Choose production reference" /></div> : null}</section><footer><button onClick={onClose}>Cancel</button><button className="primary" disabled={!name.trim() || !description.trim() || method === "UPLOAD" && !pending || Boolean(busy)} onClick={() => void save()}><Plus size={12} /> Add Asset · Assign Next Number</button></footer></div></div>;
}
