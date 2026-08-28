import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Bot,
  BrainCircuit,
  Check,
  CircleAlert,
  Clock3,
  Download,
  LoaderCircle,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { BrainMode, BrainStatusSnapshot, MovieProject, PhaseProgress, RunMode, UserBrainMode } from "../types";

interface AgentViewProps {
  project: MovieProject;
  mode: RunMode;
  busy: boolean;
  onModeChange: (mode: RunMode) => void;
  onSend: (message: string) => Promise<void>;
  onApprove: () => Promise<void>;
  onRegenerate: () => Promise<void>;
  onDownload: () => void;
  status?: BrainStatusSnapshot;
  onBrainChange: (brain: BrainMode) => Promise<void>;
  onRecover: (action: "retry" | "continue_local" | "continue_codex" | "cancel") => Promise<void>;
  onCancel: () => Promise<void>;
  onResolveApproval: (id: string, decision: "allow" | "deny") => Promise<void>;
}

const phaseIcon = (phase: PhaseProgress) => {
  if (phase.state === "completed") return <Check size={13} />;
  if (phase.state === "running") return <LoaderCircle size={13} className="spin" />;
  if (phase.state === "awaiting_approval") return <CircleAlert size={13} />;
  if (phase.state === "failed") return <CircleAlert size={13} />;
  return <span>{String(phase.attempt ? phase.attempt : "")}</span>;
};

const time = (value: string) =>
  new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );

