import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
  FileJson,
  Image as ImageIcon,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import type { MovieProject, SequencePromptRecord, TargetPlatform } from "../types";
import { api } from "../api";
import { MOVIE_DNA_CATALOG, movieDnaOption } from "../movie-dna-catalog";
import genreSheet from "../../assets/movie-dna/genre-contact-sheet.png";
import lookSheet from "../../assets/movie-dna/look-contact-sheet.png";
import cameraSheet from "../../assets/movie-dna/camera-contact-sheet.png";

type Action = (action: string, payload?: Record<string, unknown>) => Promise<void>;

interface Props {
  project: MovieProject;
  initialSequenceId: string;
  busy: boolean;
  onAction: Action;
  onBack: () => void;
  onClose: () => void;
  onSequenceChange?: (sequenceId: string) => void;
}

const platforms: TargetPlatform[] = ["Seedance", "Higgsfield", "MiniMax", "Veo", "Kling", "Runway", "Sora", "Custom"];
const sheetUrls = { genre: genreSheet, look: lookSheet, camera: cameraSheet };
const pad = (value: number) => String(value).padStart(2, "0");

function VisualCrop({ sheet, index }: { sheet: keyof typeof sheetUrls; index: number }) {
  const column = index % 4;
  const row = Math.floor(index / 4);
  const style = { backgroundImage: `url(${sheetUrls[sheet]})`, backgroundSize: "400% auto", backgroundPosition: `${column * (100 / 3)}% ${row * (100 / 3)}%` } as CSSProperties;
  return <div className="sequence-workspace-visual-crop" style={style} />;
}

const recordFor = (project: MovieProject, sequenceId: string, platform: TargetPlatform) => project.production.promptWorkspace.records[`${sequenceId}:${platform}`];

