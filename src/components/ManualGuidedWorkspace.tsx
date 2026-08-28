import { ArrowLeft, ArrowRight, Check, CircleAlert, Clock3, Save, Sparkles, WandSparkles, X } from "lucide-react";
import type { ManualGuidedStepId, MovieProject } from "../types";
import type { ViewId } from "./Sidebar";

type GuidedGroupId = "brief" | "setup" | "movie_dna" | "story" | "film_bible" | "characters" | "assets" | "continuity" | "audio" | "script" | "shots" | "sequences" | "prompts" | "export";

const groups: Array<{ id: GuidedGroupId; label: string; steps: ManualGuidedStepId[] }> = [
  { id: "brief", label: "Brief", steps: [] },
  { id: "setup", label: "Setup", steps: ["project_setup"] },
  { id: "movie_dna", label: "Movie DNA", steps: ["movie_dna", "movie_dna_board"] },
  { id: "story", label: "Story", steps: ["story"] },
  { id: "film_bible", label: "Film Bible", steps: ["film_bible"] },
  { id: "characters", label: "Characters", steps: ["characters", "character_sheets"] },
  { id: "assets", label: "Assets", steps: ["asset_manifest", "asset_generation"] },
  { id: "continuity", label: "Continuity", steps: ["story_timeline", "continuity_ledger"] },
  { id: "audio", label: "Audio", steps: ["audio_bible"] },
  { id: "script", label: "Script", steps: ["full_script", "dialogue"] },
  { id: "shots", label: "Shots", steps: ["shot_planner"] },
  { id: "sequences", label: "Sequences", steps: ["sequence_planner"] },
  { id: "prompts", label: "Prompts", steps: ["sequence_workspace"] },
  { id: "export", label: "Export", steps: ["export"] },
];

const stepCopy: Record<ManualGuidedStepId, { title: string; detail: string; why: string; next: string }> = {
  project_setup: { title: "Project Setup", detail: "Review the settings Studio Brain prepared from your brief.", why: "Runtime, delivery, language, audio, and platform settings control every downstream record.", next: "Visual Movie DNA" },
  movie_dna: { title: "Visual Movie DNA", detail: "Keep the recommendations or change, search, compare, and add custom options.", why: "A stable visual system prevents style, camera, lighting, and colour drift.", next: "Movie DNA Board" },
  movie_dna_board: { title: "Movie DNA Board", detail: "Review the complete visual direction before making it permanent.", why: "The locked board becomes the visual authority for Story, assets, shots, and prompts.", next: "Story" },
  story: { title: "Story", detail: "Generate from the brief, write manually, or paste an existing story, then review it.", why: "Only an approved Story may become Film Bible, characters, assets, or script.", next: "Film Bible" },
  film_bible: { title: "Film Bible", detail: "Generate the canonical world rules from the approved Story and review every section.", why: "The Film Bible prevents invented rules and downstream world contradictions.", next: "Characters" },
  characters: { title: "Characters", detail: "Review the analysed cast, roles, arcs, and permanent identities.", why: "Every later sheet and state must point to one stable character record.", next: "Character Sheets" },
  character_sheets: { title: "Character Sheets", detail: "Attach the Main Character identity source and generate the required neutral continuity sheet.", why: "A protected identity source prevents face drift and accidental redesign.", next: "Asset Manifest" },
  asset_manifest: { title: "Asset Manifest", detail: "Review the complete, permanently numbered production-image inventory.", why: "The manifest makes missing people, places, props, vehicles, and states visible before generation.", next: "Generate Assets" },
  asset_generation: { title: "Generate & Review Assets", detail: "Generate the planned references, inspect them, and approve only the correct results.", why: "Approved assets are the visual source used by sequence reference maps.", next: "Story Timeline" },
  story_timeline: { title: "Story Timeline", detail: "Review the chronological events and state changes extracted from approved production sources.", why: "The timeline establishes when every continuity change happens.", next: "Continuity Ledger" },
  continuity_ledger: { title: "Continuity Ledger", detail: "Review persistent character, prop, vehicle, location, and environment states.", why: "The ledger transfers approved end states forward and exposes contradictions.", next: "Audio Bible" },
  audio_bible: { title: "Audio Bible", detail: "Review language, voices, narration, ambience, effects, music, silence, and subtitles.", why: "Stable sound rules keep voices and audio intent consistent across sequences.", next: "Full Script" },
  full_script: { title: "Full Script", detail: "Generate and review screenplay, action, performance, timing, and production structure.", why: "The Script converts approved story events into exact production instructions.", next: "Dialogue" },
  dialogue: { title: "Dialogue Lock", detail: "Review exact words, language, timing, delivery, and pronunciation before locking.", why: "Locked dialogue must remain identical in shots, audio, prompts, and regeneration.", next: "Shot Planner" },
  shot_planner: { title: "Shot Planner", detail: "Review framing, camera, lens, motion, action, timing, sound, and continuity purpose.", why: "Intentional shots make sequence prompts precise and editable.", next: "Sequence Planner" },
  sequence_planner: { title: "Sequence Planner", detail: "Review formal Start, Mid, and End states for the complete movie runtime.", why: "Sequences turn the script into platform-ready generation units.", next: "Sequence Workspace" },
  sequence_workspace: { title: "Sequence Workspace", detail: "Review synchronized Normal and JSON prompts, platforms, references, validation, and versions.", why: "One canonical Prompt State prevents prompt and reference-map drift.", next: "Export" },
  export: { title: "Final Project Export", detail: "Review readiness and download the complete structured production package.", why: "The export preserves the movie source of truth, decisions, history, and production outputs.", next: "Complete" },
};

