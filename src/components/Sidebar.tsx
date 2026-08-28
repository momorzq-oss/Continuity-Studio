import {
  Aperture,
  Boxes,
  BookOpen,
  Bot,
  Bug,
  ClipboardCheck,
  FileCode2,
  Film,
  FolderArchive,
  LayoutDashboard,
  Layers3,
  MapPinned,
  Package,
  PersonStanding,
  PlugZap,
  Plus,
  ScanLine,
  ScrollText,
  Settings,
  Stethoscope,
  WandSparkles,
  Images,
  Clapperboard,
  UploadCloud,
  Info,
  Clock3,
  AudioLines,
} from "lucide-react";
import type { MovieProject, ProjectListItem } from "../types";

export type ViewId =
  | "agent"
  | "project_setup"
  | "movie_dna"
  | "reference_setup"
  | "references"
  | "overview"
  | "story"
  | "full_script"
  | "timeline"
  | "film_bible"
  | "assets"
  | "asset_manifest"
  | "characters"
  | "creatures"
  | "locations"
  | "props"
  | "sequences"
  | "frames"
  | "scenes"
  | "storyboard"
  | "prompts"
  | "continuity"
  | "audio_bible"
  | "rules"
  | "generations"
  | "review"
  | "export"
  | "settings"
  | "diagnostics"
  | "about";

const navigation: Array<{
  id: ViewId;
  label: string;
  icon: typeof Bot;
}> = [
  { id: "agent", label: "Production Agent", icon: Bot },
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "project_setup", label: "Project Setup", icon: Settings },
  { id: "movie_dna", label: "Movie DNA", icon: Aperture },
  { id: "story", label: "Story", icon: BookOpen },
  { id: "full_script", label: "Full Script", icon: FileCode2 },
  { id: "timeline", label: "Story Timeline", icon: Clock3 },
  { id: "film_bible", label: "Film Bible", icon: ScrollText },
  { id: "characters", label: "Characters", icon: PersonStanding },
  { id: "reference_setup", label: "Character Reference Setup", icon: UploadCloud },
  { id: "references", label: "Reference Manager", icon: Images },
  { id: "asset_manifest", label: "Asset Manifest", icon: ClipboardCheck },
  { id: "assets", label: "Image Asset Library", icon: Layers3 },
  { id: "creatures", label: "Creatures", icon: Bug },
  { id: "locations", label: "Locations", icon: MapPinned },
  { id: "props", label: "Props", icon: Boxes },
  { id: "sequences", label: "Sequences", icon: Film },
  { id: "frames", label: "Frames", icon: Aperture },
  { id: "scenes", label: "Scene Assets", icon: Clapperboard },
  { id: "storyboard", label: "Storyboard", icon: Images },
  { id: "prompts", label: "Prompts", icon: FileCode2 },
  { id: "continuity", label: "Continuity", icon: ScanLine },
  { id: "audio_bible", label: "Audio Bible", icon: AudioLines },
  { id: "rules", label: "Rules", icon: ClipboardCheck },
  { id: "generations", label: "Generations", icon: WandSparkles },
  { id: "review", label: "Review", icon: ScanLine },
  { id: "export", label: "Export", icon: Package },
  { id: "settings", label: "Brain Settings", icon: Settings },
  { id: "diagnostics", label: "Diagnostics", icon: Stethoscope },
  { id: "about", label: "About", icon: Info },
];

interface SidebarProps {
  project?: MovieProject;
  projects: ProjectListItem[];
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
  onProjectChange: (projectId: string) => void;
  onNewProject: () => void;
}

export function Sidebar({
  project,
  projects,
  activeView,
  onViewChange,
  onProjectChange,
  onNewProject,
}: SidebarProps) {
  const progressStages = ["project_setup", "movie_dna", "story", "film_bible", "characters", "asset_manifest", "sequences", "platform_prompts", "video_review", "export"];
  const completed = project?.production.gates.filter((gate) => progressStages.includes(gate.stage) && ["APPROVED", "LOCKED"].includes(gate.status)).length ?? 0;
  const progress = project ? (project.status === "complete" ? 100 : Math.round((completed / progressStages.length) * 100)) : 0;
  const artifactCount = project ? Object.keys(project.artifacts).length : 0;

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark"><Aperture size={16} /></span>
        <span className="brand-name"><strong>CONTINUITY STUDIO</strong><small>BY BURABEEH</small></span>
      </div>

      {project ? (
        <div className="current-project">
          <div className="eyebrow">Current production</div>
          <select
            aria-label="Current project"
            value={project.id}
            onChange={(event) => onProjectChange(event.target.value)}
          >
            {projects.map((item) => (
              <option value={item.id} key={item.id}>{item.title}</option>
            ))}
          </select>
          <strong>{project.title}</strong>
          <span>{project.genre} · {project.runtimeMinutes} MIN</span>
          <div className="project-sync">
            <i className={`status-dot ${project.status}`} />
            {project.status === "running" ? "Agent working" : `${progress}% planned`}
          </div>
        </div>
      ) : null}

      <button className="new-project-button" onClick={onNewProject}>
        <Plus size={15} /> New movie project
      </button>

      <div className="nav-label">Production</div>
      <nav className="main-nav">
        {navigation.map((item) => {
          const Icon = item.icon;
          const badge =
            item.id === "story" ? project?.production.story.status :
            item.id === "full_script" ? project?.memory.productionMemory.script.status :
            item.id === "project_setup" ? project?.production.gates.find((gate) => gate.stage === "project_setup")?.status :
            item.id === "movie_dna" ? project?.production.movieDna.status :
            item.id === "asset_manifest" ? project?.production.gates.find((gate) => gate.stage === "asset_manifest")?.status :
            item.id === "reference_setup" ? (project?.preStorySetup.completed ? "READY" : "SETUP") :
            item.id === "assets" ? (project?.artifacts.assets ? "READY" : undefined) :
            item.id === "sequences" ? (project?.artifacts.sequences ? "READY" : undefined) :
            item.id === "continuity" ? (project?.artifacts.continuity ? "CHECK" : undefined) :
            item.id === "timeline" ? (project?.memory.productionMemory.storyTimeline.status === "READY" ? "READY" : project?.memory.productionMemory.storyTimeline.status) :
            item.id === "audio_bible" ? project?.memory.productionMemory.audioBible.status :
            item.id === "export" ? (project?.status === "complete" ? "READY" : undefined) :
            item.id === "settings" ? project?.brain.selected.toUpperCase() :
            item.id === "agent" ? (project?.status === "running" ? "LIVE" : undefined) : undefined;
          return (
            <button
              key={item.id}
              className={activeView === item.id ? "active" : ""}
              onClick={() => onViewChange(item.id)}
            >
              <Icon size={15} />
              <span>{item.label}</span>
              {badge ? <em>{badge}</em> : null}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-spacer" />
      <div className="sidebar-meta">
        <div><FolderArchive size={14} /><span>{artifactCount} artifact sets</span></div>
        <div><PlugZap size={14} className="success-icon" /><span>{project?.provider.label ?? "Provider ready"}</span></div>
        <div><Settings size={14} /><span>Local project storage</span></div>
      </div>
    </aside>
  );
}
