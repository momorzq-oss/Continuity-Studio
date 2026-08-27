import { useEffect, useState } from "react";
import { Bot, CircleAlert, CloudDownload, Plus, Radio } from "lucide-react";
import { api } from "./api";
import { AgentView } from "./components/AgentView";
import { AboutView } from "./components/AboutView";
import { ArtifactView } from "./components/ArtifactViews";
import { CreateProjectModal } from "./components/CreateProjectModal";
import { DiagnosticsView } from "./components/DiagnosticsView";
import { FirstRunWizard } from "./components/FirstRunWizard";
import { SettingsView } from "./components/SettingsView";
import { Sidebar, type ViewId } from "./components/Sidebar";
import { SystemStatusBar } from "./components/SystemStatusBar";
import type {
  AppSettings,
  BrainMode,
  BrainStatusSnapshot,
  CreateProjectInput,
  MovieProject,
  ProjectListItem,
  RunMode,
} from "./types";

const viewTitles: Record<ViewId, { title: string; kicker: string }> = {
  agent: { title: "Production Agent", kicker: "Orchestrate the complete movie workflow" },
  reference_setup: { title: "Pre-Story Reference Setup", kicker: "Choose story mode and protect uploaded visual sources before writing" },
  references: { title: "Reference Library", kicker: "Uploaded sources, roles, priority, lineage, and story usage" },
  overview: { title: "Project Overview", kicker: "Production status and generated artifacts" },
  story: { title: "Story & Film Bible", kicker: "Narrative, cast, world, and locked movie rules" },
  film_bible: { title: "Film Bible", kicker: "Approved world law, visual language, and production restrictions" },
  assets: { title: "Asset Manifest", kicker: "Permanent IDs for every production element" },
  characters: { title: "Characters", kicker: "Locked identity, face, body, wardrobe, and reference records" },
  creatures: { title: "Creatures & Animals", kicker: "Persistent anatomy, equipment, damage, and state" },
  locations: { title: "Locations", kicker: "Locked geography, architecture, routes, and period details" },
  props: { title: "Props & Wardrobe", kicker: "Ownership, possession, appearance, damage, and versions" },
  sequences: { title: "Sequence Planner", kicker: "Timed story units and beginning / middle / end states" },
  frames: { title: "Frame Planner", kicker: "START, MID, and END continuity anchors for every sequence" },
  scenes: { title: "Scene Assets", kicker: "Dependency-aware master, start, middle, and end scene images" },
  storyboard: { title: "Storyboard", kicker: "Generated shot frames kept separate from scene assets" },
  prompts: { title: "Prompt Compiler", kicker: "Provider-ready prompts inherited from locked production state" },
  continuity: { title: "Continuity Review", kicker: "Identity, geography, lighting, and damage checks" },
  rules: { title: "Rule Profiles", kicker: "Enable, disable, and override operational filmmaking rules" },
  generations: { title: "Generations", kicker: "Provider-independent prompt, attempt, and result ledger" },
  review: { title: "Continuity Inspector", kicker: "Blocking validation issues, overrides, and approvals" },
  export: { title: "Export Movie Project", kicker: "Validated local folders, files, and ZIP package" },
  settings: { title: "Brain Settings", kicker: "Local, Codex, Hybrid, and OpenAI provider configuration" },
  diagnostics: { title: "Diagnostics", kicker: "Desktop, backend, brain, storage, and recent error status" },
  about: { title: "About Continuity Studio", kicker: "Creator, version, source, license, and credits" },
};

