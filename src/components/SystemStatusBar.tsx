import { Bot, BrainCircuit, Cpu, Film, Gauge, Server, Sparkles, Workflow } from "lucide-react";
import type { BrainStatusSnapshot, MovieProject } from "../types";

const stateClass = (state?: string) => state?.replaceAll("_", "-") ?? "disconnected";

export function SystemStatusBar({ project, status }: { project?: MovieProject; status?: BrainStatusSnapshot }) {
  const progressStages = ["project_setup", "movie_dna", "story", "film_bible", "characters", "asset_manifest", "sequences", "platform_prompts", "video_review", "export"];
  const completed = project?.production.gates.filter((gate) => progressStages.includes(gate.stage) && ["APPROVED", "LOCKED"].includes(gate.status)).length ?? 0;
  const sequenceTotal = project?.production.sequences.length ?? 0;
  const sequenceApproved = project?.production.sequences.filter((sequence) => ["APPROVED", "LOCKED"].includes(sequence.status)).length ?? 0;
  const videoReviewStarted = project?.production.sequences.some((sequence) => Boolean(sequence.videoPath) || ["GENERATED", "REJECTED", "APPROVED", "LOCKED"].includes(sequence.status));
  const progress = project
    ? project.status === "complete" || (videoReviewStarted && sequenceTotal > 0 && sequenceApproved === sequenceTotal)
      ? 100
      : videoReviewStarted && sequenceTotal > 0
        ? Math.round((sequenceApproved / sequenceTotal) * 100)
        : Math.round((completed / progressStages.length) * 100)
    : 0;
  const current = project?.phases.find((phase) => phase.state === "running" || phase.state === "awaiting_approval" || phase.state === "failed");
  const brain = project?.brain.selected ?? status?.defaultBrain ?? "hybrid";
  const model = brain === "codex"
    ? status?.codex.model
    : brain === "hybrid"
      ? `${status?.local.model || "Offline"} + ${status?.codex.model || "Codex"}`
      : status?.local.model || "Built-in offline";
  const items = [
    { icon: Film, label: "Project", value: project?.title ?? "No project" },
    { icon: BrainCircuit, label: "Brain", value: brain.toUpperCase() },
    { icon: Cpu, label: "Model", value: model || "Default" },
    { icon: Sparkles, label: "Codex", value: status?.codex.state ?? "loading", state: status?.codex.state },
    { icon: Server, label: "Local model", value: status?.local.state ?? "loading", state: status?.local.state },
    { icon: Workflow, label: "Current phase", value: current?.label ?? project?.currentPhase?.replaceAll("_", " ") ?? "Idle" },
    { icon: Bot, label: "Current agent", value: project?.currentAgent ?? "Production controller" },
    { icon: Gauge, label: "Progress", value: `${progress}%` },
  ];
  return (
    <div className="system-status-bar">
      {items.map(({ icon: Icon, label, value, state }) => (
        <div key={label} className="system-status-item">
          <Icon size={12} />
          <span>{label}</span>
          {state ? <i className={`status-dot ${stateClass(state)}`} /> : null}
          <strong title={value}>{value}</strong>
        </div>
      ))}
    </div>
  );
}
