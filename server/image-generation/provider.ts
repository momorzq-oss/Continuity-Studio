export interface ImageGenerationInput {
  id: string;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  referencePaths: string[];
  referenceImages: Array<{ data: Buffer; filename: string; mimeType: string }>;
  label: string;
  kind: string;
}

export interface ImageGenerationOutput {
  image: Buffer;
  thumbnail: Buffer;
  provider: string;
  model: string;
}

export interface ImageGenerationProvider {
  readonly id: string;
  readonly model: string;
  readonly paid: boolean;
  estimateCost(input: ImageGenerationInput): number;
  generate(input: ImageGenerationInput): Promise<ImageGenerationOutput>;
}