const stepViews: Record<ManualGuidedStepId, ViewId> = {
  project_setup: "project_setup", movie_dna: "movie_dna", movie_dna_board: "movie_dna", story: "story", film_bible: "film_bible",
  characters: "characters", character_sheets: "characters", asset_manifest: "asset_manifest", asset_generation: "assets",
  story_timeline: "timeline", continuity_ledger: "continuity", audio_bible: "audio_bible", full_script: "full_script",
  dialogue: "full_script", shot_planner: "full_script", sequence_planner: "sequences", sequence_workspace: "sequences", export: "export",
};
export const manualStepView = (step: ManualGuidedStepId): ViewId => stepViews[step];

const nextLabel = (project: MovieProject) => {
  const step = project.manualProduction.currentStep;
  if (step === "project_setup" || step === "movie_dna_board" || step === "dialogue") return "LOCK AND NEXT";
  if (step === "story") return !project.production.story.version ? "GENERATE STORY FROM BRIEF" : ["APPROVED", "LOCKED"].includes(project.production.story.status) ? "NEXT" : "APPROVE AND NEXT";
  if (step === "film_bible") return !project.production.filmBible.version ? "GENERATE FILM BIBLE" : ["APPROVED", "LOCKED"].includes(project.production.filmBible.status) ? "NEXT" : "APPROVE AND NEXT";
  if (step === "characters") return !project.production.characters.length ? "ANALYSE CHARACTERS" : "APPROVE AND NEXT";
  if (step === "asset_manifest") return !project.production.assets.length ? "BUILD ASSET MANIFEST" : "NEXT";
  if (step === "asset_generation") return project.production.assets.some((asset) => asset.required !== false && asset.canGenerate !== false && !asset.imagePath) ? "GENERATE ASSETS" : "APPROVE AND NEXT";
  if (step === "story_timeline") return project.memory.productionMemory.storyTimeline.events.length ? "NEXT" : "BUILD TIMELINE AND NEXT";
  if (step === "audio_bible") return ["APPROVED", "LOCKED"].includes(project.memory.productionMemory.audioBible.status) ? "NEXT" : "APPROVE AND NEXT";
  if (step === "full_script") return !project.memory.productionMemory.script.scriptVersion ? "GENERATE FULL SCRIPT" : ["APPROVED", "LOCKED"].includes(project.memory.productionMemory.script.status) ? "NEXT" : "APPROVE AND NEXT";
  if (step === "sequence_planner") return project.memory.productionMemory.script.sequences.length ? "NEXT" : "PLAN SEQUENCES";
  if (step === "sequence_workspace") return Object.keys(project.production.promptWorkspace.records).length ? "NEXT" : "COMPILE PROMPTS";
  if (step === "export") return project.manualProduction.status === "COMPLETE" ? "GUIDED PRODUCTION COMPLETE" : "COMPLETE GUIDED PRODUCTION";
  return "NEXT";
};

const blocker = (project: MovieProject) => {
  if (project.manualProduction.currentStep === "character_sheets" && !project.preStorySetup.mainCharacterReferenceId && !project.production.assets.some((asset) => asset.category === "main_character" && asset.imagePath)) {
    return "Main Character reference or Generate Main Character is required.";
  }
  if (project.manualProduction.currentStep === "shot_planner" && !project.memory.productionMemory.script.shots.length) return "Generate Full Script first so the Shot Planner has shots to review.";
  return undefined;
};