export function SequenceWorkspaceView({ project, initialSequenceId, busy, onAction, onBack, onClose, onSequenceChange }: Props) {
  const sequences = project.memory.productionMemory.script.sequences;
  const [sequenceId, setSequenceId] = useState(initialSequenceId);
  const selected = sequences.find((sequence) => sequence.id === sequenceId) ?? sequences[0];
  const [platform, setPlatform] = useState<TargetPlatform>(() => project.production.promptWorkspace.selectedPlatforms[sequenceId] ?? project.targetPlatform);
  const record = selected ? recordFor(project, selected.id, platform) : undefined;
  const [normalText, setNormalText] = useState(record?.normalPrompt ?? "");
  const [jsonText, setJsonText] = useState(record?.jsonPrompt ?? "");
  const [normalDirty, setNormalDirty] = useState(false);
  const [jsonDirty, setJsonDirty] = useState(false);
  const [saveState, setSaveState] = useState<"SAVED" | "SAVING" | "UNSAVED CHANGES" | "SAVE FAILED">("SAVED");
  const [sourcePanel, setSourcePanel] = useState<"dna" | "story" | "script" | "shots" | "storyboard" | "continuity" | "dialogue" | "audio" | "negative" | "references">("dna");
  const requested = useRef(new Set<string>());
  const storyboardInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selected || record || busy) return;
    const key = `${selected.id}:${platform}`;
    if (requested.current.has(key)) return;
    requested.current.add(key);
    void onAction("compile_sequence_prompt", { sequenceId: selected.id, platform });
  }, [busy, onAction, platform, record, selected]);

  useEffect(() => {
    if (!record) return;
    if (!normalDirty) setNormalText(record.normalPrompt);
    if (!jsonDirty) setJsonText(record.jsonPrompt);
    if (!normalDirty && !jsonDirty) setSaveState("SAVED");
  }, [jsonDirty, normalDirty, record]);

  useEffect(() => {
    const next = project.production.promptWorkspace.selectedPlatforms[sequenceId] ?? project.targetPlatform;
    setPlatform(next);
  }, [project.targetPlatform, project.production.promptWorkspace.selectedPlatforms, sequenceId]);

  const currentIndex = selected ? sequences.findIndex((sequence) => sequence.id === selected.id) : -1;
  const script = project.memory.productionMemory.script;
  const scenes = selected ? script.scenes.filter((scene) => selected.sceneIds.includes(scene.id)) : [];
  const sourceDialogue = selected ? script.dialogue.filter((line) => selected.dialogueIds.includes(line.id)) : [];
  const sourceShots = selected ? script.shots.filter((shot) => selected.shotIds.includes(shot.id)).sort((a, b) => a.number - b.number) : [];
  const profile = project.production.platformProfiles[platform];
  const state = record?.state;
  const selectedReferences = state?.references.filter((reference) => reference.selected) ?? [];
  const referenceOverLimit = Boolean(state && ((record?.referenceLimitMode === "REVIEW" && state.references.length > profile.maxReferences) || (record?.referenceLimitMode !== "MERGED_SHEET" && selectedReferences.length > profile.maxReferences)));

  const perform = async (action: string, payload: Record<string, unknown>, stateLabel = true) => {
    if (stateLabel) setSaveState("SAVING");
    try {
      await onAction(action, payload);
      setNormalDirty(false);
      setJsonDirty(false);
      if (stateLabel) setSaveState("SAVED");
    } catch (error) {
      if (stateLabel) setSaveState("SAVE FAILED");
      throw error;
    }
  };

  const saveCurrent = async (activeSequenceId = selected?.id) => {
    if (!record || !selected) return;
    if (normalDirty) await perform("save_normal_prompt", { sequenceId: selected.id, activeSequenceId, platform, text: normalText });
    else if (jsonDirty) await perform("save_json_prompt", { sequenceId: selected.id, activeSequenceId, platform, text: jsonText });
  };

  const navigate = async (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= sequences.length) return;
    const nextSequenceId = sequences[nextIndex]!.id;
    if (normalDirty || jsonDirty) {
      const save = saveCurrent(nextSequenceId);
      setSequenceId(nextSequenceId);
      onSequenceChange?.(nextSequenceId);
      await save;
    } else {
      setSequenceId(nextSequenceId);
      onSequenceChange?.(nextSequenceId);
    }
    setNormalDirty(false);
    setJsonDirty(false);
  };

  const exit = async (handler: () => void) => {
    await saveCurrent();
    handler();
  };

  const selectPlatform = async (next: TargetPlatform) => {
    await saveCurrent();
    setPlatform(next);
    await perform("compile_sequence_prompt", { sequenceId: selected!.id, platform: next }, false);
  };

  const formatJson = () => {
    try { setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2)); setJsonDirty(true); setSaveState("UNSAVED CHANGES"); }
    catch { setSaveState("SAVE FAILED"); }
  };

  const uploadStoryboardGrid = async (file?: File) => {
    if (!file || !selected) return;
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("Storyboard Grid image could not be read."));
      reader.readAsDataURL(file);
    });
    await perform("upload_storyboard_grid", { sequenceId: selected.id, platform, filename: file.name, mimeType: file.type || "image/png", base64 });
  };

  const locationVisual = useMemo(() => {
    const locationSelection = project.production.movieDna.selections.location;
    const option = locationSelection?.optionIds?.[0] ? movieDnaOption("location", locationSelection.optionIds[0]!) : undefined;
    return { path: state?.location.imagePath ?? locationSelection?.previewPath, sheet: option?.sheet ?? "look", index: option?.visualIndex ?? locationSelection?.visualIndex ?? 0 } as { path?: string; sheet: keyof typeof sheetUrls; index: number };
  }, [project.production.movieDna.selections.location, state?.location.imagePath]);

  if (!selected) return <section className="sequence-workspace-empty"><ShieldAlert size={28} /><h2>Sequence Workspace requires formal sequence plans</h2><p>Generate Full Script v2 and Sequence Planner records first.</p><button onClick={onBack}>Back to Sequence List</button></section>;

  return <div className="sequence-workspace-v3">
    <header className="sequence-workspace-header">
      <div className="sequence-workspace-navigation">
        <button onClick={() => void exit(onBack)}><ArrowLeft size={13} />Back</button>
        <button disabled={currentIndex <= 0 || busy} onClick={() => void navigate(currentIndex - 1)}><ChevronLeft size={13} />Previous</button>
        <strong>Sequence {pad(selected.number)} of {pad(sequences.length)}</strong>
        <button disabled={currentIndex >= sequences.length - 1 || busy} onClick={() => void navigate(currentIndex + 1)}>Next<ChevronRight size={13} /></button>
      </div>
      <div className="sequence-workspace-title"><span>Sequence production workspace</span><h2>{selected.title}</h2></div>
      <div className="sequence-workspace-meta">
        <span className={`sequence-workspace-status ${(state?.validation.status ?? selected.status).toLowerCase()}`}>{state?.validation.status ?? selected.status}</span>
        <label>Platform<select value={platform} onChange={(event) => void selectPlatform(event.target.value as TargetPlatform)}>{platforms.map((item) => <option key={item}>{item}</option>)}</select></label>
        <span>{selected.durationSeconds} sec</span><span>{selected.timeRange}</span>
        <button onClick={() => void exit(onClose)}>Close<X size={13} /></button>
      </div>
    </header>

    <section className="sequence-workspace-health">
      <span>Prompt State <b>One source</b></span><span>Platform compile <b>{platform} v{profile.version}</b></span><span>Storyboard Grid <b>{state?.storyboardGrid.enabled ? state.storyboardGrid.status : "Optional · Off"}</b></span><span>References <b>{selectedReferences.length} selected</b></span><span>Continuity <b>{state?.validation.issues.filter((issue) => /CONTINUITY|KNIFE/.test(issue.code)).length ?? 0} issues</b></span><span>Manual change <b>{Object.keys(state?.sequenceOverrides ?? {}).length} overrides</b></span><span className={saveState.toLowerCase().replaceAll(" ", "-")}><i />{saveState}</span>
    </section>

    {!record ? <section className="sequence-workspace-loading"><RefreshCw size={22} className="spin" /><strong>Compiling from structured production memory…</strong><p>No placeholder prompt is used. The workspace is reading Full Script v2, Dialogue Lock, Shot Planner, Continuity, assets, Audio Bible, and Movie DNA.</p></section> : <>
      {record.outdatedReasons.length ? <section className="sequence-prompt-outdated"><ShieldAlert size={15} /><div><strong>PROMPT OUTDATED</strong><p>{record.outdatedReasons.join(" · ")}</p></div><button onClick={() => void perform("compile_sequence_prompt", { sequenceId: selected.id, platform })}>Recompile</button></section> : null}

      <section className="sequence-workspace-editors">
        <article className="sequence-prompt-editor normal">
          <header><div><span>Normal Prompt</span><small>Editable · rendered from Prompt State</small></div><nav><button onClick={() => void navigator.clipboard.writeText(normalText)}><ClipboardCopy size={11} />Copy Normal Prompt</button><button disabled={!normalDirty || busy} onClick={() => void saveCurrent()}><Save size={11} />Save</button><button disabled={busy} onClick={() => void perform("compile_sequence_prompt", { sequenceId: selected.id, platform })}><RefreshCw size={11} />Recompile Prompt</button><button disabled={busy || !Object.keys(state!.sequenceOverrides).length} onClick={() => void perform("reset_sequence_overrides", { sequenceId: selected.id, platform })}><RotateCcw size={11} />Reset Overrides</button></nav></header>
          <textarea aria-label="Normal Prompt" value={normalText} onChange={(event) => { setNormalText(event.target.value); setNormalDirty(true); setJsonDirty(false); setSaveState("UNSAVED CHANGES"); }} />
        </article>
        <article className="sequence-prompt-editor json">
          <header><div><span>JSON Prompt</span><small>Editable · same Prompt State</small></div><nav><button onClick={() => void navigator.clipboard.writeText(jsonText)}><ClipboardCopy size={11} />Copy JSON</button><button disabled={!jsonDirty || busy} onClick={() => void saveCurrent()}><Save size={11} />Save</button><button disabled={busy} onClick={() => void perform("validate_sequence_prompt", { sequenceId: selected.id, platform })}><Check size={11} />Validate JSON</button><button onClick={formatJson}><FileJson size={11} />Format JSON</button><button disabled={busy} onClick={() => void perform("restore_prompt_state", { sequenceId: selected.id, platform })}><RotateCcw size={11} />Restore from Prompt State</button></nav></header>
          <textarea aria-label="JSON Prompt" value={jsonText} onChange={(event) => { setJsonText(event.target.value); setJsonDirty(true); setNormalDirty(false); setSaveState("UNSAVED CHANGES"); }} />
        </article>
      </section>

      {record.pendingChange ? <section className="sequence-prompt-review"><div><span>Review Prompt Change</span><h3>{record.pendingChange.likelyAffectedField.replaceAll("_", " ")}</h3><p>{record.pendingChange.conflict}</p></div><dl><dt>Changed text</dt><dd>{record.pendingChange.changedText}</dd><dt>Current value</dt><dd>{record.pendingChange.currentValue}</dd><dt>Proposed value</dt><dd>{record.pendingChange.proposedValue}</dd></dl>{record.pendingChange.impact ? <aside><strong>{record.pendingChange.impact.summary}</strong><p>{record.pendingChange.impact.lockedCount} locked · {record.pendingChange.impact.approvedCount} approved</p>{record.pendingChange.impact.items.slice(0, 8).map((item) => <small key={`${item.kind}-${item.id}`}>{item.kind} · {item.label} · {item.protection}</small>)}</aside> : null}<nav><button onClick={() => void perform("resolve_prompt_change", { sequenceId: selected.id, platform, resolution: "APPLY" })}>Apply</button><button onClick={() => void perform("resolve_prompt_change", { sequenceId: selected.id, platform, resolution: "KEEP_OVERRIDE" })}>Keep as Sequence Override</button><button onClick={() => void perform("resolve_prompt_change", { sequenceId: selected.id, platform, resolution: "CANCEL" })}>Cancel</button><button className="project" onClick={() => void perform("resolve_prompt_change", { sequenceId: selected.id, platform, resolution: "APPLY_PROJECT" })}>Apply Change to Project</button></nav></section> : null}

      <section className="sequence-workspace-visual-source">
        <header><div><span>Locked visual Movie DNA</span><small>Global location and all selected DNA directions remain visible while editing.</small></div><strong>{state!.movieDnaVisuals.length} visual categories · DNA v{project.production.movieDna.version}</strong></header>
        <div className="sequence-dna-visual-strip">{state!.movieDnaVisuals.map((visual) => <article key={visual.categoryId}>{visual.previewPath ? <img src={api.mediaUrl(project.id, visual.previewPath)} alt={visual.label} /> : <VisualCrop sheet={visual.sheet} index={visual.visualIndex} />}<div><small>{visual.categoryName}</small><strong>{visual.label}</strong></div></article>)}</div>
        <article className="sequence-global-location"><div>{locationVisual.path ? <img src={api.mediaUrl(project.id, locationVisual.path)} alt={state!.location.name} /> : <VisualCrop sheet={locationVisual.sheet} index={locationVisual.index} />}</div><section><span>Global location image</span><h3>{state!.location.name}</h3><code>{state!.location.id}{state!.location.projectImageNumber ? ` · PROJECT IMAGE ${pad(state!.location.projectImageNumber)}` : ""}</code><p>{state!.location.description}</p><small>{state!.environment.timeOfDay} · {state!.environment.weather} · {state!.environment.lighting}</small></section></article>
      </section>

      <section className="sequence-source-panels">
        <nav>{([['dna','Movie DNA'],['story','Story Context'],['script','Sequence Script'],['shots','Shot Plan'],['storyboard','Storyboard Grid'],['continuity','Continuity'],['dialogue','Dialogue'],['audio','Audio'],['negative','Negative Rules'],['references','References']] as const).map(([id, label]) => <button key={id} className={sourcePanel === id ? "active" : ""} onClick={() => setSourcePanel(id)}>{label}</button>)}</nav>
        <div className="sequence-source-panel-content">
          {sourcePanel === "dna" ? <div className="source-definition-grid">{Object.entries(state!.movieDNA).map(([key, value]) => <article key={key}><span>{key}</span><p>{value}</p></article>)}</div> : null}
          {sourcePanel === "story" ? <div className="source-definition-grid">{Object.entries(state!.storyContext).map(([key, value]) => <article key={key}><span>{key}</span><p>{Array.isArray(value) ? value.join(" · ") : value}</p></article>)}</div> : null}
          {sourcePanel === "script" ? <div className="source-script-excerpt">{scenes.map((scene) => <article key={scene.id}><span>{scene.heading}</span><p>{scene.action}</p><small>{scene.transition}</small></article>)}</div> : null}
          {sourcePanel === "shots" ? <div className="source-shot-grid">{sourceShots.map((shot) => <article key={shot.id}><strong>{pad(shot.number)}</strong><span>{shot.durationSeconds}s</span><p>{shot.shotType} · {shot.framing} · {shot.lens} · {shot.focalLength} · {shot.cameraMovement}</p><small>{shot.subjectAction}</small></article>)}</div> : null}
          {sourcePanel === "storyboard" ? <section className="source-storyboard-grid">
            <header><div><span>Optional 3x3 continuity grid</span><strong>{state!.storyboardGrid.enabled ? state!.storyboardGrid.status : "DISABLED"}</strong><p>Derived from the existing Shot Planner. It supplements the shot plan and never replaces it.</p></div><nav><button disabled={busy || !profile.storyboardGridSupport} onClick={() => void perform("set_storyboard_grid", { sequenceId: selected.id, platform, enabled: !state!.storyboardGrid.enabled })}>{state!.storyboardGrid.enabled ? "Disable Grid" : "Enable Grid"}</button><button disabled={busy || !state!.storyboardGrid.enabled} onClick={() => storyboardInput.current?.click()}><ImageIcon size={11} />{state!.storyboardGrid.imagePath ? "Replace Grid Image" : "Attach Grid Image"}</button><input ref={storyboardInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void uploadStoryboardGrid(event.target.files?.[0]); event.currentTarget.value = ""; }} /></nav></header>
            {state!.storyboardGrid.enabled ? <><div className="source-storyboard-panel-grid">{state!.storyboardGrid.panels.map((panel) => <article key={panel.number}><header><strong>{pad(panel.number)}</strong><code>{panel.shotId}</code></header><p>{panel.beat}</p><small>CAM: {panel.camera}</small><small>MOVE: {panel.movement}</small><em>{panel.annotationType}: {panel.annotation}</em></article>)}</div><footer>{state!.storyboardGrid.imagePath ? <img src={api.mediaUrl(project.id, state!.storyboardGrid.thumbnailPath ?? state!.storyboardGrid.imagePath)} alt={`Sequence ${pad(selected.number)} Storyboard Grid`} /> : <div><ImageIcon size={25} /><strong>Grid plan ready</strong><p>Attach a rendered composite only when you want it included as a uniquely numbered platform reference.</p></div>}<section><span>Permanent reference identity</span><code>{state!.storyboardGrid.projectImageNumber !== undefined ? `PROJECT IMAGE ${pad(state!.storyboardGrid.projectImageNumber)} · ${state!.storyboardGrid.permanentFilename}` : "Allocated when enabled"}</code><p>{profile.storyboardGridBehavior}</p></section></footer></> : <div className="source-storyboard-disabled"><ImageIcon size={24} /><strong>Storyboard Grid is optional</strong><p>The full Shot Planner remains active. Enable the grid only when a nine-panel continuous visual reference will improve motion, framing, or geography control.</p></div>}
          </section> : null}
          {sourcePanel === "continuity" ? <div className="source-continuity"><article><span>Start State</span><p>{state!.startState}</p></article><article><span>Inherited production memory</span><p>{state!.continuity.summary}</p>{state!.continuity.entities.map((entity) => <small key={entity.entityId}>{entity.entityId}: {entity.propsCarried}; weapons {entity.weapons}; {entity.condition}</small>)}</article></div> : null}
          {sourcePanel === "dialogue" ? <div className="source-dialogue">{sourceDialogue.map((line) => <article className={line.lockState.toLowerCase()} key={line.id}><header><strong>{state!.dialogue.find((item) => item.id === line.id)?.speakerName ?? line.speakerCharacterId}</strong><span>{line.timing.label}</span><em>{line.lockState}</em></header><blockquote>{line.exactDialogue}</blockquote><p>{line.language} · {line.accent} · {line.emotion} · {line.delivery}</p></article>)}</div> : null}
          {sourcePanel === "audio" ? <div className="source-definition-grid">{Object.entries(state!.audio).map(([key, value]) => <article key={key}><span>{key}</span><p>{value.join(" · ")}</p></article>)}</div> : null}
          {sourcePanel === "negative" ? <ol className="source-negative-rules">{state!.negativeRules.map((rule, index) => <li key={rule}><strong>{pad(index + 1)}</strong>{rule}</li>)}</ol> : null}
          {sourcePanel === "references" ? <div className="source-reference-summary">{state!.references.map((reference) => <article key={reference.assetId}><strong>{reference.promptTag ?? "NOT SELECTED"}</strong><span>PROJECT IMAGE {pad(reference.permanentProjectImageNumber)}</span><p>{reference.assetName} · {reference.referenceRole}</p><small>{reference.missing ? "MISSING IMAGE" : reference.permanentFilename}</small></article>)}</div> : null}
        </div>
      </section>

      <section className={`sequence-reference-limit ${referenceOverLimit ? "warning" : "good"}`}>
        <div><span>{referenceOverLimit ? "Reference Limit Warning" : "Reference capacity"}</span><strong>Required references: {state!.references.length} · {platform} supports: {profile.maxReferences}</strong><p>No permanent Project Image number is ever changed. Only temporary upload positions are compiled.</p></div>{referenceOverLimit ? <nav><button onClick={() => void perform("set_reference_limit_mode", { sequenceId: selected.id, platform, mode: "RECOMMENDED" })}>Use Recommended {profile.maxReferences}</button><button onClick={() => void perform("set_reference_limit_mode", { sequenceId: selected.id, platform, mode: "MANUAL", selectedAssetIds: selectedReferences.map((reference) => reference.assetId) })}>Choose Manually</button><button onClick={() => document.querySelector<HTMLSelectElement>(".sequence-workspace-meta select")?.focus()}>Change Platform</button><button onClick={() => void perform("set_reference_limit_mode", { sequenceId: selected.id, platform, mode: "MERGED_SHEET" })}>Merge Reference Sheet</button></nav> : null}
      </section>

      <section className="sequence-reference-package">
        <header><div><span>Upload references in this order</span><h3>Sequence {pad(selected.number)} · {platform} Reference Package</h3><p>Package numbering is temporary. Permanent filenames and Project Image numbers remain unchanged everywhere else.</p></div><a href={api.sequenceReferencePackageUrl(project.id, selected.id, platform)}><Download size={13} />Download Sequence References</a></header>
        <div className="sequence-reference-cards">{state!.references.map((reference) => <article className={`${reference.selected ? "selected" : "excluded"} ${reference.missing ? "missing" : ""}`} key={reference.assetId}><div>{reference.thumbnailPath || reference.sourcePath ? <img src={api.mediaUrl(project.id, reference.thumbnailPath ?? reference.sourcePath!)} alt={reference.assetName} /> : <span><ImageIcon size={24} />{reference.missing ? "Missing image" : "No preview"}</span>}</div><section><header><strong>{reference.promptTag ?? "NOT IN PACKAGE"}</strong><em>{reference.platformUploadPosition ? `UPLOAD ${reference.platformUploadPosition}` : "EXCLUDED"}</em></header><h4>{reference.assetName}</h4><code>PROJECT IMAGE {pad(reference.permanentProjectImageNumber)} · {reference.permanentFilename}</code><dl><dt>Type</dt><dd>{reference.assetType}</dd><dt>Role</dt><dd>{reference.referenceRole}</dd><dt>Package</dt><dd>{reference.packageFilename ?? "Not selected"}</dd><dt>Status</dt><dd>{reference.missing ? "MISSING · BLOCKING" : `${reference.approvalState} · ${reference.lockState}`}</dd></dl><p>{reference.reasonRequired}</p></section></article>)}</div>
      </section>

      <section className={`sequence-validation ${state!.validation.status.toLowerCase()}`}><header><div><span>Validation Results</span><h3>{state!.validation.status}</h3></div><small>{new Date(state!.validation.checkedAt).toLocaleString()}</small></header><div>{state!.validation.issues.map((issue) => <article className={issue.level.toLowerCase()} key={issue.id}><strong>{issue.level}</strong><span>{issue.code.replaceAll("_", " ")}</span><p>{issue.message}</p></article>)}</div></section>

      <section className="sequence-prompt-history"><header><span>Protected prompt versions</span><strong>{platform} · {record.versions.length} versions</strong></header><div>{record.versions.slice().reverse().map((version) => <article key={version.version}><strong>V{pad(version.version)}</strong><span>{version.validation.status}</span><p>{version.reason}</p><small>{new Date(version.createdAt).toLocaleString()}</small></article>)}</div></section>
    </>}
  </div>;
}
