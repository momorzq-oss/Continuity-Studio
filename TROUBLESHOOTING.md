# Troubleshooting

## Application does not start

Run `node --version`, `npm install`, `npm run typecheck`, and `npm run build`. Node.js must be 20.19+. For Windows desktop errors, run `npm run desktop:dev` to see local diagnostics.

## Missing environment variables

The built-in engine requires none. Copy `.env.example` to ignored `.env` only for optional providers. Leave unused keys empty; never commit `.env`.

## Project/database errors

v1.0.0 uses local project files, not an external SQL database. Older `project.json` files are backed up before schema migration. Check Diagnostics and local logs; preserve the project folder before manual repair.

## Image generation fails

Open Generations and inspect `GENERATION_FAILED`. Retry the asset, edit its prompt/references, or regenerate a version. The built-in renderer costs zero credits. Direct external image APIs are not included.

## Video generation fails / provider API error

Seedance, MiniMax, and Higgsfield are manual export workflows, not direct generation APIs. Confirm the prompt/model profile and run it in the provider’s own product. Importing external video results is not implemented in v1.0.0.

## Reference rejected

Use a valid PNG, JPEG, or WebP under 12 MB. A protected main source can be added once; add later images as supporting references.

## Identity drift

Verify the Identity role, source linkage, approval/lock state, and provider upload order. Do not override an identity-limit blocking issue; split the shot or choose a compatible model profile.

## Duplicate scene/storyboard

Unchanged scene dependencies reuse the same scene ID. Changed dependencies version/invalidate scene imagery. Storyboard frames remain separate. Regenerate the affected scene instead of creating an unrelated duplicate.

## Missing asset/model not configured

Generate or upload every required asset before scenes/prompts. In Prompt Compiler, enable and configure the selected editable model profile.

## FFmpeg missing

FFmpeg is not required because final video assembly is not included. A future assembly feature may add this requirement.

## Port already used

The desktop app selects another localhost port. For source mode, set `PORT` in `.env` or stop the process using 8787.

## Generation result not imported

External result import is not implemented in v1.0.0. Keep provider outputs in the exported project and record approval manually.
