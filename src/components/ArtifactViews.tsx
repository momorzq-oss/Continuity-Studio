import { useMemo, useState, type ChangeEvent } from "react";
import {
  Check,
  CircleAlert,
  Download,
  FileJson,
  Film,
  Folder,
  LockKeyhole,
  MapPin,
  Network,
  Package,
  ScanLine,
  WandSparkles,
  UploadCloud,
  Image as ImageIcon,
  RefreshCw,
  Play,
} from "lucide-react";
import { api } from "../api";
import { REFERENCE_ROLES } from "../types";
import { ReferenceManagerView } from "./ReferenceManagerView";
import { AssetLibraryView, type AddManifestAssetInput } from "./AssetLibraryView";
import type {
  ApprovalState,
  AssetEntity,
  AssetManifestArtifact,
  ContinuityArtifact,
  ExportArtifact,
  FilmBibleArtifact,
  FramePlanArtifact,
  MovieProject,
  PromptArtifact,
  SequencesArtifact,
  StoryArtifact,
  RuleDefinition,
  RuleSeverity,
  ReferenceUploadInput,
} from "../types";
import type { ViewId } from "./Sidebar";

const Empty = ({ title, detail }: { title: string; detail: string }) => (
  <div className="empty-artifact"><FileJson size={26} /><h2>{title}</h2><p>{detail}</p><span>Open Production Agent to create this phase.</span></div>
);

export function ArtifactView({
  view,
  project,
  onDownload,
  onRuleOverride,
  onAssetState,
  onCreateAssetVersion,
  onOverrideIssue,
  onUploadReference,
  onCompleteReferenceSetup,
  onUpdateReference,
  onReplaceReference,
  onRemoveReference,
  onGenerateReferenceSheet,
  onGenerateAllAssets,
  onGenerateAsset,
  onRebuildAssetManifest,
  onAddAsset,
  onUpdateManifestAsset,
  onMissingAssetDecision,
  onAcceptAssetReplacement,
  onRejectAssetReplacement,
  onDeleteManualAsset,
  onPlanScenes,
  onGenerateAllScenes,
  onGenerateScene,
  onGenerateStoryboard,
  onCompilePrompts,
  onUpdateModelProfile,
}: {
  view: Exclude<ViewId, "agent" | "settings" | "diagnostics">;
  project: MovieProject;
  onDownload: () => void;
  onRuleOverride: (ruleId: string, input: { enabled?: boolean; severity?: RuleSeverity; reason?: string }) => Promise<void>;
  onAssetState: (assetId: string, state: ApprovalState) => Promise<void>;
  onCreateAssetVersion: (assetId: string) => Promise<void>;
  onOverrideIssue: (issueId: string) => Promise<void>;
  onUploadReference: (input: ReferenceUploadInput) => Promise<void>;
  onCompleteReferenceSetup: () => Promise<void>;
  onUpdateReference: (referenceId: string, input: { roles?: string[]; storyUsage?: string; priority?: number; sequenceIds?: string[]; label?: string; name?: string }) => Promise<void>;
  onReplaceReference: (referenceId: string, input: Pick<ReferenceUploadInput, "filename" | "mimeType" | "base64">) => Promise<void>;
  onRemoveReference: (referenceId: string) => Promise<void>;
  onGenerateReferenceSheet: (referenceId: string, force?: boolean) => Promise<void>;
  onGenerateAllAssets: (force: boolean) => Promise<void>;
  onGenerateAsset: (assetId: string, force: boolean, impactMode?: "FUTURE_ONLY" | "APPLY_ALL") => Promise<void>;
  onRebuildAssetManifest: () => Promise<void>;
  onAddAsset: (input: AddManifestAssetInput) => Promise<string | undefined>;
  onUpdateManifestAsset: (assetId: string, input: { description?: string; storyPurpose?: string; sequenceIds?: string[]; referenceRoles?: string[]; generationPrompt?: string }) => Promise<void>;
  onMissingAssetDecision: (assetId: string, action: "GENERATE" | "UPLOAD" | "IGNORE", reason?: string) => Promise<void>;
  onAcceptAssetReplacement: (assetId: string) => Promise<void>;
  onRejectAssetReplacement: (assetId: string) => Promise<void>;
  onDeleteManualAsset: (assetId: string) => Promise<void>;
  onPlanScenes: () => Promise<void>;
  onGenerateAllScenes: (force: boolean) => Promise<void>;
  onGenerateScene: (sceneId: string, force: boolean) => Promise<void>;
  onGenerateStoryboard: (force: boolean) => Promise<void>;
  onCompilePrompts: (profileIds?: string[]) => Promise<void>;
  onUpdateModelProfile: (profileId: string, input: { enabled?: boolean; model?: string; maxDurationSeconds?: number; maxImageReferences?: number; supportsStartFrame?: boolean; supportsEndFrame?: boolean; tagTemplate?: string }) => Promise<void>;
}) {
  if (view === "overview") return <Overview project={project} />;
  if (view === "reference_setup") return <ReferenceManagerView project={project} setup onUpload={onUploadReference} onComplete={onCompleteReferenceSetup} onUpdate={onUpdateReference} onReplace={onReplaceReference} onRemove={onRemoveReference} onGenerateSheet={onGenerateReferenceSheet} />;
  if (view === "references") return <ReferenceManagerView project={project} onUpload={onUploadReference} onComplete={onCompleteReferenceSetup} onUpdate={onUpdateReference} onReplace={onReplaceReference} onRemove={onRemoveReference} onGenerateSheet={onGenerateReferenceSheet} />;
  if (view === "story") return <StoryBible project={project} />;
  if (view === "film_bible") return <FilmBible project={project} />;
  if (view === "assets") return <AssetLibraryView project={project} onAssetState={onAssetState} onGenerateAll={onGenerateAllAssets} onGenerateAsset={onGenerateAsset} onUploadReference={onUploadReference} onReplaceReference={onReplaceReference} onRemoveReference={onRemoveReference} onRebuildManifest={onRebuildAssetManifest} onAddAsset={onAddAsset} onUpdateAsset={onUpdateManifestAsset} onMissingDecision={onMissingAssetDecision} onAcceptReplacement={onAcceptAssetReplacement} onRejectReplacement={onRejectAssetReplacement} onDeleteAsset={onDeleteManualAsset} />;
  if (view === "characters") return <AssetCategory project={project} title="Characters" assets={project.memory.database.characters} />;
  if (view === "creatures") return <AssetCategory project={project} title="Creatures & animals" assets={[...project.memory.database.creatures, ...project.memory.database.animals]} />;
  if (view === "locations") return <AssetCategory project={project} title="Locations" assets={project.memory.database.locations} />;
  if (view === "props") return <AssetCategory project={project} title="Props & wardrobe" assets={[...project.memory.database.props, ...project.memory.database.wardrobes]} />;
  if (view === "sequences") return <Sequences project={project} />;
  if (view === "frames") return <Frames project={project} />;
  if (view === "scenes") return <Scenes project={project} onPlan={onPlanScenes} onGenerateAll={onGenerateAllScenes} onGenerate={onGenerateScene} />;
  if (view === "storyboard") return <Storyboard project={project} onGenerate={onGenerateStoryboard} />;
  if (view === "prompts") return <Prompts project={project} onCompile={onCompilePrompts} onUpdateProfile={onUpdateModelProfile} />;
  if (view === "continuity") return <Continuity project={project} />;
  if (view === "rules") return <Rules project={project} onRuleOverride={onRuleOverride} />;
  if (view === "generations") return <Generations project={project} />;
  if (view === "review") return <Review project={project} onOverrideIssue={onOverrideIssue} />;
  return <Export project={project} onDownload={onDownload} />;
}

