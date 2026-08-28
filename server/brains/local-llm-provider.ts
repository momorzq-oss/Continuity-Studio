import OpenAI from "openai";
import type { BrainHealth, MovieProject, PhaseId, ProviderInfo } from "../../src/types.js";
import type { PhaseResult } from "../engine.js";
import { LocalPhaseEngine } from "../local-engine.js";
import type { StructuredLogger } from "../logger.js";
import type { SettingsStore } from "../settings.js";
import { BaseBrainProvider } from "./provider.js";

const normalizeBaseUrl = (value: string) => {
  const clean = value.trim().replace(/\/+$/, "");
  return clean.endsWith("/v1") ? clean : `${clean}/v1`;
};

export class LocalLlmBrainProvider extends BaseBrainProvider {
  readonly id = "local" as const;
  readonly providerInfo: ProviderInfo = {
    kind: "local",
    label: "OpenAI-compatible local model",
    available: false,
  };
  private readonly shapeEngine = new LocalPhaseEngine({ delayMs: 0 });
  private active?: AbortController;

  constructor(
    private readonly settings: SettingsStore,
    private readonly logger: StructuredLogger,
  ) {
    super();
  }

  async healthCheck(): Promise<BrainHealth> {
    const settings = await this.settings.get();
    if (!settings.local.enabled) {
      return this.health("disconnected", "Local LLM server is disabled; the offline engine remains available.");
    }
    if (!settings.local.model.trim()) {
      return this.health("unavailable", "Select a model before connecting to the local server.");
    }
    try {
      const client = this.client(settings.local.serverUrl, settings.local.timeoutMs);
      const models = await client.models.list();
      const available = models.data.some((model) => model.id === settings.local.model);
      return this.health(
        available ? "connected" : "unavailable",
        available ? "Local model is ready." : `Server connected, but ${settings.local.model} is unavailable.`,
        settings.local.model,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Local model connection failed.";
      await this.logger.warn("local-model", "Local model health check failed.", { message });
      return this.health("error", message, settings.local.model || undefined);
    }
  }

  async generate(phase: PhaseId, project: MovieProject, signal?: AbortSignal): Promise<PhaseResult> {
    const settings = await this.settings.get();
    const health = await this.healthCheck();
    if (health.state !== "connected") throw new Error(health.detail || "Local model is unavailable.");
    const controller = new AbortController();
    this.active = controller;
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const shape = await this.shapeEngine.generate(phase, project);
      const client = this.client(settings.local.serverUrl, settings.local.timeoutMs);
      const completion = await client.chat.completions.create(
        {
          model: settings.local.model,
          temperature: settings.local.temperature,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "You are Continuity Studio's local film-production brain. Return valid JSON with keys summary and artifact_json. artifact_json must be a JSON string matching the requested shape. Preserve stable IDs and continuity locks.",
            },
            {
              role: "user",
              content: `PHASE=${phase}\nPROJECT=${JSON.stringify({ title: project.title, movieTitle: project.movieTitle, idea: project.idea, genre: project.genre, runtimeMinutes: project.runtimeMinutes, sequenceCount: project.sequenceCount, sequenceDurationSeconds: project.sequenceDurationSeconds, language: project.language, filmLanguage: project.filmLanguage, dialogueLanguage: project.dialogueLanguage, audienceRating: project.audienceRating, narrationEnabled: project.narrationEnabled, dialogueEnabled: project.dialogueEnabled, musicEnabled: project.musicEnabled, subtitlesEnabled: project.subtitlesEnabled, visualStyle: project.visualStyle, era: project.era, aspectRatio: project.aspectRatio, storyGenerationContext: project.production.story.generationContext, lockedMovieDna: project.production.movieDna.status === "LOCKED" ? project.production.movieDna : undefined, preStorySetup: project.preStorySetup })}\nREFERENCE_LAW=Required uploaded references are protected inputs. A main character source must become the protagonist and must not be duplicated or overwritten. Movie DNA controls tone and visual direction but never overwrites narrative cause and effect.\nMEMORY=${JSON.stringify(project.memory)}\nAPPROVED_ARTIFACTS=${JSON.stringify(project.artifacts)}\nREQUIRED_SHAPE=${JSON.stringify(shape.artifact)}`,
            },
          ],
        },
        { signal: controller.signal },
      );
      const content = completion.choices[0]?.message.content;
      if (!content) throw new Error("The local model returned no content.");
      const wrapper = JSON.parse(content) as { summary: string; artifact_json: string };
      return {
        artifact: JSON.parse(wrapper.artifact_json),
        summary: wrapper.summary,
        provider: `Local LLM · ${settings.local.model}`,
      };
    } finally {
      signal?.removeEventListener("abort", abort);
      this.active = undefined;
    }
  }

  async cancel(_projectId?: string) {
    this.active?.abort();
  }

  private client(serverUrl: string, timeout: number) {
    const localCredential = process.env.LOCAL_LLM_API_KEY?.trim() || "not-required";
    return new OpenAI({ apiKey: localCredential, baseURL: normalizeBaseUrl(serverUrl), timeout });
  }

  private health(state: BrainHealth["state"], detail: string, model?: string): BrainHealth {
    return {
      id: "local",
      state,
      label: this.providerInfo.label,
      model,
      detail,
      checkedAt: new Date().toISOString(),
    };
  }
}