export function ManualGuidedWorkspace({ project, activeView, busy, onNavigate, onAction, onSwitchAutomatic }: {
  project: MovieProject;
  activeView: ViewId;
  busy: boolean;
  onNavigate: (view: ViewId) => void;
  onAction: (action: "back" | "save" | "next") => Promise<void>;
  onSwitchAutomatic: () => Promise<void>;
}) {
  const state = project.manualProduction;
  const copy = stepCopy[state.currentStep];
  const currentGroup = groups.findIndex((group) => group.steps.includes(state.currentStep));
  const recommendation = state.recommendations.find((item) => {
    if (["project_setup", "movie_dna", "movie_dna_board"].includes(state.currentStep)) return ["Platform profile", "Genre", "Cinematic Style"].includes(item.label);
    if (state.currentStep === "audio_bible") return item.label === "Audio settings";
    return false;
  });
  const missing = blocker(project);
  const viewingGuidedStep = activeView === manualStepView(state.currentStep);
  return <>
    <section className="manual-guide" aria-label="Manual Guided Mode">
      <header><div><Sparkles size={15} /><span>MANUAL GUIDED MODE</span><strong>{copy.title}</strong></div><div><span><Clock3 size={12} />Saved {new Date(state.lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><button disabled={busy} onClick={() => { if (window.confirm("Switch to Automatic Mode and let Studio Brain continue from the existing project data?")) void onSwitchAutomatic(); }}><WandSparkles size={12} />Switch to Automatic</button></div></header>
      <div className="manual-progress">{groups.map((group, index) => { const completed = group.id === "brief" || index < currentGroup || state.status === "COMPLETE"; const active = index === currentGroup && state.status !== "COMPLETE"; return <button key={group.id} className={active ? "active" : completed ? "complete" : ""} disabled={!group.steps.length || (!completed && !active)} onClick={() => { const step = group.steps.find((item) => state.visitedSteps.includes(item)) ?? group.steps[0]; if (step) onNavigate(manualStepView(step)); }}><span>{completed ? <Check size={10} /> : index + 1}</span><small>{group.label}</small></button>; })}</div>
      <div className="manual-guide-context"><div><strong>{copy.detail}</strong><span><b>Why it matters:</b> {copy.why}</span></div><div><span>RECOMMENDED</span><strong>{recommendation ? `${recommendation.label}: ${recommendation.value}` : "Review the Studio Brain preparation, then continue when it matches your intent."}</strong><small>{recommendation?.reason ?? `Next: ${copy.next}`}</small></div>{!viewingGuidedStep ? <button onClick={() => onNavigate(manualStepView(state.currentStep))}>Return to {copy.title}<ArrowRight size={12} /></button> : null}</div>
    </section>
    <footer className="manual-guide-footer">
      <button className="button secondary" disabled={busy || state.currentStep === "project_setup"} onClick={() => void onAction("back")}><ArrowLeft size={13} />BACK</button>
      <button className="button secondary" disabled={busy} onClick={() => void onAction("save")}><Save size={13} />SAVE</button>
      <div>{missing ? <span><CircleAlert size={13} /><b>NEXT unavailable</b>{missing}</span> : <span><Check size={13} /><b>Ready for review</b>Next: {copy.next}</span>}</div>
      <button className="button primary" disabled={busy || Boolean(missing) || state.status === "COMPLETE"} onClick={() => void onAction("next")}>{busy ? "WORKING…" : nextLabel(project)}<ArrowRight size={13} /></button>
    </footer>
  </>;
}

export function ManualResumeDialog({ project, onResume, onView, onClose }: { project: MovieProject; onResume: () => void; onView: () => void; onClose: () => void }) {
  const copy = stepCopy[project.manualProduction.currentStep];
  return <div className="manual-resume-backdrop" role="presentation"><section className="manual-resume-dialog" role="dialog" aria-modal="true" aria-labelledby="manual-resume-title"><button className="manual-resume-close" onClick={onClose} aria-label="Close"><X size={15} /></button><Sparkles size={28} /><span>CONTINUE WHERE YOU LEFT OFF</span><h2 id="manual-resume-title">Current stage: {copy.title}</h2><p>{copy.detail}</p><small>All saved recommendations, changes, approvals, references, and generated records are still in this project.</small><div><button className="button primary" onClick={onResume}>RESUME<ArrowRight size={13} /></button><button className="button secondary" onClick={onView}>VIEW PROJECT</button></div></section></div>;
}
