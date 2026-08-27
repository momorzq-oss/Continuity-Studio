# User Guide

## Project modes

**Full** continues through every production phase automatically. Visual auto-generation is controlled separately for assets, scenes, and storyboard frames. **Phases** pauses after each of the eight phases for approval or regeneration.

## Pre-story references

Reference Setup accepts PNG, JPEG, and WebP images. A reference can have multiple roles: identity, wardrobe, creature, animal, location, prop, composition, camera, motion, lighting, style, START/END frame, video continuity, audio, or voice. Story usage can be Required, Preferred, Visual-only, or Optional.

A main-character upload receives the protected source ID `CHAR_MAIN_001_SOURCE`. Story reconciliation creates one protagonist asset (`CHAR_MAIN_001`) linked to that source, removes duplicate protagonist proposals, and never overwrites the uploaded file.

## Story and Film Bible

Story creates logline, synopsis, full story, acts, cast, locations, and dialogue. Film Bible locks tone, visual language, world rules, character/location continuity, and project law.

## Assets and sheets

Asset Manifest registers characters, creatures, animals, locations, props, wardrobe, and vehicles with permanent IDs. Each active record stores a prompt, negative prompt, source references, provider/model, file paths, status, version, locks, and lineage.

The built-in provider creates real PNG **previsual references**, not photorealistic AI art. External image adapters can implement the same provider interface later. Approve or lock a generated/reference-backed asset; create a new version instead of replacing a locked design.

## Scenes and storyboard

A Scene Asset is a first-class record with a master plus START, MID, and END images. It cannot generate while required asset images are missing. Unchanged compositions reuse their scene record; changed dependencies invalidate the old visual pointers and create a new version.

Storyboard frames are separate derivatives of a scene. They do not replace scene masters or continuity anchors.

## Sequences and continuity

Each sequence stores duration, location, active assets, dialogue, camera/light/sound plans, and beginning/middle/end states. The prior approved END informs the next START. The Rule Engine checks identity, count, wardrobe, props, geography, weather, lighting, screen direction, wounds, damage, animals, and recurring assets.

## Prompt Compiler

The canonical prompt contains project/sequence IDs, duration, all assets, START/MID/END action, dialogue, camera, lens, composition, light, weather, sound, hard locks, and negative constraints. Reference Tagging ranks visual inputs and maps permanent IDs to provider request tags. When a model limit would remove a critical identity, compilation stops with an explicit blocking issue.

## Providers and generation

OpenAI, Codex, and an optional local model can generate text-phase artifacts. Seedance, MiniMax, and Higgsfield are manual prompt/reference export profiles in v1.0.0. No paid image/video job runs through those services. The queue exposes cost and approval fields so future paid adapters cannot spend silently.

## Export and storage

Projects are stored locally as JSON, Markdown, and media. Development data defaults to `data/projects`; installed Windows data lives under the user’s Documents/Continuity Studio directory. Export produces a ZIP of the selected project. Never publish a user project or personal reference library accidentally.

For guided workflows see [Main Character](docs/MAIN_CHARACTER_TUTORIAL.md), [Assets](docs/ASSET_TUTORIAL.md), [Scenes](docs/SCENE_TUTORIAL.md), and [Complete Movie](docs/COMPLETE_MOVIE_TUTORIAL.md).
