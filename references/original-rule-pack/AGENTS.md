# Continuity Studio Film Brain

## Purpose

This repository contains Continuity Studio.

Continuity Studio must follow the Burabeeh filmmaking method defined in this rule pack.

Do not replace this method with a generic movie generation workflow.

Before changing film generation logic, read these files in this order:

1. `film_rules/BURABEEH_FILM_ENGINE.md`
2. `film_rules/CONTINUITY_RULES.md`
3. `film_rules/ASSET_RULES.md`
4. `film_rules/SEQUENCE_RULES.md`
5. `film_rules/FRAME_RULES.md`
6. The active model adapter in `model_rules/`
7. The matching prompt template in `templates/`

## Authority Order

When rules conflict, use this priority:

1. Approved project state and locked production data
2. `BURABEEH_FILM_ENGINE.md`
3. Continuity rules
4. Asset rules
5. Sequence and frame rules
6. Model-specific adapter
7. User request for the current project
8. General model behaviour

A model adapter must never override an approved identity, wardrobe, asset, continuity or world lock.

## Core Principle

Lock the film before generating the film.

References control visual truth.

Text controls events, performance, camera and timing.

Generation must not invent visual facts already defined by approved references.

## Required Production Flow

Use this production order:

IDEA
→ PROJECT FILM BIBLE
→ STORY
→ SEQUENCE MAP
→ ASSET MANIFEST
→ CHARACTER SHEETS
→ CREATURE SHEETS
→ LOCATION SHEETS
→ PROP AND OBJECT SHEETS
→ EFFECTS REFERENCES WHEN REQUIRED
→ VISUAL INSPECTION
→ APPROVAL AND LOCKING
→ START, MID AND END FRAME PLANNING
→ REFERENCE MANIFEST
→ MODEL-SPECIFIC PROMPT
→ GENERATION
→ VIDEO INSPECTION
→ CONTINUITY CHECK
→ APPROVE OR REGENERATE
→ UPDATE END STATE
→ NEXT SEQUENCE
→ FINAL EDIT
→ PROJECT EXPORT

Do not skip required locking steps to save time.

## Brain Architecture

Continuity Studio may use:

- Local Brain
- Codex Brain
- Hybrid Brain
- Existing offline engine
- Existing OpenAI provider

The film rules stay identical regardless of which brain performs the work.

The Brain Router chooses who performs a task.

The Film Engine defines how the task must be performed.

## Specialist Agents

The application may expose these specialist agents:

- Story Agent
- Film Bible Agent
- Character Agent
- Creature Agent
- Location Agent
- Prop Agent
- Asset Agent
- Sequence Agent
- Frame Planning Agent
- Continuity Agent
- Prompt Agent
- Inspection Agent
- Video Agent
- Audio Agent
- Editing Agent
- Export Agent

Agents are not independent authorities.

All agents read and write the same approved project state.

The Continuity Agent may block generation when a prompt conflicts with locked state.

## Non-Negotiable Generation Rules

Never silently:

- Redesign an approved character
- Change an approved face
- Change age or body proportions
- Change wardrobe
- Change a head covering
- Change accessories
- Duplicate a character
- Duplicate an animal
- Duplicate a creature
- Duplicate a vehicle
- Add unregistered people
- Morph one identity into another
- Blend unrelated references
- Reset an injury
- Reset physical damage
- Teleport characters or objects
- Move a location without explanation
- Change time of day without story reason
- Change lighting language without story reason
- Change colour treatment without approval
- Change camera language without approval
- Make a required object disappear
- Invent a recurring object during generation

If a requested story event requires one of these changes, update the structured project state first.

## Existing Projects

Do not destroy existing Continuity Studio projects.

Use migrations for new schema fields.

Preserve approved project artifacts.

## Prompt Generation

Do not send raw story prose directly to a video generator.

Compile prompts from structured state.

Every generated sequence prompt must derive from:

- Project film bible
- Approved asset references
- Active sequence plan
- Previous approved continuity state
- Current start state
- Current mid state
- Intended end state
- Camera plan
- Lighting plan
- Dialogue plan
- Sound plan
- Model adapter
- Negative continuity rules

## Final Instruction

When implementing this rule pack into the application, do not stop at documentation.

Wire the rules into data models, validation, prompt compilation, inspection, regeneration and persistence.

