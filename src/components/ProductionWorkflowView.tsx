import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  BookOpenCheck,
  Check,
  ChevronRight,
  ClipboardCopy,
  Clock3,
  Download,
  Film,
  Image as ImageIcon,
  Library,
  LockKeyhole,
  Maximize2,
  PackageCheck,
  RefreshCw,
  Save,
  ScanLine,
  Search,
  Settings2,
  Sparkles,
  UploadCloud,
  Users,
  WandSparkles,
  X,
  AudioLines,
  Boxes,
  Car,
  History,
  MapPinned,
  TriangleAlert,
  Copy,
  Eye,
  FileText,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  ChevronDown,
  ChevronUp,
  Volume2,
} from "lucide-react";
import type {
  ApprovalState,
  AppSettings,
  CharacterVoiceProfile,
  ChangeImpactReport,
  ContinuityEntityState,
  MovieDnaSelection,
  MovieProject,
  ProductionStage,
  ReferenceUploadInput,
  ScriptDialogueLine,
  ScriptProductionSequence,
  ScriptShot,
  StorySectionId,
  TargetPlatform,
} from "../types";
import { api } from "../api";
import {
  groupMovieDnaOptions,
  MOVIE_DNA_BUILT_IN_PRESETS,
  MOVIE_DNA_CATALOG,
  movieDnaOption,
  toggleMovieDnaCategoryExpansion,
  visibleMovieDnaOptions,
  type MovieDnaOptionDefinition,
} from "../movie-dna-catalog";
import type { ViewId } from "./Sidebar";
import genreSheet from "../../assets/movie-dna/genre-contact-sheet.png";
import lookSheet from "../../assets/movie-dna/look-contact-sheet.png";
import cameraSheet from "../../assets/movie-dna/camera-contact-sheet.png";
import { ReferenceImagePicker, type PendingReferenceImage } from "./ReferenceImagePicker";
import { SequenceWorkspaceView } from "./SequenceWorkspaceView";

type Action = (action: string, payload?: Record<string, unknown>) => Promise<void>;

interface Props {
  view: ViewId;
  project: MovieProject;
  busy: boolean;
  onAction: Action;
  onUploadVideo: (sequenceId: string, file: File) => Promise<void>;
  onUploadReference: (input: ReferenceUploadInput) => Promise<void>;
  onGenerateAsset: (assetId: string, force: boolean) => Promise<void>;
  onAssetState: (assetId: string, state: ApprovalState) => Promise<void>;
  onNavigate: (view: ViewId) => void;
  onDownload: () => void;
  settings?: AppSettings;
  onUpdateSettings?: (patch: Partial<AppSettings>) => Promise<AppSettings>;
}

const workflowSteps: Array<{ stage: ProductionStage; label: string }> = [
  { stage: "project_setup", label: "Setup" },
  { stage: "movie_dna", label: "Movie DNA" },
  { stage: "story", label: "Story" },
  { stage: "film_bible", label: "Bible" },
  { stage: "characters", label: "Characters" },
  { stage: "asset_manifest", label: "Assets" },
  { stage: "sequences", label: "Sequences" },
  { stage: "platform_prompts", label: "Prompts" },
  { stage: "video_review", label: "Review" },
  { stage: "export", label: "Export" },
];

const sheetUrls = { genre: genreSheet, look: lookSheet, camera: cameraSheet };
const gateClass = (status: string) => status.toLowerCase().replaceAll("_", "-");

function WorkflowRail({ project }: { project: MovieProject }) {
  return <div className="workflow-rail" aria-label="Production workflow">
    {workflowSteps.map((step, index) => {
      const gate = project.production.gates.find((item) => item.stage === step.stage);
      return <div className={`workflow-step ${gateClass(gate?.status ?? "PENDING")}`} key={step.stage}>
        <span>{["LOCKED", "APPROVED"].includes(gate?.status ?? "") ? <Check size={11} /> : index + 1}</span>
        <small>{step.label}</small>
        {index < workflowSteps.length - 1 ? <i /> : null}
      </div>;
    })}
  </div>;
}

function PageShell({ project, eyebrow, title, detail, children }: { project: MovieProject; eyebrow: string; title: string; detail: string; children: React.ReactNode }) {
  return <div className="production-workflow-page">
    <WorkflowRail project={project} />
    <div className="production-page-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{detail}</p></div><div className="three-systems"><span><i className={project.production.movieDna.status === "LOCKED" ? "on" : ""} />Movie DNA</span><span><i className={["APPROVED", "LOCKED"].includes(project.production.filmBible.status) ? "on" : ""} />Film Bible</span><span><i className={project.memory.productionMemory.continuity.snapshots.length ? "on" : ""} />Continuity Ledger</span></div></div>
    {children}
  </div>;
}

export function ProductionWorkflowView(props: Props) {
  if (props.view === "project_setup") return <ProjectSetup {...props} />;
  if (props.view === "movie_dna") return <MovieDna {...props} />;
  if (props.view === "story") return <StoryStudio {...props} />;
  if (props.view === "full_script") return <FullScriptStudio {...props} />;
  if (props.view === "timeline") return <StoryTimelineStudio {...props} />;
  if (props.view === "film_bible") return <BibleStudio {...props} />;
  if (props.view === "characters") return <CharacterStudio {...props} />;
  if (props.view === "asset_manifest") return <AssetManifest {...props} />;
  if (props.view === "sequences") return <SequenceStudio {...props} />;
  if (props.view === "prompts") return <PromptStudio {...props} />;
  if (props.view === "continuity") return <ContinuityStudio {...props} />;
  if (props.view === "audio_bible") return <AudioBibleStudio {...props} />;
  return <ExportStudio {...props} />;
}

