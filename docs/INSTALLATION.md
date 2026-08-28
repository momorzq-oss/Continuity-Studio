# Installation

This guide installs **Continuity Studio By BURABEEH v1.1.0** as a Windows application or from source.

## Windows release

1. Open [GitHub Releases](https://github.com/momorzq-oss/Continuity-Studio/releases).
2. Download `Continuity-Studio-By-BURABEEH-1.1.0-x64-nsis.exe` for the standard installer, or the `portable.exe` build for a no-install launch.
3. Run the file. The standard installer can install for the current user and create Start Menu and desktop shortcuts.
4. If SmartScreen appears, review the publisher warning and continue only if the file came from the official repository release. v1.1.0 packages are not code-signed.

Only Windows 10/11 x64 desktop packages are published. macOS and Linux can run the source/web workflow, but native packages are not claimed for v1.1.0.

## Requirements for source installation

| Component | Requirement |
| --- | --- |
| Node.js | 20.19 or newer; Node.js 22 LTS recommended |
| npm | 10 or newer |
| Git | Required only for `git clone` |
| Python | Not required |
| FFmpeg | Not required in v1.1.0 |
| Database | No external database; local JSON/Markdown/media storage |
| AI credentials | Optional |

## Multilingual CLI setup

```bash
git clone https://github.com/momorzq-oss/Continuity-Studio.git
cd Continuity-Studio
npm run setup
```

Choose a language interactively or pass it directly:

```bash
npm run setup -- --lang en   # English
npm run setup -- --lang ar   # العربية
npm run setup -- --lang es   # Español
npm run setup -- --lang zh   # 中文
```

Append `--yes` for non-interactive setup. The setup checks Node.js, installs packages when requested, creates an ignored `.env` from `.env.example`, and can run validation. It does not ask for or print provider secrets.

## Manual source setup

```bash
npm install
npm run desktop:dev
```

For browser development instead of Electron:

```bash
npm run dev
```

Open `http://127.0.0.1:8787` when the console reports that the server is ready.

## Optional provider configuration

Copy `.env.example` to `.env` only when needed. Leave unused values empty and never commit `.env`.

- OpenAI text generation: set `OPENAI_API_KEY` and optionally `OPENAI_MODEL`.
- Codex supervision: connect through Brain Settings using the signed-in Codex flow; do not copy a ChatGPT password or token into the project.
- Local model: enable an OpenAI-compatible local text server and configure its base URL and exact model name.
- Seedance, Higgsfield, MiniMax, Veo, Kling, Runway, and Sora remain manual prompt/reference handoffs in v1.1.0; their Platform Profiles do not make a direct video API call.

## Production build and verification

```bash
npm run typecheck
npm test
npm run docs:check
npm run build
npm start
```

Windows maintainers can create installer and portable artifacts with:

```bash
npm run desktop:package
```

See [Troubleshooting](TROUBLESHOOTING.md) when the app remains on the loading screen, a port is occupied, or an optional provider is unavailable.
