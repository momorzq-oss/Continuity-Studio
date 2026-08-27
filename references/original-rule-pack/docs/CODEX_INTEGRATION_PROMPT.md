# Codex Integration Prompt

Paste the instruction below into Codex at the root of the existing Continuity Studio repository after copying this rule pack into the project.

---

You are working inside my existing Continuity Studio repository.

Do not rebuild the application from scratch.

First inspect the repository, existing pipeline, schemas, routes, project persistence, prompt generation, approval flow, tests and build scripts.

A filmmaking rule pack has been added to this repository.

Read `AGENTS.md` first.

Then read every referenced file under:

- `film_rules/`
- `model_rules/`
- `templates/`

Your job is to integrate these rules into the actual Continuity Studio application.

Documentation alone is not completion.

## Required Implementation

Create or adapt structured project schemas for:

- Film Bible
- Sequence map
- Asset Manifest
- Asset IDs
- Character locks
- Creature locks
- Location locks
- Prop locks
- Injury ledger
- Damage ledger
- START state
- MID state
- END state
- Reference Manifest
- Prompt records
- Generation attempts
- Inspection results
- Approval status
- Downstream invalidation

Preserve existing project compatibility.

Add migrations when required.

## Film Engine

Create one central Film Engine or production policy layer.

Do not scatter core filmmaking rules across unrelated UI components.

The Film Engine must enforce the authority order in `AGENTS.md`.

## Continuity Validator

Add a Continuity Validator.

Run it before final model prompt compilation.

Hard failures should stop generation.

Run post-generation validation when inspection data is available.

## Asset Registry

Create a persistent Asset Registry with permanent IDs.

Do not renumber approved assets.

Allow versions and state changes.

## Sequence Planner

Ensure every sequence supports:

- Beginning
- Middle
- Ending
- START state
- MID state
- END state

Use previous approved END_STATE to construct the next START state.

## Reference Manifest

Create a per-sequence Reference Manifest.

Each reference must have one or more explicit control roles.

Do not let the prompt compiler treat every image as a generic style reference.

## Prompt Compiler

Create a model adapter layer.

At minimum wire:

- Seedance 2.5 adapter
- MiniMax H3 adapter

The Film Engine supplies structured state.

The model adapter translates it.

Model adapters must never override locked project state.

## Seedance

Use `model_rules/SEEDANCE_2_5.md`.

Generate prompts using `templates/SEEDANCE_SEQUENCE_TEMPLATE.md`.

Support a 30-second timeline when the project uses 30-second sequences.

Do not hardcode 30 seconds as the only possible duration.

## MiniMax H3

Use `model_rules/MINIMAX_H3.md`.

Generate structured prompts using `templates/MINIMAX_H3_TEMPLATE.md`.

Do not invent undocumented API parameters.

Keep provider connection settings separate.

## Approval Flow

Use statuses such as:

DRAFT
GENERATED
REVIEW
APPROVED
REJECTED
REGENERATING
STALE

When an upstream approved state changes, mark dependent downstream artifacts stale.

## UI

Expose enough structured production state for the user to inspect:

- Current phase
- Active assets
- Locked assets
- Sequence
- Start
- Mid
- End
- Active references
- Continuity warnings
- Generated prompt
- Approval state

Do not overwhelm the main screen.

Use expandable production panels where appropriate.

## Brain Integration

The filmmaking method must work regardless of brain provider.

Support:

- Existing offline engine
- Local model
- Existing OpenAI provider
- Codex
- Hybrid

Do not duplicate filmmaking logic inside each provider.

Brain provider decides who reasons.

Film Engine decides how a movie is produced.

## Testing

Add tests for:

- Asset ID stability
- Character lock enforcement
- Character count
- Wardrobe continuity
- Injury persistence
- Damage persistence
- Sequence END_STATE to next START state
- Reference Manifest roles
- Seedance prompt compilation
- MiniMax H3 prompt compilation
- Downstream invalidation
- Existing project migration
- Full mode
- Phase mode

Run the existing typecheck, tests and build.

Fix failures before declaring completion.

## Completion Report

At the end report:

- Files added
- Files modified
- Schemas added
- Film Engine status
- Continuity Validator status
- Asset Registry status
- Seedance adapter status
- MiniMax H3 adapter status
- UI changes
- Migration status
- Tests passed
- Remaining provider credentials or external configuration required

Do not stop after explaining the plan.

Implement it.

