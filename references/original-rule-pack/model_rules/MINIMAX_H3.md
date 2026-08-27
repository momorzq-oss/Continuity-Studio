# MiniMax H3 Film Prompt Adapter

## Purpose

Translate Continuity Studio production state into a MiniMax H3 film-generation prompt or planning instruction.

This adapter intentionally avoids inventing model-specific API parameters which have not been configured in the application.

Provider-specific settings should live in the provider configuration, not in film rules.

## Authority

MiniMax H3 must follow:

1. Approved project state
2. Burabeeh Film Engine
3. Continuity Rules
4. Asset Rules
5. Sequence Rules
6. Frame Rules
7. This adapter

## Principle

Use MiniMax H3 as a film reasoning or generation provider without letting it redesign approved production assets.

## Required Context

Provide only relevant project context:

- Film Bible summary
- Current sequence
- Previous approved END_STATE
- Active asset manifest
- Character locks
- Creature locks
- Location locks
- Prop locks
- START state
- MID state
- END state
- Dialogue
- Camera intent
- Lighting intent
- Negative continuity rules

Do not dump the entire project when a smaller context is sufficient.

## Prompt Structure

### ROLE

State the task.

Example:

`Act as the Sequence Agent for Continuity Studio. Produce the production plan for Sequence 4 from the approved structured state.`

### PROJECT LAW

State the highest-value locks.

Example:

- Preserve approved character identities.
- Preserve wardrobe.
- Preserve asset IDs.
- Preserve damage and injuries.
- Do not invent unregistered recurring assets.

### CONTINUITY INPUT

Provide previous approved state.

### ACTIVE REFERENCES

Provide IDs and roles.

### CURRENT SEQUENCE

Provide narrative purpose and duration.

### START

Provide structured start state.

### MIDDLE

Provide structured mid state.

### END

Provide intended end state.

### CAMERA AND VISUAL LANGUAGE

Provide:

- Camera movement
- Lens language
- Framing
- Colour
- Lighting
- Film texture

### DIALOGUE AND AUDIO

Provide exact speaker assignment.

### OUTPUT CONTRACT

Ask MiniMax H3 to return structured output matching the application's schema.

Do not accept invented asset IDs.

Do not accept renamed characters.

Do not accept changed wardrobe unless the project state allows it.

## When Used for Story Development

MiniMax H3 may expand:

- Premise
- Story
- Sequence beats
- Sensory detail
- Emotional progression
- Visual events

It must preserve approved project facts.

When story expansion creates a new recurring asset, mark it as `PROPOSED`.

Do not silently treat a proposed asset as approved.

## When Used for Prompt Generation

MiniMax H3 should produce a generator-ready prompt from approved sequence state.

It must not bypass the Reference Manifest.

## When Used for Continuity Inspection

Compare expected state with observed state.

Return:

- PASS or FAIL
- Failure category
- Expected value
- Observed value
- Severity
- Suggested smallest repair

## Provider Configuration

Keep connection details outside this file.

The application should configure:

- Endpoint
- Model identifier
- Authentication when required
- Timeout
- Context settings
- Generation settings

Do not hardcode unverified MiniMax H3 API behaviour into the Film Engine.

