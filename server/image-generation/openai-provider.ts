import OpenAI, { toFile } from "openai";
import type { ImageGenerationInput, ImageGenerationOutput, ImageGenerationProvider } from "./provider.js";

type ImageSize = "1024x1024" | "1536x1024" | "1024x1536";

export class OpenAIImageGenerationProvider implements ImageGenerationProvider {
  readonly id = "openai-images";
  readonly paid = true;
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    readonly model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1.5",
  ) {
    this.client = new OpenAI({ apiKey });
  }

  estimateCost() { return 0; }

  async generate(input: ImageGenerationInput): Promise<ImageGenerationOutput> {
    const size: ImageSize = input.width === input.height ? "1024x1024" : input.width > input.height ? "1536x1024" : "1024x1536";
    const prompt = `${input.prompt}\n\nHard negative constraints: ${input.negativePrompt}`;
    const response = input.referenceImages.length
      ? await this.client.images.edit({
          model: this.model,
          image: await Promise.all(input.referenceImages.slice(0, 4).map((item) => toFile(item.data, item.filename, { type: item.mimeType }))),
          prompt,
          size,
          quality: "medium",
          output_format: "png",
        })
      : await this.client.images.generate({
          model: this.model,
          prompt,
          size,
          quality: "medium",
          output_format: "png",
        });
    const encoded = response.data?.[0]?.b64_json;
    if (!encoded) throw new Error(`${this.model} returned no image data.`);
    const image = Buffer.from(encoded, "base64");
    if (!image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      throw new Error(`${this.model} returned an invalid PNG image.`);
    }
    return { image, thumbnail: image, provider: this.id, model: this.model };
  }
}
