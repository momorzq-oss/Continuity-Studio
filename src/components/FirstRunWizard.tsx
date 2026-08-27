import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BrainCircuit, Check, LoaderCircle, Server, Sparkles, X } from "lucide-react";
import { api } from "../api";
import type { AppSettings, BrainStatusSnapshot, UserBrainMode } from "../types";

export function FirstRunWizard({
  settings,
  status,
  onComplete,
}: {
  settings: AppSettings;
  status?: BrainStatusSnapshot;
  onComplete: (settings: AppSettings) => void;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(settings);
  const [testing, setTesting] = useState(false);
  const [liveStatus, setLiveStatus] = useState(status);
  const pages = ["Welcome", "Choose brain", "Local Brain", "Codex", "Test system", "Ready"];
  useEffect(() => setLiveStatus(status), [status]);
  const finish = async () => onComplete(await api.updateSettings({ ...draft, firstRunComplete: true }));
  const testAll = async () => {
    setTesting(true);
    await Promise.allSettled([api.testLocal(), api.testCodex()]);
    setLiveStatus(await api.brainStatus().catch(() => liveStatus));
    setTesting(false);
  };
  return <div className="wizard-backdrop"><section className="setup-wizard"><header><div><span className="eyebrow">First-run setup · {step + 1}/6</span><h2>{pages[step]}</h2></div><button className="icon-button" aria-label="Skip setup" onClick={finish}><X size={16} /></button></header><div className="wizard-progress">{pages.map((page, index) => <i key={page} className={index <= step ? "active" : ""} />)}</div><div className="wizard-body">
    {step === 0 ? <div className="wizard-hero"><div className="wizard-mark">CS</div><h1>Welcome to Continuity Studio</h1><strong className="wizard-byline">BY BURABEEH</strong><p>Your desktop filmmaking workspace is ready to connect its production brains.</p></div> : null}
    {step === 1 ? <div><p className="wizard-lead">Choose the default supervisor for new movie projects. You can change it at any time.</p><div className="wizard-brains">{(["local", "codex", "hybrid"] as UserBrainMode[]).map((brain) => <button key={brain} className={draft.defaultBrain === brain ? "selected" : ""} onClick={() => setDraft({ ...draft, defaultBrain: brain })}><BrainCircuit size={21} /><strong>{brain.toUpperCase()}{brain === "hybrid" ? " · Recommended" : ""}</strong><span>{brain === "local" ? "Offline-first production" : brain === "codex" ? "Codex-led production" : "Local production with Codex supervision"}</span></button>)}</div></div> : null}
    {step === 2 ? <div className="wizard-form"><Server size={25} /><h3>Local Brain setup</h3><label className="toggle-row"><input type="checkbox" checked={draft.local.enabled} onChange={(event) => setDraft({ ...draft, local: { ...draft.local, enabled: event.target.checked } })} /><span>Connect an OpenAI-compatible local server</span></label><label>Server URL<input value={draft.local.serverUrl} onChange={(event) => setDraft({ ...draft, local: { ...draft.local, serverUrl: event.target.value } })} /></label><label>Model<input value={draft.local.model} placeholder="Model name" onChange={(event) => setDraft({ ...draft, local: { ...draft.local, model: event.target.value } })} /></label><p>The built-in offline production engine works even when this is skipped.</p></div> : null}
    {step === 3 ? <div className="wizard-form"><Sparkles size={25} /><h3>Codex setup</h3><p>Codex App Server status: <strong>{liveStatus?.codex.state ?? "Not tested"}</strong></p><p>{liveStatus?.codex.detail}</p><button className="button secondary" onClick={async () => { const result = await api.codexLogin(); if (result.authUrl) window.open(result.authUrl, "codex-auth", "width=620,height=780"); }}><Sparkles size={14} /> Connect Codex with ChatGPT</button><small>Continuity Studio never collects your ChatGPT password.</small></div> : null}
    {step === 4 ? <div className="wizard-form"><Check size={25} /><h3>Test system</h3><div className="system-test-list"><div><span>Desktop service</span><strong>Ready</strong></div><div><span>Project storage</span><strong>Ready</strong></div><div><span>Local Brain</span><strong>{liveStatus?.local.state ?? "Not tested"}</strong></div><div><span>Codex</span><strong>{liveStatus?.codex.state ?? "Not tested"}</strong></div></div><button className="button secondary" onClick={testAll} disabled={testing}>{testing ? <LoaderCircle size={14} className="spin" /> : <Server size={14} />} Test connections</button></div> : null}
    {step === 5 ? <div className="wizard-hero"><Check size={45} className="wizard-ready" /><h1>Continuity Studio By BURABEEH is ready</h1><p>Create a project, choose Full or Phases, and let the supervised pipeline build the production package.</p></div> : null}
  </div><footer><button className="button secondary" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}><ArrowLeft size={14} /> Back</button><button className="wizard-skip" onClick={finish}>Skip setup</button>{step < 5 ? <button className="button primary" onClick={() => setStep(step + 1)}>Continue <ArrowRight size={14} /></button> : <button className="button primary" onClick={finish}>Open Continuity Studio <ArrowRight size={14} /></button>}</footer></section></div>;
}
