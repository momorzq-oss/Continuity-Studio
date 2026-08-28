# Continuity Studio Final Architecture and Implementation Checklist

Status: architecture source of truth; implementation is complete through Sequence Workspace v3 and the Final Prompt Pipeline

Brand: **CONTINUITY STUDIO BY BURABEEH**

Design phase: complete

The later Generated Video Import, Video Continuity Inspection, Targeted Regeneration, Sequence Approval/automatic continuity transfer, Production Dashboard, expanded final export, and full end-to-end movie verification blocks remain planned work. Domain sections describing them are approved architecture, not a claim that they ship in v1.1.0.

## Approved UI baselines

The following production designs are approved and must not be redesigned unless implementation exposes a functional defect:

- Sequence Workspace v3
- Asset Library v2
- Story v2
- Full Script v2

The Superdesign drafts and their version history remain the visual source of truth. Implementation may adapt responsive behavior, accessibility, loading, empty, error, and confirmation states while preserving the approved hierarchy and production controls.

## Architectural principles

1. One `MovieProject` aggregate owns the complete production state.
2. Screens are projections and editors of shared domain records, never disconnected copies.
3. Movie DNA, Film Bible, and Continuity Ledger remain separate permanent systems.
4. Story owns narrative intent; Script owns screen interpretation.
5. Normal Prompt and JSON Prompt are two editors of one structured `PromptState`.
6. Permanent project image numbers never become platform upload positions.
7. Approved data is protected; locked data requires explicit impact review before change.
8. A generation state cannot become `Generated` until a real media file exists.
9. Persistence uses queued atomic writes, schema migration, recovery backups, and append-only history for significant changes.
10. AI and provider integrations receive approved structured project context, not isolated UI text.

## Runtime layers

```text
React production workspaces
        │
        ▼
Typed local HTTP API
        │
        ▼
Application services / commands
        │
        ├── Change Impact Engine
        ├── Approval and Locking Service
        ├── Prompt State / Compiler
        ├── Reference Mapping Service
        ├── Generation Provider Layer
        ├── Continuity Inspection
        └── Export / Recovery Service
        │
        ▼
MovieProject aggregate + production database
        │
        ▼
Atomic local project store + versioned media folders
```

The desktop shell continues to run the same local server used by browser development. React never reads or writes project files directly.

## Canonical source hierarchy

| Source | Owns | Must not own |
| --- | --- | --- |
| Movie DNA | Visual language, camera, lens, lighting, texture, period look | Character identity or story facts |
| Story | Events, motivation, structure, character arcs | Shot execution or platform syntax |
| Film Bible | World law, identity facts, locations, objects, historical and production facts | Sequence-current mutable state |
| Script | Scene action, dialogue, performance, timing, shots, camera and sound interpretation | Canonical world facts |
| Continuity Ledger | Approved state over time | Unapproved generation observations |
| Sequence Workspace | Compiled execution package | Independent copies of upstream data |

## Domain modules and services

### Project State Service

- Owns project metadata, runtime, sequence duration/count, delivery format, languages, rating, tracks, platform, status, timestamps, and schema version.
- Provides create, read, update, autosave, lock setup, recover, import, and full export operations.
- Recalculates sequence count deterministically from runtime and sequence duration.

### Movie DNA Service

- Owns visual selections, representative samples, technical descriptions, versions, negative rules, lock state, and optional Master Frame asset ID.
- Emits downstream impact for edits to locked DNA.
- Supplies visual context to assets, shots, prompts, and inspections.

### Narrative Service

- Owns Story content, structure, beats, timeline links, arcs, statuses, versions, approval, and lock state.
- Owns Story-to-Script impact detection but does not rewrite Script without an approved command.
- Supplies approved Story to Film Bible and Sequence planning.

### Film Bible Service

- Owns editable canonical world, identity, location, object, history, environment, costume, VFX, audio, and continuity rules.
- Is generated only from approved Story plus locked Movie DNA.

### Character Service

- Owns permanent identity IDs, reference links, character sheets, and multiple character states.
- Keeps uploaded originals separate from generated sheets and state variations.

### Asset Service

- Owns permanent image number, stable asset ID, permanent filename, category, versions, active version, generation attempts, approvals, locks, and dependency usage.
- Allocates numbers monotonically; replacement never allocates a new number.
- Activates a regenerated file only after it exists and the user approves replacement.

