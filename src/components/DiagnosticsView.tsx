import { useEffect, useState } from "react";
import { Clipboard, RefreshCw, Stethoscope } from "lucide-react";
import { api } from "../api";
import type { BrainMode, DiagnosticsSnapshot } from "../types";

export function DiagnosticsView({ brain }: { brain?: BrainMode }) {
  const [data, setData] = useState<DiagnosticsSnapshot>();
  const [copied, setCopied] = useState(false);
  const refresh = () => api.diagnostics(brain).then(setData);
  useEffect(() => { void refresh(); }, [brain]);
  if (!data) return <div className="empty-artifact"><Stethoscope size={26} /><h2>Loading diagnostics</h2></div>;
  const rows = [
    ["Desktop version", data.desktopVersion], ["Backend version", data.backendVersion], ["Codex version", data.codexVersion || "Unavailable"],
    ["Codex connection", data.codexConnection], ["Local model connection", data.localModelConnection], ["Project directory", data.projectDirectory],
    ["Current brain", data.currentBrain], ["Platform", data.platform],
  ];
  const copy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  return <div className="artifact-page diagnostics-page"><section className="diagnostics-card"><div className="section-heading"><div><span className="eyebrow">System diagnostics · By BURABEEH</span><h2>Continuity Studio runtime</h2></div><div className="settings-actions"><button className="button secondary" onClick={refresh}><RefreshCw size={14} /> Refresh</button><button className="button primary" onClick={copy}><Clipboard size={14} /> {copied ? "Copied" : "Copy diagnostics"}</button></div></div>{rows.map(([label, value]) => <div className="diagnostic-row" key={label}><span>{label}</span><code>{value}</code></div>)}</section><section className="diagnostics-card"><span className="eyebrow">Recent errors</span>{data.recentErrors.length ? data.recentErrors.map((error) => <article className="diagnostic-error" key={`${error.createdAt}-${error.message}`}><time>{new Date(error.createdAt).toLocaleString()}</time><strong>{error.category}</strong><p>{error.message}</p></article>) : <p className="settings-help">No recent application errors.</p>}</section></div>;
}
