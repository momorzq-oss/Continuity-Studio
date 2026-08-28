import type { FilmmakingKnowledgeSource } from "../src/types.js";

const importedAt = "2026-08-28T00:00:00.000Z";

export const AI_FILMMAKING_VISUAL_GUIDE_SOURCE: FilmmakingKnowledgeSource = {
  id: "KNOWLEDGE_AI_FILMMAKING_VISUAL_GUIDE_V1",
  title: "AI Filmmaking Visual Guide",
  sourceFilename: "AI_Filmmaking_Visual_Guide.pdf",
  sourceSha256: "fc621f014cf54a2796a8b185b3ecaaa15c42cc79e46e6c1d0ec66ff76b9ee958",
  pageCount: 14,
  version: 1,
  status: "ACTIVE",
  importedAt,
  principles: [
    {
      id: "VISUAL_GUIDE_IDENTITY_ANCHOR",
      name: "Repeat one stable character identity anchor",
      scope: "CHARACTER_IDENTITY",
      enforcement: "Compile one concise identity anchor from approved character truth and repeat it unchanged across character-sheet, storyboard, and video prompts; references remain the visual authority.",
      sourcePages: [2, 4, 7, 8, 10, 12],
      durable: true,
    },
    {
      id: "VISUAL_GUIDE_NEUTRAL_CHARACTER_SHEETS",
      name: "Keep identity sheets visually neutral",
      scope: "CHARACTER_SHEET",
      enforcement: "Character identity sheets use simple backgrounds and neutral, even lighting. Scene effects, damage, dirt, weather, dramatic rim light, and transient story state belong in separate state or shot references.",
      sourcePages: [2, 5, 6, 14],
      durable: true,
    },
    {
      id: "VISUAL_GUIDE_STYLE_ANCHOR",
      name: "Lock one reusable visual-language anchor",
      scope: "STYLE",
      enforcement: "Carry the approved palette, lighting language, lens character, texture or grain, camera language, and aspect ratio through every derived visual and sequence prompt.",
      sourcePages: [2, 5],
      durable: true,
    },
    {
      id: "VISUAL_GUIDE_HIGH_SIGNAL_PROMPTS",
      name: "Prefer concise high-signal direction",
      scope: "PROMPT",
      enforcement: "Use concrete production direction, short action beats, explicit camera logic, and fully resolved values. Never ship bracketed placeholders, editorial commentary, repeated prose, or vague filler.",
      sourcePages: [2, 4, 7, 8, 9, 10, 13, 14],
      durable: true,
    },
    {
      id: "VISUAL_GUIDE_STORYBOARD_CONTINUITY",
      name: "Treat a Storyboard Grid as one continuous scene",
      scope: "STORYBOARD",
      enforcement: "When enabled, the optional 3x3 Storyboard Grid derives nine ordered beats from the Shot Planner and preserves identity, geography, lighting, staging, screen direction, and temporal flow. It supplements and never replaces the Shot Planner.",
      sourcePages: [8, 9, 10, 12, 13],
      durable: true,
    },
    {
      id: "VISUAL_GUIDE_UNIQUE_REFERENCE_NUMBERS",
      name: "Assign every uploaded reference a unique prompt position",
      scope: "REFERENCE_MAPPING",
      enforcement: "Each distinct reference occupies exactly one temporary platform upload position. Never collapse multiple character sheets, a Storyboard Grid, or another asset into the same @Image number. Permanent project image numbers never change.",
      sourcePages: [2, 11, 12, 14],
      durable: true,
    },
    {
      id: "VISUAL_GUIDE_REFERENCE_AWARE_VIDEO_PROMPTS",
      name: "Separate identity control from motion and framing control",
      scope: "VIDEO_PROMPT",
      enforcement: "Character sheets control identity; a Storyboard Grid controls ordered motion, framing, and geography; text controls action, timing, performance, camera, dialogue, sound, and the required ending.",
      sourcePages: [11, 12, 13],
      durable: true,
    },
    {
      id: "VISUAL_GUIDE_VERSION_PLATFORM_LIMITS",
      name: "Keep provider limits inside versioned Platform Profiles",
      scope: "PLATFORM_PROFILE",
      enforcement: "Duration, reference capacity, audio behavior, feature support, and prompt syntax are version-specific provider facts. Never promote one guide snapshot into a global filmmaking limit.",
      sourcePages: [11, 12, 14],
      durable: true,
    },
  ],
  platformSnapshotNotes: [
    "The guide's Seedance 2.0 duration and audio statements are retained only as historical source context; active behavior comes from the selected, versioned Platform Profile.",
  ],
};

export const createFilmmakingKnowledgeSources = () => [structuredClone(AI_FILMMAKING_VISUAL_GUIDE_SOURCE)];
