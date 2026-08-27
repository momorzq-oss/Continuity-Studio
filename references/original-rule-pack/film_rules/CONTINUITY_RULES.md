# Continuity Rules

## Purpose

Continuity is a hard production constraint.

It must be represented as structured data and checked before and after generation.

## Identity Locks

For every recurring character preserve:

- Character ID
- Face
- Age
- Body
- Hair
- Hairline
- Skin tone
- Facial proportions
- Body proportions
- Clothing
- Head covering
- Footwear
- Accessories

Exactly one physical instance of a character should exist unless the story explicitly requires more.

A lookalike is not the same character.

Do not allow:

- Face drift
- Identity swap
- Duplicate character
- Unexplained age change
- Body redesign
- Unexplained wardrobe change
- Unexplained accessory change
- Morphing

## Creature and Animal Locks

Preserve:

- Identity
- Count
- Anatomy
- Size
- Surface
- Limbs
- Tail
- Wings
- Gills
- Horns
- Teeth
- Claws
- Injury
- Equipment
- Tack
- Saddle
- Ropes
- Blankets

A creature or animal must not gain or lose anatomy between shots.

## Prop Locks

Track:

- Prop ID
- Owner
- Current holder
- Position
- Orientation when important
- Damage
- Clean or dirty state
- Presence

A carried object must not disappear without an event.

## Location Locks

Track:

- Location ID
- Interior or exterior
- Geography
- Entrances
- Exits
- Architecture
- Route
- Recurring furniture
- Environmental objects
- Time period

Do not blend two locations because both appear in references.

## State Continuity

Track between sequences:

- Character positions
- Screen direction
- Direction of travel
- Body orientation
- Character count
- Creature count
- Animal count
- Vehicle count
- Props carried
- Props left behind
- Injuries
- Blood, dirt and damage
- Weather
- Time of day
- Lighting
- Fire or smoke
- Door states
- Vehicle states
- Animal states

## Injury Ledger

Every injury has a state.

Example:

INJURY_01
- body area
- severity
- visible wound
- blood state
- pain behaviour
- mobility effect
- first sequence
- current state
- healing or worsening rule

Do not reset injuries between sequences.

## Damage Ledger

Track damage to:

- Clothing
- Props
- Vehicles
- Buildings
- Creatures
- Environment

Damage remains until a story event repairs or changes it.

## Camera Continuity

Track when relevant:

- Camera side
- Screen direction
- Lens family
- Framing
- Height
- Movement
- Character eyeline
- Axis of action

Do not create an unexplained camera jump which reverses physical direction.

## Visual Continuity

Lock project-level:

- Aspect ratio
- Colour treatment
- Grain
- Contrast
- Saturation
- Highlight behaviour
- Black level
- Sharpness
- Period feel
- Lighting language

Intentional changes require story or directorial reason.

## Dialogue Continuity

Dialogue must belong to the correct visible or established speaker.

Track:

- Speaker
- Exact line
- Language
- Accent or dialect rule
- Voice age
- Emotional delivery
- Whether speaker is on screen or off screen

Do not assign one character's dialogue to another visible character.

## Pre-Generation Continuity Gate

Before generation, validate:

1. All recurring assets are registered.
2. Required references are approved.
3. Character counts are explicit.
4. Creature and animal counts are explicit.
5. Start state is compatible with prior approved state.
6. Wardrobe matches the ledger.
7. Injuries match the ledger.
8. Props match the ledger.
9. Location is correct.
10. Time and lighting are compatible.
11. Intended changes are explained.
12. End state is defined.

If a hard lock fails, stop prompt compilation.

## Post-Generation Continuity Gate

Inspect the generated result for:

- Face drift
- Wrong person
- Duplicate person
- Extra person
- Wrong wardrobe
- Morphing
- Wrong anatomy
- Duplicate animal
- Duplicate creature
- Missing prop
- Changed prop
- Reset wound
- Location drift
- Architecture blending
- Teleportation
- Direction reversal
- Lighting jump
- Time jump
- Colour drift
- Physics failure
- Wrong dialogue speaker

Reject hard violations.

## Continuity Confidence

Store a score and individual checks.

Do not use one score to hide a hard failure.

A failed identity or character-count check should block approval even when other checks pass.

