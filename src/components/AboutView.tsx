import { Aperture, ExternalLink, GitFork, Heart, MapPin, Scale, Sparkles } from "lucide-react";

const repositoryUrl = "https://github.com/momorzq-oss/Continuity-Studio";

export function AboutView() {
  return (
    <div className="artifact-page about-page">
      <section className="about-hero">
        <div className="about-mark"><Aperture size={34} /></div>
        <div>
          <span className="eyebrow">Open-source AI filmmaking system</span>
          <h2>Continuity Studio</h2>
          <strong>By BURABEEH</strong>
          <p>One production brain for story development, visual identity, scene planning, platform prompts, and continuity control.</p>
          <div className="about-badges"><span>Version 1.0.0</span><span>Apache-2.0</span><span>Local-first</span></div>
        </div>
      </section>

      <div className="about-grid">
        <section className="about-card">
          <div className="about-card-title"><Sparkles size={17} /><div><span className="eyebrow">Creator</span><h3>Mohammed Al Marzooqi</h3></div></div>
          <p>Known as <strong>Burabeeh</strong>, Mohammed is an Emirati AI creator, independent filmmaker, software experimenter, and technology enthusiast. He created Continuity Studio from hands-on work solving identity and continuity problems in AI-assisted filmmaking.</p>
          <div className="about-detail"><MapPin size={14} /><span>United Arab Emirates</span></div>
        </section>

        <section className="about-card">
          <div className="about-card-title"><GitFork size={17} /><div><span className="eyebrow">Source</span><h3>GitHub repository</h3></div></div>
          <p>Read the documentation, inspect the source, report issues, and contribute through the public project repository.</p>
          <a className="button secondary about-link" href={repositoryUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open GitHub</a>
          <code>{repositoryUrl}</code>
        </section>

        <section className="about-card">
          <div className="about-card-title"><Scale size={17} /><div><span className="eyebrow">License</span><h3>Apache License 2.0</h3></div></div>
          <p>Copyright © 2026 Mohammed Al Marzooqi. The source is released under Apache-2.0. Review the repository LICENSE before redistributing or modifying the software.</p>
        </section>

        <section className="about-card">
          <div className="about-card-title"><Heart size={17} /><div><span className="eyebrow">Credits</span><h3>Built with open technology</h3></div></div>
          <p>TypeScript, React, Express, Electron, Vite, OpenAI, and Codex help power this project. Seedance, MiniMax, and Higgsfield are supported as manual prompt/reference formats in v1.0.0. Mention does not imply sponsorship or endorsement.</p>
        </section>
      </div>
    </div>
  );
}
