# Quick Start

[English](QUICK_START.md) · [العربية](docs/i18n/ar/QUICK_START.md) · [Español](docs/i18n/es/QUICK_START.md) · [中文](docs/i18n/zh-CN/QUICK_START.md)

## 1. Install

Download a Windows build from GitHub Releases, or clone and run the multilingual setup:

```bash
git clone https://github.com/momorzq-oss/Continuity-Studio.git
cd Continuity-Studio
npm run setup
npm run desktop:dev
```

## 2. Create a project

Choose a title, idea, genre, period, aspect ratio, runtime, sequence count, production mode, and Story mode:

- **AI First:** story can start without uploads.
- **Reference First:** add at least one protected reference before Story.
- **Hybrid:** combine references with AI planning.

## 3. Optional references

Open **Reference Setup**, upload PNG/JPEG/WebP files, assign roles, and mark an optional photo **Main character source**. Complete setup. Originals are copied into the local project and never overwritten by generation.

## 4. Run the production agent

Open **Production Agent**. In Full mode the agent runs Story → Film Bible → Assets → Sequences → Frames → Prompts → Continuity → Export. In Phases mode, review and approve each stage.

## 5. Review visuals

Open **Assets** to generate/review/lock master images and sheets. Open **Scene Assets** for dependency-aware scene masters and anchors. Open **Storyboard** for separate shot-facing images.

## 6. Compile platform prompts

Open **Prompts**, select Seedance, MiniMax, Higgsfield, or Generic, inspect temporary reference tags and blocking issues, edit the project model profile if needed, then export/copy the provider prompt manually.

## 7. Inspect and export

Resolve blocking continuity issues, approve final records, then open **Export** to download the local project ZIP.
