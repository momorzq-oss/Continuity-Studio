# Burabeeh Film Engine

## Mission

Turn one film idea into a controlled, inspectable production package and then into consistent generated sequences.

The system must behave like a production controller, not a one-shot prompt writer.

## Production Philosophy

Lock the film before generating the film.

A generated video is an execution of an approved production plan.

It is not the place where the model decides what recurring characters, wardrobe, locations, creatures or important props look like.

## Phase 1: Idea

Accept a short or long movie idea.

Capture:

- Working title
- Runtime
- Genre
- Time period
- Country or region
- Primary language
- Dialogue style
- Main character
- Main threat or conflict
- Ending intent
- Visual tone

Do not generate video yet.

## Phase 2: Film Bible

Create a project Film Bible.

The Film Bible should define:

- Title
- Runtime
- Genre
- Story premise
- Story summary
- Beginning
- Middle
- Ending
- Time period
- World rules
- Location rules
- Character rules
- Creature rules
- Dialogue rules
- Visual language
- Colour treatment
- Film grain or image texture
- Camera language
- Lens language
- Lighting language
- Sound direction
- Music rule
- Subtitle rule
- Violence and damage continuity
- Transformation rules
- Production restrictions

The Film Bible becomes project-level authority.

## Phase 3: Story

Write the full story before generating sequences.

The story must include enough visual, physical, sensory and emotional information for sequence planning.

Track cause and effect.

Track where characters are.

Track what they carry.

Track injuries and damage.

Track what the audience knows.

Track what remains hidden.

## Phase 4: Sequence Map

Break the story into numbered sequences.

The default structure supports 30-second production sequences.

Project runtime determines sequence count.

Each sequence requires:

- Sequence number
- Duration
- Narrative purpose
- Beginning state
- Middle development
- Ending state
- Characters present
- Creatures present
- Location
- Props
- Dialogue
- Sound
- Camera intent
- Emotional intent
- Continuity dependencies

Do not write Sequence N as if Sequence N-1 did not exist.

## Phase 5: Asset Manifest

Before video generation, extract every recurring or visually important asset.

Register assets with permanent IDs.

Asset categories include:

- Characters
- Character wardrobe
- Creatures
- Animals
- Vehicles
- Locations
- Interiors
- Props
- Weapons
- Tools
- Effects
- Damage states
- Period references

Nothing important should first appear as an uncontrolled invention inside video generation.

## Phase 6: Reference Sheets

Create reference sheets before sequences depend on them.

### Character Sheet

Lock:

- Identity
- Face shape
- Hair
- Hairline
- Skin tone
- Eyebrows
- Eyes
- Nose
- Mouth
- Jaw
- Neck
- Age appearance
- Body build
- Height and proportions when important
- Clothing
- Head covering
- Footwear
- Accessories

When useful, create multi-view references.

The purpose is identity consistency, not presentation art.

### Creature Sheet

Lock:

- Species or entity identity
- Anatomy
- Body proportions
- Limbs
- Skin, fur, scales or surface
- Eyes
- Teeth
- Claws
- Tail
- Gills, horns, wings or other recurring anatomy
- Movement language
- Size relative to humans
- Injury states
- Transformation rules

### Location Sheet

Lock:

- Geography
- Main architecture
- Entrances
- Exits
- Interior relationship
- Important landmarks
- Route through the location
- Lighting sources
- Period details
- Recurring objects

### Prop Sheet

Lock:

- Shape
- Material
- Scale
- Wear
- Colour
- Orientation when important
- Who carries it
- Damage state

## Phase 7: Visual Inspection

Inspect every generated reference before approval.

Reject references with:

- Wrong identity
- Wrong wardrobe
- Duplicate body parts
- Unwanted people
- Wrong anatomy
- Wrong period
- Wrong location
- Wrong prop
- Modern contamination
- Incorrect damage
- Incompatible colour treatment

Only approved references enter the locked library.

## Phase 8: Locked Asset Library

Each approved reusable asset receives:

- Permanent asset ID
- Human-readable name
- Category
- Approved image or images
- State
- Version
- Notes
- Allowed sequences
- Locked traits
- Mutable traits
- Relationship to other assets

Never reuse one image reference for unrelated responsibilities if this risks blending.

## Phase 9: Sequence Planning

For each sequence, build structured production state before writing the final generator prompt.

Required states:

START
MID
END

These states describe the physical film, not only the story.

## Phase 10: Reference Manifest

Each sequence gets a Reference Manifest.

The manifest specifies exactly which approved references are active and what each reference controls.

Example:

- @CHAR_RASHID controls Rashid identity and wardrobe
- @CAMEL_01 controls camel identity and tack
- @LOC_DESERT_01 controls terrain and environment
- @PROP_KNIFE_01 controls knife design
- @STATE_RASHID_WOUND_02 controls wound appearance

Use only references required for the sequence.

Do not flood the generator with unrelated references.

## Phase 11: Prompt Compilation

The Prompt Agent compiles structured state into the active model's prompt language.

The prompt must not become the source of truth for locked visual identity.

Approved references and structured project data remain the source of truth.

## Phase 12: Generation

Generate one controlled sequence.

The system must know:

- What enters the generation
- What the model is allowed to change
- What the model must preserve
- What must exist at the end

## Phase 13: Video Inspection

After generation, inspect:

- Identity
- Character count
- Wardrobe
- Anatomy
- Location
- Props
- Damage
- Screen direction
- Camera continuity
- Lighting
- Colour
- Dialogue speaker
- Temporal continuity
- Physics
- End state

The output receives a status such as:

PENDING
GENERATED
REVIEW
APPROVED
REJECTED
REGENERATING

## Phase 14: Approval or Regeneration

If the video violates a lock, do not accept it because most of the clip looks good.

Choose the smallest appropriate repair:

- Prompt correction
- Reference correction
- Shot regeneration
- Region correction when supported
- Transition repair when supported
- Sequence regeneration

Approved upstream assets should remain unchanged unless the user explicitly changes them.

## Phase 15: End State

After approval, write a structured END_STATE.

Track:

- Exact characters present
- Exact character positions
- Direction of travel
- Body orientation
- Facial and emotional state
- Wardrobe state
- Items held
- Injuries
- Creature state
- Animal state
- Vehicle state
- Location
- Time
- Weather
- Lighting
- Camera relationship
- Important sounds
- Objects remaining in frame
- Story facts revealed

The next sequence reads this state.

## Continuity Source Policy

Continuity should use approved references plus structured approved end-state data.

When a previous approved video or frame is intentionally used as a visual continuation reference, it must remain subordinate to locked character, asset and project references.

Never allow a flawed generated frame to overwrite a clean master identity reference.

## Phase 16: Next Sequence

Before Sequence N+1:

1. Read Sequence N approved END_STATE.
2. Load relevant locked assets.
3. Resolve any intentional time or location transition.
4. Build the new START state.
5. Validate continuity.
6. Plan MID and END.
7. Compile the model prompt.
8. Generate.
9. Inspect.
10. Approve or regenerate.

## Phase 17: Final Edit

Only approved sequences enter final assembly.

Track:

- Sequence order
- Dialogue
- Sound
- Music rule
- Transitions
- Titles
- End credits
- Aspect ratio
- Export settings

## Project Export

Export a complete project package with:

- Film Bible
- Story
- Sequence map
- Asset manifest
- Approved references
- Character sheets
- Creature sheets
- Location sheets
- Prop sheets
- Frame plans
- Model prompts
- Continuity states
- Generation history
- Approved videos
- Rejected generation records when useful
- Final edit metadata