export function AgentView({
  project,
  mode,
  busy,
  onModeChange,
  onSend,
  onApprove,
  onRegenerate,
  onDownload,
  status,
  onBrainChange,
  onRecover,
  onCancel,
  onResolveApproval,
}: AgentViewProps) {
  const promptPackageReady = project.production.gates.find((gate) => gate.stage === "platform_prompts")?.status === "APPROVED";
  const initialDraft = project.status === "draft" && !promptPackageReady;
  const [input, setInput] = useState(initialDraft ? project.idea : "");
  const logRef = useRef<HTMLDivElement>(null);
  const stageByPhase = { story: "story", film_bible: "film_bible", assets: "asset_manifest", sequences: "sequences", frame_plans: "asset_sheets", prompts: "platform_prompts", continuity: "video_review", export: "export" } as const;
  const displayPhases = project.phases.map((phase) => {
    const gate = project.production.gates.find((item) => item.stage === stageByPhase[phase.id]);
    const state = gate?.status === "APPROVED" || gate?.status === "LOCKED" ? "completed" : gate?.status === "REVIEW" ? "awaiting_approval" : phase.state;
    return { ...phase, state, summary: gate?.note ?? phase.summary };
  });
  const completed = displayPhases.filter((phase) => phase.state === "completed").length;
  const progress = Math.round((completed / displayPhases.length) * 100);
  const current = displayPhases.find(
    (phase) => phase.state === "running" || phase.state === "awaiting_approval" || phase.state === "failed",
  );
  const approvals = status?.approvals.filter((approval) => approval.projectId === project.id) ?? [];
  const activities = project.brain.activity.slice(-8).reverse();

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [project.messages.length]);

  useEffect(() => {
    if (project.status === "draft" && !promptPackageReady) setInput(project.idea);
    else if (promptPackageReady) setInput("");
  }, [project.id, project.idea, project.status, promptPackageReady]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    setInput("");
    await onSend(value);
  };

  return (
    <div className="agent-layout">
      <section className="pipeline-panel">
        <div className="section-heading">
          <div><span className="eyebrow">Agent pipeline</span><h2>Production stages</h2></div>
          <span className="mono-muted">{completed}/{displayPhases.length}</span>
        </div>
        <div className="pipeline-progress"><i style={{ width: `${progress}%` }} /></div>
        <div className="phase-list">
          {displayPhases.map((phase, index) => (
            <div className={`phase-row ${phase.state}`} key={phase.id}>
              <div className="phase-index">{phaseIcon(phase) || String(index + 1).padStart(2, "0")}</div>
              <div className="phase-copy">
                <strong>{phase.label}</strong>
                <span>{phase.summary ?? phase.description}</span>
                {phase.provider ? <small>{phase.provider}</small> : null}
              </div>
              <em>{phase.state.replace("_", " ")}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="agent-console">
        <div className="console-header">
          <div className="agent-identity">
            <span><Bot size={18} /></span>
            <div><h2>Production Agent</h2><p>Director · Writer · Asset planner · Continuity lead</p></div>
          </div>
          <div className={`live-state ${project.status}`}>
            <i /> {project.status.replace("_", " ")}
          </div>
        </div>

        <div className="agent-log" ref={logRef}>
          {project.messages.map((item) => (
            <div className={`message ${item.role}`} key={item.id}>
              <div className="message-meta">
                <span>{item.role === "user" ? "YOU" : item.role === "system" ? "SYSTEM" : "PRODUCTION AGENT"}</span>
                {item.phase ? <em>{item.phase.replace("_", " ")}</em> : null}
                <time>{time(item.createdAt)}</time>
              </div>
              <p>{item.content}</p>
            </div>
          ))}
          {project.status === "running" ? (
            <div className="message agent working-message">
              <div className="message-meta"><span>PRODUCTION AGENT</span><em>{current?.label}</em></div>
              <p><LoaderCircle size={14} className="spin" /> Building the {current?.label.toLowerCase()} artifact and saving it to the project…</p>
            </div>
          ) : null}
        </div>

        <form className="agent-composer" onSubmit={submit}>
          <label htmlFor="agent-input">
            {initialDraft ? "Tell the agent what to create" : "Give the production agent an instruction"}
          </label>
          <textarea
            id="agent-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              project.status === "awaiting_approval"
                ? "Type changes for this phase, or approve it from the right panel…"
                : "Create a six-minute Emirati horror film set in 1965…"
            }
            rows={4}
          />
          <div className="composer-footer">
            <span><Sparkles size={13} /> Commands: create · approve · regenerate story/assets/sequences</span>
            <button className="button primary" type="submit" disabled={busy || !input.trim()}>
              {initialDraft ? <Play size={14} /> : <Send size={14} />}
              {initialDraft ? "Start production" : "Send instruction"}
            </button>
          </div>
        </form>
      </section>

      <aside className="agent-inspector">
        <section className="inspector-card">
          <div className="eyebrow">Brain</div>
          <div className="brain-switch" role="group" aria-label="Project brain">
            {(["local", "codex", "hybrid"] as UserBrainMode[]).map((brain) => (
              <button key={brain} className={project.brain.selected === brain ? "active" : ""} disabled={project.status === "running" || busy} onClick={() => onBrainChange(brain)}>{brain}</button>
            ))}
          </div>
        </section>
        <section className="inspector-card">
          <div className="eyebrow">Run mode</div>
          <div className="mode-switch" role="group" aria-label="Agent run mode">
            <button
              className={mode === "full" ? "active" : ""}
              onClick={() => onModeChange("full")}
              disabled={project.status === "running"}
            >
              <strong>Full</strong><span>Automatic</span>
            </button>
            <button
              className={mode === "phases" ? "active" : ""}
              onClick={() => onModeChange("phases")}
              disabled={project.status === "running"}
            >
              <strong>Phases</strong><span>Approve each</span>
            </button>
          </div>
          <p className="inspector-note">
            {mode === "full"
              ? "The agent continues through all eight stages and prepares the export automatically."
              : "The agent pauses after every generated artifact so you can approve it or type revisions."}
          </p>
        </section>

        <section className="inspector-card">
          <div className="eyebrow">Provider</div>
          <div className="provider-line"><i className={`status-dot ${project.status === "failed" ? "failed" : "complete"}`} /><div><strong>{project.brain.selected.toUpperCase()} Brain</strong><span>{project.provider.model ?? project.provider.label}</span></div></div>
        </section>

        {activities.length ? <section className="inspector-card activity-card"><div className="eyebrow">Brain activity</div>{activities.map((activity) => <div className={`activity-row ${activity.state}`} key={activity.id}><BrainCircuit size={11} /><div><strong>{activity.agent}</strong><span>{activity.summary}</span></div></div>)}</section> : null}

        {approvals.map((approval) => <section className="approval-card codex-approval" key={approval.id}><div className="approval-title"><ShieldCheck size={15} /><span>Codex approval</span></div><strong>{approval.title}</strong><p>{approval.detail}</p>{approval.command ? <code>{approval.command}</code> : null}<div className="approval-actions"><button className="button primary" onClick={() => onResolveApproval(approval.id, "allow")}><Check size={14} /> Allow</button><button className="button secondary" onClick={() => onResolveApproval(approval.id, "deny")}><XCircle size={14} /> Deny</button></div></section>)}

        {project.brain.recovery ? <section className="approval-card recovery-card"><div className="approval-title"><CircleAlert size={15} /><span>{project.brain.recovery.failedBrain.toUpperCase()} failed</span></div><p>{project.brain.recovery.message}</p><button className="button primary full-width" onClick={() => onRecover("retry")}>Retry {project.brain.recovery.failedBrain}</button>{project.brain.recovery.actions.includes("continue_local") ? <button className="button secondary full-width" onClick={() => onRecover("continue_local")}>Continue Local</button> : null}{project.brain.recovery.actions.includes("continue_codex") ? <button className="button secondary full-width" onClick={() => onRecover("continue_codex")}>Continue with Codex</button> : null}<button className="button secondary full-width" onClick={() => onRecover("cancel")}>Cancel production</button></section> : null}

        <section className="inspector-card current-task-card">
          <div className="eyebrow">Current task</div>
          <h3>{current?.label ?? (project.status === "complete" ? "Production complete" : promptPackageReady ? "Manual generation ready" : "Ready to begin")}</h3>
          <p>{current?.summary ?? current?.description ?? (promptPackageReady ? "Open Sequences to download references, copy the compiled platform prompt, generate externally, and upload the video for continuity review." : "Enter the movie idea and start the agent.")}</p>
          {current?.attempt ? <span className="attempt">Attempt {current.attempt}</span> : null}
        </section>

        {project.status === "awaiting_approval" ? (
          <section className="approval-card">
            <div className="approval-title"><Clock3 size={15} /><span>Waiting for your review</span></div>
            <p>{current?.summary} Approving will start the next production agent.</p>
            <button className="button primary full-width" onClick={onApprove} disabled={busy}><Check size={14} /> Approve & continue</button>
            <button className="button secondary full-width" onClick={onRegenerate} disabled={busy}><RotateCcw size={14} /> Regenerate phase</button>
          </section>
        ) : null}

        {project.status === "complete" ? (
          <section className="approval-card complete-card">
            <div className="approval-title"><Check size={15} /><span>Project ready</span></div>
            <p>The complete folder structure and generated planning artifacts are ready.</p>
            <button className="button primary full-width" onClick={onDownload}><Download size={14} /> Download project ZIP</button>
          </section>
        ) : null}

        {project.status === "running" ? <button className="button secondary full-width cancel-production" onClick={onCancel} disabled={busy}><XCircle size={14} /> Cancel production</button> : null}
      </aside>
    </div>
  );
}
