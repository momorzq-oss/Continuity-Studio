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

## 4. Lock Movie DNA and build Story v2

Choose the 27 visual categories, review the Movie DNA Board and Master Frame, then lock the selected DNA version. Create Story v2 and review Full Story, Story Structure, Timeline, Character Arcs, and Sequence Breakdown before approval.

## 5. Run the production agent

Open **Production Agent**. In Full mode the agent runs Story → Film Bible → Assets → Sequences → Frames → Prompts → Continuity → Export. In Phases mode, review and approve each stage.

## 6. Review characters, script, and visuals

Open Character Analysis and Reference Manager to connect permanent identities and protected sources. Review Full Script v2 and exact dialogue. Open **Image Asset Library** to generate/review/lock master images and sheets. Open **Scene Assets** for dependency-aware scene masters and anchors. Open **Storyboard** for separate shot-facing images.

## 7. Compile platform prompts

Open a sequence in **Sequence Workspace v3**. Select Seedance, Higgsfield, MiniMax, Veo, Kling, Runway, Sora, or Custom. Inspect the synchronized Normal/JSON prompts, temporary reference tags, upload order, profile limits, and blocking issues, then copy or export the prompt/reference package manually.

## 8. Import, approve, and export

Generate in the selected provider, then import the result into the same sequence. Reject failed attempts with a reason or approve and lock the accepted result. Verify automatic End State transfer and the movie dashboard, then open **Export** to download the local project ZIP. Direct provider video generation remains roadmap work.
