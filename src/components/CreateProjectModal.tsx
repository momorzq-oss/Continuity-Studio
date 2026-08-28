import { useState, type FormEvent } from "react";
import { Aperture, X } from "lucide-react";
import type { CreateProjectInput, RunMode, UserBrainMode } from "../types";
import { ReferenceImagePicker, type PendingReferenceImage } from "./ReferenceImagePicker";

interface CreateProjectModalProps {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (input: CreateProjectInput) => Promise<void>;
}

const defaults: CreateProjectInput = {
  title: "The Last Camp Production",
  movieTitle: "The Last Camp",
  idea: "1965 UAE desert. Rashid becomes lost while travelling with his camel and finds a strange Bedouin camp.",
  genre: "Folk Horror",
  runtimeMinutes: 6,
  sequenceCount: 12,
  language: "Arabic / English",
  visualStyle: "1965 UAE desert, grounded cinematic realism, widescreen",
  mode: "phases",
  brain: "hybrid",
  storyMode: "AI_FIRST",
  era: "1965 UAE",
  aspectRatio: "2.39:1",
  sequenceDurationSeconds: 8,
  resolution: "4K UHD",
  filmLanguage: "English",
  dialogueLanguage: "English",
  audienceRating: "General / PG-13",
  targetPlatform: "Seedance",
  narrationEnabled: false,
  dialogueEnabled: true,
  musicEnabled: true,
  subtitlesEnabled: true,
  autoGenerateAssets: true,
  autoGenerateScenes: true,
  autoGenerateStoryboard: true,
};

