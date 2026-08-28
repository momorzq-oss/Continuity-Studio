# Troubleshooting

## The app stays on the loading screen

1. Close all Continuity Studio windows.
2. In the repository, run `npm install`, `npm run typecheck`, and `npm run build`.
3. Start with `npm run desktop:dev` so the backend error remains visible.
4. If port 8787 is already occupied, stop the old development server or set a different `PORT` in the ignored `.env` file.
5. Open Diagnostics after launch and inspect recent local errors. Do not paste secrets or personal project files into a public issue.

## Node.js or install failure

Run `node --version` and `npm --version`. Node.js must be at least 20.19; Node.js 22 LTS is recommended. Delete or overwrite neither project data nor reference folders to fix package installation. Re-run `npm install` first.

## Windows SmartScreen warning

v1.1.0 Windows files are not code-signed. Confirm that the filename and release page belong to `momorzq-oss/Continuity-Studio` before choosing to continue. Do not run a copy downloaded from an unrelated mirror.

## Missing environment variables

The built-in engine requires no key. Copy `.env.example` to the ignored `.env` only for optional providers. Leave unused values empty and never commit `.env`.

## Codex does not connect

Open Brain Settings, verify that Codex is installed/available, and use the supported sign-in flow. Codex supervision is optional; the built-in local production engine remains available. A disconnected Codex status is not the same as lost project data.

## Local model does not connect

Confirm the local OpenAI-compatible server is running, the base URL is correct, and the exact model name exists on that server. If authentication is required, place its key only in the ignored `.env` file.

## Reference upload is missing or rejected

- Open Character Reference Setup, Reference Manager, or the relevant Asset Inspector.
- Use PNG, JPEG, or WebP under 12 MB.
- Confirm the file is a real image rather than an extension-renamed document.
- Assign its role and usage after upload.
- A protected main source is separate from generated character sheets and must not be overwritten.

## Movie DNA or Story is blocked

Project Setup must be locked before Movie DNA can become the permanent visual source. Movie DNA must then be locked before Story generation. If an upstream approved item changed, review the visible downstream invalidation instead of bypassing it.

## Asset generation fails

Open Generations or the Asset Inspector and read the saved failure. Verify sources, prompt, model/profile, and required dependencies. Edit only the relevant prompt, then retry or create a new version. The deterministic local previsual renderer uses no paid credits.

## Sequence Workspace is blocked

Approve the required Story/Film Bible/character/asset/script/sequence records first. A sequence also needs its production plan, shot context, and reference state. Use the reported validation issue; do not invent a placeholder reference to force compilation.

## JSON Prompt is invalid

Use **Validate JSON**, then **Format JSON**. If the JSON diverged too far from canonical production state, use **Restore from Prompt State** and reapply only the intended manual override. Save a new prompt version after validation.

## A reference is excluded by the Platform Profile

Check the selected profile's real maximum reference count and role support. Required identity references must not be silently dropped. Choose a compatible profile, reduce non-critical references, split the sequence, or update the custom profile to match verified provider capabilities.

## Direct provider generation does not start

Seedance, Higgsfield, MiniMax, Veo, Kling, Runway, and Sora are manual prompt/reference handoffs in v1.1.0. Copy the prompt and upload the numbered references in the provider's own application.

## Generated video cannot be imported

Generated-video import is roadmap work and is not available in v1.1.0. Keep the video beside the exported project and record the provider, sequence, prompt version, and reference package manually.

## Project data or migration issue

Do not edit or delete the project folder first. Copy it to a safe backup. Continuity Studio creates timestamped project backups before schema migrations. Use Diagnostics to identify the project path and recent error, then report a minimal redacted reproduction.

## Documentation or screenshot link is broken

Run `npm run docs:check`. Repository screenshots belong under `docs/screenshots/` and documentation should use relative repository paths.
