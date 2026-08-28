import OpenAI from "openai";
import type {
  MovieProject,
  PhaseId,
  ProviderInfo,
} from "../src/types.js";
import { LocalPhaseEngine } from "./local-engine.js";

export interface PhaseResult {
  artifact: unknown;
  summary: string;
  provider: string;
}

export interface PhaseEngine {
  providerInfo: ProviderInfo;
  providerInfoFor?(brain: import("../src/types.js").BrainMode): ProviderInfo;
  generate(phase: PhaseId, project: MovieProject, signal?: AbortSignal): Promise<PhaseResult>;
  cancel?(projectId: string): Promise<void>;
}

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    artifact_json: { type: "string" },
  },
  required: ["summary", "artifact_json"],
} as const;

const phaseInstructions: Record<PhaseId, string> = {
  story:
    "Write a production-ready story package with a specific logline, synopsis, three-act story, characters, locations, relationships, and a short dialogue excerpt.",
  film_bible:
    "Create a rigorous film bible. Lock tone, visual language, world rules, character continuity, location continuity, and enforceable movie rules.",
  assets:
    "Create a normalized asset manifest. Give every character, animal, creature, location, prop, wardrobe item, and vehicle a stable uppercase ID.",
  sequences:
    "Break the target runtime into the requested number of sequences. Each must have duration, dramatic purpose, location ID, asset IDs, and emotional beat.",
  frame_plans:
    "For every sequence, plan beginning, middle, and end states with visual action, camera, lighting, sound, emotion, and continuity notes.",
  prompts:
    "Create a concise provider-ready video prompt and negative prompt for every sequence. Reference locked asset IDs instead of redescribing identities.",
  continuity:
    "Audit all available artifacts for identity, wardrobe, prop, geography, lighting, damage, exposure, and screen-direction continuity. Return actionable issues and passes.",
  export:
    "Validate the complete project package and report the expected folders, key files, readiness, and any remaining export note.",
};

export class OpenAIPhaseEngine implements PhaseEngine {
  readonly providerInfo: ProviderInfo;
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly shapeEngine = new LocalPhaseEngine({ delayMs: 0 });

  constructor(apiKey: string, model = "gpt-5.4-mini") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.providerInfo = {
      kind: "openai",
      label: "OpenAI Responses API",
      model,
      available: true,
    };
  }

  async generate(phase: PhaseId, project: MovieProject, signal?: AbortSignal): Promise<PhaseResult> {
    const shape = await this.shapeEngine.generate(phase, project);
    const context = JSON.stringify(
      {
        project: {
          title: project.title,
          idea: project.idea,
          genre: project.genre,
          runtimeMinutes: project.runtimeMinutes,
          sequenceCount: project.sequenceCount,
          language: project.language,
          visualStyle: project.visualStyle,
          era: project.era,
          aspectRatio: project.aspectRatio,
          movieTitle: project.movieTitle,
          sequenceDurationSeconds: project.sequenceDurationSeconds,
          filmLanguage: project.filmLanguage,
          dialogueLanguage: project.dialogueLanguage,
          audienceRating: project.audienceRating,
          narrationEnabled: project.narrationEnabled,
          dialogueEnabled: project.dialogueEnabled,
          musicEnabled: project.musicEnabled,
          subtitlesEnabled: project.subtitlesEnabled,
          storyGenerationContext: project.production.story.generationContext,
          lockedMovieDna: project.production.movieDna.status === "LOCKED" ? project.production.movieDna : undefined,
          preStorySetup: project.preStorySetup,
          projectReferences: project.memory.database.projectReferences,
          storyAssetRequirements: project.memory.database.storyAssetRequirements,
        },
        approvedArtifacts: project.artifacts,
        feedback: project.phases.find((item) => item.id === phase)?.feedback,
      },
      null,
      2,
    );

    const response = await this.client.responses.create({
      model: this.model,
      instructions:
        "You are the production agent inside Continuity Studio. Produce concrete, internally consistent film-development artifacts. Never omit required keys. Return a short summary plus the artifact encoded as a JSON string.",
      input: `${phaseInstructions[phase]}\n\nPROJECT CONTEXT:\n${context}\n\nREQUIRED ARTIFACT SHAPE (keep these keys and value types, but write original content):\n${JSON.stringify(shape.artifact, null, 2)}`,
      text: {
        format: {
          type: "json_schema",
          name: "continuity_phase_artifact",
          strict: true,
          schema: responseSchema,
        },
      },
    }, { signal });

    const wrapper = JSON.parse(response.output_text) as {
      summary: string;
      artifact_json: string;
    };

    return {
      artifact: JSON.parse(wrapper.artifact_json),
      summary: wrapper.summary,
      provider: `OpenAI · ${this.model}`,
    };
  }
}

export class FallbackPhaseEngine implements PhaseEngine {
  readonly providerInfo: ProviderInfo;

  constructor(
    private readonly primary: PhaseEngine,
    private readonly fallback: PhaseEngine,
  ) {
    this.providerInfo = {
      ...primary.providerInfo,
      label: `${primary.providerInfo.label} · local fallback enabled`,
    };
  }

  async generate(phase: PhaseId, project: MovieProject): Promise<PhaseResult> {
    try {
      return await this.primary.generate(phase, project);
    } catch (error) {
      const result = await this.fallback.generate(phase, project);
      const reason = error instanceof Error ? error.message : "provider error";
      return {
        ...result,
        summary: `${result.summary} Live provider fallback used (${reason}).`,
        provider: `${result.provider} · fallback`,
      };
    }
  }
}

export const createPhaseEngine = (): PhaseEngine => {
  const local = new LocalPhaseEngine();
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return local;

  const openai = new OpenAIPhaseEngine(
    apiKey,
    process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini",
  );
  return new FallbackPhaseEngine(openai, local);
};
