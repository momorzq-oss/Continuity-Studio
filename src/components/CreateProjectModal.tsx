import { useState, type FormEvent } from "react";
import { Aperture, SlidersHorizontal, WandSparkles, X } from "lucide-react";
import type { CreateProjectInput, ProductionControlMode, TargetPlatform } from "../types";

interface CreateProjectModalProps {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (input: CreateProjectInput) => Promise<void>;
}

const defaults: CreateProjectInput = {
  title: "",
  movieTitle: "",
  idea: "",
  genre: "Drama",
  runtimeMinutes: 6,
  sequenceCount: 45,
  language: "English",
  visualStyle: "Cinematic realism",
  mode: "phases",
  controlMode: "manual",
  brain: "hybrid",
  storyMode: "AI_FIRST",
  era: "Contemporary",
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

export function CreateProjectModal({ open, busy, onClose, onCreate }: CreateProjectModalProps) {
  const [form, setForm] = useState(defaults);
  const [creationMode, setCreationMode] = useState<ProductionControlMode>("automatic");
  const [mainCharacterPreference, setMainCharacterPreference] = useState("Ask me at the Main Character checkpoint");
  const [preferredPlatform, setPreferredPlatform] = useState<"" | TargetPlatform>("");
  if (!open) return null;

  const set = <K extends keyof CreateProjectInput>(key: K, value: CreateProjectInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const movieTitle = form.movieTitle?.trim() || form.title.trim() || (creationMode === "automatic" ? "My Automatic Movie" : "Untitled Movie");
    const title = form.title.trim() || `${movieTitle} Production`;
    const duration = form.sequenceDurationSeconds ?? 8;
    await onCreate({
      ...form,
      title,
      movieTitle,
      controlMode: creationMode,
      mode: creationMode === "automatic" ? "full" : form.mode,
      genre: "Studio Brain selection",
      visualStyle: "Studio Brain selection from the movie brief",
      era: "Studio Brain selection",
      sequenceCount: Math.max(1, Math.min(120, Math.ceil((form.runtimeMinutes * 60) / duration))),
      language: (form.filmLanguage ?? form.language) === (form.dialogueLanguage ?? form.language) ? (form.filmLanguage ?? form.language) : `${form.filmLanguage ?? form.language} / ${form.dialogueLanguage ?? form.language}`,
      storyMode: "AI_FIRST",
      mainCharacterPreference: creationMode === "automatic" ? mainCharacterPreference.trim() || undefined : undefined,
      preferredPlatform: creationMode === "manual" && preferredPlatform ? preferredPlatform : undefined,
    });
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="create-modal" onSubmit={submit}>
        <div className="modal-header">
          <div className="modal-title">
            <span className="brand-mark"><Aperture size={17} /></span>
            <div><h2>Create movie project</h2><p>Choose how Continuity Studio By BURABEEH should build your production.</p></div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>

        <div className="creation-mode-grid" role="group" aria-label="Project creation mode">
          <button type="button" className={creationMode === "automatic" ? "creation-mode-card selected" : "creation-mode-card"} onClick={() => setCreationMode("automatic")}>
            <WandSparkles size={24} /><span><strong>AUTOMATIC MOVIE</strong><small>Describe your movie. Continuity Studio builds the production for you.</small></span>
          </button>
          <button type="button" className={creationMode === "manual" ? "creation-mode-card selected" : "creation-mode-card"} onClick={() => setCreationMode("manual")}>
            <SlidersHorizontal size={24} /><span><strong>MANUAL PRODUCTION</strong><small>Studio Brain recommends; you review every stage and decide when to continue.</small></span>
          </button>
        </div>

        {creationMode === "automatic" ? (
          <div className="automatic-create-panel">
            <div className="automatic-create-intro"><WandSparkles size={18} /><div><strong>One brief. One required identity checkpoint.</strong><small>Studio Brain selects global Movie DNA, then creates the editable production package using the existing workflow.</small></div></div>
            <div className="form-grid">
              <label>Movie title <small>Optional</small><input value={form.movieTitle ?? ""} onChange={(event) => set("movieTitle", event.target.value)} placeholder="Studio Brain can name it" /></label>
              <label>Approximate duration (minutes)<input type="number" min="0.5" max="180" step="0.5" value={form.runtimeMinutes} onChange={(event) => set("runtimeMinutes", Number(event.target.value))} required /></label>
              <label className="span-2">Brief movie idea<textarea rows={7} value={form.idea} onChange={(event) => set("idea", event.target.value)} placeholder="Describe the movie, its world, characters, feeling, and ending direction in your own words…" required /></label>
              <label>Main language<input value={form.filmLanguage} onChange={(event) => set("filmLanguage", event.target.value)} required /></label>
              <label>Dialogue language<input value={form.dialogueLanguage} onChange={(event) => set("dialogueLanguage", event.target.value)} required /></label>
              <label className="span-2">Main character preference<input value={mainCharacterPreference} onChange={(event) => setMainCharacterPreference(event.target.value)} placeholder="For example: woman in her 30s, fictional hero, or ask me later" /></label>
            </div>
            <div className="automatic-checkpoint-note"><strong>Main Character checkpoint</strong><span>Automatic Mode will pause before visual asset production so you can upload a protected identity image or choose an AI-generated character.</span></div>
          </div>
        ) : (
          <div className="manual-create-panel">
            <div className="automatic-create-intro"><SlidersHorizontal size={18} /><div><strong>DESCRIBE YOUR MOVIE</strong><small>Studio Brain will analyse one simple brief, prefill Setup and Visual Movie DNA, then wait for your decision at every stage.</small></div></div>
            <div className="form-grid">
              <label>Movie title <small>Optional</small><input value={form.movieTitle ?? ""} onChange={(event) => set("movieTitle", event.target.value)} placeholder="You can name it later" /></label>
              <label>Approximate duration (minutes)<input type="number" min="0.5" max="180" step="0.5" value={form.runtimeMinutes} onChange={(event) => set("runtimeMinutes", Number(event.target.value))} required /></label>
              <label className="span-2">Brief description of the movie<textarea rows={8} value={form.idea} onChange={(event) => set("idea", event.target.value)} placeholder="A supernatural thriller about a man who gets lost in the desert at night and discovers a strange camp. I want it tense, realistic, cinematic, and around six minutes." required /></label>
              <label>Language<input value={form.filmLanguage} onChange={(event) => set("filmLanguage", event.target.value)} required /></label>
              <label>Dialogue language<input value={form.dialogueLanguage} onChange={(event) => set("dialogueLanguage", event.target.value)} required /></label>
              <label className="span-2">Preferred platform <small>Optional</small><select value={preferredPlatform} onChange={(event) => setPreferredPlatform(event.target.value as "" | TargetPlatform)}><option value="">Let Studio Brain recommend</option><option>Seedance</option><option>Higgsfield</option><option>MiniMax</option><option>Veo</option><option>Kling</option><option>Runway</option><option>Sora</option><option>Custom</option></select></label>
            </div>
            <div className="automatic-checkpoint-note"><strong>What happens after NEXT</strong><span>Project Setup and all visual recommendations are filled in. Nothing is automatically approved in Manual Mode.</span></div>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="button primary" disabled={busy || form.idea.trim().length < 12}>
            {busy ? "Analysing brief…" : creationMode === "automatic" ? "CREATE MY MOVIE" : "NEXT"}
          </button>
        </div>
      </form>
    </div>
  );
}
