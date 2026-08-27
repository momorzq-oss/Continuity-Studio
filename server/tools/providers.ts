export type ToolProviderKind =
  | "text"
  | "image_generation"
  | "video_generation"
  | "audio_generation"
  | "image_inspection"
  | "video_inspection";

export interface ToolProviderHealth {
  state: "connected" | "unconfigured" | "error";
  detail?: string;
}

export interface ToolProvider<TInput = unknown, TOutput = unknown> {
  id: string;
  kind: ToolProviderKind;
  label: string;
  healthCheck(): Promise<ToolProviderHealth>;
  execute(input: TInput, signal?: AbortSignal): Promise<TOutput>;
  cancel?(jobId: string): Promise<void>;
}

export class ToolProviderRegistry {
  private readonly providers = new Map<string, ToolProvider>();

  register(provider: ToolProvider) {
    this.providers.set(provider.id, provider);
  }

  get(id: string) {
    return this.providers.get(id);
  }

  list(kind?: ToolProviderKind) {
    return [...this.providers.values()].filter((provider) => !kind || provider.kind === kind);
  }
}
