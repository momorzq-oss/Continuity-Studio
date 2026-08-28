import { useMemo, useState } from "react";
import {
  Check,
  CircleAlert,
  Clock3,
  Download,
  FileArchive,
  Film,
  History,
  Pause,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  UserRound,
} from "lucide-react";
import type { MovieProject } from "../types";
import { ReferenceImagePicker, type PendingReferenceImage } from "./ReferenceImagePicker";
import type { ViewId } from "./Sidebar";

interface AutomaticDirectorViewProps {
  project: MovieProject;
  busy: boolean;
  onAction: (action: "pause" | "resume" | "stop" | "manual_override" | "ai_main_character") => void;
  onUploadAndCreateSheet: (image: PendingReferenceImage) => void;
  onCreateExistingSheet: (referenceId: string) => void;
  onNavigate: (view: ViewId) => void;
  onDownloadProject: () => void;
  onDownloadAssets: () => void;
  onDownloadSequencePacks: () => void;
}

const dnaKeys = ["genre", "cinematography", "photography", "framing", "lensStyle", "focalLength", "colorGrade", "lighting", "texture", "aspectRatio"];

export function AutomaticDirectorView({
  project,
  busy,
  onAction,
  onUploadAndCreateSheet,
  onCreateExistingSheet,
  onNavigate,
  onDownloadProject,
  onDownloadAssets,
  onDownloadSequencePacks,
}: AutomaticDirectorViewProps) {
  const automatic = project.automaticProduction;
  const [pendingReference, setPendingReference] = useState<PendingReferenceImage>();
  const completed = automatic.stages.filter((stage) => stage.status === "COMPLETE").length;
  const percent = Math.round((completed / automatic.stages.length) * 100);
  const mainReference = project.preStorySetup.mainCharacterReferenceId
    ? project.memory.database.projectReferences.find((item) => item.id === project.preStorySetup.mainCharacterReferenceId)
    : undefined;
  const dnaSummary = useMemo(() => dnaKeys.map((key) => project.production.movieDna.selections[key]).filter(Boolean), [project.production.movieDna.selections]);
  const waitingForCharacter = automatic.status === "WAITING_FOR_MAIN_CHARACTER";
  const active = automatic.status === "RUNNING";
  const resumable = ["PAUSED", "STOPPED", "FAILED", "NEEDS_USER_REVIEW"].includes(automatic.status);

  return (
    <div className="automatic-director-view">
      <section className="automatic-hero">
        <div>
          <span className="eyebrow"><Sparkles size={14} /> AUTOMATIC MOVIE CREATION</span>
          <h2>{automatic.status === "COMPLETE" ? "YOUR MOVIE PRODUCTION PACKAGE IS READY" : project.movieTitle || project.title}</h2>
          <p>{automatic.status === "COMPLETE" ? "The editable production package is complete. External video generation remains under your control." : waitingForCharacter ? "Studio Brain has reached the required Main Character identity checkpoint." : active ? `Automatic Production Director is building ${automatic.currentStage?.replaceAll("_", " ") ?? "the next stage"}.` : automatic.lastError || "Automatic Mode is safely paused. Everything already created is preserved."}</p>
        </div>
        <div className="automatic-progress-ring"><strong>{percent}%</strong><span>{completed}/{automatic.stages.length} stages</span></div>
      </section>

      <div className="automatic-control-bar">
        {active ? <button className="button secondary" disabled={busy} onClick={() => onAction("pause")}><Pause size={15} /> Pause Automatic Mode</button> : null}
        {resumable ? <button className="button primary" disabled={busy} onClick={() => onAction("resume")}><Play size={15} /> Resume Automatic Mode</button> : null}
        {!automatic.completedAt && automatic.status !== "STOPPED" ? <button className="button secondary" disabled={busy} onClick={() => onAction("stop")}><Square size={14} /> Stop</button> : null}
        <button className="button secondary" disabled={busy} onClick={() => onAction("manual_override")}><SlidersHorizontal size={15} /> Manual Override</button>
      </div>

      {dnaSummary.length ? (
        <section className="automatic-panel dna-auto-summary">
          <div className="automatic-panel-heading"><div><span className="eyebrow">SELECTED AUTOMATICALLY</span><h3>Movie DNA preview</h3></div><button className="button secondary" onClick={() => onNavigate("movie_dna")}>Edit DNA</button></div>
          <div className="dna-summary-grid">{dnaSummary.map((selection) => <div key={selection.key}><small>{selection.key.replaceAll(/([A-Z])/g, " $1")}</small><strong>{selection.label}</strong></div>)}</div>
          <p className="muted-copy">Automatic Mode continues without individual approvals. Edit DNA at any time through the normal shared project workflow.</p>
        </section>
      ) : null}

      {waitingForCharacter ? (
        <section className="automatic-panel main-character-checkpoint">
          <div className="checkpoint-title"><span><UserRound size={22} /></span><div><span className="eyebrow">REQUIRED CHECKPOINT</span><h3>MAIN CHARACTER</h3></div></div>
          <p>Your uploaded image becomes the protected identity source for the Main Character. Continuity Studio will create a neutral Character Sheet while preserving this identity.</p>
          <div className="identity-protection-note"><ShieldCheck size={18} /><span>The original JPG, JPEG, PNG, or WEBP remains protected and separate. Character sheets never add sequence damage, dirt, blood, weather, or scene lighting.</span></div>
          {mainReference ? (
            <div className="existing-main-reference">
              <div><strong>{mainReference.name}</strong><small>{mainReference.originalFilename} · protected source uploaded</small></div>
              <button className="button primary" disabled={busy} onClick={() => onCreateExistingSheet(mainReference.id)}>CREATE CHARACTER SHEET</button>
            </div>
          ) : (
            <>
              <ReferenceImagePicker value={pendingReference} onChange={setPendingReference} title="Drop the Main Character reference here" detail="Drag and drop or browse. Preview, replace, or remove it before uploading." />
              <button className="button primary checkpoint-upload" disabled={busy || !pendingReference} onClick={() => pendingReference && onUploadAndCreateSheet(pendingReference)}>UPLOAD MAIN CHARACTER & CREATE CHARACTER SHEET</button>
            </>
          )}
          <div className="checkpoint-divider"><span>or</span></div>
          <button className="button secondary ai-character-button" disabled={busy} onClick={() => onAction("ai_main_character")}><Sparkles size={15} /> GENERATE MAIN CHARACTER WITH AI</button>
          <small className="sheet-view-contract">Neutral sheet contract: front, side, three-quarter, and back full body; front, side, and three-quarter face; neutral identity close-up.</small>
        </section>
      ) : null}

      {automatic.status === "NEEDS_USER_REVIEW" || automatic.status === "FAILED" ? (
        <section className="automatic-panel automatic-error-panel"><CircleAlert size={20} /><div><strong>{automatic.status === "FAILED" ? "Automatic stage failed" : "User review needed"}</strong><p>{automatic.lastError || automatic.stages.find((stage) => ["FAILED", "NEEDS_USER_REVIEW"].includes(stage.status))?.note}</p></div><button className="button primary" onClick={() => onAction("resume")}>Retry</button></section>
      ) : null}

      <section className="automatic-panel">
        <div className="automatic-panel-heading"><div><span className="eyebrow">LIVE PRODUCTION STATE</span><h3>Production progress</h3></div><span className={`automatic-status-pill status-${automatic.status.toLowerCase()}`}>{automatic.status.replaceAll("_", " ")}</span></div>
        <div className="automatic-stage-list">
          {automatic.stages.map((stage) => (
            <div className={`automatic-stage-row stage-${stage.status.toLowerCase()}`} key={stage.id}>
              <span className="stage-icon">{stage.status === "COMPLETE" ? <Check size={14} /> : stage.status === "RUNNING" ? <Sparkles size={14} /> : stage.status === "WAITING" ? <UserRound size={14} /> : ["FAILED", "NEEDS_USER_REVIEW"].includes(stage.status) ? <CircleAlert size={14} /> : <Clock3 size={14} />}</span>
              <div><strong>{stage.label}</strong>{stage.note ? <small>{stage.note}</small> : null}</div>
              <span>{stage.status.replaceAll("_", " ")}</span>
            </div>
          ))}
        </div>
      </section>

      {automatic.status === "COMPLETE" ? (
        <section className="automatic-panel automatic-final-actions">
          <div className="automatic-panel-heading"><div><span className="eyebrow">PRODUCTION READY</span><h3>Open or download your production</h3></div><Film size={26} /></div>
          <div className="final-action-grid">
            <button className="button primary" onClick={() => onNavigate("prompts")}><Play size={15} /> Open Sequence 01</button>
            <button className="button secondary" onClick={onDownloadAssets}><Download size={15} /> Download All Assets</button>
            <button className="button secondary" onClick={onDownloadSequencePacks}><FileArchive size={15} /> Download All Sequence Packs</button>
            <button className="button secondary" onClick={() => onNavigate("full_script")}>View Full Script</button>
            <button className="button secondary" onClick={() => onNavigate("story")}>View Story</button>
            <button className="button secondary" onClick={() => onNavigate("continuity")}>View Continuity</button>
            <button className="button secondary" onClick={onDownloadProject}><Download size={15} /> Export Project</button>
          </div>
        </section>
      ) : null}

      <section className="automatic-panel automatic-history">
        <div className="automatic-panel-heading"><div><span className="eyebrow">INSPECTABLE AUTOMATION</span><h3>Studio Brain decision history</h3></div><History size={20} /></div>
        {automatic.history.length ? <div className="decision-history-list">{[...automatic.history].reverse().slice(0, 20).map((entry) => <div key={entry.id}><span>{new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><div><strong>{entry.action.replaceAll("_", " ")}</strong><p>{entry.reason}</p></div></div>)}</div> : <p className="muted-copy">Decisions will appear as the Automatic Production Director progresses.</p>}
      </section>
    </div>
  );
}