function ReferenceWorkspace({
  project,
  setup = false,
  onUpload,
  onComplete,
  onUpdate,
}: {
  project: MovieProject;
  setup?: boolean;
  onUpload: (input: { filename: string; mimeType: "image/png" | "image/jpeg" | "image/webp"; base64: string; name: string; type: string; roles?: string[]; storyUsage?: string; mainCharacter?: boolean }) => Promise<void>;
  onComplete: () => Promise<void>;
  onUpdate: (referenceId: string, input: { roles?: string[]; storyUsage?: string; priority?: number }) => Promise<void>;
}) {
  const [type, setType] = useState("character");
  const [name, setName] = useState("Main character reference");
  const [mainCharacter, setMainCharacter] = useState(true);
  const references = project.memory.database.projectReferences;
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) return;
    const reader = new FileReader();
    reader.onload = () => void onUpload({
      filename: file.name,
      mimeType: file.type as "image/png" | "image/jpeg" | "image/webp",
      base64: String(reader.result),
      name: name.trim() || file.name,
      type,
      mainCharacter: mainCharacter && type === "character",
      storyUsage: mainCharacter && type === "character" ? "REQUIRED" : "PREFERRED",
    });
    reader.readAsDataURL(file);
    event.target.value = "";
  };
  return (
    <div className="artifact-page reference-workspace">
      {setup ? <section className={`setup-gate ${project.preStorySetup.completed ? "complete" : "pending"}`}>
        <div><span className="eyebrow">Stage 0 · before Story</span><h2>{project.preStorySetup.completed ? "Reference setup complete" : "Prepare Story inputs"}</h2><p>{project.preStorySetup.mode.replace("_", " ")} mode · uploaded sources are protected and take priority over generated designs.</p></div>
        {!project.preStorySetup.completed ? <button className="button primary" onClick={() => void onComplete()}>Complete setup</button> : <span className="approval-pill approved">READY</span>}
      </section> : null}
      <section className="reference-upload-panel">
        <div><UploadCloud size={23} /><span className="eyebrow">Protected source upload</span><h2>Add visual reference</h2><p>PNG, JPEG, or WebP. The original file is copied into this project and is never overwritten.</p></div>
        <div className="reference-upload-form">
          <label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Category<select value={type} onChange={(event) => { setType(event.target.value); setMainCharacter(event.target.value === "character"); }}><option value="character">Character</option><option value="creature">Creature</option><option value="animal">Animal</option><option value="location">Location</option><option value="prop">Prop</option><option value="wardrobe">Wardrobe</option><option value="style">Style</option><option value="composition">Composition</option><option value="lighting">Lighting</option></select></label>
          <label className="check-line"><input type="checkbox" checked={mainCharacter && type === "character"} disabled={type !== "character" || Boolean(project.preStorySetup.mainCharacterReferenceId)} onChange={(event) => setMainCharacter(event.target.checked)} /> Main character source</label>
          <label className="button primary upload-button"><ImageIcon size={14} /> Choose image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} /></label>
        </div>
      </section>
      <div className="reference-grid">
        {references.map((reference) => <ReferenceCard key={reference.id} project={project} reference={reference} onUpdate={onUpdate} />)}
        {!references.length ? <div className="reference-empty"><ImageIcon size={22} /><strong>No uploaded references</strong><span>{project.preStorySetup.mode === "AI_FIRST" ? "AI-first can continue without uploads." : "Upload at least one source before completing setup."}</span></div> : null}
      </div>
    </div>
  );
}

