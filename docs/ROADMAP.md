# Roadmap

This file distinguishes planned work from v1.1.0 features. It is a direction, not a promise or release date.

## Next production blocks, in order

### 1. Generated Video Import and Generation Attempt History

Import provider-generated Sequence 01, Sequence 02, and later files. Link each attempt to its sequence, platform, prompt version, JSON version, reference set, attempt number, generation date, and duration. Preserve rejected and approved attempts without overwriting history.

### 2. Video Continuity Inspection and Targeted Regeneration

Inspect imported results against character identity, face, clothing, state, duplicate people, morphing, props, weapons, vehicles, animals, creatures, location, Movie DNA, grade, lighting, camera, movement/screen direction, dialogue, START/END state, and Continuity Ledger.

Allow targeted correction of only the failed area: face, character, clothing, dialogue, camera, movement, lighting, grade, location, prop, creature, animal, vehicle, continuity, duplication, morphing, missing asset, or wrong ending.

### 3. Sequence Approval and Automatic Continuity Transfer

Add Approve, Reject, Regenerate, and Approve with Notes. Lock the approved video, prompt, JSON, references, generation metadata, and ending state. Only an approved ending may become the next sequence's starting state or update permanent continuity.

### 4. Production Dashboard

Show total, approved, ready, blocked, rejected, and waiting sequences; completion percentage; missing assets; continuity warnings; prompt warnings; and provider-generation status.

### 5. Final Project Export expansion

Extend export with complete generation history, approved-video metadata, review decisions, automatic continuity-transfer history, and a final production report. Continue to preserve structured Markdown/JSON records and ZIP architecture.

### 6. Full end-to-end movie verification

Create a fresh project and verify the complete idea-to-final-sequence path, including one rejected attempt, targeted regeneration, approval, END-to-START transfer, completion of all sequences, and full project export.

## Later candidates

- Direct, tested image-provider adapters.
- Direct, tested video-provider adapters.
- Optional local image and video models.
- Audio production, voice continuity, and dubbing workflows.
- Timeline editing and final film assembly.
- macOS and Linux desktop packaging.
- Full application-interface localization beyond multilingual documentation and CLI setup.
- Collaboration, optional cloud storage, and a public provider/plugin SDK.

## Explicit v1.1.0 boundary

Generated-video import, automatic video inspection, attempt approval, targeted video regeneration, approved END-to-START transfer, production completion dashboard, and final movie assembly are **not shipped in v1.1.0**.
