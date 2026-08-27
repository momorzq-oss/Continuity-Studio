# Sequence Rules

## Sequence Unit

Continuity Studio supports film production as numbered sequences.

The default long generation unit is 30 seconds when the active video model and project support it.

Duration is a project setting, not a hidden assumption.

## Required Sequence Record

Every sequence stores:

- Sequence ID
- Sequence number
- Duration
- Story purpose
- Previous continuity source
- Active references
- Beginning
- Middle
- Ending
- Start state
- Mid state
- End state
- Camera plan
- Lighting plan
- Sound plan
- Dialogue
- Negative rules
- Generator prompt
- Generation attempts
- Review status
- Approved output
- Approved END_STATE

## Beginning, Middle, Ending

Every sequence has a clear progression.

### Beginning

Establish the physical state inherited from the previous approved sequence.

### Middle

Advance action, tension, information or performance.

### Ending

Land on a deliberate state which supports the next sequence.

The ending must not be an accidental generation result.

## Time Map

For a 30-second sequence, a useful default planning structure is:

- 0 to 10 seconds
- 10 to 20 seconds
- 20 to 30 seconds

This is a planning structure, not a requirement for three camera cuts.

A sequence may use one continuous shot or multiple controlled shots.

## Continuation

Before writing Sequence N:

- Read Sequence N-1 approved END_STATE.
- Load relevant locked references.
- Preserve character count.
- Preserve creature and animal count.
- Preserve props and damage.
- Preserve direction.
- Resolve any intended transition.
- Build Sequence N START state.

Do not copy a prior mistake forward merely because it appears in a generated frame.

## Dialogue

For every spoken line record:

- Speaker
- Timestamp or timing range
- Exact dialogue
- Language
- Voice description
- Emotional delivery
- On-screen or off-screen status

## Character Count

Prompt character count explicitly when duplication risk exists.

Examples:

- Exactly one Rashid
- Exactly one camel
- Exactly three camp inhabitants

Do not add background people unless registered or explicitly required.

## Physical Logic

Actions must respect:

- Distance
- Direction
- Object possession
- Environment
- Character ability
- Damage
- Injury
- Animal movement
- Vehicle movement

No unexplained teleportation.

## Regeneration

When a sequence fails, identify the failure category.

Examples:

IDENTITY
WARDROBE
COUNT
ANATOMY
PROP
LOCATION
CONTINUITY
CAMERA
LIGHTING
DIALOGUE
PHYSICS
END_STATE

Regenerate the smallest necessary scope.

## Downstream Invalidation

When an approved upstream state changes, mark dependent downstream states stale.

Do not silently leave incompatible prompts approved.

