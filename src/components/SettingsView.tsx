import { useEffect, useState } from "react";
import { BrainCircuit, Check, LoaderCircle, LogIn, LogOut, RefreshCw, Save, Server } from "lucide-react";
import { api } from "../api";
import type { AppSettings, BrainStatusSnapshot } from "../types";

export function SettingsView({
  settings,
  status,
  onChange,
  onRefresh,
}: {
  settings: AppSettings;
  status?: BrainStatusSnapshot;
  onChange: (settings: AppSettings) => void;
  onRefresh: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [models, setModels] = useState<Array<{ id: string; model?: string; displayName?: string }>>([]);
  useEffect(() => setDraft(settings), [settings]);
  useEffect(() => {
    if (status?.codex.state !== "connected") return;
    let active = true;
    void api.codexModels().then((items) => {
      if (active) setModels(items);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [status?.codex.state]);

  const save = async () => {
    setBusy("save");
    try {
      const updated = await api.updateSettings(draft);
      onChange(updated);
      setNotice("Brain settings saved locally.");
      await onRefresh();
    } finally { setBusy(undefined); }
  };
  const testLocal = async () => {
    setBusy("local");
    try {
      await api.updateSettings({ local: draft.local } as Partial<AppSettings>);
      const result = await api.testLocal();
      setNotice(result.detail || result.state);
      await onRefresh();
    } finally { setBusy(undefined); }
  };
  const testCodex = async () => {
    setBusy("codex");
    try {
      const result = await api.testCodex();
      setNotice(result.detail || result.state);
      setModels(await api.codexModels().catch(() => []));
      await onRefresh();
    } finally { setBusy(undefined); }
  };
  const login = async () => {
    setBusy("login");
    try {
      const result = await api.codexLogin();
      if (result.authUrl) window.open(result.authUrl, "codex-auth", "width=620,height=780");
      setNotice("Complete the secure ChatGPT sign-in window. Continuity Studio never sees your password.");
    } finally { setBusy(undefined); }
  };

  return (
    <div className="artifact-page settings-page">
      <section className="settings-intro">
        <BrainCircuit size={24} />
        <div><span className="eyebrow">Brain Router</span><h2>Choose how production work is routed</h2><p>Every provider feeds the same film pipeline. Hybrid keeps repetitive work local and asks Codex to supervise project-wide reasoning.</p></div>
        <button className="button primary" onClick={save} disabled={Boolean(busy)}>{busy === "save" ? <LoaderCircle size={14} className="spin" /> : <Save size={14} />} Save settings</button>
      </section>
      {notice ? <div className="settings-notice"><Check size={14} />{notice}</div> : null}
      <div className="settings-grid">
        <section className="settings-card">
          <div className="settings-card-head"><Server size={17} /><div><span className="eyebrow">Local</span><h3>Local Brain</h3></div><em className={status?.local.state}>{status?.local.state ?? "unknown"}</em></div>
          <label className="toggle-row"><input type="checkbox" checked={draft.local.enabled} onChange={(event) => setDraft({ ...draft, local: { ...draft.local, enabled: event.target.checked } })} /><span>Use an OpenAI-compatible local LLM server</span></label>
          <label>Server URL<input value={draft.local.serverUrl} onChange={(event) => setDraft({ ...draft, local: { ...draft.local, serverUrl: event.target.value } })} /></label>
          <label>Model<input value={draft.local.model} placeholder="Select or type the installed model" onChange={(event) => setDraft({ ...draft, local: { ...draft.local, model: event.target.value } })} /></label>
          <div className="settings-row"><label>Context length<input type="number" value={draft.local.contextLength} onChange={(event) => setDraft({ ...draft, local: { ...draft.local, contextLength: Number(event.target.value) } })} /></label><label>Temperature<input type="number" min="0" max="2" step="0.05" value={draft.local.temperature} onChange={(event) => setDraft({ ...draft, local: { ...draft.local, temperature: Number(event.target.value) } })} /></label></div>
          <label>Timeout (milliseconds)<input type="number" value={draft.local.timeoutMs} onChange={(event) => setDraft({ ...draft, local: { ...draft.local, timeoutMs: Number(event.target.value) } })} /></label>
          <button className="button secondary" onClick={testLocal} disabled={Boolean(busy)}>{busy === "local" ? <LoaderCircle size={14} className="spin" /> : <RefreshCw size={14} />} Test local connection</button>
          <p className="settings-help">When this switch is off, Local Brain uses the built-in offline engine and makes no internet request.</p>
        </section>

        <section className="settings-card">
          <div className="settings-card-head"><BrainCircuit size={17} /><div><span className="eyebrow">Codex</span><h3>Codex App Server</h3></div><em className={status?.codex.state}>{status?.codex.state ?? "unknown"}</em></div>
          <label>Codex model<select value={draft.codex.model} onChange={(event) => setDraft({ ...draft, codex: { ...draft.codex, model: event.target.value } })}><option value="">Codex recommended default</option>{models.map((model) => <option key={model.id} value={model.model || model.id}>{model.displayName || model.model || model.id}</option>)}</select></label>
          <label>Approval policy<select value={draft.codex.approvalPolicy} onChange={(event) => setDraft({ ...draft, codex: { ...draft.codex, approvalPolicy: event.target.value as AppSettings["codex"]["approvalPolicy"] } })}><option value="unlessTrusted">Ask outside trusted operations</option><option value="onRequest">Ask when Codex requests</option></select></label>
          <label className="toggle-row"><input type="checkbox" checked={draft.codex.autoStart} onChange={(event) => setDraft({ ...draft, codex: { ...draft.codex, autoStart: event.target.checked } })} /><span>Start Codex when needed</span></label>
          <div className="settings-actions"><button className="button secondary" onClick={testCodex} disabled={Boolean(busy)}><RefreshCw size={14} /> Test connection</button>{status?.codex.authMode ? <button className="button secondary" onClick={async () => { await api.codexLogout(); await onRefresh(); }}><LogOut size={14} /> Sign out</button> : <button className="button primary" onClick={login} disabled={Boolean(busy)}><LogIn size={14} /> Connect Codex</button>}</div>
          <p className="settings-help">Codex authentication is managed by Codex App Server. ChatGPT passwords and tokens are never stored by Continuity Studio.</p>
        </section>

        <section className="settings-card">
          <div className="settings-card-head"><BrainCircuit size={17} /><div><span className="eyebrow">Hybrid · Recommended</span><h3>Supervisor routing</h3></div></div>
          <label>Routing policy<select value={draft.hybrid.routingPolicy} onChange={(event) => setDraft({ ...draft, hybrid: { ...draft.hybrid, routingPolicy: event.target.value as AppSettings["hybrid"]["routingPolicy"] } })}><option value="balanced">Balanced</option><option value="local_first">Local first</option><option value="codex_first">Codex first</option></select></label>
          <label className="toggle-row"><input type="checkbox" checked={draft.hybrid.automaticRouting} onChange={(event) => setDraft({ ...draft, hybrid: { ...draft.hybrid, automaticRouting: event.target.checked } })} /><span>Automatic central routing</span></label>
          <label>Default brain for new projects<select value={draft.defaultBrain} onChange={(event) => setDraft({ ...draft, defaultBrain: event.target.value as AppSettings["defaultBrain"] })}><option value="hybrid">Hybrid · Recommended</option><option value="local">Local</option><option value="codex">Codex</option></select></label>
          <label className="toggle-row"><input type="checkbox" checked={draft.trustedProjectWorkspace} onChange={(event) => setDraft({ ...draft, trustedProjectWorkspace: event.target.checked })} /><span>Trust low-risk operations inside the active movie project</span></label>
          <p className="settings-help">Operations outside the active project remain protected by Codex sandboxing and approvals.</p>
        </section>

        <section className="settings-card">
          <div className="settings-card-head"><Server size={17} /><div><span className="eyebrow">OpenAI API</span><h3>Separate API provider</h3></div><em className={status?.openai.state}>{status?.openai.state ?? "unknown"}</em></div>
          <label>OpenAI model<input value={draft.openaiModel} onChange={(event) => setDraft({ ...draft, openaiModel: event.target.value })} /></label>
          <p className="settings-help">This uses <code>OPENAI_API_KEY</code> and is separate from Codex sign-in and the local model server. Secrets remain in the environment file.</p>
        </section>
      </div>
    </div>
  );
}