### Script and Dialogue Service

- Owns screenplay/production sections and structured dialogue records.
- Locked dialogue preserves exact words and delivery metadata across visual prompt recompilation.
- Script edits emit affected sequence/prompt commands without mutating Story.

### Sequence and Shot Service

- Owns sequence timing, purpose, script interpretation, shots, start/mid/end state, assets, reference requirements, status, imported video, and generation attempts.
- An approved End State becomes the next sequence Start State through a reviewed continuity transaction.

### Continuity Ledger Service

- Stores only approved or locked sequence results.
- Tracks entity, possession, injury, dirt, damage, weather, light, position, direction, relationship, knowledge, and story-event state over time.
- Retains previous entries when downstream changes are proposed.

### Prompt State and Compiler

- Owns one structured Prompt State per sequence and platform compilation metadata.
- Normal editing parses into structured patches; JSON editing validates into the same state.
- Unsafe or ambiguous edits create a review issue rather than overwriting data.
- Platform changes recompile formatting/capabilities while preserving narrative, dialogue, DNA, assets, continuity, and action.

### Reference Mapping Service

- Computes required sequence references from dependencies.
- Maps permanent project image numbers to sequence-specific upload slots and prompt tags.
- Produces ordered files, `prompt.txt`, `prompt.json`, and `reference_manifest.json`.

### Generation Provider Layer

- Uses provider-neutral structured requests for images and inspection tasks.
- Records provider, model, request, attempt, output path, thumbnail, status, error, and cost approval.
- Failure preserves the current approved file and every reference relationship.

### Change Impact Engine

- Traverses explicit dependency edges before approved or locked data changes.
- Returns affected characters, states, assets, locations, props, scripts, dialogue, sequences, prompts, reference packs, and continuity entries.
- Requires one of: cancel, review, apply safe patch, explicit override, or create a new version.

### History and Recovery Service

- Records story/script/prompt versions, asset generations/replacements, sequence attempts, approvals, locks, continuity changes, overrides, and regeneration reasons.
- Uses atomic temporary-file replacement and migration backups.
- Never deletes the only approved media version during a replacement transaction.

## Persistence layout

```text
project/
  project.json
  movie_dna.json
  story.json
  film_bible.json
  continuity_ledger.json
  asset_manifest.json
  prompt_manifest.json
  assets/
  references/
  generated/
  characters/
  creatures/
  animals/
  locations/
  props/
  vehicles/
  costumes/
  visual_direction/
  sequences/
  prompts/
  reference_packs/
  videos/
  exports/
  history/
```

`project.json` is the transaction root. Derived JSON/Markdown files are regenerated after the root write succeeds. Binary originals and approved versions are immutable; active pointers live in structured state.

## Application navigation

- Overview
- Movie DNA
- Story
- Film Bible
- Characters
- Assets
- Full Script
- Sequences
- Continuity
- Audio
- Export

Cross-links resolve by stable IDs and open the shared inspector or workspace in context.

## Implementation stages

Legend: `[x]` implemented foundation, `[~]` in progress/partial, `[ ]` required.

### Stage 1 — Project foundation

- [x] Typed `MovieProject` aggregate and schema migration
- [x] Queued atomic project writes and migration backups
- [x] Project creation with runtime, duration, format, language, rating, tracks, and platform
- [x] Automatic sequence count
- [x] Desktop/local-server navigation foundation
- [x] Draft setup autosave with Saved / Saving / Unsaved status
- [x] Shared Change Impact Engine and typed impact API
- [ ] Explicit project recovery snapshots and restore UI

### Stage 2 — Visual Direction and Movie DNA

- [x] Image-first visual choices and technical descriptions
- [x] Versioned Movie DNA and lock gate
- [x] Permanent negative rules
- [x] Complete approved Movie DNA board behavior across all 26 visual categories
- [x] Same-scene compare, full preview, provider-backed regeneration, visible failure/Retry state
- [x] Editable Studio Brain recommendation and generated combined-genre preview
- [x] Optional Master Frame with permanent project number, stable filename, and separate STYLE role
- [x] Locked Movie DNA context injection into downstream image generation requests
- [x] Locked-DNA downstream impact review before creating a new version

### Stage 3 — Story, Film Bible, character analysis