export default function App() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [project, setProject] = useState<MovieProject>();
  const [activeView, setActiveView] = useState<ViewId>("agent");
  const [mode, setMode] = useState<RunMode>("phases");
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [settings, setSettings] = useState<AppSettings>();
  const [brainStatus, setBrainStatus] = useState<BrainStatusSnapshot>();
  const title = viewTitles[activeView];

  const loadProjects = async (preferredId?: string) => {
    const list = await api.listProjects();
    setProjects(list);
    const id = preferredId ?? project?.id ?? list[0]?.id;
    if (id) {
      const loaded = await api.getProject(id);
      setProject(loaded);
      setMode(loaded.mode);
    } else {
      setModalOpen(true);
    }
  };

  useEffect(() => {
    loadProjects().catch((failure) => setError(failure instanceof Error ? failure.message : "Unable to load projects."));
    api.getSettings().then(setSettings).catch((failure) => setError(failure instanceof Error ? failure.message : "Unable to load settings."));
    api.brainStatus().then(setBrainStatus).catch(() => undefined);
    // Initial project discovery only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => api.brainStatus().then(setBrainStatus).catch(() => undefined), 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const startup = new URLSearchParams(window.location.search).get("startup");
    if (startup === "port_collision") setError("Port 8787 was already occupied, so Continuity Studio safely selected another local port.");
  }, []);

  useEffect(() => {
    if (!project?.id) return;
    const delay = project.status === "running" ? 650 : 2200;
    const timer = window.setInterval(() => {
      api.getProject(project.id)
        .then((updated) => {
          setProject(updated);
          setMode(updated.mode);
        })
        .catch(() => undefined);
    }, delay);
    return () => window.clearInterval(timer);
  }, [project?.id, project?.status]);

  const act = async (operation: () => Promise<MovieProject>) => {
    setBusy(true);
    setError(undefined);
    try {
      const updated = await operation();
      setProject(updated);
      setMode(updated.mode);
      window.setTimeout(() => {
        api.getProject(updated.id).then(setProject).catch(() => undefined);
      }, 400);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The operation failed.");
    } finally {
      setBusy(false);
    }
  };

  const createProject = async (input: CreateProjectInput) => {
    setBusy(true);
    setError(undefined);
    try {
      const created = await api.createProject(input);
      setProject(created);
      setMode(created.mode);
      setActiveView(created.preStorySetup.completed ? "agent" : "reference_setup");
      setModalOpen(false);
      await loadProjects(created.id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to create the project.");
    } finally {
      setBusy(false);
    }
  };

  const changeProject = async (projectId: string) => {
    setBusy(true);
    try {
      const loaded = await api.getProject(projectId);
      setProject(loaded);
      setMode(loaded.mode);
      setActiveView("agent");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to open the project.");
    } finally {
      setBusy(false);
    }
  };

  const changeMode = async (nextMode: RunMode) => {
    if (!project || project.status === "running") return;
    const previous = mode;
    setMode(nextMode);
    try {
      const updated = await api.updateMode(project.id, nextMode);
      setProject(updated);
    } catch (failure) {
      setMode(previous);
      setError(failure instanceof Error ? failure.message : "Unable to change mode.");
    }
  };

  const download = () => {
    if (project) window.location.assign(api.exportUrl(project.id));
  };

  const refreshBrains = async () => setBrainStatus(await api.brainStatus());

  const changeBrain = async (brain: BrainMode) => {
    if (!project) return;
    await act(() => api.updateBrain(project.id, brain));
    await refreshBrains().catch(() => undefined);
  };

  return (
    <div className="app-shell">
      <Sidebar
        project={project}
        projects={projects}
        activeView={activeView}
        onViewChange={setActiveView}
        onProjectChange={changeProject}
        onNewProject={() => setModalOpen(true)}
      />

      <main className="main-workspace">
        <header className="workspace-header">
          <div>
            <div className="breadcrumb">PROJECTS / {project?.title.toUpperCase() ?? "NEW PROJECT"} / <span>{activeView.replace("_", " ").toUpperCase()}</span></div>
            <h1>{title.title}</h1>
            <p>{title.kicker}</p>
          </div>
          <div className="header-status">
            <div><Radio size={13} /><span>{project?.brain.selected.toUpperCase() ?? "BRAIN ROUTER"}</span></div>
            {project?.status === "complete" ? <button className="button secondary" onClick={download}><CloudDownload size={14} /> Export</button> : null}
            <button className="button primary" onClick={() => setModalOpen(true)}><Plus size={14} /> New project</button>
          </div>
        </header>

        <SystemStatusBar project={project} status={brainStatus} />

        {error ? (
          <div className="error-banner"><CircleAlert size={16} /><span>{error}</span><button onClick={() => setError(undefined)}>Dismiss</button></div>
        ) : null}

        <div className="workspace-content">
          {project ? (
            activeView === "agent" ? (
              <AgentView
                project={project}
                mode={mode}
                busy={busy}
                onModeChange={changeMode}
                onSend={(content) => act(() => api.sendMessage(project.id, content, mode))}
                onApprove={() => act(() => api.approve(project.id))}
                onRegenerate={() => act(() => api.regenerate(project.id, project.currentPhase))}
                onDownload={download}
                status={brainStatus}
                onBrainChange={changeBrain}
                onRecover={(action) => act(() => api.recover(project.id, action))}
                onCancel={() => act(() => api.cancel(project.id))}
                onResolveApproval={async (id, decision) => {
                  await api.resolveCodexApproval(id, decision);
                  await refreshBrains();
                }}
              />
            ) : activeView === "settings" ? (
              settings
                ? <SettingsView settings={settings} status={brainStatus} onChange={setSettings} onRefresh={refreshBrains} />
                : <div className="empty-artifact"><Bot size={26} /><h2>Loading settings</h2></div>
            ) : activeView === "diagnostics" ? (
              <DiagnosticsView brain={project.brain.selected} />
            ) : activeView === "about" ? (
              <AboutView />
            ) : (
              <ArtifactView
                view={activeView}
                project={project}
                onDownload={download}
                onRuleOverride={(ruleId, input) => act(() => api.updateRule(project.id, ruleId, input))}
                onAssetState={(assetId, state) => act(() => api.updateAssetStatus(project.id, assetId, state))}
                onCreateAssetVersion={(assetId) => act(() => api.createAssetVersion(project.id, assetId))}
                onUploadReference={(input) => act(() => api.uploadReference(project.id, input))}
                onCompleteReferenceSetup={() => act(() => api.completeReferenceSetup(project.id))}
                onUpdateReference={(referenceId, input) => act(() => api.updateReference(project.id, referenceId, input))}
                onGenerateAllAssets={(force) => act(() => api.generateAllAssets(project.id, force))}
                onGenerateAsset={(assetId, force) => act(() => api.generateAsset(project.id, assetId, force))}
                onPlanScenes={() => act(() => api.planScenes(project.id))}
                onGenerateAllScenes={(force) => act(() => api.generateAllScenes(project.id, force))}
                onGenerateScene={(sceneId, force) => act(() => api.generateScene(project.id, sceneId, force))}
                onGenerateStoryboard={(force) => act(() => api.generateStoryboard(project.id, force))}
                onCompilePrompts={(profileIds) => act(() => api.compilePrompts(project.id, profileIds))}
                onUpdateModelProfile={(profileId, input) => act(() => api.updateModelProfile(project.id, profileId, input))}
                onOverrideIssue={(issueId) => act(() => api.overrideIssue(project.id, issueId, "Manual override from Continuity Inspector"))}
              />
            )
          ) : (
            <div className="empty-workspace"><Bot size={30} /><h2>No movie project yet</h2><p>Create a project, type the idea into the agent, and run the complete workflow.</p><button className="button primary" onClick={() => setModalOpen(true)}>Create movie project</button></div>
          )}
        </div>
      </main>

      <CreateProjectModal
        open={modalOpen}
        busy={busy}
        onClose={() => projects.length && setModalOpen(false)}
        onCreate={createProject}
      />
      {settings && !settings.firstRunComplete ? (
        <FirstRunWizard settings={settings} status={brainStatus} onComplete={(updated) => { setSettings(updated); void refreshBrains(); }} />
      ) : null}
    </div>
  );
}
