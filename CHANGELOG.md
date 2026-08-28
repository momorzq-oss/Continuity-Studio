# Changelog

## v1.1.0 — Visual production system and Sequence Workspace v3

- Expanded Visual Movie DNA to 27 categories and 629 selectable options, including Global Location DNA, image-led comparisons, a Movie DNA Board, master-frame handling, version history, locks, and downstream invalidation.
- Integrated durable AI Filmmaking Visual Guide principles: identity locking, neutral character-sheet lighting, style consistency, unique reference numbering, concise high-signal prompting, storyboard continuity, and reference-aware video prompts.
- Completed Story v2 with AI First, Reference First, and Hybrid creation; Full Story, Story Structure, Timeline, Character Arcs, Sequence Breakdown, scoped modifications, impact analysis, approval/lock versions, and restart-safe structured persistence.
- Expanded Film Bible and character production memory with permanent IDs, protected source links, adaptive character sheets, identity reconciliation, per-sequence Character States, and approval history.
- Added the numbered Asset Manifest, Image Asset Library, asset inspection, prompt editing, reference uploads, lineage, versions, approvals, and locks.
- Added Full Script v2 views for screenplay, dialogue, shot script, production script, scenes, and sequences, plus exact dialogue records and lock state.
- Implemented Sequence Workspace v3 with Previous/Next navigation, canonical Prompt State, editable Normal and JSON prompts, synchronization, validation, formatting, manual overrides, saved prompt versions, persistence, and optional nine-panel Storyboard Grid support.
- Added versioned Platform Profiles for Seedance, Higgsfield, MiniMax, Veo, Kling, Runway, Sora, and Custom. Provider-specific duration, reference, audio, and syntax rules remain profile-owned rather than globally hard-coded.
- Added stable reference slot mapping, project image numbers, provider-specific `@Image` numbering, upload order, recommended/manual selection, and sequence reference packages.
- Added current-build documentation, a 57-image screenshot gallery, expanded installation/user/workflow/troubleshooting/roadmap guides, and Windows v1.1.0 packaging metadata.
- Preserved Full and Phases modes, local JSON/Markdown/media storage, approval gates, downstream invalidation, rule integration, diagnostics, and ZIP export.

Not included in v1.1.0: generated-video import, complete attempt review, automatic video continuity inspection, targeted video regeneration, approved END-to-START transfer, a completion dashboard, or final movie assembly. These remain in the Roadmap.

## v1.0.1 — Reference workflow update

- Added main-character reference selection and immediate JPG/PNG/WebP preview during project creation.
- Added a dedicated Reference Manager with asset categories, labels, versioned replacement, removal, and sequence assignment.
- Added an Assets workspace with thumbnails, continuity sheets, approval, locking, and retryable generation errors.
- Added Story-dependent main-character identity sheets and reference-derived local image rendering.
- Preserved protected source uploads separately from generated files and fixed persistence after reopening a project.
- Added optional OpenAI image generation when configured, with an offline local fallback.
- Added automated lifecycle and failure/retry coverage for references and asset generation.

## v1.0.0 — Initial public release

- Eight-phase story-to-export Production Agent with Full and Phases modes.
- AI First, Reference First, and Hybrid pre-story workflows.
- Protected uploads, main-character identity reconciliation, and reference roles.
- Film Bible and 53 enforceable continuity/production rules.
- Permanent asset registry, relationships, lineage, approvals, locks, and versions.
- File-backed local PNG asset/sheet generation with explicit failure states.
- Dependency-aware scene masters and separate storyboard frame generation.
- START/MID/END continuity state planning across sequences.
- Canonical Platform Prompt Compiler and Reference Tagging Engine.
- Editable prompt profiles and manual provider handoff.
- Local, Codex, Hybrid, and OpenAI text brain routing.
- Local project persistence, migration backups, diagnostics, ZIP export, Windows installer, and portable build.
- English, Arabic, Spanish, and Chinese documentation and CLI setup prompts.
