import { useState, type FormEvent } from "react";
import { Aperture, X } from "lucide-react";
import type { CreateProjectInput, RunMode, UserBrainMode } from "../types";

interface CreateProjectModalProps {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (input: CreateProjectInput) => Promise<void>;
}

const defaults: CreateProjectInput = {
  title: "The Last Camp",
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
  if (!open) return null;

  const set = <K extends keyof CreateProjectInput>(key: K, value: CreateProjectInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onCreate(form);
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
          <label className="span-2">Movie title<input value={form.title} onChange={(event) => set("title", event.target.value)} required /></label>
          <label className="span-2">Main idea<textarea rows={4} value={form.idea} onChange={(event) => set("idea", event.target.value)} required /></label>
          <label>Genre<input value={form.genre} onChange={(event) => set("genre", event.target.value)} required /></label>
          <label>Language<input value={form.language} onChange={(event) => set("language", event.target.value)} required /></label>
          <label>Runtime (minutes)<input type="number" min="0.5" max="180" step="0.5" value={form.runtimeMinutes} onChange={(event) => set("runtimeMinutes", Number(event.target.value))} required /></label>
          <label>Number of sequences<input type="number" min="1" max="120" value={form.sequenceCount} onChange={(event) => set("sequenceCount", Number(event.target.value))} required /></label>
          <label className="span-2">Visual style<input value={form.visualStyle} onChange={(event) => set("visualStyle", event.target.value)} required /></label>
          <label>Era / period<input value={form.era} onChange={(event) => set("era", event.target.value)} required /></label>
          <label>Aspect ratio<select value={form.aspectRatio} onChange={(event) => set("aspectRatio", event.target.value)}><option>2.39:1</option><option>16:9</option><option>1.85:1</option><option>9:16</option><option>1:1</option></select></label>
        </div>

        <div className="mode-field">
          <span>Pre-story workflow</span>
          <div className="brain-create-options">
            {(["AI_FIRST", "REFERENCE_FIRST", "HYBRID"] as const).map((storyMode) => (
              <button key={storyMode} type="button" className={form.storyMode === storyMode ? "selected" : ""} onClick={() => set("storyMode", storyMode)}>
                <strong>{storyMode.replace("_", " ")}</strong>
                <small>{storyMode === "AI_FIRST" ? "Start without uploads" : storyMode === "REFERENCE_FIRST" ? "Upload references before Story" : "Mix uploaded references with AI planning"}</small>
              </button>
            ))}
          </div>
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
          <button type="submit" className="button primary" disabled={busy}>{busy ? "Creating…" : "Create project"}</button>
        </div>
      </form>
    </div>
  );
}
