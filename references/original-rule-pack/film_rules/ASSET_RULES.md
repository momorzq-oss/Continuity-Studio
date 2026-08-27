# Asset Rules

## Asset Principle

Important recurring visual information must exist as an approved asset before video generation.

## Permanent IDs

Every reusable asset receives a permanent project ID.

Examples:

CHAR_RASHID_01
WARD_RASHID_MAIN_01
CREATURE_JINN_01
ANIMAL_CAMEL_01
LOC_DESERT_ROUTE_01
LOC_CAMP_01
PROP_DALLAH_01
PROP_KNIFE_01
VEHICLE_DHOW_01
FX_DUST_STORM_01

Do not renumber approved assets because a new asset is inserted later.

## Asset Record

Each asset should store:

- ID
- Name
- Category
- Description
- Reference files
- Approval status
- Version
- Locked traits
- Mutable traits
- Current state
- First sequence
- Last known sequence
- Notes

## Character References

Character references control identity.

Wardrobe references control wardrobe.

When one reference clearly controls both, record both roles.

Do not assume a location image should also define a character.

Do not assume a character sheet should define the environment.

## Character Sheet Views

When useful, include:

- Front
- Three-quarter
- Profile
- Back
- Full body
- Close-up
- Neutral expression
- Production wardrobe view

More views are useful only when they strengthen identity.

## Creature Sheet Views

When useful, include:

- Front
- Side
- Back
- Full body
- Scale comparison
- Face
- Key anatomy detail
- Action pose
- Damage state

## Location Reference Set

When useful, include:

- Establishing view
- Reverse direction
- Entry
- Exit
- Main interior
- Spatial relationship
- Night or day state when both are required
- Critical route angle

## Prop Reference Set

When useful, include:

- Hero view
- Side view
- Scale
- Handheld view
- Damage state

## Reference Manifest

Every sequence has an explicit list of active references.

Each entry states:

- Asset ID
- Reference file
- Role
- Priority
- State version

Example:

`@Image 1 = CHAR_RASHID_01, identity and wardrobe lock`

`@Image 2 = ANIMAL_CAMEL_01, camel identity and tack lock`

`@Image 3 = LOC_DESERT_ROUTE_01, environment and terrain lock`

## Reference Discipline

Use the minimum sufficient reference set.

Too many unrelated references increase ambiguity.

Never intentionally blend responsibilities.

## Approval

An asset enters production only after inspection.

Status:

DRAFT
GENERATED
REVIEW
APPROVED
REJECTED
REPLACED

Approved asset IDs remain stable.

A replacement creates a new version.

## Asset Mutation

If a character intentionally changes wardrobe, create a new wardrobe state.

If an object becomes damaged, create a new damage state.

If a creature transforms, define the transformation state.

Do not overwrite history.

