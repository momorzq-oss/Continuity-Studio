# Seedance 2.5 Prompt Adapter

## Purpose

Translate an approved Continuity Studio sequence plan into a concise production prompt for Seedance.

This file defines prompt structure.

It does not override the Film Engine or continuity locks.

## Principle

References control visual truth.

Text controls events, timing, performance, camera and movement.

## Input Requirements

Do not compile a final Seedance prompt until the sequence has:

- Approved project Film Bible
- Approved active assets
- Reference Manifest
- START state
- MID state
- END state
- Camera plan
- Lighting plan
- Dialogue plan when required
- Sound plan
- Negative continuity rules

## Recommended Prompt Order

### 1. Sequence Header

Include:

- Film title
- Sequence number
- Duration
- Aspect ratio
- Production style

### 2. Continuity Source

State the approved previous sequence state.

Describe the exact physical handoff.

### 3. Reference Role Map

List only active references.

Example:

`@Image 1: Rashid identity and wardrobe`

`@Image 2: Camel identity, saddle, blankets, ropes and tack`

`@Image 3: Desert location and terrain`

Never ask one reference to control an unrelated asset.

### 4. Hard Locks

State critical locks clearly.

Examples:

- Exactly one Rashid
- Exactly one camel
- Same approved Rashid face, body, age and wardrobe
- Same camel and tack
- No extra people

### 5. Start State

Describe the first physical state.

### 6. Timed Action

For a 30-second sequence, default to:

0:00 to 0:10

10:00 to 0:20

20:00 to 0:30

Use continuous action where the scene requires it.

Do not force cuts for the sake of the timeline.

### 7. Camera

Specify:

- Shot size
- Lens language
- Camera height
- Movement
- Screen direction
- Subject tracking
- Focus behaviour when important

### 8. Environment and Lighting

Specify only what needs control.

Preserve project colour and lighting rules.

### 9. Dialogue and Sound

For dialogue:

- Name the speaker
- Give exact line
- Give delivery
- Maintain assigned language
- Keep the speaker relationship clear

Only include music or subtitles when the project Film Bible allows them.

### 10. End State

Describe the exact intended final physical state.

This state becomes continuity data after approval.

### 11. Negative Continuity Rules

Use targeted negatives.

Examples:

- No duplicate Rashid
- No duplicate camel
- No face drift
- No wardrobe change
- No morphing
- No extra people
- No architecture blending
- No disappearing props
- No wound reset
- No teleportation
- No unexplained camera reversal
- No unexplained lighting or time jump

## Prompt Style

Prefer direct production language.

Describe what should happen.

Avoid repeating the same lock excessively.

Use references instead of rewriting a full character description when the approved reference already defines appearance.

## Generation Review

After generation, validate the video against:

- Reference Manifest
- START state
- MID state
- END state
- Continuity rules

Do not approve a visually impressive result with broken identity or continuity.

## Continuation

For the next sequence:

- Use the approved END_STATE as structured continuity.
- Reuse permanent master references.
- Use a previous approved frame or video as a continuation reference only when the workflow intentionally requires it.
- Never allow a flawed generated reference to replace the clean master identity sheet.

