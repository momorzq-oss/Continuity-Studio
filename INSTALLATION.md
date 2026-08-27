# Installation

[English](INSTALLATION.md) · [العربية](docs/i18n/ar/INSTALLATION.md) · [Español](docs/i18n/es/INSTALLATION.md) · [中文](docs/i18n/zh-CN/INSTALLATION.md)

## Supported installation methods

1. **Windows installer:** download the NSIS `.exe` from GitHub Releases.
2. **Windows portable:** download the portable `.exe`; no installer is required.
3. **Git clone:** recommended for developers on Windows, macOS, and Linux.
4. **GitHub ZIP:** download **Code → Download ZIP**, extract, then follow source setup.

Only Windows 10/11 x64 desktop packages are built and tested for v1.0.0. macOS and Linux can run the source development/web workflow, but native desktop packaging for those platforms is not configured or claimed.

## Requirements

| Component | Required |
| --- | --- |
| Node.js | 20.19+; Node.js 22 LTS recommended |
| npm | 10+ |
| Git | Required only for `git clone` |
| Python | Not required by v1.0.0 |
| FFmpeg | Not required; final video assembly is a roadmap feature |
| External database | Not required; projects use local JSON/Markdown/media files |
| AI key | Optional; the built-in engine works without one |

## Multilingual CLI installation

```bash
git clone https://github.com/momorzq-oss/Continuity-Studio.git
cd Continuity-Studio
npm run setup
```

Choose a language interactively, or select one directly:

```bash
npm run setup -- --lang en
npm run setup -- --lang ar
npm run setup -- --lang es
npm run setup -- --lang zh
```

Add `--yes` for a non-interactive local setup: `npm run setup -- --lang en --yes`.

The installer checks Node.js, optionally runs `npm install`, copies `.env.example` to the ignored `.env`, and optionally runs type checking/tests. It never asks for or prints a secret.

## Manual source installation

The same commands work in PowerShell, Command Prompt, Bash, and zsh:

```bash
npm install
```

Copy `.env.example` to `.env` only if you want an optional provider. Leave unused values empty.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
npm run desktop:dev
```

macOS/Linux:

```bash
cp .env.example .env
npm run dev
```

Open `http://127.0.0.1:8787`. The browser-development workflow is tested from the same backend; native macOS/Linux Electron releases are not currently supplied.

## Production and verification

```bash
npm run typecheck
npm test
npm run build
npm start
```

`npm start` serves the production build on localhost. Windows maintainers can build desktop packages with `npm run desktop:package`.

## Optional providers

- **OpenAI API:** set `OPENAI_API_KEY` and optionally `OPENAI_MODEL`.
- **Codex:** sign in from Continuity Studio Settings; no API key is copied into `.env`.
- **Local model:** enable an OpenAI-compatible local server and set its URL/model in Settings. If that local server requires authentication, set `LOCAL_LLM_API_KEY` in `.env`.
- `MINIMAX_API_KEY`, `SEEDANCE_API_KEY`, and `HIGGSFIELD_API_KEY` are reserved placeholders for future direct adapters. v1.0.0 does not call those APIs.

See [Platforms](PLATFORMS.md) and [Troubleshooting](TROUBLESHOOTING.md).