function ProjectSetup({ project, busy, onAction, onNavigate }: Props) {
  const fromProject = () => ({
    title: project.title, movieTitle: project.movieTitle ?? project.title, idea: project.idea,
    runtimeMinutes: project.runtimeMinutes, sequenceDurationSeconds: project.sequenceDurationSeconds,
    aspectRatio: project.aspectRatio, resolution: project.resolution, filmLanguage: project.filmLanguage,
    dialogueLanguage: project.dialogueLanguage, genre: project.genre, era: project.era,
    audienceRating: project.audienceRating, targetPlatform: project.targetPlatform,
    narrationEnabled: project.narrationEnabled, dialogueEnabled: project.dialogueEnabled,
    musicEnabled: project.musicEnabled, subtitlesEnabled: project.subtitlesEnabled,
  });
  const [form, setForm] = useState(fromProject);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const actionRef = useRef(onAction);
  const timerRef = useRef<number | undefined>(undefined);
  const lastSavedRef = useRef(JSON.stringify(form));
  const locked = project.production.gates.find((item) => item.stage === "project_setup")?.status === "LOCKED";
  const count = Math.max(1, Math.min(120, Math.ceil((form.runtimeMinutes * 60) / form.sequenceDurationSeconds)));
  const set = (key: string, value: unknown) => {
    setSaveState("unsaved");
    setForm((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => { actionRef.current = onAction; }, [onAction]);
  useEffect(() => {
    const next = fromProject();
    setForm(next);
    lastSavedRef.current = JSON.stringify(next);
    setSaveState("saved");
    // A project switch must reset the editor; ordinary autosave responses keep the local draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);
  useEffect(() => {
    if (locked) return;
    const snapshot = JSON.stringify(form);
    if (snapshot === lastSavedRef.current) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setSaveState("saving");
      void actionRef.current("update_setup", form)
        .then(() => {
          lastSavedRef.current = snapshot;
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    }, 800);
    return () => window.clearTimeout(timerRef.current);
  }, [form, locked]);

  const lockSetup = async () => {
    window.clearTimeout(timerRef.current);
    setSaveState("saving");
    try {
      await onAction("save_setup", form);
      lastSavedRef.current = JSON.stringify(form);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  return <PageShell project={project} eyebrow="Stage 01 · Production foundation" title="Project Setup" detail="Set the runtime, delivery format, languages, film tracks, and target platform. Sequence count updates automatically.">
    <section className="setup-production-card">
      <div className="setup-save-header"><div><strong>{locked ? "Project Setup locked" : "Draft autosave active"}</strong><span>{locked ? "Protected from silent changes. A future revision must pass impact review." : "Important edits save after a short pause."}</span></div><span className={`setup-save-state ${locked ? "locked" : saveState}`}>{locked ? <LockKeyhole size={12} /> : saveState === "saving" ? <RefreshCw size={12} /> : <Check size={12} />}{locked ? "Locked" : saveState === "saving" ? "Saving" : saveState === "unsaved" ? "Unsaved changes" : saveState === "error" ? "Save failed" : "Saved"}</span></div>
      <fieldset className="setup-edit-fields" disabled={busy || locked}>
        <div className="production-form-grid">
          <label>Project name<input value={form.title} onChange={(event) => set("title", event.target.value)} /></label>
          <label>Movie title<input value={form.movieTitle} onChange={(event) => set("movieTitle", event.target.value)} /></label>
          <label className="wide setup-idea">Movie idea<textarea rows={3} value={form.idea} onChange={(event) => set("idea", event.target.value)} /></label>
          <label>Film duration (minutes)<input type="number" min="0.5" max="180" step="0.5" value={form.runtimeMinutes} onChange={(event) => set("runtimeMinutes", Number(event.target.value))} /></label>
          <label>Sequence duration (seconds)<input type="number" min="1" max="120" value={form.sequenceDurationSeconds} onChange={(event) => set("sequenceDurationSeconds", Number(event.target.value))} /></label>
          <label>Sequence count<input className="calculated-field" readOnly value={count} /><small>Calculated from runtime ÷ sequence duration</small></label>
          <label>Aspect ratio<select value={form.aspectRatio} onChange={(event) => set("aspectRatio", event.target.value)}><option>2.39:1</option><option>16:9</option><option>1.85:1</option><option>9:16</option><option>1:1</option></select></label>
          <label>Resolution<select value={form.resolution} onChange={(event) => set("resolution", event.target.value)}><option>4K UHD</option><option>4K DCI</option><option>2K DCI</option><option>1080p</option></select></label>
          <label>Film language<input value={form.filmLanguage} onChange={(event) => set("filmLanguage", event.target.value)} /></label>
          <label>Dialogue language<input value={form.dialogueLanguage} onChange={(event) => set("dialogueLanguage", event.target.value)} /></label>
          <label>Genre<input value={form.genre} onChange={(event) => set("genre", event.target.value)} /></label>
          <label>Historical era<input value={form.era} onChange={(event) => set("era", event.target.value)} /></label>
          <label>Audience / rating<input value={form.audienceRating} onChange={(event) => set("audienceRating", event.target.value)} /></label>
          <label>Target platform<select value={form.targetPlatform} onChange={(event) => set("targetPlatform", event.target.value as TargetPlatform)}><option>Seedance</option><option>Higgsfield</option><option>MiniMax</option><option>Veo</option><option>Kling</option><option>Runway</option><option>Sora</option><option>Custom</option></select></label>
        </div>
        <div className="track-switches"><span>Film tracks</span>{[["narrationEnabled", "Narration"], ["dialogueEnabled", "Dialogue"], ["musicEnabled", "Music"], ["subtitlesEnabled", "Subtitles"]].map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(form[key as keyof typeof form])} onChange={(event) => set(key, event.target.checked)} /><i />{label}</label>)}</div>
      </fieldset>
      <div className="workflow-actions"><button className="button primary" disabled={busy || locked || saveState === "saving"} onClick={() => void lockSetup()}><LockKeyhole size={14} />{locked ? "Setup locked" : "Lock Project Setup"}</button><button className="button secondary" disabled={!locked} onClick={() => onNavigate("movie_dna")}>Continue to Movie DNA <ChevronRight size={14} /></button></div>
    </section>
  </PageShell>;
}

function VisualCrop({ sheet, index }: { sheet: keyof typeof sheetUrls; index: number }) {
  const column = index % 4;
  const row = Math.floor(index / 4);
  const style = { backgroundImage: `url(${sheetUrls[sheet]})`, backgroundSize: "400% auto", backgroundPosition: `${column * (100 / 3)}% ${row * (100 / 3)}%` } as CSSProperties;
  return <div className="dna-card-image" style={style} />;
}

function MovieDna({ project, busy, onAction, onNavigate, settings, onUpdateSettings }: Props) {
  const dna = project.production.movieDna;
  const locked = dna.status === "LOCKED";
  const [activeCategoryId, setActiveCategoryId] = useState("genre");
  const [previewOption, setPreviewOption] = useState<{ categoryId: string; option: MovieDnaOptionDefinition }>();
  const [compareIds, setCompareIds] = useState<string[]>(dna.comparisonOptionIds ?? []);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [categoryQueries, setCategoryQueries] = useState<Record<string, string>>({});
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetTab, setPresetTab] = useState<"built-in" | "mine" | "recent">("built-in");
  const [presetName, setPresetName] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [idea, setIdea] = useState(project.idea);
  const [generatingId, setGeneratingId] = useState<string>();
  const [impact, setImpact] = useState<ChangeImpactReport>();
  const [impactBusy, setImpactBusy] = useState(false);
  const activeCategory = MOVIE_DNA_CATALOG.find((category) => category.id === activeCategoryId) ?? MOVIE_DNA_CATALOG[0]!;
  const selectedIds = dna.selections[activeCategory.id]?.optionIds ?? [];
  const selectedCount = MOVIE_DNA_CATALOG.filter((category) => dna.selections[category.id]?.optionIds?.length).length;
  const requiredCategories = MOVIE_DNA_CATALOG.filter((category) => category.required);
  const requiredSelectedCount = requiredCategories.filter((category) => dna.selections[category.id]?.optionIds?.length).length;
  const complete = requiredSelectedCount === requiredCategories.length;
  const expanded = Boolean(expandedCategories[activeCategory.id]);
  const activeOptions = visibleMovieDnaOptions(activeCategory, expanded, categoryQueries[activeCategory.id] ?? "", dna.customOptions[activeCategory.id] ?? []);
  const activeGroups = groupMovieDnaOptions(activeOptions);
  const resolveOption = (categoryId: string, optionId: string) => movieDnaOption(categoryId, optionId) ?? dna.customOptions[categoryId]?.find((entry) => entry.id === optionId);
  const compareOptions = compareIds.map((id) => {
    const [categoryId, optionId] = id.split(":");
    const option = resolveOption(categoryId!, optionId!);
    return option ? { categoryId: categoryId!, option } : undefined;
  }).filter((item): item is { categoryId: string; option: MovieDnaOptionDefinition } => item !== undefined);

  useEffect(() => {
    setCompareIds(project.production.movieDna.comparisonOptionIds ?? []);
    setExpandedCategories({});
    setCategoryQueries({});
  }, [project.id]);

  const optionPreview = (categoryId: string, optionId: string) => dna.previews[`${categoryId}:${optionId}`];
  const selectOption = async (categoryId: string, optionId: string) => {
    const category = MOVIE_DNA_CATALOG.find((item) => item.id === categoryId)!;
    const current = dna.selections[categoryId]?.optionIds ?? [];
    const optionIds = category.multi
      ? current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]
      : [optionId];
    if (!optionIds.length) return;
    await onAction("update_dna", { key: categoryId, optionIds });
  };
  const toggleCompare = async (compareId: string) => {
    const next = compareIds.includes(compareId) ? compareIds.filter((id) => id !== compareId) : [...compareIds.slice(-5), compareId];
    setCompareIds(next);
    await onAction("update_dna_comparisons", { optionIds: next });
  };
  const clearComparisons = async () => {
    setCompareIds([]);
    await onAction("update_dna_comparisons", { optionIds: [] });
  };
  const createCustomOption = async () => {
    if (!customName.trim() || customDescription.trim().length < 3) return;
    const technicalValues = Object.fromEntries(Object.entries(customValues).filter(([, value]) => value.trim()).map(([key, value]) => [key, /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value]));
    await onAction("add_custom_dna_option", { categoryId: activeCategory.id, name: customName, description: customDescription, technicalValues });
    setCustomName(""); setCustomDescription(""); setCustomValues({}); setCustomOpen(false);
    setExpandedCategories((current) => ({ ...current, [activeCategory.id]: true }));
  };
  const applyPreset = async (selections: Record<string, string[]>, customOptions: typeof dna.customOptions = {}) => {
    await onAction("apply_dna_preset", { selections, customOptions });
  };
  const savePreset = async () => {
    if (!settings || !onUpdateSettings || presetName.trim().length < 2) return;
    const timestamp = new Date().toISOString();
    const preset = {
      id: `dna-preset-${crypto.randomUUID()}`, name: presetName.trim(), description: `Saved from ${project.movieTitle ?? project.title}`,
      selections: Object.fromEntries(Object.entries(dna.selections).map(([key, value]) => [key, [...(value.optionIds ?? [])]]).filter(([, ids]) => ids.length)),
      customOptions: structuredClone(dna.customOptions), createdAt: timestamp, updatedAt: timestamp, useCount: 0,
    };
    await onUpdateSettings({ movieDnaPresets: [...settings.movieDnaPresets, preset] });
    setPresetName(""); setPresetTab("mine");
  };
  const regenerate = async (categoryId: string, optionId: string) => {
    const id = `${categoryId}:${optionId}`;
    setGeneratingId(id);
    try { await onAction("generate_dna_preview", { categoryId, optionId }); }
    finally { setGeneratingId(undefined); }
  };
  const generateCombined = async () => {
    setGeneratingId("combined-genre");
    try { await onAction("generate_combined_genre_preview", { optionIds: dna.genreOptionIds }); }
    finally { setGeneratingId(undefined); }
  };
  const reviewRevision = async () => {
    setImpactBusy(true);
    try { setImpact(await api.changeImpact(project.id, "movie_dna")); }
    finally { setImpactBusy(false); }
  };
  const PreviewImage = ({ categoryId, option, large = false }: { categoryId: string; option: MovieDnaOptionDefinition; large?: boolean }) => {
    const generated = optionPreview(categoryId, option.id);
    return generated?.path
      ? <img className={large ? "dna-generated-preview large" : "dna-generated-preview"} src={api.mediaUrl(project.id, generated.path)} alt={`${option.name} generated preview`} />
      : <VisualCrop sheet={option.sheet} index={option.visualIndex} />;
  };

  return <PageShell project={project} eyebrow="Stage 02 · Permanent visual source" title="Visual Movie DNA" detail="See the movie before you build it. Choose by image, compare the same scene, then lock one structured visual source for every later generation.">
    <div className="dna-command-bar">
      <div><strong>{selectedCount}/{MOVIE_DNA_CATALOG.length} visual categories selected</strong><span>{locked ? `Movie DNA v${dna.version} is locked and feeding production.` : `${requiredSelectedCount}/${requiredCategories.length} required directions ready · every card keeps its technical values.`}</span></div>
      <button className="button secondary" disabled={busy || locked} onClick={() => setHelpOpen((value) => !value)}><Sparkles size={14} />Help Me Choose</button>
      <button className={`button secondary ${presetOpen ? "active" : ""}`} onClick={() => setPresetOpen((value) => !value)}><Library size={14} />Preset Library</button>
      <button className={`button secondary ${compareIds.length ? "active" : ""}`} disabled={!compareIds.length} onClick={() => document.getElementById("dna-compare-panel")?.scrollIntoView({ behavior: "smooth" })}><Library size={14} />Compare {compareIds.length}</button>
    </div>

    {presetOpen ? <section className="dna-preset-library">
      <div className="dna-preset-tabs"><button className={presetTab === "built-in" ? "active" : ""} onClick={() => setPresetTab("built-in")}>Built-in Presets</button><button className={presetTab === "mine" ? "active" : ""} onClick={() => setPresetTab("mine")}>My Presets</button><button className={presetTab === "recent" ? "active" : ""} onClick={() => setPresetTab("recent")}>Recently Used</button></div>
      {presetTab === "built-in" ? <div className="dna-preset-grid">{MOVIE_DNA_BUILT_IN_PRESETS.map((preset) => <article key={preset.id}><strong>{preset.name}</strong><p>{preset.description}</p><button disabled={busy || locked} onClick={() => void applyPreset(preset.selections)}>Apply editable preset</button></article>)}</div> : null}
      {presetTab === "mine" ? <><div className="dna-preset-save"><input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Preset name, e.g. BURABEEH HORROR LOOK" /><button disabled={!settings || !onUpdateSettings || presetName.trim().length < 2} onClick={() => void savePreset()}>Save Current DNA as Preset</button></div><div className="dna-preset-grid">{settings?.movieDnaPresets.length ? settings.movieDnaPresets.map((preset) => <article key={preset.id}><strong>{preset.name}</strong><p>{preset.description}</p><button disabled={busy || locked} onClick={() => void applyPreset(preset.selections, preset.customOptions)}>Apply editable preset</button></article>) : <p className="dna-empty-options">No personal presets yet.</p>}</div></> : null}
      {presetTab === "recent" ? <div className="dna-recent-list">{dna.recentOptionIds.map((entry) => { const separator = entry.indexOf(":"); const categoryId = entry.slice(0, separator); const optionId = entry.slice(separator + 1); const recent = resolveOption(categoryId, optionId); return recent ? <button key={entry} disabled={busy || locked} onClick={() => void selectOption(categoryId, optionId)}><small>{MOVIE_DNA_CATALOG.find((category) => category.id === categoryId)?.name}</small><strong>{recent.name}</strong></button> : null; })}</div> : null}
    </section> : null}

    {helpOpen ? <section className="dna-help-panel">
      <div><span className="eyebrow">Studio Brain recommendation</span><h3>Describe the movie, then review before accepting</h3><p>The recommendation remains editable and generates a real combined-genre preview through the configured image provider.</p></div>
      <textarea rows={4} value={idea} onChange={(event) => setIdea(event.target.value)} />
      <button className="button primary" disabled={busy || idea.trim().length < 12} onClick={() => void onAction("recommend_dna", { idea })}><WandSparkles size={14} />Generate recommendation & preview</button>
      {dna.recommendation ? <div className="dna-recommendation"><strong>{dna.recommendation.summary}</strong><span>{dna.recommendation.acceptedAt ? "Recommendation accepted — every choice can still be edited before lock." : "Nothing changes until you accept this recommendation."}</span>{!dna.recommendation.acceptedAt ? <button className="button secondary" disabled={busy} onClick={() => void onAction("apply_dna_recommendation")}>Accept editable recommendation</button> : null}</div> : null}
    </section> : null}

    <div className="visual-dna-workbench">
      <aside className="dna-category-rail">
        <span className="eyebrow">Visual categories</span>
        {MOVIE_DNA_CATALOG.map((category, index) => <button className={category.id === activeCategory.id ? "active" : ""} onClick={() => setActiveCategoryId(category.id)} key={category.id}><span>{pad(index + 1)}</span><strong>{category.name}</strong><i className={dna.selections[category.id]?.optionIds?.length ? "complete" : ""}>{dna.selections[category.id]?.optionIds?.length ?? 0}</i></button>)}
      </aside>

      <section className="dna-visual-selector">
        <div className="dna-category-heading"><div><span className="eyebrow">{activeCategory.multi ? "Expandable combination · no fixed limit" : "Single selection"}</span><h3>{activeCategory.name}</h3><p>{activeCategory.note}</p></div><div className="dna-category-heading-actions"><code>{dna.selections[activeCategory.id]?.label ?? "Choose an option"}</code><button data-dna-view-all={activeCategory.id} aria-expanded={expanded} onClick={() => setExpandedCategories((current) => toggleMovieDnaCategoryExpansion(current, activeCategory.id))}>{expanded ? "SHOW LESS" : "VIEW ALL OPTIONS"}</button><button disabled={locked} onClick={() => setCustomOpen((value) => !value)}><Plus size={11} />ADD CUSTOM</button></div></div>
        {expanded ? <label className="dna-catalog-search"><Search size={14} /><input aria-label={`Search ${activeCategory.name}`} value={categoryQueries[activeCategory.id] ?? ""} onChange={(event) => setCategoryQueries((current) => ({ ...current, [activeCategory.id]: event.target.value }))} placeholder={`Search ${activeCategory.name.replace(" DNA", "")}`} /><span>{activeOptions.length} options</span></label> : null}
        {customOpen ? <section className="dna-custom-option-form">
          <div><span className="eyebrow">Custom direction</span><h4>{activeCategory.id === "historicalPeriod" ? "CUSTOM YEAR OR PERIOD" : activeCategory.id === "colorGrade" ? "CREATE CUSTOM GRADE" : activeCategory.id === "environment" ? "CUSTOM ENVIRONMENT" : `CUSTOM ${activeCategory.name.toUpperCase()}`}</h4><p>The Studio Brain stores your words as structured Movie DNA and generates a same-scene preview.</p></div>
          <label>Name<input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder={activeCategory.id === "historicalPeriod" ? "1965, 1888, 2050…" : activeCategory.id === "environment" ? "Floating city above Jupiter" : "Name this direction"} /></label>
          <label>Direction<textarea rows={3} value={customDescription} onChange={(event) => setCustomDescription(event.target.value)} placeholder="Describe the visual behavior, restrictions, and production feeling." /></label>
          {activeCategory.id === "colorGrade" ? <div className="dna-custom-values">{["temperature", "tint", "contrast", "saturation", "blackLevel", "highlightRolloff", "shadowTone", "midtoneTone", "highlightTone", "exposureTendency"].map((field) => <label key={field}>{field.replaceAll(/([A-Z])/g, " $1")}<input value={customValues[field] ?? ""} onChange={(event) => setCustomValues((current) => ({ ...current, [field]: event.target.value }))} /></label>)}</div> : null}
          <div className="workflow-actions"><button className="button secondary" onClick={() => setCustomOpen(false)}>Cancel</button><button className="button primary" disabled={busy || locked || !customName.trim() || customDescription.trim().length < 3} onClick={() => void createCustomOption()}><WandSparkles size={13} />Create, Select & Generate Preview</button></div>
        </section> : null}
        <div className="dna-option-groups" data-dna-category-options={activeCategory.id}>
          {activeGroups.map(([group, options]) => <section className="dna-option-group" key={group}><div className="dna-option-group-title"><strong>{group}</strong><span>{options.length}</span></div><div className="dna-visual-card-grid">{options.map((entry) => {
            const option = entry as MovieDnaOptionDefinition;
            const selected = selectedIds.includes(option.id);
            const compareId = `${activeCategory.id}:${option.id}`;
            const compared = compareIds.includes(compareId);
            const preview = optionPreview(activeCategory.id, option.id);
            const generating = generatingId === compareId;
            return <article className={`dna-visual-card ${selected ? "selected" : ""} ${compared ? "compared" : ""}`} data-dna-option-id={option.id} key={option.id}>
              <button className="dna-image-button" onClick={() => setPreviewOption({ categoryId: activeCategory.id, option })}><PreviewImage categoryId={activeCategory.id} option={option} /><span><Maximize2 size={13} />Full preview</span></button>
              <div className="dna-card-copy"><div><strong>{option.name}</strong><span className={`dna-preview-state ${preview?.status?.toLowerCase() ?? "sample"}`}>{generating ? "GENERATING" : preview?.status ?? (option.source === "custom" ? "CUSTOM" : "SAMPLE")}</span></div><p>{option.shortDescription}</p>{preview?.status === "FAILED" ? <small className="dna-generation-error">{preview.error}</small> : null}</div>
              <div className="dna-card-actions">
                <button onClick={() => setPreviewOption({ categoryId: activeCategory.id, option })}><Maximize2 size={11} />Preview</button>
                <button className={compared ? "active" : ""} disabled={busy} onClick={() => void toggleCompare(compareId)}><Library size={11} />Compare</button>
                <button disabled={busy || locked || generating} onClick={() => void regenerate(activeCategory.id, option.id)}><RefreshCw size={11} />{preview?.status === "FAILED" ? "Retry" : "Regenerate"}</button>
                <button className={selected ? "selected" : ""} disabled={busy || locked} onClick={() => void selectOption(activeCategory.id, option.id)}>{selected ? <Check size={11} /> : null}{selected ? "Selected" : "Select"}</button>
              </div>
            </article>;
          })}</div></section>)}
          {!activeOptions.length ? <p className="dna-empty-options">No options match this search. Add a custom direction or try a broader term.</p> : null}
        </div>

        {activeCategory.id === "genre" ? <section className="combined-genre-card">
          <div className="combined-genre-image">{dna.combinedGenrePreviewId && dna.previews[dna.combinedGenrePreviewId]?.path ? <img src={api.mediaUrl(project.id, dna.previews[dna.combinedGenrePreviewId]!.path!)} alt="Combined genre generated preview" /> : <VisualCrop sheet="genre" index={15} />}</div>
          <div><span className="eyebrow">Combined genre visual</span><h3>{dna.selections.genre?.label || "Combine any number of genres"}</h3><p>Studio Brain interprets every chosen genre as one cohesive production direction. It regenerates only when requested.</p>{dna.combinedGenrePreviewId ? <small>{dna.previews[dna.combinedGenrePreviewId]?.status} · {dna.previews[dna.combinedGenrePreviewId]?.provider ?? "waiting for provider"}</small> : null}<button className="button primary" disabled={busy || locked || !dna.genreOptionIds.length} onClick={() => void generateCombined()}><WandSparkles size={13} />{generatingId === "combined-genre" ? "Generating…" : "Generate combined preview"}</button></div>
        </section> : null}

        {compareOptions.length ? <section id="dna-compare-panel" className="dna-compare-panel"><div className="section-heading"><div><span className="eyebrow">Same-scene comparison</span><h3>Inspect the visual difference</h3></div><button disabled={busy} onClick={() => void clearComparisons()}>Clear comparison</button></div><div>{compareOptions.map(({ categoryId, option }) => <article key={`${categoryId}:${option.id}`}><PreviewImage categoryId={categoryId} option={option} /><strong>{option.name}</strong><span>{option.shortDescription}</span><code>{JSON.stringify(option.technicalValues)}</code></article>)}</div></section> : null}

        <section className="negative-rules-editor"><span className="eyebrow">Permanent negative rules</span><h3>Never allow</h3>{dna.negativeRules.map((rule, index) => <div key={`${index}-${rule}`}><strong>{pad(index + 1)}</strong><p>{rule}</p></div>)}{!locked ? <textarea aria-label="Permanent negative rules" defaultValue={dna.negativeRules.join("\n")} rows={7} onBlur={(event) => { const rules = event.target.value.split("\n").map((rule) => rule.trim()).filter(Boolean); if (rules.join("\n") !== dna.negativeRules.join("\n")) void onAction("update_dna_rules", { rules }); }} /> : null}</section>
      </section>

      <aside className="dna-board movie-dna-board">
        <div className="dna-board-title"><div><span className="eyebrow">Movie DNA Board</span><h3>{project.movieTitle ?? project.title}</h3></div><span className={locked ? "locked" : "draft"}>{locked ? "LOCKED" : "EDITABLE"}</span></div>
        <div className="dna-board-summary"><strong>{dna.selections.genre?.label}</strong><span>V{dna.version} · {selectedCount} structured selections</span></div>
        <div className="dna-board-visual-list">{MOVIE_DNA_CATALOG.map((category) => {
          const selection = dna.selections[category.id];
          const option = selection?.optionIds?.length ? resolveOption(category.id, selection.optionIds[0]!) : undefined;
          if (!selection || !option) return null;
          const generatedPath = selection.previewPath;
          return <article key={category.id}>{generatedPath ? <img src={api.mediaUrl(project.id, generatedPath)} alt={`${category.name} selected preview`} /> : <VisualCrop sheet={option.sheet} index={option.visualIndex} />}<div><small>{category.name}</small><strong>{selection.label}</strong><span>{selection.technicalDescription}</span></div></article>;
        })}</div>

        <section className="dna-master-frame-card">
          <div><span className="eyebrow">Visual Style Reference</span><h4>{dna.masterFrame?.filename ?? "Movie DNA Master Frame"}</h4></div>
          {dna.masterFrame?.path ? <img src={api.mediaUrl(project.id, dna.masterFrame.path)} alt="Movie DNA Master Frame" /> : <div className="dna-master-empty"><ImageIcon size={24} /><span>Optional permanent style frame</span></div>}
          <p>Controls look, colour, light, texture and atmosphere. It never replaces Main Character identity.</p>
          {dna.masterFrame?.error ? <small className="dna-generation-error">{dna.masterFrame.provider}: {dna.masterFrame.error}</small> : null}
          <button className="button secondary wide-button" disabled={busy || !locked} onClick={() => void onAction("generate_dna_master")}><WandSparkles size={13} />{dna.masterFrame?.status === "FAILED" ? "Retry Master Frame" : dna.masterFrame?.path ? "Regenerate Master Frame" : "Generate Master Frame"}</button>
        </section>

        <div className={`dna-lock-state ${locked ? "locked" : "draft"}`}><LockKeyhole size={15} /><div><strong>{locked ? "MOVIE DNA LOCKED" : complete ? "READY TO LOCK" : "DNA INCOMPLETE"}</strong><small>{locked ? `Version ${dna.version} feeds future generations` : `${requiredSelectedCount}/${requiredCategories.length} required categories selected`}</small></div></div>
        {locked ? <button className="button secondary wide-button" disabled={busy || impactBusy} onClick={() => void reviewRevision()}><RefreshCw size={14} />{impactBusy ? "Checking impact…" : "Review affected items"}</button> : <button className="button primary wide-button" disabled={busy || !complete} onClick={() => void onAction("lock_dna")}><LockKeyhole size={14} />Lock Movie DNA</button>}
        {impact ? <section className="dna-impact-review"><div><strong>Locked Movie DNA change</strong><span>{impact.summary}</span></div><div className="dna-impact-counts"><span>{impact.lockedCount} locked</span><span>{impact.approvedCount} approved</span></div><ul>{impact.items.slice(0, 7).map((item) => <li key={`${item.kind}-${item.id}`}><span>{item.kind}</span><strong>{item.label}</strong><em>{item.protection}</em></li>)}</ul>{impact.items.length > 7 ? <small>+ {impact.items.length - 7} more affected items</small> : null}<p>Future-only keeps all existing approved images unchanged. Rebuild mode only marks eligible draft/review work; locked work is never regenerated silently.</p><div className="dna-impact-actions"><button className="button secondary" onClick={() => setImpact(undefined)}>Cancel</button><button className="button secondary" disabled={busy} onClick={() => void onAction("new_dna_version", { scope: "FUTURE_ONLY" }).then(() => setImpact(undefined))}>Change future generations</button><button className="button primary" disabled={busy} onClick={() => void onAction("new_dna_version", { scope: "REBUILD_EXISTING" }).then(() => setImpact(undefined))}>Review existing rebuild</button></div></section> : null}
        {locked ? <button className="button primary wide-button" onClick={() => onNavigate("story")}>Continue to Story <ChevronRight size={14} /></button> : null}
      </aside>
    </div>

    {previewOption ? <div className="dna-fullscreen-preview" role="dialog" aria-modal="true" aria-label={`${previewOption.option.name} full preview`}><button className="dna-preview-close" onClick={() => setPreviewOption(undefined)}><X size={18} />Close</button><div className="dna-preview-stage"><PreviewImage categoryId={previewOption.categoryId} option={previewOption.option} large /></div><aside><span className="eyebrow">Full-screen visual sample</span><h2>{previewOption.option.name}</h2><p>{previewOption.option.shortDescription}</p><dl>{Object.entries(previewOption.option.technicalValues).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl><strong>Final prompt description</strong><p>{previewOption.option.promptDescription}</p><button className="button primary wide-button" disabled={busy || locked} onClick={() => void selectOption(previewOption.categoryId, previewOption.option.id).then(() => setPreviewOption(undefined))}>Use this style</button><button className="button secondary wide-button" disabled={busy || locked} onClick={() => void regenerate(previewOption.categoryId, previewOption.option.id)}>Regenerate sample</button></aside></div> : null}
  </PageShell>;
}

function StoryStudio({ project, busy, onAction, onNavigate }: Props) {
  const story = project.production.story;
  const [mode, setMode] = useState(story.mode);
  const [input, setInput] = useState(story.input || project.idea);
  const [view, setView] = useState<"full" | "structure" | "timeline" | "arcs" | "sequences">("full");
  const [editing, setEditing] = useState(false);
  const [reading, setReading] = useState(false);
  const [activeSection, setActiveSection] = useState<StorySectionId>("opening");
  const [draftSections, setDraftSections] = useState<Record<string, string>>(() => Object.fromEntries(story.sections.map((section) => [section.id, section.content])));
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "impact" | "error">("saved");
  const [instruction, setInstruction] = useState("");
  const [impact, setImpact] = useState<ChangeImpactReport>();
  const [impactIntent, setImpactIntent] = useState<"manual" | "proposal">();
  const [impactExpanded, setImpactExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const timerRef = useRef<number | undefined>(undefined);
  const actionRef = useRef(onAction);
  const dnaLocked = project.production.movieDna.status === "LOCKED";
  const protectedStory = story.status === "APPROVED" || story.status === "LOCKED";
  const canonicalSections = useMemo(() => Object.fromEntries(story.sections.map((section) => [section.id, section.content])), [story.sections]);
  const approvedRecord = story.history.find((record) => record.version === story.approvedVersion);
  const sequenceCount = Math.ceil((project.runtimeMinutes * 60) / Math.max(1, project.sequenceDurationSeconds));
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    const records = [
      ...story.sections.map((section) => ({ kind: "Story section", id: section.id, label: section.title, text: section.content })),
      ...story.characters.map((character) => ({ kind: "Character", id: character.id, label: character.name, text: `${character.role} ${character.description} ${character.relationships.join(" ")}` })),
      ...story.locations.map((location) => ({ kind: "Location", id: location.id, label: location.name, text: location.description })),
      ...story.objects.map((object) => ({ kind: object.category, id: object.id, label: object.name, text: object.description })),
      ...story.beats.map((beat) => ({ kind: "Story beat", id: beat.id, label: beat.name, text: `${beat.description} ${beat.storyPurpose} ${beat.eventIds.join(" ")}` })),
      ...story.events.map((event) => ({ kind: "Event", id: event.id, label: event.name, text: event.description })),
      ...story.sequenceBreakdown.map((sequence) => ({ kind: "Sequence", id: sequence.id, label: `Sequence ${pad(sequence.sequenceNumber)} · ${sequence.timeRange}`, text: `${sequence.storyPurpose} ${sequence.events.join(" ")}` })),
    ];
    return records.filter((record) => `${record.label} ${record.text}`.toLowerCase().includes(query)).slice(0, 30);
  }, [search, story]);

  useEffect(() => { actionRef.current = onAction; }, [onAction]);
  useEffect(() => {
    setMode(story.mode);
    setInput(story.input || project.idea);
    setDraftSections(Object.fromEntries(story.sections.map((section) => [section.id, section.content])));
    setSaveState("saved");
    setEditing(false);
    window.clearTimeout(timerRef.current);
  }, [project.id, story.version]);
  useEffect(() => {
    if (!editing || protectedStory || !story.sections.length) return;
    const changed = story.sections.some((section) => draftSections[section.id] !== section.content);
    if (!changed) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setSaveState("saving");
      void actionRef.current("update_story", { sections: story.sections.map((section) => ({ id: section.id, content: draftSections[section.id] ?? section.content })) })
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 900);
    return () => window.clearTimeout(timerRef.current);
  }, [draftSections, editing, protectedStory, story.sections]);

  const changeSection = (id: StorySectionId, value: string) => {
    setDraftSections((current) => ({ ...current, [id]: value }));
    setSaveState(protectedStory ? "impact" : "unsaved");
  };
  const requestImpact = async (intent: "manual" | "proposal") => {
    setImpact(await api.changeImpact(project.id, "story"));
    setImpactIntent(intent);
    setImpactExpanded(false);
  };
  const saveNow = async () => {
    window.clearTimeout(timerRef.current);
    if (protectedStory) return requestImpact("manual");
    setSaveState("saving");
    try {
      await onAction("update_story", { sections: story.sections.map((section) => ({ id: section.id, content: draftSections[section.id] ?? section.content })) });
      setSaveState("saved");
    } catch { setSaveState("error"); }
  };
  const analyzeChange = async () => {
    if (instruction.trim().length < 3) return;
    await onAction("propose_story_change", { instruction });
    await requestImpact("proposal");
  };
  const applyImpact = async (impactAction: "APPLY" | "FUTURE_ONLY") => {
    if (!impactIntent || !impact) return;
    if (impactIntent === "manual") {
      setSaveState("saving");
      await onAction("update_story", { sections: story.sections.map((section) => ({ id: section.id, content: draftSections[section.id] ?? section.content })), confirmedImpact: true, impactAction });
      setSaveState("saved");
    } else {
      await onAction("apply_story_change", { impactAction, affectedItemIds: impact.items.map((item) => item.id) });
      setInstruction("");
    }
    setImpact(undefined);
    setImpactIntent(undefined);
  };
  const copyStory = async () => {
    const readable = approvedRecord?.content || story.content;
    try { await navigator.clipboard.writeText(`${story.title}\n\n${readable}`); setCopyState("copied"); }
    catch { setCopyState("error"); }
    window.setTimeout(() => setCopyState("idle"), 1800);
  };
  const focusSearchResult = (kind: string, id: string) => {
    if (kind === "Story section") { setView("full"); setActiveSection(id as StorySectionId); document.getElementById(`story-section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else if (kind === "Character") setView("arcs");
    else if (kind === "Story beat") setView("structure");
    else if (kind === "Sequence") setView("sequences");
    else setView("timeline");
    setSearch("");
  };

  if (reading) return <div className="story-reading-overlay"><header><div><span>CONTINUITY STUDIO BY BURABEEH · READING MODE</span><h1>{story.title}</h1></div><button onClick={() => setReading(false)}><X size={17} />Exit Reading Mode</button></header><div className="story-reading-body"><nav>{story.sections.map((section) => <button className={activeSection === section.id ? "active" : ""} onClick={() => { setActiveSection(section.id); document.getElementById(`reading-${section.id}`)?.scrollIntoView({ behavior: "smooth" }); }} key={section.id}>{section.title}</button>)}</nav><article>{story.sections.map((section) => <section id={`reading-${section.id}`} key={section.id}><span>{section.title} · {formatStoryTime(section.approximateStartSeconds)}</span><h2>{section.title}</h2><p>{section.content}</p></section>)}</article></div></div>;

  return <PageShell project={project} eyebrow="Stage 03 · Narrative source of truth" title="Story Narrative Control" detail="What happens, why it happens, and who changes. Movie DNA supplies visual tone; structured Story State controls narrative logic.">
    {!dnaLocked ? <GateBlock title="Lock Movie DNA first" detail="Story generation is intentionally blocked so every AI request receives a locked visual and tonal source." action="Open Movie DNA" onClick={() => onNavigate("movie_dna")} /> : !story.sections.length ? <section className="story-creation-workspace">
      <div className="story-creation-heading"><BookOpenCheck size={28} /><div><span className="eyebrow">Three creation methods · one structured Story State</span><h3>Create the narrative source</h3><p>Generation stops after Story. Film Bible, characters, assets, scripts, and sequences wait for explicit Story approval.</p></div></div>
      <div className="story-mode-grid">{[
        ["MANUAL", "Write Story Manually", "Write your narrative directly, then organize it into stable Story sections."],
        ["PASTE", "Paste Existing Story", "Import existing prose without losing it, then edit the structured result."],
        ["AI", "Develop Story From Idea With AI", "Use Studio Intelligence with Project Setup and locked Movie DNA."],
      ].map(([value, label, detail]) => <button className={mode === value ? "active" : ""} onClick={() => setMode(value as typeof mode)} key={value}><strong>{label}</strong><span>{detail}</span></button>)}</div>
      <label className="story-source-input"><span>{mode === "AI" ? "Story idea for Studio Intelligence" : mode === "PASTE" ? "Paste the complete existing Story" : "Write the Story"}</span><textarea rows={12} value={input} onChange={(event) => setInput(event.target.value)} placeholder={mode === "AI" ? "Describe the premise, protagonist, conflict, and desired ending…" : "Begin the Story here…"} /></label>
      <div className="story-brain-context"><span><LockKeyhole size={12} />Movie DNA v{project.production.movieDna.version} locked</span><span><Clock3 size={12} />{project.runtimeMinutes} min · {sequenceCount} slots</span><span><Settings2 size={12} />{project.genre} · {project.era}</span><span>{project.filmLanguage} film · {project.dialogueLanguage} dialogue</span><span>{project.audienceRating}</span><span>{project.narrationEnabled ? "Narration on" : "Narration off"} · {project.musicEnabled ? "Music on" : "Music off"}</span></div>
      <button className="button primary story-generate-button" disabled={busy || input.trim().length < 12} onClick={() => void onAction("generate_story", { input, mode })}><WandSparkles size={15} />{mode === "AI" ? "Develop Story with Studio Intelligence" : mode === "PASTE" ? "Import Structured Story" : "Create Manual Story"}</button>
    </section> : <div className="story-v2-workspace">
      <div className="story-command-row"><div><span>Story V{pad(story.version)} · {story.generationProvider ?? story.mode}</span><strong>{story.logline}</strong></div><div><button onClick={() => setReading(true)}><BookOpenCheck size={13} />Reading Mode</button><button onClick={() => void copyStory()}><ClipboardCopy size={13} />{copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy Story"}</button><div className="story-export-menu"><button onClick={() => setExportOpen((value) => !value)}><Download size={13} />Export Story</button>{exportOpen ? <div>{(["full", "structure", "timeline", "arcs", "sequences", "json"] as const).map((format) => <a href={api.storyExportUrl(project.id, format)} onClick={() => setExportOpen(false)} key={format}>{format === "full" ? "Full Story" : format === "structure" ? "Story Structure" : format === "timeline" ? "Timeline" : format === "arcs" ? "Character Arcs" : format === "sequences" ? "Sequence Breakdown" : "Structured JSON Story"}</a>)}</div> : null}</div><button className="approve" disabled={busy || !["GENERATED", "EDITED", "REVIEW", "CHANGED_AFTER_PRODUCTION"].includes(story.status) || saveState !== "saved"} onClick={() => void onAction("approve_story")}><Check size={13} />Approve Story</button><button className="lock" disabled={busy || story.status !== "APPROVED"} onClick={() => void onAction("lock_story")}><LockKeyhole size={13} />Lock Story</button></div></div>
      <div className="story-meta-grid"><StoryMetric label="Movie title" value={story.title} /><StoryMetric label="Story status" value={story.status.replaceAll("_", " ")} tone={story.status === "LOCKED" ? "success" : "warning"} /><StoryMetric label="Runtime" value={formatStoryTime(project.runtimeMinutes * 60)} /><StoryMetric label="Sequences" value={`${sequenceCount} × ${formatStoryTime(project.sequenceDurationSeconds)}`} /><StoryMetric label="Genre" value={project.production.movieDna.selections.genre?.label ?? project.genre} /><StoryMetric label="Period" value={project.era} /><StoryMetric label="Film language" value={project.filmLanguage} /><StoryMetric label="Dialogue" value={project.dialogueEnabled ? project.dialogueLanguage : "Disabled"} /><StoryMetric label="Movie DNA" value={`V${project.production.movieDna.version} LOCKED`} tone="success" /></div>
      <div className="story-view-row"><div>{(["full", "structure", "timeline", "arcs", "sequences"] as const).map((id) => <button className={view === id ? "active" : ""} onClick={() => setView(id)} key={id}>{id === "full" ? "Full Story" : id === "arcs" ? "Character Arcs" : id === "sequences" ? "Sequence Breakdown" : id === "structure" ? "Story Structure" : "Timeline"}</button>)}</div><label><Search size={13} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Story, people, places…" /></label></div>
      {search ? <div className="story-search-results"><div><strong>{searchResults.length} structured results</strong><button onClick={() => setSearch("")}><X size={13} /></button></div>{searchResults.length ? searchResults.map((result) => <button onClick={() => focusSearchResult(result.kind, result.id)} key={`${result.kind}-${result.id}`}><span>{result.kind}</span><strong>{result.label}</strong><small>{result.text.slice(0, 150)}</small></button>) : <p>No matching Story text, character, location, object, beat, event, or sequence.</p>}</div> : null}
      <div className="story-control-grid">
        <aside className="story-map-panel"><div><span>Story map</span><strong>{story.sequenceBreakdown.length} linked</strong></div>{story.sections.map((section) => <button className={activeSection === section.id ? "active" : ""} onClick={() => { setActiveSection(section.id); setView("full"); document.getElementById(`story-section-${section.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }} key={section.id}><span>{formatStoryTime(section.approximateStartSeconds)}–{formatStoryTime(section.approximateEndSeconds)} · {section.title}</span><strong>{section.content.slice(0, 52) || "Continue writing this section"}</strong><small>{story.beats.filter((beat) => beat.sectionId === section.id).map((beat) => beat.relatedSequenceIds).flat().join(" · ")}</small></button>)}<div className="story-shared-links"><span>Shared connections</span><button onClick={() => onNavigate("film_bible")}>Film Bible <em>{project.production.filmBible.status}</em></button><button onClick={() => onNavigate("characters")}>Characters <em>{story.characters.length}</em></button><button onClick={() => onNavigate("assets")}>Assets <em>{story.objects.length}</em></button><button onClick={() => onNavigate("continuity")}>Continuity Ledger <em>{project.production.continuityLedger.length ? "LIVE" : "AVAILABLE"}</em></button></div></aside>
        <main className="story-primary-panel">
          {view === "full" ? <StoryFullView story={story} editing={editing} draftSections={draftSections} saveState={saveState} busy={busy} onEdit={() => setEditing(true)} onChange={changeSection} onSave={() => void saveNow()} onRegenerate={() => void onAction("regenerate_story", { input: story.input })} onAi={() => document.getElementById("story-ai-instruction")?.focus()} /> : null}
          {view === "structure" ? <StoryStructureView project={project} /> : null}
          {view === "timeline" ? <StoryTimelineView project={project} onNavigate={onNavigate} /> : null}
          {view === "arcs" ? <StoryArcsView project={project} onNavigate={onNavigate} /> : null}
          {view === "sequences" ? <StorySequencesView project={project} onNavigate={onNavigate} /> : null}
        </main>
        <aside className="story-intelligence-panel"><section className="story-ai-card"><div><span>AI Story Editor</span><strong>Scope aware</strong></div><p>Modify only the requested Story area. Unrelated sections remain byte-for-byte unchanged.</p><textarea id="story-ai-instruction" rows={5} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Make the opening scarier but keep the ending unchanged." /><div className="story-ai-actions"><button disabled={busy || instruction.trim().length < 3} onClick={() => void analyzeChange()}><WandSparkles size={12} />Analyze Change</button><button onClick={() => setInstruction("")}>Clear</button></div><div className="story-ai-examples">{["Opening scarier", "Extend the chase", "Move the reveal later", "Reduce dialogue", "Change the ending"].map((example) => <button onClick={() => setInstruction(example)} key={example}>{example}</button>)}</div></section>
          {story.pendingProposal ? <section className="story-proposal-card"><div><span>AI modify preview · Variant {story.pendingProposal.variant}</span><strong className={story.pendingProposal.impactLevel.toLowerCase()}>{story.pendingProposal.impactLevel} IMPACT</strong></div>{story.pendingProposal.changes.map((change) => <details open={story.pendingProposal?.changes.length === 1} key={change.sectionId}><summary>{change.sectionId} · current vs proposed</summary><label>Current text<p>{change.currentText}</p></label><label>Proposed text<p>{change.proposedText}</p></label></details>)}<div className="story-proposal-links"><span>{story.pendingProposal.affectedBeatIds.length} beats</span><span>{story.pendingProposal.affectedCharacterIds.length} characters</span><span>{story.pendingProposal.affectedSequenceIds.length} sequences</span></div><div className="story-proposal-actions"><button onClick={() => void requestImpact("proposal")}>Accept / Impact Review</button><button disabled={busy} onClick={() => void onAction("regenerate_story_change", { instruction: story.pendingProposal?.instruction })}>Regenerate</button><button disabled={busy} onClick={() => void onAction("reject_story_change").then(() => { setImpact(undefined); setImpactIntent(undefined); })}>Reject</button></div></section> : null}
          {approvedRecord && story.approvedVersion !== story.version ? <section className="story-version-compare"><div><span>Production source vs draft</span><strong>APPROVAL REQUIRED TO REPLACE</strong></div><p><b>Story V{pad(story.approvedVersion ?? 0)}</b> remains the approved{story.lockedVersion === story.approvedVersion ? " and locked" : ""} production source.</p><p><b>Story V{pad(story.version)}</b> is the current {story.status.replaceAll("_", " ").toLowerCase()} draft.</p><details><summary>Compare changed sections</summary>{story.sections.map((section) => ({ section, approved: approvedRecord.sections.find((item) => item.id === section.id) })).filter(({ section, approved }) => approved?.content !== section.content).map(({ section, approved }) => <div key={section.id}><strong>{section.title}</strong><small>Approved V{pad(story.approvedVersion ?? 0)}</small><p>{approved?.content}</p><small>Current V{pad(story.version)}</small><p>{section.content}</p></div>)}</details></section> : null}
          {impact ? <StoryImpactPanel report={impact} expanded={impactExpanded} onToggle={() => setImpactExpanded((value) => !value)} onApply={() => void applyImpact("APPLY")} onFuture={() => void applyImpact("FUTURE_ONLY")} onCancel={() => { setImpact(undefined); setImpactIntent(undefined); }} /> : null}
          <section className="story-safety-card"><div><span>Approved material safety</span><strong>Guard active</strong></div><p><span>Approved assets</span><b>{project.production.assets.filter((asset) => asset.status === "APPROVED").length} preserved</b></p><p><span>Locked characters</span><b>{project.production.characters.filter((character) => character.status === "LOCKED").length} preserved</b></p><p><span>Locked sequences</span><b>{project.production.sequences.filter((sequence) => sequence.status === "LOCKED").length} preserved</b></p><p><span>Continuity history</span><b>Immutable</b></p></section>
          <section className="story-history-card"><span>Story status history</span>{[...story.history].reverse().slice(0, 8).map((record) => <p key={`${record.version}-${record.createdAt}`}><b>V{pad(record.version)}</b><span>{record.changeSource} · {record.status}</span>{record.locked ? <em>Locked</em> : record.approved ? <em>Approved</em> : null}</p>)}</section>
        </aside>
      </div>
    </div>}
  </PageShell>;
}

const formatStoryTime = (seconds: number) => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, "0")}:${String(Math.round(Math.max(0, seconds)) % 60).padStart(2, "0")}`;

function StoryMetric({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  return <div><span>{label}</span><strong className={tone}>{value}</strong></div>;
}

function StoryFullView({ story, editing, draftSections, saveState, busy, onEdit, onChange, onSave, onRegenerate, onAi }: { story: MovieProject["production"]["story"]; editing: boolean; draftSections: Record<string, string>; saveState: string; busy: boolean; onEdit: () => void; onChange: (id: StorySectionId, value: string) => void; onSave: () => void; onRegenerate: () => void; onAi: () => void }) {
  return <div className="story-full-view"><header><div><span>Full Story · structured narrative source</span><h3>{story.title}</h3><p>{story.premise}</p></div><div><button onClick={onEdit}>Edit Story</button><button disabled={busy || !editing} onClick={onSave}><Save size={12} />Save</button><button disabled={busy} onClick={onRegenerate}><RefreshCw size={12} />Regenerate Story</button><button onClick={onAi}><WandSparkles size={12} />AI Modify</button></div></header><div className={`story-save-indicator ${saveState}`}>{saveState === "saving" ? <RefreshCw size={12} /> : saveState === "impact" ? <LockKeyhole size={12} /> : <Check size={12} />}{saveState === "saving" ? "Saving" : saveState === "unsaved" ? "Unsaved Changes" : saveState === "impact" ? "Impact review required to save" : saveState === "error" ? "Save failed" : "Saved"}</div><article>{story.sections.map((section) => <section id={`story-section-${section.id}`} key={section.id}><div><span>{section.title} control · {formatStoryTime(section.approximateStartSeconds)}</span><i /><small>{story.beats.filter((beat) => beat.sectionId === section.id).flatMap((beat) => beat.relatedSequenceIds).join(" · ")}</small></div>{editing ? <textarea rows={Math.max(4, Math.ceil((draftSections[section.id]?.length ?? 0) / 100))} value={draftSections[section.id] ?? ""} onChange={(event) => onChange(section.id, event.target.value)} /> : <p>{section.content}</p>}</section>)}</article><footer><div><strong>Story controls</strong><p>What happens, why it happens, character motivation, world events, and narrative structure.</p></div><div><strong>Script controls later</strong><p>How approved Story events appear on screen: action, dialogue, timing, performance, shots, camera, and sound.</p></div></footer></div>;
}

function StoryStructureView({ project }: { project: MovieProject }) {
  const story = project.production.story;
  return <div className="story-structure-view"><header><div><span>Adaptive structure · {formatStoryTime(project.runtimeMinutes * 60)} project runtime</span><h3>Narrative Beats Across {story.sequenceBreakdown.length} Sequences</h3></div><strong>Timing reads from Project Setup</strong></header><div className="story-beat-timeline">{story.beats.map((beat) => <div key={beat.id}><span>{formatStoryTime(beat.approximateTimeSeconds)}</span><strong>{beat.name}</strong><small>{beat.emotion}</small></div>)}</div><div className="story-beat-cards">{story.beats.map((beat) => <article key={beat.id}><div><strong>{beat.id} · {beat.name}</strong><span>{formatStoryTime(beat.approximateTimeSeconds)} · {beat.relatedSequenceIds.join(", ")}</span></div><dl><dt>Story purpose</dt><dd>{beat.storyPurpose}</dd><dt>Characters</dt><dd>{beat.characterIds.join(" · ") || "None"}</dd><dt>Locations</dt><dd>{beat.locationIds.join(" · ") || "TBD"}</dd><dt>Emotion</dt><dd>{beat.emotion}</dd><dt>Conflict</dt><dd>{beat.conflict}</dd><dt>Important assets</dt><dd>{beat.importantAssetIds.join(" · ") || "None"}</dd></dl></article>)}</div></div>;
}

function StoryTimelineView({ project, onNavigate }: { project: MovieProject; onNavigate: (view: ViewId) => void }) {
  const story = project.production.story;
  return <div className="story-timeline-view"><header><div><span>Story timeline · upstream source for Continuity Ledger</span><h3>{project.era} · {story.timeline.length} stored state changes</h3></div><button onClick={() => onNavigate("continuity")}>Open Continuity Ledger <ChevronRight size={12} /></button></header><div className="story-timeline-table"><div><span>Movie time</span><span>Date / time</span><span>Weather / place</span><span>Event / knowledge / relationship</span><span>Objects</span><span>Injury / damage / environment</span></div>{story.timeline.map((entry) => <div key={entry.id}><span>{formatStoryTime(entry.approximateTimeSeconds)}</span><span>{entry.date}<small>{entry.time} · {entry.timeOfDay}</small></span><span>{entry.weather}<small>{entry.locationId}</small></span><span>{entry.events.join(", ")}<small>{Object.values(entry.characterKnowledge).join(" · ")} · {Object.values(entry.relationshipState).join(" · ")}</small></span><span>+ {entry.objectsAcquired.join(", ") || "None"}<small>− {entry.objectsLost.join(", ") || "None"}</small></span><span>{[...entry.injuries, ...entry.damage].join(", ") || "No change"}<small>{entry.environmentChanges.join(" · ")}</small></span></div>)}</div></div>;
}

function StoryArcsView({ project, onNavigate }: { project: MovieProject; onNavigate: (view: ViewId) => void }) {
  return <div className="story-arcs-view"><header><span>Character arcs · linked Story IDs</span><h3>Transformation Across the Film</h3></header>{project.production.story.characterArcs.map((arc, index) => <article key={arc.characterId}><div className="story-character-number">{pad(index + 1)}</div><div><span>{arc.characterId} · permanent candidate</span><h3>{arc.name}</h3><small>{arc.role} · {arc.relatedSequenceIds.join(", ")}</small></div><dl><dt>Start</dt><dd>{arc.startingEmotionalState}</dd><dt>Goal</dt><dd>{arc.goal}</dd><dt>Motivation</dt><dd>{arc.motivation}</dd><dt>Conflict / fear</dt><dd>{arc.conflict} · {arc.fear}</dd><dt>Major decisions</dt><dd>{arc.majorDecisions.slice(0, 2).join(" · ")}</dd><dt>Ending state</dt><dd>{arc.endingState}</dd></dl><button onClick={() => onNavigate("characters")}>Open Character <ChevronRight size={12} /></button></article>)}<p className="story-link-note">Story stores arc relationships against stable candidate IDs. Character Analysis later links those IDs to permanent Character records without duplication.</p></div>;
}

function StorySequencesView({ project, onNavigate }: { project: MovieProject; onNavigate: (view: ViewId) => void }) {
  const story = project.production.story;
  return <div className="story-sequences-view"><header><div><span>Suggested Sequence Breakdown · no production prompts</span><h3>Story Divided for Production</h3></div><strong>{story.sequenceBreakdown.length} positions · {formatStoryTime(project.runtimeMinutes * 60)} total</strong></header><div>{story.sequenceBreakdown.map((sequence) => <article key={sequence.id}><div><strong>Sequence {pad(sequence.sequenceNumber)}</strong><span>{sequence.timeRange}</span></div><p>{sequence.events.join(" ")}</p><dl><dt>Purpose</dt><dd>{sequence.storyPurpose}</dd><dt>Emotion</dt><dd>{sequence.emotion}</dd><dt>Conflict</dt><dd>{sequence.conflict}</dd><dt>Characters</dt><dd>{sequence.characterIds.join(" · ")}</dd><dt>Location</dt><dd>{sequence.locationId}</dd><dt>Important assets</dt><dd>{sequence.importantAssetIds.join(" · ") || "None"}</dd><dt>Required ending</dt><dd>{sequence.requiredEndingCondition}</dd></dl><button onClick={() => onNavigate("sequences")}>Open Sequence Workspace <ChevronRight size={12} /></button></article>)}</div></div>;
}

function StoryImpactPanel({ report, expanded, onToggle, onApply, onFuture, onCancel }: { report: ChangeImpactReport; expanded: boolean; onToggle: () => void; onApply: () => void; onFuture: () => void; onCancel: () => void }) {
  const items = expanded ? report.items : report.items.slice(0, 7);
  return <section className="story-impact-panel"><div><span>Story Change Impact</span><strong>Review required</strong></div><p>{report.summary} {report.lockedCount} locked and {report.approvedCount} approved records remain protected.</p><ul>{items.map((item) => <li key={`${item.kind}-${item.id}`}><span>{item.kind.replaceAll("_", " ")}</span><strong>{item.label}</strong><em className={item.protection.toLowerCase()}>{item.protection}</em><small>{item.reason}</small></li>)}</ul><button className="story-impact-toggle" onClick={onToggle}>{expanded ? "Show Impact Summary" : `Review Affected Items (${report.items.length})`}</button><div><button onClick={onApply}>Apply Change</button><button onClick={onFuture}>Apply For Future Work Only</button><button onClick={onCancel}>Cancel</button></div></section>;
}

function BibleStudio({ project, busy, onAction, onNavigate }: Props) {
  const bible = project.production.filmBible;
  const approvedStory = Boolean(project.production.story.approvedVersion) && ["APPROVED", "LOCKED", "CHANGED_AFTER_PRODUCTION"].includes(project.production.story.status);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const approved = bible.history.find((item) => item.version === bible.approvedVersion);
  const save = async (key: string, value: string) => {
    if (value === bible.sections[key]) return;
    setSaveState("saving");
    try { await onAction("update_bible", { key, value }); setSaveState("saved"); }
    catch { setSaveState("error"); }
  };
  return <PageShell project={project} eyebrow="Stage 04 · Story and world law" title="Film Bible" detail="Editable canonical sections derived only from the approved story and locked Movie DNA.">
    {!approvedStory ? <GateBlock title="Approve Story first" detail="The Bible cannot be generated from an unapproved draft." action="Open Story" onClick={() => onNavigate("story")} /> : bible.status === "PENDING" ? <GateBlock icon={<Sparkles size={22} />} title="Ready to generate the Film Bible" detail="Studio Intelligence will consume the approved structured Story contract and locked Movie DNA, then stop for review." action="Generate Film Bible" disabled={busy} onClick={() => void onAction("generate_bible")} /> : <>
      <section className="bible-command-deck">
        <div><span className="eyebrow">Canonical world source</span><h3>Film Bible V{String(bible.version).padStart(2, "0")}</h3><p>{bible.generationProvider ?? "Migrated canonical source"}</p></div>
        <dl><div><dt>Status</dt><dd className={bible.status.toLowerCase()}>{bible.status.replaceAll("_", " ")}</dd></div><div><dt>Story source</dt><dd>V{bible.sourceContext?.approvedStoryVersion ?? project.production.story.approvedVersion ?? "—"}</dd></div><div><dt>Movie DNA</dt><dd>V{bible.sourceContext?.movieDnaVersion ?? project.production.movieDna.version} locked</dd></div><div><dt>Autosave</dt><dd className={saveState}>{saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : saveState === "unsaved" ? "Unsaved changes" : "Save failed"}</dd></div></dl>
        <div className="bible-command-actions"><button className="button secondary" disabled={busy} onClick={() => void onAction("regenerate_bible")}><RefreshCw size={14} />New draft</button>{bible.status === "APPROVED" ? <button className="button primary" disabled={busy} onClick={() => void onAction("lock_bible")}><LockKeyhole size={14} />Lock Bible</button> : bible.status === "LOCKED" ? <button className="button primary" onClick={() => onNavigate("characters")}><Users size={14} />Analyze Characters</button> : <button className="button primary" disabled={busy} onClick={() => void onAction("approve_bible")}><Check size={14} />Approve V{String(bible.version).padStart(2, "0")}</button>}</div>
      </section>
      {bible.version !== bible.approvedVersion && approved ? <section className="bible-version-safety"><LockKeyhole size={16} /><div><strong>Approved V{String(approved.version).padStart(2, "0")} remains protected</strong><span>The current V{String(bible.version).padStart(2, "0")} draft cannot replace production law until you explicitly approve it.</span></div></section> : null}
      <div className="bible-section-grid">{Object.entries(bible.sections).map(([key, value], index) => <article className={index < 2 ? "wide" : ""} key={`${bible.version}-${key}`}><span>{String(index + 1).padStart(2, "0")} · {key.replace(/([A-Z])/g, " $1")}</span><textarea defaultValue={value} rows={index < 2 ? 7 : 5} onChange={() => setSaveState("unsaved")} onBlur={(event) => void save(key, event.target.value)} /></article>)}</div>
      <section className="audio-bible-editor"><div className="section-heading"><div><span className="eyebrow">Permanent sound source</span><h3>Audio Bible</h3></div></div><div>{Object.entries(project.production.audioBible).map(([key, value]) => <label key={key}><span>{key}</span><textarea defaultValue={value} rows={3} onBlur={(event) => { if (event.target.value !== value) void onAction("update_audio", { key, value: event.target.value }); }} /></label>)}</div></section>
      <section className="bible-history"><div><span className="eyebrow">Non-destructive history</span><h3>{bible.history.length} saved Film Bible versions</h3></div>{[...bible.history].reverse().map((version) => <article key={version.version}><strong>V{String(version.version).padStart(2, "0")}</strong><span>{version.status.replaceAll("_", " ")}</span><small>{version.source} · {version.provider ?? "Continuity Studio"}</small><em>{version.version === bible.approvedVersion ? "PRODUCTION SOURCE" : version.version === bible.lockedVersion ? "LOCKED" : version.changedSections.length ? `${version.changedSections.length} sections changed` : "Generated"}</em></article>)}</section>
      <div className="sticky-approval-bar"><div><strong>Film Bible v{bible.version}</strong><span>{bible.status === "LOCKED" ? "Locked canonical world law" : bible.status === "APPROVED" ? "Approved canonical source" : "Review every section before approval"}</span></div>{["APPROVED", "LOCKED"].includes(bible.status) ? <button className="button primary" onClick={() => onNavigate("characters")}>Continue to Characters <ChevronRight size={14} /></button> : <button className="button primary" disabled={busy} onClick={() => void onAction("approve_bible")}><Check size={14} />Approve Film Bible</button>}</div>
    </>}
  </PageShell>;
}

function CharacterStudio({ project, busy, onAction, onNavigate, onUploadReference, onGenerateAsset, onAssetState }: Props) {
  const ready = Boolean(project.production.filmBible.approvedVersion) || ["APPROVED", "LOCKED"].includes(project.production.filmBible.status);
  const [selectedId, setSelectedId] = useState(project.production.characters[0]?.id);
  const [tab, setTab] = useState<"identity" | "references" | "states">("identity");
  const [pending, setPending] = useState<PendingReferenceImage>();
  useEffect(() => { if (!project.production.characters.some((item) => item.id === selectedId)) setSelectedId(project.production.characters[0]?.id); }, [project.production.characters, selectedId]);
  const character = project.production.characters.find((item) => item.id === selectedId) ?? project.production.characters[0];
  const references = character ? project.memory.database.projectReferences.filter((item) => character.referenceIds.includes(item.id) || item.assetId === character.id) : [];
  const asset = character ? project.memory.database.assets.find((item) => item.id === character.id) : undefined;
  const sheet = character ? project.memory.database.continuitySheets.find((item) => item.assetId === character.id) : undefined;
  const upload = async () => {
    if (!pending || !character) return;
    await onUploadReference({ ...pending, name: character.name, type: "character", roles: ["IDENTITY"], storyUsage: character.category === "main" ? "REQUIRED" : "PREFERRED", mainCharacter: character.category === "main" && !project.preStorySetup.mainCharacterReferenceId, assetId: character.id });
    setPending(undefined);
  };
  const identityFields = character ? [
    ["name", "Name", character.name], ["role", "Role", character.role], ["ageRange", "Age range", character.ageRange ?? "Not specified"], ["occupation", "Occupation", character.occupation], ["personality", "Personality", character.personality], ["backstory", "Backstory", character.backstory], ["goal", "Goal", character.goal], ["motivation", "Motivation", character.motivation], ["conflict", "Conflict", character.conflict], ["fear", "Fear", character.fear], ["description", "Identity description", character.description],
  ] as const : [];
  return <PageShell project={project} eyebrow="Stage 05 · Identity system" title="Character Analysis & References" detail="Determine the cast first, then attach multiple protected references and track every story state inside one permanent identity.">
    {!ready ? <GateBlock title="Approve the Film Bible first" detail="Character counts and roles must come from approved story law." action="Open Film Bible" onClick={() => onNavigate("film_bible")} /> : !project.production.characters.length ? <GateBlock icon={<Users size={22} />} title="Analyze the approved story" detail="The agent will count and number main, supporting, and background characters without generating images yet." action="Analyze Characters" disabled={busy} onClick={() => void onAction("analyze_characters")} /> : <>
      <section className="character-command-deck"><div><span className="eyebrow">Permanent identity registry</span><h3>{project.production.characters.length} Story-linked characters</h3><p>{project.production.characters.filter((item) => item.referenceIds.length).length} with protected identity sources · {project.production.characters.reduce((sum, item) => sum + item.states.length, 0)} stored Story states</p></div><button className="button secondary" disabled={busy} onClick={() => void onAction("analyze_characters")}><RefreshCw size={14} />Reconcile Story</button><button className="button primary" disabled={busy} onClick={() => void onAction("approve_characters")}><Check size={14} />Approve Analysis</button></section>
      <div className="character-workspace">
        <aside className="character-registry">{project.production.characters.map((item) => <button className={item.id === character?.id ? "active" : ""} onClick={() => { setSelectedId(item.id); setPending(undefined); }} key={item.id}><span>{pad(item.number)}</span><div><strong>{item.name}</strong><small>{item.id} · {item.category}</small><em>{item.referenceIds.length} refs · {item.states.length} states</em></div><i className={item.status.toLowerCase()}>{item.status}</i></button>)}</aside>
        {character ? <section className="character-inspector">
          <header><div className="character-number">{pad(character.number)}</div><div><span>{character.id} · Story candidate {character.storyCandidateId}</span><h3>{character.name}</h3><p>{character.role} · {character.identitySource.replaceAll("_", " ")} · Version {character.version}</p></div><span className={`approval-pill ${character.status.toLowerCase()}`}>{character.status}</span></header>
          <nav><button className={tab === "identity" ? "active" : ""} onClick={() => setTab("identity")}>Identity</button><button className={tab === "references" ? "active" : ""} onClick={() => setTab("references")}>References & Sheet <em>{references.length}</em></button><button className={tab === "states" ? "active" : ""} onClick={() => setTab("states")}>Character States <em>{character.states.length}</em></button></nav>
          {tab === "identity" ? <div className="character-identity-editor"><div className="character-source-law"><LockKeyhole size={15} /><p><strong>{character.identitySource.replaceAll("_", " ")}</strong><span>{character.referenceIds.length ? "Uploaded originals are the highest-priority identity source. Story and Movie DNA may define period, role, wardrobe, and production context without redesigning the person." : "The identity is Story-defined until an approved reference or generated master is attached."}</span></p></div><div>{identityFields.map(([key, label, value]) => <label className={["personality", "backstory", "goal", "motivation", "conflict", "fear", "description"].includes(key) ? "wide" : ""} key={key}><span>{label}</span>{["personality", "backstory", "goal", "motivation", "conflict", "fear", "description"].includes(key) ? <textarea rows={3} defaultValue={value} onBlur={(event) => { if (event.target.value !== value) void onAction("update_character", { characterId: character.id, [key]: event.target.value }); }} /> : <input defaultValue={value} onBlur={(event) => { if (event.target.value !== value) void onAction("update_character", { characterId: character.id, [key]: event.target.value }); }} />}</label>)}</div><dl><div><dt>Relationships</dt><dd>{character.relationships.join(" · ") || "None defined"}</dd></div><div><dt>Related beats</dt><dd>{character.relatedBeatIds.join(" · ") || "No linked beats"}</dd></div><div><dt>Related sequences</dt><dd>{character.relatedSequenceIds.join(" · ") || "No linked sequences"}</dd></div></dl></div> : null}
          {tab === "references" ? <div className="character-reference-workspace"><div className="character-reference-law"><div><span className="eyebrow">Protected identity sources</span><h3>{references.length ? `${references.length} attached reference${references.length === 1 ? "" : "s"}` : "Upload or generate the identity source"}</h3><p>Original uploads are stored separately and are never overwritten by generated masters or sheet views.</p></div><button className="button secondary" onClick={() => onNavigate("references")}><ImageIcon size={14} />Reference Manager</button></div>{references.length ? <div className="character-reference-strip">{references.map((reference) => <article key={reference.id}><img src={api.mediaUrl(project.id, reference.sourcePath)} alt={`${character.name} reference`} /><div><strong>{reference.label ?? reference.name}</strong><code>{reference.id}</code><small>v{reference.versions.length} · {reference.roles.join(" · ")}</small></div><span>{reference.protected ? "PROTECTED" : reference.source}</span></article>)}</div> : null}<ReferenceImagePicker compact value={pending} onChange={setPending} title={`Upload ${character.name} identity reference`} detail="The original remains separate from every generated sheet." />{pending ? <button className="button primary character-upload-confirm" disabled={busy} onClick={() => void upload()}><UploadCloud size={14} />Attach protected reference</button> : null}<div className="character-sheet-command"><div><span className="eyebrow">Story-required character sheet</span><h3>{sheet ? `${sheet.views.length} planned views · ${sheet.status}` : "Sheet not generated"}</h3><p>Views are selected from character importance, sequence reuse, wardrobe, equipment, and Story actions—never to fill a fixed template.</p></div><button className="button primary" disabled={busy} onClick={() => void onGenerateAsset(character.id, Boolean(asset?.generatedImagePath))}><WandSparkles size={14} />{sheet ? "Regenerate Sheet" : "Generate Character Sheet"}</button>{asset?.generatedImagePath && !["APPROVED", "LOCKED"].includes(asset.approvalState) ? <button className="button secondary" onClick={() => void onAssetState(character.id, "APPROVED")}><Check size={14} />Approve Sheet</button> : null}{asset?.approvalState === "APPROVED" ? <button className="button secondary" onClick={() => void onAssetState(character.id, "LOCKED")}><LockKeyhole size={14} />Lock Identity</button> : null}</div>{sheet ? <div className="character-sheet-grid">{sheet.views.map((view) => <article key={view.id}>{view.imagePath ? <img src={api.mediaUrl(project.id, view.imagePath)} alt={`${character.name} ${view.name}`} /> : <div><ImageIcon size={20} /><span>Awaiting generation</span></div>}<strong>{view.name}</strong><small>{view.status}</small></article>)}</div> : null}</div> : null}
          {tab === "states" ? <div className="character-state-editor"><div className="character-state-heading"><span className="eyebrow">Sequence-linked continuity</span><h3>{character.name} Across the Story</h3><p>Physical, emotional, wardrobe, possession, knowledge, and relationship state all inherit forward unless an approved Story event changes them.</p></div>{character.states.map((state) => <article key={state.id}><header><strong>{state.sequenceId}</strong><span>{state.timeRange}</span><em>{state.locationId}</em></header><div>{([ ["physical", "Physical", state.physical], ["emotional", "Emotional", state.emotional], ["wardrobe", "Wardrobe", state.wardrobe], ["injuries", "Injuries", state.injuries], ["knowledge", "Knowledge", state.knowledge], ["relationshipState", "Relationships", state.relationshipState] ] as const).map(([key, label, value]) => <label key={key}><span>{label}</span><textarea rows={2} defaultValue={value} onBlur={(event) => { if (event.target.value !== value) void onAction("update_character_state", { characterId: character.id, sequenceId: state.sequenceId, [key]: event.target.value }); }} /></label>)}<label><span>Possessions</span><textarea rows={2} defaultValue={state.possessions.join(", ")} onBlur={(event) => { const value = event.target.value.split(",").map((item) => item.trim()).filter(Boolean); if (value.join("|") !== state.possessions.join("|")) void onAction("update_character_state", { characterId: character.id, sequenceId: state.sequenceId, possessions: value }); }} /></label><label><span>Damage</span><textarea rows={2} defaultValue={state.damage.join(", ")} onBlur={(event) => { const value = event.target.value.split(",").map((item) => item.trim()).filter(Boolean); if (value.join("|") !== state.damage.join("|")) void onAction("update_character_state", { characterId: character.id, sequenceId: state.sequenceId, damage: value }); }} /></label></div><footer>Approved Story V{state.sourceStoryVersion} · updated {new Date(state.updatedAt).toLocaleString()}</footer></article>)}</div> : null}
        </section> : null}
      </div>
      <div className="character-actions"><button className="button secondary" onClick={() => onNavigate("references")}><ImageIcon size={14} />Open Reference Manager</button><p>Reference sources and sheet outputs remain linked to the same permanent character ID.</p><button className="button primary" disabled={busy} onClick={() => void onAction("approve_characters")}><Check size={14} />Approve Character Analysis</button></div>
    </>}
  </PageShell>;
}

function AssetManifest({ project, busy, onAction, onNavigate }: Props) {
  const characterGate = project.production.gates.find((item) => item.stage === "characters")?.status;
  const [editing, setEditing] = useState<string>();
  return <PageShell project={project} eyebrow="Stage 06 · Complete production inventory" title="Numbered Asset Manifest" detail="Every story dependency receives a permanent ID, category, continuity notes, sequence use, references, version, and approval state.">
    {characterGate !== "APPROVED" ? <GateBlock title="Approve Character Analysis first" detail="The manifest begins with permanent numbered character identities." action="Open Characters" onClick={() => onNavigate("characters")} /> : !project.production.assets.length ? <GateBlock icon={<Library size={22} />} title="Build the complete manifest" detail="The agent will identify characters, locations, costumes, props, environment, VFX, and audio dependencies." action="Build Asset Manifest" disabled={busy} onClick={() => void onAction("build_assets")} /> : <>
      <div className="manifest-command"><div><strong>{project.production.assets.length} production assets</strong><span>{new Set(project.production.assets.map((asset) => asset.category)).size} categories · no version is destroyed</span></div><button className="button secondary" onClick={() => onNavigate("assets")}><ImageIcon size={14} />Open image Asset Library</button><button className="button primary" disabled={busy} onClick={() => void onAction("approve_assets")}><Check size={14} />Approve Assets & Sheets</button></div>
      <div className="manifest-table"><div className="manifest-row header"><span># / ID</span><span>Asset</span><span>Description & continuity</span><span>References</span><span>Version</span><span>Status</span></div>{project.production.assets.map((asset) => <div className="manifest-row" key={asset.id}><span><strong>{pad(asset.number)}</strong><code>{asset.id}</code><small>{asset.filename}</small></span><span><small>{asset.category}</small><strong>{asset.name}</strong></span><span>{editing === asset.id ? <textarea autoFocus defaultValue={asset.description} onBlur={(event) => { setEditing(undefined); if (event.target.value !== asset.description) void onAction("update_asset", { assetId: asset.id, description: event.target.value }); }} /> : <button className="text-edit" onClick={() => setEditing(asset.id)}>{asset.description}</button>}<small>{asset.continuityNotes[0]}</small></span><span>{asset.referenceIds.length || "—"}</span><span>v{asset.version}<small>{asset.previousVersions.length} preserved</small></span><span><select value={asset.status} onChange={(event) => void onAction("update_asset", { assetId: asset.id, status: event.target.value })}><option>REVIEW</option><option>APPROVED</option><option>LOCKED</option><option>REGENERATE</option><option>REJECTED</option></select></span></div>)}</div>
    </>}
  </PageShell>;
}

type FullScriptView = "screenplay" | "sequence" | "scene" | "dialogue" | "shot" | "production";

function FullScriptStudio({ project, busy, onAction, onNavigate }: Props) {
  const script = project.memory.productionMemory.script;
  const [view, setView] = useState<FullScriptView>("screenplay");
  const [selectedId, setSelectedId] = useState(script.sequences[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [readingMode, setReadingMode] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [saveState, setSaveState] = useState<"SAVED" | "SAVING" | "UNSAVED CHANGES" | "SAVE FAILED">("SAVED");
  useEffect(() => {
    if (!script.sequences.some((sequence) => sequence.id === selectedId)) setSelectedId(script.sequences[0]?.id ?? "");
  }, [script.sequences, selectedId]);
  const selected = script.sequences.find((sequence) => sequence.id === selectedId) ?? script.sequences[0];
  const scenes = selected ? script.scenes.filter((scene) => scene.sequenceId === selected.id) : [];
  const currentScene = scenes[0];
  const dialogue = selected ? script.dialogue.filter((line) => line.sequenceId === selected.id) : [];
  const shots = selected ? script.shots.filter((shot) => shot.sequenceId === selected.id).sort((a, b) => a.number - b.number) : [];
  const lockedDialogue = script.dialogue.filter((line) => line.lockState === "LOCKED").length;
  const openWarnings = project.memory.productionMemory.continuity.warnings.filter((warning) => warning.status === "OPEN" && (!selected || warning.currentSequenceId === selected.id));
  const unresolvedWarnings = openWarnings.filter((warning) => !script.continuityDecisions.some((decision) => decision.warningId === warning.id));
  const query = search.trim().toLowerCase();
  const visibleSequences = script.sequences.filter((sequence) => {
    if (statusFilter !== "ALL" && sequence.status !== statusFilter) return false;
    if (!query) return true;
    const relatedScenes = script.scenes.filter((scene) => scene.sequenceId === sequence.id);
    const relatedDialogue = script.dialogue.filter((line) => line.sequenceId === sequence.id);
    return [sequence.id, sequence.title, sequence.storyPurpose, sequence.storyBeat, ...relatedScenes.flatMap((scene) => [scene.heading, scene.action]), ...relatedDialogue.map((line) => line.exactDialogue)].join(" ").toLowerCase().includes(query);
  });
  const sourceReady = Boolean(project.production.story.approvedVersion)
    && Boolean(project.production.filmBible.approvedVersion)
    && project.production.movieDna.status === "LOCKED"
    && project.memory.productionMemory.storyTimeline.events.length > 0;
  const confirmImpact = async (sourceType: "script" | "dialogue", sourceId: string, label: string) => {
    const impact = await api.changeImpact(project.id, sourceType, sourceId);
    return !impact.requiresReview || window.confirm(`${label}\n\n${impact.summary}\n\nApproved and locked records stay protected. Continue?`);
  };
  const save = async (work: () => Promise<void>) => {
    setSaveState("SAVING");
    try { await work(); setSaveState("SAVED"); }
    catch (error) { setSaveState("SAVE FAILED"); throw error; }
  };
  const editScene = async () => {
    if (!currentScene || !selected) return;
    const action = window.prompt("Edit scene action. Exact locked dialogue is stored separately and will not be changed.", currentScene.action);
    if (action === null || action === currentScene.action) return;
    setSaveState("UNSAVED CHANGES");
    if (await confirmImpact("script", selected.id, "Update this scene?")) await save(() => onAction("update_script_scene", { sceneId: currentScene.id, changes: { action }, reason: "Manual scoped scene action edit.", confirmedImpact: true }));
  };
  const editDialogue = async (line: ScriptDialogueLine) => {
    if (line.lockState === "LOCKED") return;
    const exactDialogue = window.prompt("Edit the exact dialogue words", line.exactDialogue);
    if (exactDialogue === null || exactDialogue === line.exactDialogue) return;
    const language = window.prompt("Dialogue language", line.language) ?? line.language;
    const accent = window.prompt("Accent", line.accent) ?? line.accent;
    const emotion = window.prompt("Emotion", line.emotion) ?? line.emotion;
    const delivery = window.prompt("Delivery", line.delivery) ?? line.delivery;
    const pronunciation = (window.prompt("Pronunciation rules, comma-separated", line.pronunciation.join(", ")) ?? line.pronunciation.join(", ")).split(",").map((value) => value.trim()).filter(Boolean);
    const volume = window.prompt("Volume", line.volume) ?? line.volume;
    setSaveState("UNSAVED CHANGES");
    if (await confirmImpact("dialogue", line.sequenceId, "Update this dialogue line?")) await save(() => onAction("update_dialogue", { dialogueId: line.id, changes: { exactDialogue, language, accent, emotion, delivery, pronunciation, volume }, reason: "Manual structured dialogue edit.", confirmedImpact: true }));
  };
  const rewriteDialogue = async (line: ScriptDialogueLine) => {
    if (line.lockState === "LOCKED") return;
    const rewriteInstruction = window.prompt("How should Studio Intelligence rewrite only this dialogue line?", "Shorten this dialogue while preserving its meaning.");
    if (!rewriteInstruction?.trim()) return;
    await onAction("propose_dialogue_change", { dialogueId: line.id, instruction: rewriteInstruction.trim() });
  };
  const editDialogueTiming = async (line: ScriptDialogueLine) => {
    if (line.lockState === "LOCKED") return;
    const start = Number(window.prompt("Dialogue start in sequence seconds", String(line.timing.startSeconds)));
    const end = Number(window.prompt("Dialogue end in sequence seconds", String(line.timing.endSeconds)));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    setSaveState("UNSAVED CHANGES");
    if (await confirmImpact("dialogue", line.sequenceId, "Update dialogue timing?")) await save(() => onAction("update_dialogue", { dialogueId: line.id, changes: { timing: { startSeconds: start, endSeconds: end, label: "" } }, reason: "Manual dialogue timing edit.", confirmedImpact: true }));
  };
  const addDialogue = async () => {
    if (!selected || !currentScene) return;
    const speakerCharacterId = window.prompt("Speaker character ID", selected.characterIds[0] ?? project.production.characters[0]?.id ?? "");
    if (!speakerCharacterId) return;
    const exactDialogue = window.prompt("Exact dialogue words");
    if (!exactDialogue) return;
    await save(() => onAction("add_dialogue", { sequenceId: selected.id, speakerCharacterId, exactDialogue, language: project.dialogueLanguage, accent: "Use permanent voice profile", emotion: selected.emotion, delivery: "Natural performance matched to the approved character state", pronunciation: [], volume: "Scene-appropriate", timing: { startSeconds: 1, endSeconds: Math.min(selected.durationSeconds, 6), label: "" } }));
  };
  const updateShot = async (shot: ScriptShot) => {
    const durationSeconds = Number(window.prompt("Shot duration in seconds", String(shot.durationSeconds)));
    if (!Number.isInteger(durationSeconds) || durationSeconds <= 0 || durationSeconds === shot.durationSeconds) return;
    if (await confirmImpact("script", shot.sequenceId, "Change this shot duration?")) await save(() => onAction("update_shot", { shotId: shot.id, changes: { durationSeconds }, reason: "Manual shot timing edit.", confirmedImpact: true }));
  };
  const editShotCamera = async (shot: ScriptShot) => {
    const shotType = window.prompt("Shot type (Establishing, Extreme Wide, Wide, Medium Wide, Medium, Medium Close Up, Close Up, Extreme Close Up, Over Shoulder, Two Shot, Group Shot, POV, Reaction, Insert, Macro, Tracking, Dolly, Crane, Low Angle, High Angle, Dutch Angle, Top Down, Aerial, Drone, Custom)", shot.shotType);
    if (shotType === null) return;
    const framing = window.prompt("Framing", shot.framing);
    if (framing === null) return;
    const cameraMovement = window.prompt("Camera movement (Static, Push In, Pull Out, Dolly, Tracking, Orbit, Crane, Handheld, Steadicam, Gimbal, Pan, Tilt, Dolly Zoom, Rack Focus, Custom)", shot.cameraMovement);
    if (cameraMovement === null) return;
    const lens = window.prompt("Lens", shot.lens);
    if (lens === null) return;
    const focalLength = window.prompt("Focal length", shot.focalLength);
    if (focalLength === null) return;
    const depthOfField = window.prompt("Depth of field", shot.depthOfField);
    if (depthOfField === null || (shotType === shot.shotType && framing === shot.framing && lens === shot.lens && focalLength === shot.focalLength && depthOfField === shot.depthOfField && cameraMovement === shot.cameraMovement)) return;
    if (await confirmImpact("script", shot.sequenceId, "Change this shot camera setup?")) await save(() => onAction("update_shot", { shotId: shot.id, changes: { shotType, framing, cameraMovement, lens, focalLength, depthOfField }, reason: "Manual structured shot camera edit.", confirmedImpact: true }));
  };
  const moveShot = (shot: ScriptShot, direction: -1 | 1) => {
    if (!selected) return;
    const index = shots.findIndex((item) => item.id === shot.id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= shots.length) return;
    const orderedShotIds = shots.map((item) => item.id);
    [orderedShotIds[index], orderedShotIds[next]] = [orderedShotIds[next]!, orderedShotIds[index]!];
    void onAction("reorder_shots", { sequenceId: selected.id, orderedShotIds });
  };
  const screenplayPage = (sequence: ScriptProductionSequence) => {
    const scene = script.scenes.find((item) => item.sequenceId === sequence.id);
    if (!scene) return null;
    const lines = script.dialogue.filter((line) => line.sequenceId === sequence.id);
    return <article className="screenplay-page" key={sequence.id}><div className="screenplay-meta"><span>{sequence.id} · SCENE {pad(scene.number)} · {sequence.timeRange}</span><code>{scene.id}</code></div><h2>{scene.heading}</h2><p className="screenplay-action">{scene.action}</p>{lines.map((line) => <div className="screenplay-dialogue" key={line.id}><button className="script-character-link" onClick={() => onNavigate("characters")}>{project.production.characters.find((character) => character.id === line.speakerCharacterId)?.name ?? line.speakerCharacterId}</button><small>({line.emotion} · {line.delivery})</small><p>{line.exactDialogue}</p>{line.lockState === "LOCKED" ? <em><LockKeyhole size={10} />EXACT WORDS LOCKED</em> : null}</div>)}<footer><span>IMPORTANT SOUND / PERFORMANCE</span>{scene.importantSound.map((sound) => <p key={sound}>{sound}</p>)}{scene.performanceNotes.map((note) => <p key={note}>{note}</p>)}<strong>{scene.transition}</strong></footer></article>;
  };
  const selectedCharacters = selected ? selected.characterIds.map((id) => project.production.characters.find((character) => character.id === id)).filter(Boolean) : [];
  const selectedAssets = selected ? selected.assetRequirements.map((requirement) => project.production.assets.find((asset) => asset.id === requirement.assetId)).filter(Boolean) : [];
  const screenplayText = selected ? [currentScene?.heading, currentScene?.action, ...dialogue.map((line) => `${project.production.characters.find((character) => character.id === line.speakerCharacterId)?.name ?? line.speakerCharacterId}\n${line.exactDialogue}`)].filter(Boolean).join("\n\n") : "";
  const views: Array<{ id: FullScriptView; label: string }> = [
    { id: "screenplay", label: "Full Screenplay" }, { id: "sequence", label: "By Sequence" }, { id: "scene", label: "By Scene" },
    { id: "dialogue", label: "Dialogue Only" }, { id: "shot", label: "Shot Script" }, { id: "production", label: "Production Script" },
  ];
  if (readingMode) return <div className="script-reading-mode"><header><div><span>FULL SCRIPT V{pad(script.scriptVersion)}</span><strong>{project.title}</strong></div><button className="button secondary" onClick={() => setReadingMode(false)}><X size={13} />Exit Reading Mode</button></header><main>{script.sequences.map((sequence) => { const scene = script.scenes.find((item) => item.sequenceId === sequence.id); const lines = script.dialogue.filter((line) => line.sequenceId === sequence.id); return <article key={sequence.id}><code>{sequence.id} · {sequence.timeRange}</code><h2>{scene?.heading}</h2><p>{scene?.action}</p>{lines.map((line) => <blockquote key={line.id}><strong>{project.production.characters.find((character) => character.id === line.speakerCharacterId)?.name ?? line.speakerCharacterId}</strong><span>{line.exactDialogue}</span></blockquote>)}</article>; })}</main></div>;
  return <PageShell project={project} eyebrow="Production writing · Script State" title="Full Script v2" detail="One persistent screenplay source for exact dialogue, production shots, sequence states, continuity decisions, and non-destructive versions.">
    {!sourceReady ? <GateBlock icon={<FileText size={22} />} title="Complete the approved production-memory sources first" detail="Full Script v2 requires approved Story, approved Film Bible, locked Movie DNA, and the production-memory timeline." action="Open Story Timeline" onClick={() => onNavigate("timeline")} /> : script.scriptVersion === 0 || script.status === "EMPTY" ? <GateBlock icon={<Sparkles size={22} />} title="Generate Full Script v2" detail={`Create ${project.sequenceCount} formally timed sequences from the approved story contract. Dialogue, shots, assets, continuity, and audio will remain structured and editable.`} action="Generate Full Script" disabled={busy} onClick={() => void onAction("generate_script")} /> : <>
      <section className="script-command-deck"><div><span className="eyebrow">Canonical production writing</span><h3>Full Script V{pad(script.scriptVersion)}</h3><p>Story V{script.storyVersion} · Bible V{script.filmBibleVersion} · DNA V{script.movieDnaVersion} · Continuity V{script.continuityVersion} · Audio V{script.audioBibleVersion}</p></div><dl><div><dt>Status</dt><dd className={script.status.toLowerCase()}>{script.status}</dd></div><div><dt>Scenes</dt><dd>{script.scenes.length}</dd></div><div><dt>Dialogue</dt><dd>{script.dialogue.length} · {lockedDialogue} locked</dd></div><div><dt>Shots</dt><dd>{script.shots.length}</dd></div><div><dt>Sequences</dt><dd>{script.sequences.length} / {project.sequenceCount}</dd></div></dl><div className="script-command-actions"><span className={`script-save-state ${saveState.toLowerCase().replaceAll(" ", "-")}`}><Save size={11} />{saveState}</span><button className="button secondary" onClick={() => setReadingMode(true)}><Eye size={13} />Reading Mode</button><button className="button secondary" disabled={busy} onClick={() => void save(() => onAction("regenerate_script", { reason: "User requested a protected new Full Script v2 draft." }))}><RefreshCw size={13} />New Version</button>{script.status === "APPROVED" ? <button className="button primary" disabled={busy} onClick={() => void save(() => onAction("lock_script"))}><LockKeyhole size={13} />Lock Script</button> : script.status === "LOCKED" ? <span className="script-locked-badge"><ShieldCheck size={13} />SCRIPT LOCKED</span> : <button className="button primary" disabled={busy} onClick={() => void save(() => onAction("approve_script"))}><Check size={13} />Approve V{pad(script.scriptVersion)}</button>}</div></section>
      <div className="script-view-controls"><nav>{views.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>{item.label}</button>)}</nav><label><Search size={12} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search script…" /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>ALL</option><option>SCRIPTED</option><option>READY</option><option>BLOCKED</option><option>APPROVED</option><option>LOCKED</option></select></div>
      <div className="full-script-workspace">
        <aside className="script-sequence-rail"><header><span className="eyebrow">Sequence navigation</span><strong>{visibleSequences.length} of {script.sequences.length}</strong></header>{visibleSequences.map((sequence) => <button key={sequence.id} className={selected?.id === sequence.id ? "selected" : ""} onClick={() => setSelectedId(sequence.id)}><code>{pad(sequence.number)}</code><span><strong>{sequence.title}</strong><small>{sequence.timeRange} · {sequence.durationSeconds}s</small></span><em className={sequence.status.toLowerCase()}>{sequence.status}</em>{sequence.warnings.length ? <i>{sequence.warnings.length}</i> : null}</button>)}</aside>
        <main className="script-document-panel">
          {selected ? <><header className="script-document-header"><div><span>{selected.id} · {selected.timeRange} · {selected.durationSeconds}s</span><h3>{selected.title}</h3><p>{selected.storyPurpose}</p></div><div><button onClick={() => void navigator.clipboard.writeText(screenplayText)}><Copy size={12} />Copy</button>{currentScene && !["dialogue", "shot"].includes(view) ? <button onClick={() => void editScene()}><Pencil size={12} />Edit scene</button> : null}</div></header>
            {view === "screenplay" ? <section className="full-screenplay-stack" data-script-view="full-screenplay">{script.sequences.map(screenplayPage)}</section> : null}
            {(["sequence", "scene", "production"] as FullScriptView[]).includes(view) && selected ? screenplayPage(selected) : null}
            {view === "sequence" ? <section className="script-sequence-contract"><div><span>STORY BEAT</span><p>{selected.storyBeat}</p></div><div><span>CONFLICT / EMOTION</span><p>{selected.conflict} · {selected.emotion}</p></div><div><span>START STATE</span><p>{selected.startState}</p></div><div><span>MID STATE</span><p>{selected.midState}</p></div><div><span>END STATE → NEXT</span><p>{selected.endState}</p></div><div><span>ASSET DEPENDENCIES</span><p>{selected.assetRequirements.map((item) => `${item.assetId}${item.resolved ? " ✓" : " MISSING"}`).join(" · ") || "None"}</p></div></section> : null}
            {view === "dialogue" ? <section className="script-dialogue-list"><header><div><span className="eyebrow">Dialogue Lock</span><h3>{dialogue.length} exact lines</h3></div><button className="button secondary" disabled={busy || !project.dialogueEnabled} onClick={() => void addDialogue()}><Plus size={12} />Add line</button></header>{project.dialogueEnabled ? dialogue.map((line) => <article key={line.id} className={line.lockState === "LOCKED" ? "locked" : ""}><header><code>{line.id}</code><button className="script-character-link" onClick={() => onNavigate("characters")}>{project.production.characters.find((character) => character.id === line.speakerCharacterId)?.name ?? line.speakerCharacterId}</button><span>{line.timing.label}</span></header><blockquote>{line.exactDialogue}</blockquote><dl><dt>Voice</dt><dd>{line.audioVoiceProfileId ?? "Permanent profile required"}</dd><dt>Performance</dt><dd>{line.emotion} · {line.delivery} · {line.volume}</dd><dt>Language</dt><dd>{line.language} · {line.accent}</dd><dt>Pronunciation</dt><dd>{line.pronunciation.join(" · ") || "Permanent voice profile rules"}</dd></dl>{line.timingWarning ? <p className="script-inline-warning"><TriangleAlert size={11} />{line.timingWarning}</p> : null}<footer><button onClick={() => void editDialogue(line)} disabled={line.lockState === "LOCKED"}><Pencil size={11} />Edit Dialogue</button><button onClick={() => void rewriteDialogue(line)} disabled={line.lockState === "LOCKED"}><Sparkles size={11} />AI Rewrite</button><button onClick={() => void editDialogueTiming(line)} disabled={line.lockState === "LOCKED"}><Clock3 size={11} />Timing</button>{line.approvalState !== "APPROVED" ? <button onClick={() => void save(() => onAction("approve_dialogue", { dialogueId: line.id }))}><Check size={11} />Approve</button> : null}{line.lockState === "LOCKED" ? <button onClick={() => void save(() => onAction("unlock_dialogue", { dialogueId: line.id }))}><LockKeyhole size={11} />Unlock</button> : <button onClick={() => void save(() => onAction("lock_dialogue", { dialogueId: line.id }))}><LockKeyhole size={11} />Lock exact words</button>}<button disabled={line.lockState === "LOCKED"} onClick={() => void save(() => onAction("delete_dialogue", { dialogueId: line.id }))}><Trash2 size={11} /></button></footer></article>) : <div className="script-track-disabled"><Volume2 size={20} /><strong>Dialogue track disabled</strong><p>No spoken dialogue will be invented. Re-enable it in Project Setup or Audio Bible.</p></div>}</section> : null}
            {(["shot", "production"] as FullScriptView[]).includes(view) ? <section className="script-shot-planner"><header><div><span className="eyebrow">Production shot planner</span><h3>{shots.length} shots · {shots.reduce((sum, shot) => sum + shot.durationSeconds, 0)} / {selected.durationSeconds}s</h3></div><button className="button secondary" onClick={() => void save(() => onAction("add_shot", { sequenceId: selected.id, afterIndex: shots.length - 1, shotType: "Custom", storyPurpose: "User-added production coverage", subjectAction: currentScene?.action ?? selected.storyPurpose }))}><Plus size={12} />Add shot</button></header>{shots.map((shot, index) => <article key={shot.id}><div className="shot-number"><strong>{pad(shot.number)}</strong><small>{formatStoryTime(shot.startSeconds)}–{formatStoryTime(shot.endSeconds)}</small><em>{shot.durationSeconds}s</em></div><div className="shot-body"><header><strong>{shot.shotType} · {shot.framing}</strong><code>{shot.lens} · {shot.focalLength} · {shot.cameraMovement}</code></header><p>{shot.subjectAction}</p><dl><dt>State</dt><dd>{shot.startVisualState} → {shot.endVisualState}</dd><dt>Purpose</dt><dd>{shot.storyPurpose}</dd><dt>Continuity</dt><dd>{shot.continuityPurpose}<br />Position: {shot.continuityState.characterPosition}<br />Facing: {shot.continuityState.characterFacing} · Screen: {shot.continuityState.screenDirection}<br />Props: {shot.continuityState.props}<br />Costume / injury: {shot.continuityState.costume} · {shot.continuityState.injury}</dd><dt>Audio</dt><dd>{shot.sound}</dd><dt>Assets</dt><dd>{shot.assetIds.join(" · ") || "None"}</dd></dl></div><div className="shot-actions"><button disabled={index === 0} onClick={() => moveShot(shot, -1)}><ChevronUp size={11} /></button><button disabled={index === shots.length - 1} onClick={() => moveShot(shot, 1)}><ChevronDown size={11} /></button><button title="Edit duration" onClick={() => void updateShot(shot)}><Clock3 size={11} /></button><button title="Edit camera, framing, movement and lens" onClick={() => void editShotCamera(shot)}><Pencil size={11} /></button><button title="Duplicate shot" onClick={() => void save(() => onAction("duplicate_shot", { shotId: shot.id }))}><Copy size={11} /></button><button title="Delete shot" disabled={shots.length <= 1} onClick={() => void save(() => onAction("delete_shot", { shotId: shot.id }))}><Trash2 size={11} /></button></div></article>)}</section> : null}
            {view === "production" ? <section className="script-production-data" data-script-view="production"><header><span className="eyebrow">Complete production record</span><strong>{selected.id} · source Script V{selected.sourceScriptVersion}</strong></header><div><article><span>Story / performance</span><dl><dt>Purpose</dt><dd>{selected.storyPurpose}</dd><dt>Beat</dt><dd>{selected.storyBeat}</dd><dt>Conflict</dt><dd>{selected.conflict}</dd><dt>Emotion</dt><dd>{selected.emotion}</dd><dt>Action / body movement</dt><dd>{selected.actions.join(" ")}</dd></dl></article><article><span>Characters / states</span><div className="production-link-list">{selectedCharacters.map((character) => <button key={character!.id} onClick={() => onNavigate("characters")}><strong>{character!.name}</strong><code>{character!.id}</code><small>{character!.motivation} · {character!.relationships.join(", ")}</small></button>)}</div><p>{selected.characterStateIds.join(" · ") || "No linked Character State"}</p></article><article><span>Location / environment</span><button className="production-record-link" onClick={() => onNavigate("asset_manifest")}>{selected.locationId}</button><p>{currentScene?.timeOfDay} · {project.memory.productionMemory.continuity.currentGlobal.weather}</p><small>{shots[0]?.continuityState.environment}</small></article><article><span>Camera / lighting</span><p>{shots.map((shot) => `${pad(shot.number)} ${shot.shotType}, ${shot.framing}, ${shot.cameraAngle}, ${shot.lens}, ${shot.focalLength}, ${shot.depthOfField}, ${shot.cameraMovement}`).join(" · ")}</p><small>{[...new Set(shots.map((shot) => shot.lighting))].join(" · ")}</small></article><article><span>Audio / narration / music</span>{selected.audioRequirements.map((rule) => <p key={rule}>{rule}</p>)}</article><article><span>Required production assets</span><div className="production-link-list">{selectedAssets.map((asset) => <button key={asset!.id} onClick={() => onNavigate("asset_manifest")}><strong>{asset!.name}</strong><code>{asset!.id}</code><small>{asset!.category} · {asset!.status}</small></button>)}</div></article><article className="wide"><span>Start / Mid / End continuity</span><p><strong>START</strong> {selected.startState}</p><p><strong>MID</strong> {selected.midState}</p><p><strong>END</strong> {selected.endState}</p></article><article className="wide"><span>Continuity / negative production rules</span>{selected.continuityRequirements.map((rule) => <p key={rule}>{rule}</p>)}{selected.negativeRules.map((rule) => <small key={rule}>{rule}</small>)}</article></div></section> : null}
          </> : <div className="stage-placeholder"><Search size={23} /><p>No sequence matches the current filter.</p></div>}
        </main>
        <aside className="script-control-panel"><section><span className="eyebrow">AI Modify · selected scope only</span><textarea id="script-ai-instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} rows={4} placeholder="Example: increase tension without changing locked dialogue…" /><button className="button primary full-width" disabled={busy || !selected || instruction.trim().length < 3} onClick={() => void onAction("propose_script_change", { sequenceId: selected?.id, instruction })}><Sparkles size={12} />Analyze Change</button></section>{script.pendingProposal ? <section className="script-change-proposal"><span>PROPOSED · VARIANT {script.pendingProposal.variant}</span><label>CURRENT SECTION</label><p>{script.pendingProposal.currentSection}</p><label>PROPOSED SECTION</label><p>{script.pendingProposal.proposedSection}</p><dl><dt>Dialogue</dt><dd>{script.pendingProposal.preservesLockedDialogue ? `Locked words preserved · ${script.pendingProposal.affectedDialogueIds.length} reviewed` : `${script.pendingProposal.affectedDialogueIds.length} affected`}</dd><dt>Shots</dt><dd>{script.pendingProposal.affectedShotIds.length}</dd><dt>Sequences</dt><dd>{script.pendingProposal.affectedSequenceIds.join(" · ")}</dd><dt>Assets</dt><dd>{script.pendingProposal.affectedAssetIds.length}</dd><dt>Continuity</dt><dd>{script.pendingProposal.affectedContinuityIds.length}</dd></dl><div><button onClick={() => void onAction("reject_script_change")}><X size={11} />Reject</button><button onClick={() => void onAction("regenerate_script_change", { instruction: script.pendingProposal?.instruction })}><RefreshCw size={11} />Regenerate</button><button onClick={() => void save(() => onAction("apply_script_change", { confirmedImpact: true }))}><Check size={11} />Accept</button></div></section> : null}
          <section className="script-dialogue-summary"><div><LockKeyhole size={15} /><strong>Dialogue Lock</strong><em>{lockedDialogue} / {script.dialogue.length}</em></div><p>Approved words can be locked independently. Camera, action, timing, or continuity edits never silently rewrite them.</p><button onClick={() => setView("dialogue")}>Open dialogue control</button></section>
          <section className="script-warning-panel"><header><TriangleAlert size={14} /><strong>Continuity & readiness</strong><em>{unresolvedWarnings.length + (selected?.warnings.length ?? 0)}</em></header>{selected?.warnings.slice(0, 8).map((warning) => <p key={warning}>{warning}</p>)}{(selected?.warnings.length ?? 0) > 8 ? <p className="script-more-warnings">+ {selected!.warnings.length - 8} more · resolve them in Asset Manifest or Continuity</p> : null}{unresolvedWarnings.slice(0, 4).map((warning) => <article key={warning.id}><strong>{warning.code} · {warning.field}</strong><p>Expected: {warning.expected}</p><p>Conflicting: {warning.conflicting}</p><small>Source: {warning.sourceSequenceId}</small><div><button onClick={() => void onAction("resolve_script_continuity", { warningId: warning.id, action: "FIX_SCRIPT" })}>Fix Script</button><button onClick={() => { const note = window.prompt("Why is this intentional?"); if (note) void onAction("resolve_script_continuity", { warningId: warning.id, action: "ACCEPT_INTENTIONAL_CHANGE", note }); }}>Accept change</button></div></article>)}{!selected?.warnings.length && !unresolvedWarnings.length ? <p className="script-all-clear"><Check size={11} />No open issue in this sequence.</p> : null}</section>
          <section className="script-export-panel"><span className="eyebrow">Script exports</span>{(["full", "production", "dialogue", "shots", "sequences", "json"] as const).map((format) => <button key={format} onClick={() => window.location.assign(api.scriptExportUrl(project.id, format))}><Download size={11} />{format.replaceAll("_", " ")}</button>)}</section>
          <section className="script-version-panel"><span className="eyebrow">Protected version history</span>{[...script.versions].reverse().map((version) => <div key={version.version}><strong>V{pad(version.version)}</strong><span>{version.status}</span><em>{version.locked ? "LOCKED" : version.approved ? "APPROVED" : "PRESERVED"}</em></div>)}</section>
        </aside>
      </div>
    </>}
  </PageShell>;
}

function SequenceStudio({ project, busy, onAction, onNavigate }: Props) {
  const script = project.memory.productionMemory.script;
  const [selectedId, setSelectedId] = useState(script.sequences[0]?.id ?? "");
  const [workspaceSequenceId, setWorkspaceSequenceId] = useState<string | undefined>(() => script.sequences.some((sequence) => sequence.id === project.production.promptWorkspace.activeSequenceId) ? project.production.promptWorkspace.activeSequenceId : undefined);
  useEffect(() => { if (!script.sequences.some((sequence) => sequence.id === selectedId)) setSelectedId(script.sequences[0]?.id ?? ""); }, [script.sequences, selectedId]);
  const selected = script.sequences.find((sequence) => sequence.id === selectedId) ?? script.sequences[0];
  const shots = selected ? script.shots.filter((shot) => shot.sequenceId === selected.id).sort((a, b) => a.number - b.number) : [];
  const dialogue = selected ? script.dialogue.filter((line) => line.sequenceId === selected.id) : [];
  const missing = selected?.assetRequirements.filter((requirement) => requirement.required && !requirement.resolved) ?? [];
  if (workspaceSequenceId) return <SequenceWorkspaceView project={project} initialSequenceId={workspaceSequenceId} busy={busy} onAction={onAction} onSequenceChange={setWorkspaceSequenceId} onBack={() => setWorkspaceSequenceId(undefined)} onClose={() => setWorkspaceSequenceId(undefined)} />;
  return <PageShell project={project} eyebrow="Production planning · Formal sequence contract" title="Sequence Planner" detail="Exact Project Setup ranges, story purpose, character states, assets, continuity, audio, dialogue, shots, and the approved Sequence Workspace v3 prompt pipeline.">
    {!script.scriptVersion ? <GateBlock icon={<Film size={22} />} title="Generate Full Script v2 first" detail="Formal sequence plans are derived from the same persistent Script State, not from a separate generic planner." action="Open Full Script" onClick={() => onNavigate("full_script")} /> : !script.sequences.length ? <GateBlock icon={<Film size={22} />} title={`Build ${project.sequenceCount} formal sequence plans`} detail="The planner uses the approved screenplay, exact runtime, sequence duration, assets, continuity, and audio memory." action="Plan Sequences" disabled={busy} onClick={() => void onAction("plan_sequences")} /> : <div className="formal-sequence-layout">
      <aside className="formal-sequence-rail"><header><span className="eyebrow">Project Setup authority</span><strong>{script.sequences.length} / {project.sequenceCount} sequences</strong><small>{project.runtimeMinutes} min · {project.sequenceDurationSeconds}s target</small></header>{script.sequences.map((sequence) => <button className={selected?.id === sequence.id ? "selected" : ""} onClick={() => setSelectedId(sequence.id)} key={sequence.id}><code>{pad(sequence.number)}</code><span><strong>{sequence.title}</strong><small>{sequence.timeRange} · {sequence.durationSeconds}s</small></span><em className={sequence.status.toLowerCase()}>{sequence.status}</em>{sequence.warnings.length ? <i>{sequence.warnings.length}</i> : null}</button>)}</aside>
      {selected ? <section className="formal-sequence-detail"><header className="formal-sequence-title"><div><span className="eyebrow">{selected.id} · {selected.timeRange} · {selected.durationSeconds}s</span><h3>{selected.title}</h3><p>{selected.storyPurpose}</p></div><div className="formal-sequence-approval"><button className="button primary" disabled={busy} onClick={() => setWorkspaceSequenceId(selected.id)}><WandSparkles size={11} />Open Workspace v3</button><span className={`approval-pill ${selected.status.toLowerCase()}`}>{selected.status}</span>{selected.status === "APPROVED" ? <button className="button primary" disabled={busy} onClick={() => void onAction("lock_script_sequence", { sequenceId: selected.id })}><LockKeyhole size={11} />Lock</button> : selected.status === "LOCKED" ? null : <button className="button primary" disabled={busy || selected.status === "BLOCKED"} onClick={() => void onAction("approve_script_sequence", { sequenceId: selected.id })}><Check size={11} />Approve</button>} {!['APPROVED','LOCKED'].includes(selected.status) ? <button className="button secondary" disabled={busy} onClick={() => { const reason = window.prompt("Why is this formal sequence rejected?"); if (reason) void onAction("reject_script_sequence", { sequenceId: selected.id, reason }); }}><X size={11} />Reject</button> : null}</div></header>
        <div className="formal-sequence-summary"><article><span>Story beat</span><p>{selected.storyBeat}</p></article><article><span>Conflict</span><p>{selected.conflict}</p></article><article><span>Emotion</span><p>{selected.emotion}</p></article><article><span>Characters / states</span><p>{selected.characterIds.join(" · ") || "None"}</p><small>{selected.characterStateIds.join(" · ") || "No separate state"}</small></article><article><span>Location</span><p>{selected.locationId}</p></article><article><span>Dialogue / shots</span><p>{dialogue.length} exact lines · {shots.length} shots</p></article></div>
        <div className="state-transfer formal"><article><span>START STATE</span><p>{selected.startState}</p></article><ChevronRight size={18} /><article><span>MID STATE</span><p>{selected.midState}</p></article><ChevronRight size={18} /><article><span>END STATE → {selected.nextSequenceId ?? "END"}</span><p>{selected.endState}</p></article></div>
        <div className="formal-sequence-columns"><section><header><span className="eyebrow">Shot timing contract</span><strong>{shots.reduce((sum, shot) => sum + shot.durationSeconds, 0)} / {selected.durationSeconds}s</strong></header>{shots.map((shot) => <article key={shot.id}><strong>{pad(shot.number)}</strong><div><span>{shot.shotType} · {shot.framing}</span><p>{shot.subjectAction}</p><small>{shot.cameraMovement} · {shot.lens} · {shot.sound}</small></div><em>{shot.durationSeconds}s</em></article>)}</section><section><header><span className="eyebrow">Asset dependencies</span><strong>{selected.assetRequirements.length} required / linked</strong></header>{selected.assetRequirements.map((requirement) => { const asset = project.production.assets.find((item) => item.id === requirement.assetId); return <article className={requirement.resolved ? "resolved" : "missing"} key={requirement.assetId}><div><strong>{asset?.name ?? requirement.assetId}</strong><code>{requirement.assetId}</code><p>{requirement.reason}</p></div><em>{requirement.resolved ? "READY" : "MISSING"}</em></article>; })}{!selected.assetRequirements.length ? <p className="formal-empty">No asset dependency was identified.</p> : null}</section></div>
        <div className="formal-sequence-rules"><article><span>CONTINUITY REQUIREMENTS</span>{selected.continuityRequirements.map((rule) => <p key={rule}>{rule}</p>)}</article><article><span>AUDIO REQUIREMENTS</span>{selected.audioRequirements.map((rule) => <p key={rule}>{rule}</p>)}</article><article><span>NEGATIVE RULES</span>{selected.negativeRules.map((rule) => <p key={rule}>{rule}</p>)}</article></div>
        {selected.warnings.length || missing.length ? <div className="formal-sequence-warnings"><TriangleAlert size={15} /><div><strong>{selected.status === "BLOCKED" ? "Sequence readiness blocked" : "Review sequence warnings"}</strong>{selected.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div><button className="button secondary" onClick={() => onNavigate(missing.length ? "asset_manifest" : "continuity")}>{missing.length ? "Resolve Assets" : "Open Continuity"}</button></div> : <div className="formal-sequence-ready"><Check size={14} /><strong>Formal plan is ready</strong><span>Timing, state, required assets, shots, dialogue, continuity, and audio are linked.</span></div>}
        <footer className="formal-sequence-footer"><button className="button secondary" onClick={() => onNavigate("full_script")}><FileText size={13} />Open Full Script</button><button className="button primary" onClick={() => setWorkspaceSequenceId(selected.id)}><WandSparkles size={13} />Open Sequence Workspace v3</button><span>One shared Prompt State compiles Normal, JSON, platform formatting, and the reference package.</span></footer>
      </section> : null}
    </div>}
  </PageShell>;
}

function PromptStudio({ project, busy, onAction, onNavigate }: Props) {
  const [platform, setPlatform] = useState<TargetPlatform>(project.targetPlatform);
  const [selectedId, setSelectedId] = useState(project.production.sequences[0]?.id);
  const selected = project.production.sequences.find((sequence) => sequence.id === selectedId) ?? project.production.sequences[0];
  return <PageShell project={project} eyebrow="Stage 08 · Platform compiler" title="Platform Prompt Studio" detail="Compile one canonical sequence package into provider-ready prompts with real reference tags and editable sections.">
    {!project.production.sequences.length ? <GateBlock title="Plan sequences first" detail="The compiler needs approved state, shot, asset, and reference data." action="Open Sequences" onClick={() => onNavigate("sequences")} /> : <div className="prompt-production-layout">
      <aside><span className="eyebrow">Target platform</span>{(["Seedance", "Higgsfield", "MiniMax", "Veo", "Kling", "Runway", "Sora", "Custom"] as TargetPlatform[]).map((item) => <button className={platform === item ? "selected" : ""} onClick={() => setPlatform(item)} key={item}><strong>{item}</strong><small>{project.production.platformProfiles[item].model}</small></button>)}<div className="platform-profile-fields"><label>Model<input defaultValue={project.production.platformProfiles[platform].model} key={`${platform}-model`} onBlur={(event) => void onAction("update_platform_profile", { platform, model: event.target.value })} /></label><label>Max seconds<input type="number" defaultValue={project.production.platformProfiles[platform].maxDurationSeconds} key={`${platform}-seconds`} onBlur={(event) => void onAction("update_platform_profile", { platform, maxDurationSeconds: Number(event.target.value) })} /></label><label>Max refs<input type="number" defaultValue={project.production.platformProfiles[platform].maxReferences} key={`${platform}-refs`} onBlur={(event) => void onAction("update_platform_profile", { platform, maxReferences: Number(event.target.value) })} /></label></div><button className="button primary compile-button" disabled={busy} onClick={() => void onAction("compile_prompts", { platform })}><WandSparkles size={14} />Compile all prompts</button><span className="eyebrow sequence-label">Sequence preview</span>{project.production.sequences.map((sequence) => <button className={selected?.id === sequence.id ? "selected sequence" : "sequence"} onClick={() => setSelectedId(sequence.id)} key={sequence.id}><strong>{sequence.id}</strong><small>{sequence.status}</small></button>)}</aside>
      <section>{selected ? <><div className="prompt-preview-header"><div><span className="eyebrow">{platform} preview</span><h3>{selected.id} · {selected.title}</h3></div><button className="button secondary" disabled={!selected.compiledPrompt} onClick={() => void navigator.clipboard.writeText(selected.compiledPrompt)}><ClipboardCopy size={14} />Copy full prompt</button></div>{Object.keys(selected.promptSections).length ? <div className="prompt-section-stack">{Object.entries(selected.promptSections).map(([key, value]) => <article key={key}><span>{key}</span><textarea rows={Math.min(10, Math.max(3, value.split("\n").length + 1))} defaultValue={value} onBlur={(event) => { if (event.target.value !== value) void onAction("update_sequence_prompt", { sequenceId: selected.id, key, value: event.target.value }); }} /></article>)}</div> : <div className="stage-placeholder"><Settings2 size={25} /><p>Choose a platform and compile. The three permanent systems, shot plan, asset dependencies, negative rules, and reference order will be assembled here.</p></div>}<div className="reference-upload-order"><span className="eyebrow">Manual upload order</span>{selected.referenceSlots.map((slot) => <div key={slot.slot}><strong>{slot.slot}</strong><code>{slot.tag}</code><span>{slot.assetId}</span><em>{slot.required ? "REQUIRED" : "OPTIONAL"}</em></div>)}</div></> : null}</section>
    </div>}
  </PageShell>;
}

function StoryTimelineStudio({ project, busy, onAction, onNavigate }: Props) {
  const timeline = project.memory.productionMemory.storyTimeline;
  const [selectedId, setSelectedId] = useState(timeline.events[0]?.id);
  const selected = timeline.events.find((event) => event.id === selectedId) ?? timeline.events[0];
  const ready = timeline.events.length > 0;
  return <PageShell project={project} eyebrow="Production memory · What happened" title="Global Story Timeline" detail="One chronological movie timeline derived from the approved Story and Film Bible, aligned to runtime and sequence duration.">
    {!ready ? <GateBlock icon={<Clock3 size={22} />} title="Build the production-memory layer" detail="The timeline requires an approved Story and Film Bible. It will not generate missing image assets or invent new story events." action="Build Story Timeline, Continuity & Audio" disabled={busy} onClick={() => void onAction("build_production_memory")} /> : <>
      <div className="memory-command-bar"><div><span className="eyebrow">Approved source contract</span><strong>{timeline.events.length} chronological events · {Math.round(timeline.runtimeSeconds / 60)} minute runtime · {timeline.sequenceDurationSeconds}s sequence grid</strong><small>Story V{timeline.sourceStoryVersion} · Film Bible V{timeline.sourceFilmBibleVersion} · Timeline V{timeline.version}</small></div>{timeline.status === "STALE" ? <span className="memory-stale"><TriangleAlert size={13} />UPSTREAM CHANGED</span> : <span className="memory-ready"><Check size={13} />SOURCE ALIGNED</span>}<button className="button secondary" onClick={() => onNavigate("story")}>Review Story</button><button className="button primary" disabled={busy} onClick={() => void onAction("build_production_memory")}><RefreshCw size={13} />Rebuild from approved sources</button></div>
      <div className="story-timeline-layout">
        <aside className="story-time-rail"><div><span className="eyebrow">Movie progress</span><strong>{timeline.events[0]?.movieTime.label.split("–")[0]} → {timeline.events.at(-1)?.movieTime.label.split("–").at(-1)}</strong></div>{timeline.events.map((event) => <button key={event.id} className={selected?.id === event.id ? "selected" : ""} onClick={() => setSelectedId(event.id)}><code>{event.movieTime.label}</code><strong>{event.sequenceId ?? "UNASSIGNED"}</strong><span>{event.scene}</span><small>{event.storyBeat}</small></button>)}</aside>
        <section className="story-event-stream"><div className="section-heading"><div><span className="eyebrow">Beginning to end</span><h3>Chronological event memory</h3></div><span>{timeline.status}</span></div>{timeline.events.map((event) => <button className={selected?.id === event.id ? "selected" : ""} onClick={() => setSelectedId(event.id)} key={event.id}><i /><div><header><code>{event.movieTime.label} · {event.id}</code><span>{event.sequenceId}</span></header><strong>{event.scene}</strong><p>{event.importantActions.join(" · ")}</p><footer><span>{event.locationId}</span><span>{event.timeOfDay}</span><span>{event.weather}</span><span>{event.characterIds.length} characters</span></footer></div></button>)}</section>
        {selected ? <aside className="story-event-inspector"><span className="eyebrow">Selected event</span><h3>{selected.scene}</h3><code>{selected.id} · {selected.movieTime.label}</code><dl><dt>Sequence</dt><dd>{selected.sequenceId ?? "Not assigned"}</dd><dt>Story beat</dt><dd>{selected.storyBeat}</dd><dt>Date / time</dt><dd>{selected.date} · {selected.time} · {selected.timeOfDay}</dd><dt>Weather</dt><dd>{selected.weather}</dd><dt>Location</dt><dd>{selected.locationId}</dd><dt>Lighting</dt><dd>{selected.lightingState}</dd><dt>Characters</dt><dd>{selected.characterIds.join(", ") || "None"}</dd><dt>Character states</dt><dd>{Object.values(selected.characterStateIds).join(", ") || "No separate state required"}</dd><dt>Knowledge</dt><dd>{Object.entries(selected.characterKnowledge).map(([id, values]) => `${id}: ${values.join(", ")}`).join(" · ") || "No new knowledge"}</dd><dt>Relationships</dt><dd>{Object.entries(selected.relationships).map(([id, value]) => `${id}: ${value}`).join(" · ") || "No change"}</dd><dt>Acquired</dt><dd>{selected.objectsAcquired.join(", ") || "None"}</dd><dt>Lost</dt><dd>{selected.objectsLost.join(", ") || "None"}</dd><dt>Props</dt><dd>{selected.propIds.join(", ") || "None"}</dd><dt>Vehicles</dt><dd>{selected.vehicleIds.join(", ") || "None"}</dd><dt>Creatures / animals</dt><dd>{[...selected.creatureIds, ...selected.animalIds].join(", ") || "None"}</dd><dt>Injuries</dt><dd>{Object.entries(selected.injuries).map(([id, values]) => `${id}: ${values.join(", ")}`).join(" · ") || "None"}</dd><dt>Damage</dt><dd>{selected.damage.join(", ") || "None"}</dd><dt>Costume</dt><dd>{Object.entries(selected.costumeChanges).map(([id, value]) => `${id}: ${value}`).join(" · ") || "No change"}</dd><dt>Environment</dt><dd>{selected.environmentChanges.join(", ") || "No change"}</dd><dt>Consequence</dt><dd>{selected.storyConsequence}</dd></dl><div className="memory-source-box"><strong>UPSTREAM REFERENCES</strong><span>Story V{selected.sourceStoryVersion} · Film Bible V{selected.sourceFilmBibleVersion}</span><code>{[...selected.sourceEventIds, ...selected.sourceBeatIds].join(" · ")}</code></div></aside> : null}
      </div>
    </>}
  </PageShell>;
}

const stateTitle = (project: MovieProject, state: ContinuityEntityState) => project.production.characters.find((character) => character.id === state.entityId)?.name ?? project.production.assets.find((asset) => asset.id === state.entityId)?.name ?? state.entityId;
const arrayContinuityFields = new Set(["accessories", "injuries", "equipment", "weapons", "propsCarried", "knowledge", "relationships", "damage", "occupants", "objectsPresent", "environmentChanges"]);

function ContinuityStudio({ project, busy, onAction, onNavigate }: Props) {
  type ContinuityTab = "overview" | "characters" | "props" | "vehicles" | "locations" | "timeline" | "warnings" | "sequence_states" | "history";
  const [tab, setTab] = useState<ContinuityTab>("overview");
  const memory = project.memory.productionMemory;
  const ledger = memory.continuity;
  const orderedSnapshots = [...ledger.snapshots].sort((a, b) => Number(a.sequenceId.match(/(\d+)/)?.[1] ?? 0) - Number(b.sequenceId.match(/(\d+)/)?.[1] ?? 0) || a.anchor.localeCompare(b.anchor) || b.version - a.version);
  const latest = [...orderedSnapshots].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const currentStates = Object.values(ledger.currentByEntity);
  const visibleStates = currentStates.length ? currentStates : latest?.entities ?? [];
  const openWarnings = ledger.warnings.filter((warning) => warning.status === "OPEN");
  const stateForTab = tab === "characters" ? visibleStates.filter((state) => state.entityType === "character") : tab === "props" ? visibleStates.filter((state) => state.entityType === "prop") : tab === "vehicles" ? visibleStates.filter((state) => state.entityType === "vehicle") : tab === "locations" ? visibleStates.filter((state) => state.entityType === "location") : visibleStates;
  const editState = async (state: ContinuityEntityState) => {
    const field = window.prompt("Continuity field to change (for example: clothing, injuries, propsCarried, knowledge, location, screenDirection, ownerId, damage)");
    if (!field || !(field in state)) return;
    const current = (state as unknown as Record<string, unknown>)[field];
    const entered = window.prompt(`New ${field}${arrayContinuityFields.has(field) ? " (comma separated)" : ""}`, Array.isArray(current) ? current.join(", ") : String(current ?? ""));
    if (entered === null) return;
    const value: unknown = arrayContinuityFields.has(field) ? entered.split(",").map((item) => item.trim()).filter(Boolean) : typeof current === "boolean" ? entered.toLowerCase() === "true" : entered;
    const sourceSequence = latest?.sequenceId ?? memory.storyTimeline.events[0]?.sequenceId;
    if (!sourceSequence) return;
    const impact = await api.changeImpact(project.id, "continuity", sourceSequence);
    if (impact.requiresReview && !window.confirm(`${impact.summary}\n\nApply this continuity change after reviewing the affected items?`)) return;
    await onAction("update_continuity", { sequenceId: sourceSequence, anchor: latest?.anchor ?? "START", patches: [{ entityId: state.entityId, entityType: state.entityType, fields: { [field]: value } }], reason: `User updated ${state.entityId}.${field} from the Continuity view.`, confirmedImpact: true });
  };
  const renderEntityCards = (states: ContinuityEntityState[]) => <div className="continuity-entity-grid">{states.map((state) => { const asset = project.production.assets.find((item) => item.id === state.entityId || item.characterId === state.entityId); return <article key={`${state.entityId}-${state.characterStateId ?? "current"}`}><div className="continuity-entity-visual">{asset?.imagePath ? <img src={api.mediaUrl(project.id, asset.imagePath)} alt={stateTitle(project, state)} /> : state.entityType === "vehicle" ? <Car size={24} /> : state.entityType === "location" ? <MapPinned size={24} /> : state.entityType === "prop" ? <Boxes size={24} /> : <Users size={24} />}</div><div><header><code>{state.identityId}</code><span>{state.entityType}</span></header><h3>{stateTitle(project, state)}</h3><dl><dt>Visual state</dt><dd>{state.characterStateId ?? state.condition}</dd><dt>Location</dt><dd>{state.location}</dd>{state.entityType === "character" ? <><dt>Costume</dt><dd>{state.clothing}</dd><dt>Condition</dt><dd>{state.physicalCondition} · {state.dirt} · {state.wetState}</dd><dt>Emotion</dt><dd>{state.emotionalState}</dd><dt>Props</dt><dd>{state.propsCarried.join(", ") || "None"}</dd><dt>Knowledge</dt><dd>{state.knowledge.join(", ") || "No new knowledge"}</dd></> : <><dt>Owner / occupants</dt><dd>{state.ownerId ?? state.occupants?.join(", ") ?? "None"}</dd><dt>Damage</dt><dd>{state.damage.join(", ") || "None"}</dd><dt>State</dt><dd>{state.destroyed ? "Destroyed" : state.lost ? "Lost" : state.dropped ? "Dropped" : state.condition}</dd></>}</dl><button className="button secondary" disabled={busy} onClick={() => void editState(state)}>Edit with impact review</button></div></article>; })}</div>;
  return <PageShell project={project} eyebrow="Production memory · Current state" title="Continuity Ledger" detail="Versioned state, inheritance, conflict warnings, and audit history for every character, object, vehicle, location, creature, animal, and global movie condition.">
    {!memory.storyTimeline.events.length ? <GateBlock icon={<ScanLine size={22} />} title="Build production memory first" detail="Continuity snapshots read the approved Story Timeline and never update future starts until an End State is approved." action="Build production memory" disabled={busy} onClick={() => void onAction("build_production_memory")} /> : <>
      <div className="continuity-memory-tabs">{(["overview", "characters", "props", "vehicles", "locations", "timeline", "warnings", "sequence_states", "history"] as ContinuityTab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item.replaceAll("_", " ")}{item === "warnings" && openWarnings.length ? <em>{openWarnings.length}</em> : null}</button>)}</div>
      {tab === "overview" ? <><div className="continuity-production-summary"><div><ScanLine size={22} /><strong>{visibleStates.length}</strong><span>structured entity states</span></div><div><PackageCheck size={22} /><strong>{ledger.snapshots.filter((snapshot) => ["APPROVED", "LOCKED"].includes(snapshot.status)).length}</strong><span>approved snapshots</span></div><div><RefreshCw size={22} /><strong>{ledger.snapshots.filter((snapshot) => snapshot.status === "CANDIDATE").length}</strong><span>candidate snapshots</span></div><div className={openWarnings.length ? "warning" : ""}><TriangleAlert size={22} /><strong>{openWarnings.length}</strong><span>open warnings</span></div></div>{renderEntityCards(visibleStates.filter((state) => ["character", "prop", "vehicle", "location"].includes(state.entityType)).slice(0, 8))}</> : null}
      {["characters", "props", "vehicles", "locations"].includes(tab) ? renderEntityCards(stateForTab) : null}
      {tab === "timeline" ? <div className="continuity-timeline-list">{memory.storyTimeline.events.map((event) => <article key={event.id}><code>{event.movieTime.label}</code><strong>{event.sequenceId} · {event.scene}</strong><span>{ledger.snapshots.filter((snapshot) => snapshot.sequenceId === event.sequenceId).length} saved state versions</span><p>{event.storyConsequence}</p></article>)}</div> : null}
      {tab === "warnings" ? <div className="continuity-warning-list">{ledger.warnings.length ? ledger.warnings.slice().reverse().map((warning) => <article className={warning.status.toLowerCase()} key={warning.id}><header><TriangleAlert size={15} /><strong>CONTINUITY WARNING · {warning.code}</strong><span>{warning.status}</span></header><h3>{warning.entityId} · {warning.field}</h3><div><p><small>EXPECTED STATE</small>{warning.expected}</p><p><small>CONFLICTING STATE</small>{warning.conflicting}</p><p><small>SOURCE SEQUENCE</small>{warning.sourceSequenceId}</p><p><small>AFFECTED FUTURE SEQUENCES</small>{warning.affectedFutureSequenceIds.join(", ") || "None"}</p></div>{warning.status === "OPEN" ? <footer><button className="button primary" onClick={() => void onAction("resolve_continuity_warning", { warningId: warning.id, action: "FIX_CURRENT_DATA", note: "Restored the latest approved source value." })}>Fix Current Data</button><button className="button secondary" onClick={() => setTab("sequence_states")}>Review Source</button><button className="button secondary" onClick={() => { const note = window.prompt("Why is this continuity change intentional?"); if (note) void onAction("resolve_continuity_warning", { warningId: warning.id, action: "ACCEPT_INTENTIONAL_CHANGE", note }); }}>Accept Intentional Change</button></footer> : <footer><span>{warning.resolutionNote ?? "Warning closed"}</span></footer>}</article>) : <div className="stage-placeholder"><Check size={25} /><p>No continuity conflicts are open.</p></div>}</div> : null}
      {tab === "sequence_states" ? <div className="snapshot-table"><div><span>Sequence / anchor</span><span>Version</span><span>State</span><span>Inheritance</span><span>Source</span><span>Actions</span></div>{orderedSnapshots.map((snapshot) => <div key={snapshot.id}><span><code>{snapshot.sequenceId}</code><strong>{snapshot.anchor}</strong></span><code>V{pad(snapshot.version)}</code><span className={snapshot.status.toLowerCase()}>{snapshot.status}</span><code>{snapshot.inheritedFromSnapshotId ? "APPROVED END" : "STORY SOURCE"}</code><span>{snapshot.changeSource}<small>{snapshot.changeReason}</small></span><span>{snapshot.status === "CANDIDATE" ? <button className="button secondary" onClick={() => void onAction("approve_continuity", { snapshotId: snapshot.id })}>Approve</button> : snapshot.status === "APPROVED" ? <button className="button secondary" onClick={() => void onAction("lock_continuity", { snapshotId: snapshot.id })}>Lock</button> : null}</span></div>)}</div> : null}
      {tab === "history" ? <div className="continuity-history-list"><div className="section-heading"><div><span className="eyebrow">Never overwritten</span><h3>Continuity version and audit history</h3></div><History size={18} /></div>{ledger.history.slice().reverse().map((entry) => <article key={entry.id}><code>{entry.sequenceId} · V{pad(entry.version)}</code><strong>{entry.action}</strong><p>{entry.reason}</p><span>{entry.changedFields.join(", ")}</span><time>{new Date(entry.createdAt).toLocaleString()}</time></article>)}</div> : null}
    </>}
  </PageShell>;
}

function AudioBibleStudio({ project, busy, onAction }: Props) {
  const audio = project.memory.productionMemory.audioBible;
  const [selectedCharacterId, setSelectedCharacterId] = useState(audio.voiceProfiles[0]?.characterId ?? project.production.characters[0]?.id ?? "");
  const selectedCharacter = project.production.characters.find((character) => character.id === selectedCharacterId) ?? project.production.characters[0];
  const profile = audio.voiceProfiles.find((item) => item.characterId === selectedCharacter?.id);
  const emptyVoice = (characterId: string): Omit<CharacterVoiceProfile, "createdAt" | "updatedAt" | "version"> => ({ id: `VOICE_${characterId.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}`, characterId, voiceDescription: "", language: project.dialogueLanguage, accent: "", ageImpression: selectedCharacter?.ageRange ?? "", pitch: "", tone: "", speakingSpeed: "", emotionRange: [], deliveryStyle: "", pronunciationRules: [], volumeTendencies: "", status: "DRAFT" });
  const [voice, setVoice] = useState(() => profile ? { ...profile, emotionRange: [...profile.emotionRange], pronunciationRules: [...profile.pronunciationRules] } : emptyVoice(selectedCharacterId));
  const [musicRules, setMusicRules] = useState(audio.musicRules.join("\n"));
  const [silenceRules, setSilenceRules] = useState(audio.intentionalSilenceRules.join("\n"));
  useEffect(() => { const next = audio.voiceProfiles.find((item) => item.characterId === selectedCharacter?.id); setVoice(next ? { ...next, emotionRange: [...next.emotionRange], pronunciationRules: [...next.pronunciationRules] } : emptyVoice(selectedCharacter?.id ?? "")); }, [selectedCharacter?.id, audio.voiceProfiles]);
  const confirmAudioImpact = async (label: string) => { const impact = await api.changeImpact(project.id, "audio_bible", "AUDIO_BIBLE"); return !impact.requiresReview || window.confirm(`${label}\n\n${impact.summary}\n\nApply after reviewing the affected items?`); };
  const updateSetting = async (key: "narrationEnabled" | "dialogueEnabled" | "musicEnabled" | "subtitlesEnabled", value: boolean) => { if (await confirmAudioImpact(`Change ${key}?`)) await onAction("update_audio_bible", { settings: { [key]: value }, reason: `User changed ${key}.`, confirmedImpact: true }); };
  const saveVoice = async () => { if (!selectedCharacter || !(await confirmAudioImpact(`Save the permanent voice profile for ${selectedCharacter.name}?`))) return; await onAction("update_voice_profile", { ...voice, characterId: selectedCharacter.id, confirmedImpact: true }); };
  const configureNarrator = async () => {
    const identity = window.prompt("Narrator identity", audio.narrator?.identity ?? "Project narrator"); if (!identity) return;
    const tone = window.prompt("Narrator tone", audio.narrator?.tone ?? "Grounded and restrained"); if (!tone) return;
    const pacing = window.prompt("Narrator pacing", audio.narrator?.pacing ?? "Measured"); if (!pacing || !(await confirmAudioImpact("Save the narrator identity and delivery rules?"))) return;
    await onAction("update_audio_bible", { narrator: { id: audio.narrator?.id ?? "NARRATOR_001", identity, language: audio.narrator?.language ?? audio.filmLanguage, accent: audio.narrator?.accent ?? "User-defined", tone, style: audio.narrator?.style ?? "Story-led", delivery: audio.narrator?.delivery ?? "Natural narration", pacing, status: audio.narrator?.status ?? "DRAFT" }, reason: "User updated the narrator identity and delivery rules.", confirmedImpact: true });
  };
  return <PageShell project={project} eyebrow="Production memory · What is heard" title="Audio Bible" detail="Permanent character voices, narration, recurring ambience, sound effects, music law, intentional silence, and the Full Script v2 dialogue contract.">
    <div className="audio-bible-summary"><div><span>Film language</span><strong>{audio.filmLanguage}</strong></div><div><span>Dialogue language</span><strong>{audio.dialogueLanguage}</strong></div>{(["narrationEnabled", "dialogueEnabled", "musicEnabled", "subtitlesEnabled"] as const).map((key) => <label key={key}><span>{key.replace("Enabled", "")}</span><input type="checkbox" checked={audio[key]} onChange={(event) => void updateSetting(key, event.target.checked)} /></label>)}<div><span>Version</span><strong>V{pad(audio.version)} · {audio.status}</strong></div></div>
    <div className="audio-bible-layout"><aside><span className="eyebrow">Character voice identities</span>{project.production.characters.map((character) => { const stored = audio.voiceProfiles.find((item) => item.characterId === character.id); return <button key={character.id} className={selectedCharacter?.id === character.id ? "selected" : ""} onClick={() => setSelectedCharacterId(character.id)}><strong>{character.name}</strong><code>{stored?.id ?? "VOICE NOT ASSIGNED"}</code><span>{stored?.status ?? "DRAFT"}</span></button>; })}<div className="audio-boundary"><AudioLines size={17} /><strong>Movie DNA boundary</strong><p>Visual DNA may recommend audio direction. It never overwrites user choices or locked voice identities.</p></div></aside>
      <section>{selectedCharacter ? <><div className="section-heading"><div><span className="eyebrow">Permanent character ID · {selectedCharacter.id}</span><h3>{selectedCharacter.name} Voice Profile</h3></div><span className={`approval-pill ${voice.status.toLowerCase()}`}>{voice.status}</span></div><div className="voice-profile-form"><label className="wide"><span>Voice description</span><textarea rows={3} value={voice.voiceDescription} onChange={(event) => setVoice({ ...voice, voiceDescription: event.target.value })} /></label>{([ ["language", "Language"], ["accent", "Accent"], ["ageImpression", "Age impression"], ["pitch", "Pitch"], ["tone", "Tone"], ["speakingSpeed", "Speaking speed"], ["deliveryStyle", "Delivery style"], ["volumeTendencies", "Volume tendencies"] ] as const).map(([key, label]) => <label key={key}><span>{label}</span><input value={voice[key]} onChange={(event) => setVoice({ ...voice, [key]: event.target.value })} /></label>)}<label className="wide"><span>Emotion range</span><textarea rows={2} value={voice.emotionRange.join(", ")} onChange={(event) => setVoice({ ...voice, emotionRange: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label><label className="wide"><span>Pronunciation rules</span><textarea rows={3} value={voice.pronunciationRules.join("\n")} onChange={(event) => setVoice({ ...voice, pronunciationRules: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} /></label><label><span>Approval state</span><select value={voice.status} onChange={(event) => setVoice({ ...voice, status: event.target.value as CharacterVoiceProfile["status"] })}><option>DRAFT</option><option>APPROVED</option><option>LOCKED</option></select></label></div><div className="audio-save-row"><span>Voice ID remains <code>{voice.id}</code> across every sequence and application restart.</span><button className="button primary" disabled={busy} onClick={() => void saveVoice()}><Save size={13} />Save voice identity</button></div></> : <div className="stage-placeholder"><Users size={25} /><p>Analyze characters before assigning voice identities.</p></div>}
        <div className="audio-rule-grid"><article><span className="eyebrow">Music rules</span><textarea rows={6} value={musicRules} onChange={(event) => setMusicRules(event.target.value)} /><button className="button secondary" onClick={async () => { if (await confirmAudioImpact("Save music rules?")) await onAction("update_audio_bible", { musicRules: musicRules.split("\n").map((item) => item.trim()).filter(Boolean), reason: "User updated project music rules.", confirmedImpact: true }); }}>Save music rules</button></article><article><span className="eyebrow">Intentional silence</span><textarea rows={6} value={silenceRules} onChange={(event) => setSilenceRules(event.target.value)} /><button className="button secondary" onClick={async () => { if (await confirmAudioImpact("Save intentional silence rules?")) await onAction("update_audio_bible", { intentionalSilenceRules: silenceRules.split("\n").map((item) => item.trim()).filter(Boolean), reason: "User updated intentional silence rules.", confirmedImpact: true }); }}>Save silence rules</button></article></div>
      </section><aside className="audio-identity-panel"><span className="eyebrow">Recurring audio identities</span>{audio.narrationEnabled ? <><h3>Narrator</h3><article><code>{audio.narrator?.id ?? "NARRATOR NOT ASSIGNED"}</code><strong>{audio.narrator?.identity ?? "Configure narrator"}</strong><p>{audio.narrator ? `${audio.narrator.language} · ${audio.narrator.accent} · ${audio.narrator.tone} · ${audio.narrator.pacing}` : "Narration is enabled; save one persistent narrator identity before Full Script v2."}</p><button className="button secondary" onClick={() => void configureNarrator()}>Configure narrator</button></article></> : null}<h3>Ambience</h3>{audio.ambientSounds.map((sound) => <article key={sound.id}><code>{sound.identityKey}</code><strong>{sound.name}</strong><p>{sound.description}</p><span>{sound.locked ? "LOCKED" : "EDITABLE"}</span></article>)}<h3>Sound effects</h3>{audio.soundEffects.slice(0, 8).map((sound) => <article key={sound.id}><code>{sound.sourceEntityId}</code><strong>{sound.name}</strong><p>{sound.description}</p></article>)}<div className="dialogue-contract"><strong>FULL SCRIPT V2 CONTRACT</strong>{audio.dialogueContract.supportedFields.map((field) => <span key={field}>{field}</span>)}<em>{audio.dialogueContract.preparedForFullScript ? "PREPARED" : "INCOMPLETE"}</em></div></aside></div>
    <div className="audio-approval-bar"><div><strong>Audio Bible V{audio.version}</strong><span>{audio.voiceProfiles.length} voice profiles · {audio.ambientSounds.length} ambience identities · {audio.soundEffects.length} effect identities</span></div><button className="button secondary" onClick={async () => { if (await confirmAudioImpact("Approve the Audio Bible?")) await onAction("update_audio_bible", { status: "APPROVED", reason: "Audio Bible approved for downstream use.", confirmedImpact: true }); }}>Approve</button><button className="button primary" onClick={async () => { if (await confirmAudioImpact("Lock the Audio Bible?")) await onAction("update_audio_bible", { status: "LOCKED", reason: "Audio Bible locked for downstream use.", confirmedImpact: true }); }}><LockKeyhole size={13} />Lock Audio Bible</button></div>
  </PageShell>;
}

function ExportStudio({ project, onDownload, onNavigate }: Props) {
  const prompts = project.production.sequences.filter((sequence) => sequence.compiledPrompt).length;
  return <PageShell project={project} eyebrow="Stage 10 · Final production package" title="Export Continuity Studio Project" detail="Download the complete local package: DNA, Bible, identities, asset versions, sequence scripts, prompts, reference mappings, ledger, history, and generated videos.">
    <section className="production-export-hero"><PackageCheck size={34} /><span className="eyebrow">Continuity Studio By BURABEEH</span><h2>{project.title}</h2><p>The package is always downloadable for backup. A finished master is ready when every required sequence is approved or locked.</p><div className="export-readiness"><span><strong>{project.production.movieDna.status}</strong>Movie DNA</span><span><strong>{project.production.story.status}</strong>Story</span><span><strong>{project.production.filmBible.status}</strong>Film Bible</span><span><strong>{project.production.assets.length}</strong>Assets</span><span><strong>{project.production.sequences.length}</strong>Sequences</span><span><strong>{prompts}</strong>Prompts</span></div><div className="workflow-actions"><button className="button secondary" onClick={() => onNavigate("continuity")}>Review continuity</button><button className="button primary" onClick={onDownload}><Download size={15} />Download full project ZIP</button></div></section>
  </PageShell>;
}

function GateBlock({ title, detail, action, onClick, disabled, icon }: { title: string; detail: string; action: string; onClick: () => void; disabled?: boolean; icon?: React.ReactNode }) {
  return <section className="production-gate-block">{icon ?? <LockKeyhole size={22} />}<div><span className="eyebrow">Workflow gate</span><h3>{title}</h3><p>{detail}</p></div><button className="button primary" disabled={disabled} onClick={onClick}>{action}<ChevronRight size={14} /></button></section>;
}

const pad = (value: number) => String(value).padStart(2, "0");