export function CreateProjectModal({
  open,
  busy,
  onClose,
  onCreate,
}: CreateProjectModalProps) {
  const [form, setForm] = useState(defaults);
  const [useMainReference, setUseMainReference] = useState(false);
  const [mainCharacterName, setMainCharacterName] = useState("Main Character");
  const [mainReference, setMainReference] = useState<PendingReferenceImage>();
  if (!open) return null;

  const set = <K extends keyof CreateProjectInput>(key: K, value: CreateProjectInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (useMainReference && !mainReference) return;
    await onCreate({
      ...form,
      sequenceCount: Math.max(1, Math.min(120, Math.ceil((form.runtimeMinutes * 60) / (form.sequenceDurationSeconds ?? 8)))),
      language: (form.filmLanguage ?? form.language) === (form.dialogueLanguage ?? form.language) ? (form.filmLanguage ?? form.language) : `${form.filmLanguage ?? form.language} / ${form.dialogueLanguage ?? form.language}`,
      storyMode: useMainReference ? "REFERENCE_FIRST" : "AI_FIRST",
      mainCharacterReference: useMainReference && mainReference ? {
        ...mainReference,
        name: mainCharacterName.trim() || "Main Character",
        type: "character",
        mainCharacter: true,
        storyUsage: "REQUIRED",
        roles: ["IDENTITY"],
      } : undefined,
    });
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="create-modal" onSubmit={submit}>
        <div className="modal-header">
          <div className="modal-title">
            <span className="brand-mark"><Aperture size={17} /></span>
            <div><h2>Create movie project</h2><p>The agent will build and save every production phase.</p></div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>

        <div className="form-grid">
          <label>Project name<input value={form.title} onChange={(event) => set("title", event.target.value)} required /></label>
          <label>Movie title<input value={form.movieTitle ?? ""} onChange={(event) => set("movieTitle", event.target.value)} required /></label>
          <label className="span-2">Main idea<textarea rows={4} value={form.idea} onChange={(event) => set("idea", event.target.value)} required /></label>
          <label>Genre<input value={form.genre} onChange={(event) => set("genre", event.target.value)} required /></label>
          <label>Film language<input value={form.filmLanguage} onChange={(event) => set("filmLanguage", event.target.value)} required /></label>
          <label>Dialogue language<input value={form.dialogueLanguage} onChange={(event) => set("dialogueLanguage", event.target.value)} required /></label>
          <label>Runtime (minutes)<input type="number" min="0.5" max="180" step="0.5" value={form.runtimeMinutes} onChange={(event) => set("runtimeMinutes", Number(event.target.value))} required /></label>
          <label>Sequence duration (seconds)<input type="number" min="1" max="120" value={form.sequenceDurationSeconds} onChange={(event) => set("sequenceDurationSeconds", Number(event.target.value))} required /></label>
          <label>Auto sequence count<input readOnly value={Math.max(1, Math.min(120, Math.ceil((form.runtimeMinutes * 60) / (form.sequenceDurationSeconds ?? 8))))} /></label>
          <label className="span-2">Visual style<input value={form.visualStyle} onChange={(event) => set("visualStyle", event.target.value)} required /></label>
          <label>Era / period<input value={form.era} onChange={(event) => set("era", event.target.value)} required /></label>
          <label>Aspect ratio<select value={form.aspectRatio} onChange={(event) => set("aspectRatio", event.target.value)}><option>2.39:1</option><option>16:9</option><option>1.85:1</option><option>9:16</option><option>1:1</option></select></label>
          <label>Resolution<select value={form.resolution} onChange={(event) => set("resolution", event.target.value)}><option>4K UHD</option><option>4K DCI</option><option>1080p</option><option>2K DCI</option></select></label>
          <label>Audience / rating<input value={form.audienceRating} onChange={(event) => set("audienceRating", event.target.value)} required /></label>
          <label>Target platform<select value={form.targetPlatform} onChange={(event) => set("targetPlatform", event.target.value as CreateProjectInput["targetPlatform"])}><option>Seedance</option><option>Higgsfield</option><option>MiniMax</option><option>Veo</option><option>Kling</option><option>Runway</option><option>Sora</option><option>Custom</option></select></label>
        </div>

        <div className="mode-field main-reference-create">
          <span>Main Character Reference</span>
          <div className="main-reference-choice" role="group" aria-label="Main Character Reference">
            <button type="button" className={!useMainReference ? "selected" : ""} onClick={() => { setUseMainReference(false); set("storyMode", "AI_FIRST"); }}><strong>No Main Character Reference</strong><small>Story Without Main Character Reference</small></button>
            <button type="button" className={useMainReference ? "selected" : ""} onClick={() => { setUseMainReference(true); set("storyMode", "REFERENCE_FIRST"); }}><strong>Use Main Character Reference</strong><small>Story With Main Character Reference</small></button>
          </div>
          {useMainReference ? <div className="new-project-reference"><label>Main character name<input value={mainCharacterName} onChange={(event) => setMainCharacterName(event.target.value)} required /></label><ReferenceImagePicker value={mainReference} onChange={setMainReference} title="Drop the Main Character reference here" detail="The original person remains the highest-priority identity source." /></div> : null}
        </div>

        <div className="mode-field">
          <span>Agent mode</span>
          <div className="mode-options">
            {(["full", "phases"] as RunMode[]).map((mode) => (
              <button key={mode} type="button" className={form.mode === mode ? "selected" : ""} onClick={() => set("mode", mode)}>
                <strong>{mode === "full" ? "Full production" : "Phase by phase"}</strong>
                <small>{mode === "full" ? "Run all phases automatically" : "Review and approve every phase"}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="mode-field brain-create-field">
          <span>Production brain</span>
          <div className="brain-create-options">
            {(["local", "codex", "hybrid"] as UserBrainMode[]).map((brain) => (
              <button key={brain} type="button" className={form.brain === brain ? "selected" : ""} onClick={() => set("brain", brain)}>
                <strong>{brain.toUpperCase()}{brain === "hybrid" ? " · Recommended" : ""}</strong>
                <small>{brain === "local" ? "Offline engine or your local LLM" : brain === "codex" ? "Codex App Server supervision" : "Local production with Codex supervision"}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="mode-field auto-generation-field">
          <span>Film tracks</span>
          <div className="auto-generation-options production-track-options">
            <label><input type="checkbox" checked={form.narrationEnabled} onChange={(event) => set("narrationEnabled", event.target.checked)} /> Narration</label>
            <label><input type="checkbox" checked={form.dialogueEnabled} onChange={(event) => set("dialogueEnabled", event.target.checked)} /> Dialogue</label>
            <label><input type="checkbox" checked={form.musicEnabled} onChange={(event) => set("musicEnabled", event.target.checked)} /> Music</label>
            <label><input type="checkbox" checked={form.subtitlesEnabled} onChange={(event) => set("subtitlesEnabled", event.target.checked)} /> Subtitles</label>
          </div>
        </div>

        <div className="mode-field auto-generation-field">
          <span>Visual automation</span>
          <div className="auto-generation-options">
            <label><input type="checkbox" checked={form.autoGenerateAssets} onChange={(event) => set("autoGenerateAssets", event.target.checked)} /> Generate asset images & sheets</label>
            <label><input type="checkbox" checked={form.autoGenerateScenes} onChange={(event) => set("autoGenerateScenes", event.target.checked)} /> Generate scene images</label>
            <label><input type="checkbox" checked={form.autoGenerateStoryboard} onChange={(event) => set("autoGenerateStoryboard", event.target.checked)} /> Generate storyboard frames</label>
          </div>
          <small>Built-in local rendering uses no paid credits. External paid providers always require a queue approval.</small>
        </div>

        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="button primary" disabled={busy || (useMainReference && !mainReference)}>{busy ? "Creating…" : useMainReference && !mainReference ? "Choose Main Character Image" : "Create project"}</button>
        </div>
      </form>
    </div>
  );
}