function ReferenceCard({ project, reference, onUpdate }: { project: MovieProject; reference: MovieProject["memory"]["database"]["projectReferences"][number]; onUpdate: (referenceId: string, input: { roles?: string[]; storyUsage?: string; priority?: number }) => Promise<void> }) {
  const [roles, setRoles] = useState<string[]>(reference.roles);
  const [usage, setUsage] = useState(reference.storyUsage);
  const toggle = (role: string) => setRoles((current) => current.includes(role) ? (current.length > 1 ? current.filter((item) => item !== role) : current) : [...current, role]);
  return <article className="reference-card">
    <img src={api.mediaUrl(project.id, reference.sourcePath)} alt={reference.name} />
    <div><span className="asset-type">{reference.type} · {reference.storyUsage}</span><h3>{reference.name}</h3><code>{reference.id}</code><div className="role-picker">{REFERENCE_ROLES.map((role) => <button type="button" className={roles.includes(role) ? "selected" : ""} onClick={() => toggle(role)} key={role}>{role}</button>)}</div><label className="reference-usage">Story usage<select value={usage} disabled={reference.id === project.preStorySetup.mainCharacterReferenceId} onChange={(event) => setUsage(event.target.value as typeof usage)}><option>REQUIRED</option><option>PREFERRED</option><option>VISUAL_REFERENCE_ONLY</option><option>OPTIONAL</option></select></label><button className="save-reference" onClick={() => void onUpdate(reference.id, { roles, storyUsage: usage })}>Save assignments</button><small>Priority {reference.priority} · {reference.protected ? "PROTECTED SOURCE" : reference.source}</small>{reference.linkedAssetIds.map((id) => <em key={id}>Linked → {id}</em>)}</div>
  </article>;
}

