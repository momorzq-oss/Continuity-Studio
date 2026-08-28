# Windows desktop build

## Target

- Windows 10 or Windows 11
- x64
- Electron 44
- Assisted per-user NSIS installer plus portable executable

The installed application contains the frontend, backend, Electron runtime, application icon, and pinned Codex launcher/native package. Only user-selected external models, an optional local model server, or account/API credentials remain external.

## Development

Install Node.js and dependencies, then launch the desktop shell:

```powershell
npm install
npm run desktop:dev
```

This compiles the Electron main/preload processes and starts the same managed-backend flow used by production. The app window—not a normal browser—is the primary interface.

## Production build

```powershell
npm run typecheck
npm test
npm run desktop:build
```

`desktop:build` creates the optimized Vite bundle and bundled Electron main/preload modules. It does not use `npm run dev`.

## Windows package

```powershell
npm run desktop:package
```

Version 1.1.0 artifacts are placed in `release/windows-v1.1.0/`:

- `Continuity-Studio-By-BURABEEH-1.1.0-x64-nsis.exe` — assisted installer; this is the file to double-click for installation.
- `Continuity-Studio-By-BURABEEH-1.1.0-x64-portable.exe` — portable executable.
- `win-unpacked/Continuity Studio By BURABEEH.exe` — unpacked executable for release smoke testing.

The installer is configured with application metadata, Start Menu shortcut, optional Desktop shortcut selection, per-user install, changeable install directory, installer/uninstaller icons, and uninstall support.

## Installed data

Application data stays outside the install directory:

```text
%USERPROFILE%\Documents\Continuity Studio\
  Projects\
  Logs\
  settings.json
  .env                 optional OpenAI API configuration
```

Window state is stored in Electron's normal per-user application-data folder. Upgrades therefore do not overwrite projects.

## Replace the icon

The exact replaceable source file is `assets/icon.png`. Use a square high-resolution PNG, then run:

```powershell
npm run icon:build
npm run desktop:package
```

`icon:build` regenerates `assets/icon.ico`. Do not edit generated release resources directly.

## Release verification

Before delivery:

1. Run type checking, tests, and the web build.
2. Package both Windows targets.
3. Confirm the NSIS, portable, and unpacked executable files exist and have non-zero size.
4. Start `win-unpacked\Continuity Studio.exe`.
5. Confirm the loading view transitions to the first-run/project UI without a terminal.
6. Confirm Diagnostics reports backend, Codex, storage, and brain states accurately.
7. Close the window and confirm its backend and Codex child processes stop.

Unsigned local builds can show Windows SmartScreen. Production distribution should use an organization-owned Windows code-signing certificate; signing is intentionally not faked by this repository.
