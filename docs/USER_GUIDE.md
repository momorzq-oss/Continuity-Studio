# User Guide

This guide covers the working v1.1.0 production flow in **Continuity Studio By BURABEEH**.

## 1. Create a project

Select **New movie project** and complete Project Setup. Required planning choices include the movie idea, runtime, sequence duration, story mode, and production mode. Optional audio and delivery settings are stored with the project so later agents and prompt compilers use the same intent.

Choose a Story mode:

- **AI First:** start without image references.
- **Reference First:** require protected references before Story.
- **Hybrid:** combine user references with structured AI planning.

Choose a production mode:

- **Full:** the Production Agent continues automatically wherever gates permit.
- **Phases:** the agent pauses for review after each major block.

## 2. Choose and lock Movie DNA

Movie DNA is the permanent visual source. Its 27 categories cover genre, cinematic style, photography, camera system, framing, lens, focal length, stock, grain, grade, exposure, lighting, movement, texture, production design, period, global location, costume, environment, VFX, realism, and aspect ratio.

Use **View all options**, **Preview**, **Compare**, presets, or custom directions. Review the Movie DNA Board and Master Frame before locking. A later change creates a new DNA version and marks dependent production records for review.

## 3. Build Story v2

Open Story and create a draft. Review its five main views:

1. Full Story
2. Story Structure
3. Timeline
4. Character Arcs
5. Sequence Breakdown

Use scoped editing or AI modification when needed. Analyze the proposed impact before accepting a major change. Approve and lock the correct story version so Film Bible, characters, assets, script, and sequences can inherit it.

## 4. Build the Film Bible

The Film Bible turns approved story meaning and locked Movie DNA into project law: world rules, tone, visual language, production design, permanent negatives, identity policy, geography, and continuity constraints. Review the new draft, approve it, and lock the version intended for production.

## 5. Reconcile characters and references

Character Analysis creates one permanent identity for each story character. It prevents duplicate protagonist records and separates story identity from temporary provider tags.

For the main character:

1. Open **Character Reference Setup** or **Reference Manager**.
2. Upload PNG, JPEG, or WebP under 12 MB.
3. Mark the protected main source and assign the appropriate identity/wardrobe roles.
4. Complete reference setup.
5. Generate the Story-required sheet views.
6. Inspect Identity, References & Sheet, and Character States.
7. Approve and lock only the correct identity/version.

Uploaded originals remain protected. Generated images and sheets are derivative records and do not overwrite the source.

## 6. Review the Asset Manifest and Library

The manifest registers all recurring production entities with permanent IDs and project image numbers. The library exposes image state, reference sources, prompt, negative prompt, provider/model, lineage, approval, lock, and version history.

Use **Edit prompt** for a targeted change. Use a new version for a locked asset. Missing required images block dependent scene, storyboard, and prompt work instead of creating a false completed state.

## 7. Review Full Script v2

Open Full Script and inspect:

- Full Screenplay;
- By Sequence and By Scene;
- Dialogue Only;
- Shot Script;
- Production Script.

Dialogue is stored as exact lines with stable IDs and speakers. Lock dialogue only after checking the intended language, wording, speaker, and sequence placement.

## 8. Plan shots and sequences

Sequence Planner divides the runtime into exact ranges. Each sequence records beginning, middle, and end states plus its shot, camera, lighting, action, dialogue, audio, location, asset, and continuity requirements.

Open each sequence to inspect its production package. Previous/Next keeps the user inside the workspace while moving through the movie.

## 9. Compile Normal and JSON prompts

Sequence Workspace v3 has one canonical Prompt State and two editable representations:

- **Normal Prompt:** readable sectioned production instructions.
- **JSON Prompt:** structured output representing the same state.

Save edits, validate/format JSON, restore from canonical state, recompile, or reset manual overrides. Both editors persist. Prompt versions keep the platform/profile version, references, validation state, and content used for that attempt.

## 10. Select a Platform Profile

Choose Seedance, Higgsfield, MiniMax, Veo, Kling, Runway, Sora, or Custom. Each versioned profile owns its duration, reference, audio, syntax, and formatting capabilities. Changing one profile does not rewrite the global Movie DNA or another provider's rules.

## 11. Verify references

Open References in Sequence Workspace. Use the recommended set or choose manually. Confirm:

- stable asset ID;
- project image number;
- provider slot or `@Image` number;
- role and priority;
- required/optional state;
- upload order;
- blocking exclusions.

Download or merge the Sequence Reference Package only after validation passes.

## 12. Generate manually, import, and review

Transfer the prompt and references to the selected provider's own application. Import the result into its Continuity Studio sequence. The attempt remains linked to the selected platform, prompt and JSON versions, references, generation date, filename, and duration. Reject a failed attempt with a reason or approve and lock the accepted result. Only an approved result transfers its End State into permanent continuity and the next sequence Start State.

## 13. Dashboard and export

Use Overview to review movie completion, sequence states, missing assets, prompt warnings, and continuity warnings. Open Export to download the structured project ZIP. The ZIP preserves available JSON, Markdown, rule, reference, image, prompt, generated-video, generation-history, and continuity records. It is not a rendered final movie.

## Local persistence

The application stores projects as JSON, Markdown, and media files. Development data uses `data/projects/`; installed Windows projects use the user's Documents/Continuity Studio location. Writes are atomic and older project files receive migration backups.

## Safety reminders

- Never commit `.env`, project data, personal reference images, generated media, or logs.
- Never override a blocking identity/reference issue by silently dropping the required image.
- Do not replace a locked asset; create and approve a new version.
- Do not describe manual provider profiles as direct API integrations.

Continue with [Workflow](WORKFLOW.md), [Screenshot Gallery](SCREENSHOTS.md), and [Troubleshooting](TROUBLESHOOTING.md).
