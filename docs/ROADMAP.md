# Roadmap

This file distinguishes the current source build from planned work. It is a direction, not a promise or release date.

## Completed in the current source build

- Generated Video Import and Generation Attempt History link each provider result to its sequence, platform, prompt version, JSON version, reference set, attempt number, generation date, filename, and duration.
- Manual Approve, Reject, and Approve & Lock decisions preserve history. The approved ending updates permanent continuity and becomes the next sequence Start State.
- The Production Dashboard shows total, approved, ready, blocked, rejected, and waiting sequences; completion percentage; missing assets; continuity warnings; and prompt warnings.
- Project export includes generated media and structured production records while preserving the existing JSON, Markdown, media, and ZIP architecture.
- A clean end-to-end tutorial project verifies project creation through fifteen approved sequences, one rejected attempt, automatic continuity transfer, a 100% dashboard, and a 1,487-entry export ZIP.

## Next production blocks, in order

### 1. Automated Video Continuity Inspection and Targeted Regeneration

Inspect imported video pixels against character identity, face, clothing, state, duplicate people, morphing, props, weapons, vehicles, animals, creatures, location, Movie DNA, grade, lighting, camera, movement/screen direction, dialogue, Start/End State, and Continuity Ledger.

Allow targeted correction of only the failed area: face, character, clothing, dialogue, camera, movement, lighting, grade, location, prop, creature, animal, vehicle, continuity, duplication, morphing, missing asset, or wrong ending. Add Approve with Notes as a first-class review decision.

### 2. Final movie assembly

Assemble approved locked sequences in order, add the approved audio plan, verify delivery settings, and produce a finished movie without changing sequence-level production history.

## Later candidates

- Direct, tested image-provider adapters.
- Direct, tested video-provider adapters.
- Optional local image and video models.
- Audio production, voice continuity, and dubbing workflows.
- Timeline editing and final film assembly.
- macOS and Linux desktop packaging.
- Full application-interface localization beyond multilingual documentation and CLI setup.
- Collaboration, optional cloud storage, and a public provider/plugin SDK.

## Release boundary

The packaged v1.1.0 release predates generated-video return. The current source build includes import, attempt history, manual review, approved End-to-Start transfer, the production dashboard, and expanded project export. Automated pixel-level inspection, targeted prompt correction, direct provider generation, and final movie assembly are not yet shipped.