function Overview({ project }: { project: MovieProject }) {
  const sequences = project.production.sequences;
  const total = sequences.length;
  const approved = sequences.filter((sequence) => ["APPROVED", "LOCKED"].includes(sequence.status)).length;
  const ready = sequences.filter((sequence) => sequence.status === "READY").length;
  const rejected = sequences.filter((sequence) => sequence.status === "REJECTED").length;
  const promptRecords = Object.values(project.production.promptWorkspace.records);
  const blocked = promptRecords.filter((record) => record.state.validation.status === "BLOCKED").length;
  const waiting = sequences.filter((sequence) => ["READY", "GENERATED"].includes(sequence.status)).length;
  const progress = total > 0 ? Math.round((approved / total) * 100) : 0;
  const missingAssets = project.production.assets.filter((asset) => asset.required && !asset.imagePath && asset.missingDecision?.action !== "IGNORE");
  const continuityWarnings = project.memory.productionMemory.continuity.warnings.filter((warning) => warning.status === "OPEN");
  const promptWarnings = promptRecords.flatMap((record) => record.state.validation.issues.filter((issue) => issue.level !== "VALID"));
  const stages = [
    { label: "Story", detail: `Story v${project.production.story.version} ${project.production.story.status.toLowerCase()}.`, done: ["APPROVED", "LOCKED"].includes(project.production.story.status) },
    { label: "Film Bible", detail: `Film Bible v${project.production.filmBible.version} ${project.production.filmBible.status.toLowerCase()}.`, done: ["APPROVED", "LOCKED"].includes(project.production.filmBible.status) },
    { label: "Assets", detail: `${project.production.assets.length} numbered production assets · ${missingAssets.length} missing.`, done: project.production.assets.length > 0 && missingAssets.length === 0 },
    { label: "Sequences", detail: `${total} timed sequence plans with ${sequences.reduce((sum, sequence) => sum + sequence.shots.length, 0)} shots.`, done: total > 0 && sequences.every((sequence) => sequence.shots.length > 0) },
    { label: "Prompt Pipeline", detail: `${promptRecords.length} platform prompt record${promptRecords.length === 1 ? "" : "s"} · ${blocked} blocked.`, done: promptRecords.some((record) => record.state.validation.status === "VALID") },
    { label: "Generated Video", detail: `${sequences.filter((sequence) => Boolean(sequence.videoPath)).length}/${total} sequence videos imported.`, done: total > 0 && sequences.every((sequence) => Boolean(sequence.videoPath)) },
    { label: "Continuity", detail: `${project.production.continuityLedger.length} permanent ledger entries · ${continuityWarnings.length} open warnings.`, done: total > 0 && approved === total && continuityWarnings.length === 0 },
    { label: "Final Export", detail: approved === total && total > 0 ? "Complete production package is ready to export." : "Complete and approve every sequence before final export.", done: total > 0 && approved === total },
  ];
  return (
    <div className="artifact-page">
      <div className="overview-hero">
        <div><span className="eyebrow">Production overview</span><h2>{project.title}</h2><p>{project.idea}</p></div>
        <div className="overview-score"><strong>{progress}%</strong><span>movie complete</span></div>
      </div>
      <div className="overview-metrics">
        <article><strong>{total}</strong><span>Total sequences</span></article>
        <article><strong>{approved}</strong><span>Approved</span></article>
        <article><strong>{ready}</strong><span>Ready</span></article>
        <article><strong>{blocked}</strong><span>Blocked prompts</span></article>
        <article><strong>{rejected}</strong><span>Rejected</span></article>
        <article><strong>{waiting}</strong><span>Waiting generation</span></article>
      </div>
      <div className="overview-alerts">
        <article><span>Missing assets</span><strong>{missingAssets.length}</strong></article>
        <article><span>Continuity warnings</span><strong>{continuityWarnings.length}</strong></article>
        <article><span>Prompt warnings</span><strong>{promptWarnings.length}</strong></article>
      </div>
      <div className="overview-grid">
        {stages.map((stage, index) => (
          <article key={stage.label} className={`overview-phase ${stage.done ? "completed" : "pending"}`}>
            <span className="phase-number">{String(index + 1).padStart(2, "0")}</span>
            <div><div className="eyebrow">{stage.done ? "complete" : "pending"}</div><h3>{stage.label}</h3><p>{stage.detail}</p></div>
            {stage.done ? <Check size={16} /> : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function StoryBible({ project }: { project: MovieProject }) {
  const story = project.artifacts.story as StoryArtifact | undefined;
  const bible = project.artifacts.film_bible as FilmBibleArtifact | undefined;
  if (!story) return <Empty title="Story not generated" detail="Run the Story phase to create the logline, synopsis, acts, characters, locations, and dialogue." />;
  return (
    <div className="artifact-page two-column-artifact">
      <section className="document-panel">
        <span className="eyebrow">Story package</span><h2>{project.title}</h2>
        <h4>Logline</h4><p className="lead-copy">{story.logline}</p>
        <h4>Synopsis</h4><p>{story.synopsis}</p>
        <h4>Story</h4><div className="preserve-lines">{story.fullStory}</div>
        <h4>Dialogue excerpt</h4><pre>{story.dialogueExcerpt}</pre>
      </section>
      <aside className="document-rail">
        <section><div className="eyebrow">Characters</div>{story.characters.map((character) => <div className="mini-record" key={character.id}><strong>{character.name}</strong><span>{character.id}</span><p>{character.description}</p></div>)}</section>
        {bible ? <section><div className="eyebrow">Movie rules</div>{bible.movieRules.map((rule, index) => <div className="rule-row" key={rule}><span>{String(index + 1).padStart(2, "0")}</span><p>{rule}</p></div>)}</section> : <section><p>Film Bible is waiting for its production phase.</p></section>}
      </aside>
    </div>
  );
}

function FilmBible({ project }: { project: MovieProject }) {
  const bible = project.artifacts.film_bible as FilmBibleArtifact | undefined;
  const entity = project.memory.database.filmBible;
  if (!bible) return <Empty title="Film Bible not generated" detail="Run the Film Bible phase to lock world law, visual language, characters, locations, and production restrictions." />;
  return (
    <div className="artifact-page two-column-artifact">
      <section className="document-panel">
        <span className="eyebrow">{entity?.approvalState ?? "DRAFT"} · VERSION {entity?.version ?? 1}</span>
        <h2>{bible.title}</h2>
        <h4>Tone</h4><p className="lead-copy">{bible.tone}</p>
        <h4>Visual language</h4><p>{bible.visualLanguage}</p>
        <h4>World rules</h4>{bible.worldRules.map((rule) => <div className="rule-row" key={rule}><Check size={13} /><p>{rule}</p></div>)}
        <h4>Character continuity</h4>{bible.characterContinuity.map((rule) => <div className="rule-row" key={rule}><Check size={13} /><p>{rule}</p></div>)}
        <h4>Location continuity</h4>{bible.locationContinuity.map((rule) => <div className="rule-row" key={rule}><Check size={13} /><p>{rule}</p></div>)}
      </section>
      <aside className="document-rail"><section><div className="eyebrow">Project law</div>{bible.movieRules.map((rule, index) => <div className="rule-row" key={rule}><span>{String(index + 1).padStart(2, "0")}</span><p>{rule}</p></div>)}</section></aside>
    </div>
  );
}

function AssetCategory({ project, title, assets }: { project: MovieProject; title: string; assets: AssetEntity[] }) {
  if (!project.artifacts.assets) return <Empty title={`${title} not extracted`} detail="Run the Asset Agent to turn the story into a permanent asset manifest." />;
  return (
    <div className="artifact-page">
      <div className="section-heading"><div><span className="eyebrow">Permanent registry</span><h2>{title}</h2></div><span className="mono-muted">{assets.length} records</span></div>
      {assets.length ? <div className="entity-table">{assets.map((asset) => <article key={asset.id}><div className="entity-heading"><div><strong>{asset.name}</strong><code>{asset.id}</code></div><span className={`approval-pill ${asset.approvalState.toLowerCase()}`}>{asset.approvalState}</span></div><p>{asset.description}</p><div className="trait-grid">{Object.entries(asset.lockedTraits).map(([name, value]) => <div key={name}><span>{name}</span><strong>{value}</strong></div>)}</div><div className="reference-list">{asset.referenceImages.map((reference) => <code key={reference}>{reference}</code>)}</div></article>)}</div> : <Empty title={`No ${title.toLowerCase()} registered`} detail="The current story did not require an entity in this category." />}
    </div>
  );
}

function Assets({ project, onAssetState, onCreateAssetVersion, onGenerateAll, onGenerateAsset }: { project: MovieProject; onAssetState: (assetId: string, state: ApprovalState) => Promise<void>; onCreateAssetVersion: (assetId: string) => Promise<void>; onGenerateAll: (force: boolean) => Promise<void>; onGenerateAsset: (assetId: string, force: boolean, impactMode?: "FUTURE_ONLY" | "APPLY_ALL") => Promise<void> }) {
  const manifest = project.artifacts.assets as AssetManifestArtifact | undefined;
  if (!manifest) return <Empty title="Asset manifest not generated" detail="The Asset Agent will inspect the story and create permanent IDs for every required production asset." />;
  const database = project.memory.database;
  return (
    <div className="artifact-page">
      <div className="asset-command-bar"><div><span className="eyebrow">Visual asset queue</span><h2>Generated references & continuity sheets</h2><p>{database.imageGenerationJobs.length} image jobs · built-in provider · zero paid credits</p></div><button className="button primary" onClick={() => void onGenerateAll(false)}><WandSparkles size={14} /> Generate all assets</button></div>
      <div className="asset-summary">{Object.entries(manifest.counts).map(([type, count]) => <div key={type}><strong>{count}</strong><span>{type}</span></div>)}<div><strong>{database.continuitySheets.length}</strong><span>sheets</span></div></div>
      <div className="asset-grid">
        {manifest.assets.map((asset) => {
          const record = database.assets.find((item) => item.id === asset.id);
          const imagePath = record?.thumbnailPath || record?.generatedImagePath;
          const sheet = database.continuitySheets.find((item) => item.assetId === asset.id);
          return <article className="asset-card" key={asset.id}>
            <div className={`asset-visual ${imagePath ? "has-image" : "empty"}`}>{imagePath ? <img src={api.mediaUrl(project.id, imagePath)} alt={`${asset.name} generated reference`} /> : <><ImageIcon size={22} /><span>IMAGE NOT GENERATED</span></>}</div>
            <div className="asset-card-body"><div className="asset-type">{asset.type}</div><h3>{asset.name}</h3><code>{asset.id}</code><p>{asset.description}</p><div className="lock-state"><LockKeyhole size={12} /> {record?.approvalState ?? asset.approvalState ?? "PLANNED"} · V{record?.version ?? asset.version ?? 1}</div><small>{sheet ? `${sheet.views.filter((view) => view.imagePath).length}/${sheet.views.length} sheet views` : "Sheet not generated"}</small><div className="asset-actions">{imagePath ? <button onClick={() => void onGenerateAsset(asset.id, true)}><RefreshCw size={11} /> Regenerate version</button> : <button onClick={() => void onGenerateAsset(asset.id, false)}><Play size={11} /> Generate image</button>}{record?.approvalState === "REVIEW" ? <><button onClick={() => void onAssetState(asset.id, "APPROVED")}>Approve</button><button onClick={() => void onAssetState(asset.id, "LOCKED")}>Lock</button></> : null}{record?.approvalState === "LOCKED" ? <button onClick={() => void onCreateAssetVersion(asset.id)}>New version</button> : null}</div></div>
          </article>;
        })}
      </div>
      <section className="relationship-panel"><div className="section-heading"><div><span className="eyebrow">Asset relationship graph</span><h2>Production links</h2></div><Network size={18} /></div><div className="relationship-graph">{project.memory.database.relationships.map((relationship) => <div key={relationship.id}><code>{relationship.fromAssetId}</code><span>{relationship.relation.replace("_", " ")} →</span><code>{relationship.toId}</code></div>)}</div></section>
    </div>
  );
}

function Sequences({ project }: { project: MovieProject }) {
  const artifact = project.artifacts.sequences as SequencesArtifact | undefined;
  const frames = project.artifacts.frame_plans as FramePlanArtifact | undefined;
  const prompts = project.artifacts.prompts as PromptArtifact | undefined;
  const [selectedId, setSelectedId] = useState<string | undefined>(artifact?.sequences[0]?.id);
  const selected = useMemo(() => artifact?.sequences.find((item) => item.id === selectedId) ?? artifact?.sequences[0], [artifact, selectedId]);
  const plan = frames?.plans.find((item) => item.sequenceId === selected?.id);
  const prompt = prompts?.prompts.find((item) => item.sequenceId === selected?.id);
  if (!artifact) return <Empty title="Sequences not generated" detail="Run the Sequence Agent to turn the runtime into timed dramatic units." />;
  return (
    <div className="artifact-page sequence-workspace">
      <aside className="sequence-list"><div className="section-heading"><div><span className="eyebrow">Timeline</span><h2>Sequences</h2></div><span>{artifact.sequences.length}</span></div>{artifact.sequences.map((sequence) => <button key={sequence.id} className={selected?.id === sequence.id ? "selected" : ""} onClick={() => setSelectedId(sequence.id)}><strong>{String(sequence.number).padStart(2, "0")}</strong><div><span>{sequence.title}</span><small>{sequence.locationId} · {sequence.durationSeconds} SEC</small></div></button>)}</aside>
      <section className="sequence-detail">
        {selected ? <><div className="sequence-detail-header"><div><span className="eyebrow">{selected.id}</span><h2>{selected.title}</h2><p>{selected.synopsis}</p></div><span className="sequence-status">{selected.status}</span></div><div className="reference-strip"><span><MapPin size={12} />{selected.locationId}</span>{selected.assetIds.map((asset) => <span key={asset}><LockKeyhole size={12} />{asset}</span>)}</div>{plan ? <div className="frame-board">{plan.states.map((state) => <article key={state.state}><div className={`frame-visual ${state.state}`}><Film size={19} /></div><div className="frame-copy"><div><strong>{state.state}</strong><span>{state.timeRange}</span></div><p>{state.visual}</p><dl><dt>CAM</dt><dd>{state.camera}</dd><dt>LIGHT</dt><dd>{state.lighting}</dd><dt>SOUND</dt><dd>{state.sound}</dd></dl></div></article>)}</div> : <Empty title="Frame plans waiting" detail="The next phase will create beginning, middle, and end states." />}{prompt ? <div className="prompt-panel"><span className="eyebrow">Provider-ready prompt</span><p>{prompt.prompt}</p><div>{prompt.references.map((reference) => <code key={reference}>{reference}</code>)}</div></div> : null}</> : null}
      </section>
    </div>
  );
}

function Frames({ project }: { project: MovieProject }) {
  const frames = project.memory.database.frames;
  if (!frames.length) return <Empty title="Frame plans not generated" detail="Run Frame Planning to create START, MID, and END anchors with inherited continuity state." />;
  const grouped = frames.reduce<Record<string, typeof frames>>((result, frame) => {
    result[frame.sequenceId] = [...(result[frame.sequenceId] ?? []), frame];
    return result;
  }, {});
  return (
    <div className="artifact-page frame-registry">
      {Object.entries(grouped).map(([sequenceId, sequenceFrames]) => <section key={sequenceId}><div className="section-heading"><div><span className="eyebrow">Continuity anchors</span><h2>{sequenceId}</h2></div><span className="approval-pill approved">{sequenceFrames.every((frame) => frame.approvalState === "APPROVED") ? "APPROVED" : "REVIEW"}</span></div><div className="frame-board">{sequenceFrames.map((frame) => <article key={frame.id}><div className={`frame-visual ${frame.anchor.toLowerCase()}`}><Film size={19} /></div><div className="frame-copy"><div><strong>{frame.anchor}</strong><span>{frame.lens}</span></div><p>{frame.action}</p><dl><dt>POS</dt><dd>{frame.position}</dd><dt>CAM</dt><dd>{frame.camera}</dd><dt>LIGHT</dt><dd>{frame.lighting}</dd><dt>STATE</dt><dd>{frame.continuityStateId}</dd></dl><div className="reference-list">{frame.referenceImages.map((reference) => <code key={reference}>{reference}</code>)}</div></div></article>)}</div></section>)}
    </div>
  );
}

function Scenes({ project, onPlan, onGenerateAll, onGenerate }: { project: MovieProject; onPlan: () => Promise<void>; onGenerateAll: (force: boolean) => Promise<void>; onGenerate: (sceneId: string, force: boolean) => Promise<void> }) {
  const scenes = project.memory.database.sceneAssets;
  const dependencies = project.memory.database.assetDependencies;
  if (!scenes.length) return <div className="empty-artifact"><ClapperboardIcon /><h2>Scene assets not planned</h2><p>Generate sequences, then plan one dependency-aware scene asset for each sequence.</p><button className="button primary" onClick={() => void onPlan()}>Plan scene assets</button></div>;
  return <div className="artifact-page scene-page">
    <div className="asset-command-bar"><div><span className="eyebrow">First-class scene assets</span><h2>Master + START / MID / END</h2><p>Scenes generate only when every required visual dependency has a real image.</p></div><button className="button primary" onClick={() => void onGenerateAll(false)}><WandSparkles size={14} /> Generate all scenes</button></div>
    <div className="scene-grid">{scenes.map((scene) => {
      const missing = dependencies.filter((item) => item.fromId === scene.id && item.required && !item.satisfied);
      return <article key={scene.id}><div className="scene-image">{scene.masterImagePath ? <img src={api.mediaUrl(project.id, scene.masterImagePath)} alt={scene.name} /> : <ImageIcon size={24} />}</div><div className="scene-copy"><span className="asset-type">{scene.sequenceId} · V{scene.version}</span><h3>{scene.name}</h3><code>{scene.id}</code><div className="scene-anchors">{[["START", scene.startImagePath], ["MID", scene.midImagePath], ["END", scene.endImagePath]].map(([label, image]) => <span className={image ? "ready" : ""} key={label}>{label}</span>)}</div><p>{missing.length ? `Blocked: ${missing.map((item) => item.toId).join(", ")}` : `${scene.dependencyIds.length} dependencies ready`}</p><button disabled={Boolean(missing.length)} onClick={() => void onGenerate(scene.id, Boolean(scene.masterImagePath))}>{scene.masterImagePath ? "Regenerate scene version" : "Generate scene"}</button></div></article>;
    })}</div>
  </div>;
}

const ClapperboardIcon = () => <Film size={26} />;

function Storyboard({ project, onGenerate }: { project: MovieProject; onGenerate: (force: boolean) => Promise<void> }) {
  const frames = project.memory.database.storyboardFrames;
  if (!frames.length) return <Empty title="Storyboard not planned" detail="Plan and generate scene assets first; storyboard frames remain separate derivative records." />;
  return <div className="artifact-page storyboard-page"><div className="asset-command-bar"><div><span className="eyebrow">Storyboard derivatives</span><h2>Shot-facing continuity frames</h2><p>These images do not replace the scene master or continuity anchors.</p></div><button className="button primary" onClick={() => void onGenerate(false)}><WandSparkles size={14} /> Generate storyboard</button></div><div className="storyboard-grid">{frames.map((frame) => <article key={frame.id}>{frame.imagePath ? <img src={api.mediaUrl(project.id, frame.imagePath)} alt={frame.id} /> : <div><ImageIcon size={20} /></div>}<footer><strong>{frame.sequenceId} · {frame.anchor}</strong><code>{frame.id}</code><span>{frame.status}</span></footer></article>)}</div></div>;
}

function Prompts({ project, onCompile, onUpdateProfile }: { project: MovieProject; onCompile: (profileIds?: string[]) => Promise<void>; onUpdateProfile: (profileId: string, input: { enabled?: boolean; model?: string; maxDurationSeconds?: number; maxImageReferences?: number; supportsStartFrame?: boolean; supportsEndFrame?: boolean; tagTemplate?: string }) => Promise<void> }) {
  const prompts = project.memory.database.generationPrompts;
  const [selectedId, setSelectedId] = useState(prompts[0]?.id);
  const selected = prompts.find((prompt) => prompt.id === selectedId) ?? prompts[0];
  const profile = project.memory.database.modelProfiles.find((item) => item.id === selected?.model);
  if (!prompts.length) return <div className="empty-artifact"><FileJson size={26} /><h2>Prompts not compiled</h2><p>Compile Seedance, MiniMax, Higgsfield, and Generic previews from the canonical prompt and real reference mappings.</p><button className="button primary" onClick={() => void onCompile()}>Compile platform prompts</button></div>;
  return (
    <div className="artifact-page prompt-workspace">
      <aside>{prompts.map((prompt) => <button className={selected?.id === prompt.id ? "selected" : ""} key={prompt.id} onClick={() => setSelectedId(prompt.id)}><strong>{prompt.sequenceId}</strong><span>{prompt.model}</span><small>{prompt.approvalState}</small></button>)}</aside>
      <section>{selected ? <><div className="section-heading"><div><span className="eyebrow">Canonical → provider compiler</span><h2>{selected.sequenceId} · {selected.model}</h2></div><div><button className="button secondary" onClick={() => void onCompile()}>Recompile all</button><span className={`approval-pill ${selected.approvalState.toLowerCase()}`}>{selected.approvalState}</span></div></div>{profile ? <div className="model-profile-editor" key={`${profile.id}-${profile.updatedAt}`}><label>Model<input defaultValue={profile.model} onBlur={(event) => event.target.value.trim() && void onUpdateProfile(profile.id, { model: event.target.value.trim() })} /></label><label>Max seconds<input type="number" min="1" placeholder="unset" defaultValue={profile.maxDurationSeconds ?? ""} onBlur={(event) => event.target.value && void onUpdateProfile(profile.id, { maxDurationSeconds: Number(event.target.value) })} /></label><label>Max image refs<input type="number" min="1" placeholder="unset" defaultValue={profile.maxImageReferences ?? ""} onBlur={(event) => event.target.value && void onUpdateProfile(profile.id, { maxImageReferences: Number(event.target.value) })} /></label><label>Tag template<input defaultValue={profile.tagTemplate} onBlur={(event) => event.target.value.trim() && void onUpdateProfile(profile.id, { tagTemplate: event.target.value.trim() })} /></label><label className="profile-check"><input type="checkbox" checked={profile.enabled} onChange={(event) => void onUpdateProfile(profile.id, { enabled: event.target.checked })} /> Enabled</label><small>Editable project model profile. Recompile after changes.</small></div> : null}{selected.compilation?.blockingIssues.length ? <div className="compiler-blocking"><CircleAlert size={15} /><div><strong>Compilation blocked</strong>{selected.compilation.blockingIssues.map((issue) => <p key={issue}>{issue}</p>)}</div></div> : null}<div className="reference-manifest"><h3>Reference mappings</h3>{selected.compilation?.mappings.map((mapping) => <div key={mapping.id}><code>{mapping.promptTag}</code><span>{mapping.assetId} · {mapping.referenceType}</span><em>{mapping.status} · upload {mapping.uploadPosition}</em></div>) ?? selected.referenceManifest.map((reference) => <div key={reference.assetId}><code>{reference.assetId}</code><span>{reference.roles.join(" · ")}</span><em>V{reference.stateVersion} · P{reference.priority}</em></div>)}</div>{selected.compilation ? <div className="compiler-settings">{Object.entries(selected.compilation.settings).map(([key, value]) => <span key={key}><small>{key}</small><strong>{String(value)}</strong></span>)}</div> : null}<pre className="compiled-prompt">{selected.prompt}</pre><div className="negative-box"><strong>Negative continuity constraints</strong><p>{selected.negativePrompt}</p></div></> : null}</section>
    </div>
  );
}

function Rules({ project, onRuleOverride }: { project: MovieProject; onRuleOverride: (ruleId: string, input: { enabled?: boolean; severity?: RuleSeverity; reason?: string }) => Promise<void> }) {
  const database = project.memory.database;
  const projectProfile = database.ruleProfiles.find((profile) => profile.type === "project");
  const effective = (rule: RuleDefinition) => projectProfile?.overrides.find((override) => override.ruleId === rule.id)?.enabled ?? rule.enabled;
  const severity = (rule: RuleDefinition) => projectProfile?.overrides.find((override) => override.ruleId === rule.id)?.severity ?? rule.severity;
  const groups = database.rules.reduce<Record<string, RuleDefinition[]>>((result, rule) => {
    result[rule.category] = [...(result[rule.category] ?? []), rule];
    return result;
  }, {});
  return (
    <div className="artifact-page rules-page">
      <div className="profile-strip">{database.ruleProfiles.map((profile) => <div key={profile.id}><strong>{profile.name}</strong><span>{profile.overrides.length} overrides</span></div>)}</div>
      {Object.entries(groups).map(([category, rules]) => <section key={category}><div className="section-heading"><div><span className="eyebrow">Rule profile</span><h2>{category.replaceAll("_", " ")}</h2></div><span className="mono-muted">{rules.length} rules</span></div>{rules.map((rule) => <article className={!effective(rule) ? "disabled" : ""} key={rule.id}><div className="rule-main"><button className={`rule-toggle ${effective(rule) ? "enabled" : ""}`} onClick={() => void onRuleOverride(rule.id, { enabled: !effective(rule), reason: "Changed in Rules workspace" })}><i />{effective(rule) ? "ON" : "OFF"}</button><div><strong>{rule.name}</strong><code>{rule.id}</code><p>{rule.enforcement}</p><small>{rule.source} · {rule.scopes.join(" · ")}</small></div></div><select aria-label={`${rule.name} severity`} value={severity(rule)} onChange={(event) => void onRuleOverride(rule.id, { severity: event.target.value as RuleSeverity, reason: "Severity override in Rules workspace" })}><option>INFO</option><option>WARNING</option><option>ERROR</option><option>BLOCKING</option></select></article>)}</section>)}
    </div>
  );
}

function Generations({ project }: { project: MovieProject }) {
  const database = project.memory.database;
  return (
    <div className="artifact-page generations-page">
      <div className="production-metrics"><div><strong>{database.generationPrompts.length}</strong><span>compiled prompts</span></div><div><strong>{database.generationResults.length}</strong><span>generation results</span></div><div><strong>{project.memory.generationHistory.length}</strong><span>agent operations</span></div></div>
      <section><div className="section-heading"><div><span className="eyebrow">Provider-independent ledger</span><h2>Generation history</h2></div></div>{project.memory.generationHistory.slice().reverse().map((record) => <article key={record.id}><div><strong>{record.phase.replaceAll("_", " ")}</strong><code>{record.brain} · attempt {record.attempt}</code></div><p>{record.summary}</p><span>{record.provider}</span><time>{new Date(record.createdAt).toLocaleString()}</time></article>)}</section>
      {!database.generationResults.length ? <div className="empty-inline"><WandSparkles size={20} /><strong>No paid external assets generated</strong><span>Planning prompts are ready for a connected provider adapter.</span></div> : null}
    </div>
  );
}

function Review({ project, onOverrideIssue }: { project: MovieProject; onOverrideIssue: (issueId: string) => Promise<void> }) {
  const database = project.memory.database;
  const active = database.validationIssues.filter((issue) => !issue.resolved);
  const blocking = active.filter((issue) => issue.blocking && !issue.overridden).length;
  return (
    <div className="artifact-page review-page">
      <div className={`review-gate ${blocking ? "blocked" : "clear"}`}><CircleAlert size={22} /><div><span className="eyebrow">Pre-generation gate</span><h2>{blocking ? `${blocking} blocking issue${blocking === 1 ? "" : "s"}` : "Generation cleared"}</h2><p>BLOCKING issues stop prompt compilation until resolved or manually overridden.</p></div></div>
      <section className="review-list">{active.map((item) => <article className={`${item.severity.toLowerCase()} ${item.overridden ? "overridden" : ""}`} key={item.id}><div><span>{item.severity}</span><code>{item.ruleId}</code>{item.sequenceId ? <em>{item.sequenceId}</em> : null}</div><h3>{item.title}</h3><p>{item.detail}</p>{item.expected ? <small>Expected: {item.expected} · Observed: {item.observed}</small> : null}{item.blocking && !item.overridden ? <button className="button secondary" onClick={() => void onOverrideIssue(item.id)}>Manual override</button> : null}{item.overridden ? <strong>OVERRIDDEN · {item.overrideReason}</strong> : null}</article>)}</section>
      <section className="approval-ledger"><span className="eyebrow">Approval ledger</span>{database.approvals.slice().reverse().map((approval) => <div key={approval.id}><code>{approval.entityId}</code><span>{approval.entityType}</span><strong>{approval.state}</strong></div>)}</section>
    </div>
  );
}

function Continuity({ project }: { project: MovieProject }) {
  const report = project.artifacts.continuity as ContinuityArtifact | undefined;
  if (!report) return <Empty title="Continuity check not run" detail="The Continuity Agent will compare identity, wardrobe, geography, lighting, screen direction, and damage across the project." />;
  return (
    <div className="artifact-page continuity-page">
      <div className="continuity-score"><ScanLine size={24} /><strong>{report.score}</strong><span>continuity score</span><small>{report.checkedRules} rules checked</small></div>
      <section className="issue-panel"><div className="section-heading"><div><span className="eyebrow">Review queue</span><h2>{report.issues.length} issues</h2></div></div>{report.issues.map((issue) => <article key={issue.id} className={issue.severity}><div><span>{issue.severity}</span><code>{issue.id}</code></div><h3>{issue.title}</h3><p>{issue.detail}</p><strong>{issue.suggestion}</strong></article>)}</section>
      <section className="passed-panel"><span className="eyebrow">Passed checks</span>{report.passed.map((item) => <div key={item}><Check size={14} /><span>{item}</span></div>)}</section>
    </div>
  );
}

function Export({ project, onDownload }: { project: MovieProject; onDownload: () => void }) {
  const artifact = project.artifacts.export as ExportArtifact | undefined;
  if (!artifact) return <Empty title="Export not prepared" detail="Complete the production pipeline to validate and package the movie project." />;
  return (
    <div className="artifact-page export-page"><section className="export-hero"><Package size={28} /><span className="eyebrow">Movie project package</span><h2>{project.title} is ready</h2><p>{artifact.note}</p><button className="button primary" onClick={onDownload}><Download size={14} /> Download project ZIP</button></section><div className="export-tree"><section><span className="eyebrow">Folders</span>{artifact.folders.map((folder) => <div key={folder}><Folder size={14} /><code>{folder}</code></div>)}</section><section><span className="eyebrow">Key files</span>{artifact.files.map((file) => <div key={file}><FileJson size={14} /><code>{file}</code></div>)}</section></div></div>
  );
}