- [x] Structured Story generation, manual/paste creation, autosave editing, approval, lock, and non-destructive version history
- [x] Film Bible central generation, editable non-destructive versions, approval, lock, and restart persistence
- [x] Character analysis foundation
- [x] Approved Story v2 workspace with Full Story, Story Structure, Timeline, Character Arcs, Sequence Breakdown, and Reading Mode
- [x] Scoped AI modification preview, regeneration/rejection, shared impact review, and future-only decisions
- [x] Runtime-derived Story Beats, Timeline states, Character Arcs, searchable structured data, stable exports, and restart persistence
- [~] Story lock and Story-to-Script synchronization — protected Story impact and structured Script contract complete; Full Script v2 functional consumption remains pending

### Stage 4 — Character references and states

- [x] Visible main-character upload, validation, preview, replace, and remove
- [x] Multiple protected references and generated sheet foundation
- [x] Story-dependent Character Sheet views with protected source lineage and approval/lock state
- [x] Sequence-linked Character State records derived from approved Story data
- [x] Complete identity metadata and UI state editor

### Stage 5 — Asset production

- [x] Manifest generation and permanent IDs
- [x] Image provider abstraction, attempts, errors, and local renderer
- [x] Monotonic permanent numbering, stable filenames, and version lineage foundation
- [ ] Approved Asset Library v2 implementation
- [ ] Safe side-by-side regeneration activation transaction
- [ ] Individual/selected/approved/locked/all downloads

### Stage 6 — Timeline, continuity, and audio

- [~] Continuity Ledger and approved sequence transfer
- [~] Audio Bible storage
- [ ] Global Story Timeline editor
- [ ] Detailed state categories and downstream impact transaction

### Stage 7 — Full Script and Shot Planner

- [ ] Approved Full Script v2 and all six functional views
- [ ] Structured dialogue editor, approval, and lock enforcement
- [~] Sequence script and shot records
- [ ] Story-to-Script affected-section update flow

### Stage 8 — Sequences and approved workspace

- [x] Timed Sequence Planner foundation
- [~] START/MID/END states and approval transfer
- [ ] Approved Sequence Workspace v3 split editor
- [ ] Previous/Next autosave and unsaved-change protection
- [ ] Functional source panels and missing-asset blockers

### Stage 9 — Platform compilation and references

- [~] Editable platform profiles and prompt compiler
- [~] Reference tagging and provider limits
- [ ] Shared Prompt State with bidirectional Normal/JSON synchronization
- [ ] Seedance, Higgsfield, MiniMax, Veo, Kling, Runway, Sora, and Custom profiles
- [ ] Sequence reference strip, exact upload order, and downloadable reference packs

### Stage 10 — Video import, inspection, regeneration

- [x] Generated video upload and attempt linkage foundation
- [~] Rejection reason and targeted regeneration history
- [ ] Structured continuity inspection categories and source links
- [ ] Corrective prompt patches that preserve unrelated fields

### Stage 11 — Export, history, recovery, integration

- [x] Full project ZIP and asset export foundation
- [~] Production history persistence
- [ ] Every requested partial export and organised full package
- [ ] Recovery UI and interrupted-generation verification
- [ ] Complete real-interface production walkthrough

## Critical acceptance tests

- [ ] Reference mapping keeps project numbers `01, 02, 04, 05` while producing sequence tags `@Image 1` through `@Image 4`.
- [ ] Regenerating Project Image 04 preserves number, ID, assignments, sequence mappings, and prompt tags.
- [ ] Main-character upload survives application restart with identity, DNA, Story, assets, sequences, and prompts intact.
- [ ] Normal Prompt edits update JSON; valid JSON edits update Normal Prompt; unsafe edits request review.
- [ ] Platform switching changes only supported syntax/formatting.
- [ ] Approved Sequence 04 End State feeds Sequence 05 Start State.
- [ ] Editing approved Sequence 04 shows downstream impact before changing Sequence 05.
- [ ] Upload, generation, downloads, filenames, approvals, locks, restart persistence, and project export work through the real interface.

## Completion gate

The application is complete only when every production control visible in an approved design performs its intended operation and all critical acceptance tests pass. Static UI, placeholder generation, missing files, broken persistence, incorrect numbering, ignored locks, prompt desynchronization, lost edits, or incomplete exports block completion.
