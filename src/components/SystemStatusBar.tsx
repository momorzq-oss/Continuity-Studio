import { Bot, BrainCircuit, Cpu, Film, Gauge, Server, Sparkles, Workflow } from "lucide-react";
import type { BrainStatusSnapshot, MovieProject } from "../types";

const stateClass = (state?: string) => state?.replaceAll("_", "-") ?? "disconnected";

export function SystemStatusBar({ project, status }: { project?: MovieProject; status?: BrainStatusSnapshot }) {
  const completed = project?.phases.filter((phase) => phase.state === "completed").length ?? 0;
  const progress = project ? Math.round((completed / project.phases.length) * 100) : 0;
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
