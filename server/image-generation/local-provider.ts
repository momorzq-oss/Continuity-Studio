import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import type { ImageGenerationInput, ImageGenerationOutput, ImageGenerationProvider } from "./provider.js";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (data: Buffer) => {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Buffer) => {
  const typeBuffer = Buffer.from(type, "ascii");
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return output;
};

const png = (width: number, height: number, seed: Buffer, kind: string) => {
  const row = width * 4 + 1;
  const raw = Buffer.alloc(row * height);
  const sky = Buffer.from([Math.max(22, seed[0]!), Math.max(20, seed[1]!), Math.max(18, seed[2]!), 255]);
  const ground = Buffer.from([Math.max(18, seed[3]!), Math.max(16, seed[4]!), Math.max(14, seed[5]!), 255]);
  const gold = Buffer.from([232, 170, 58, 255]);
  const subject = Buffer.from([Math.max(8, Math.floor(seed[6]! * .25)), Math.max(8, Math.floor(seed[7]! * .25)), Math.max(8, Math.floor(seed[8]! * .25)), 255]);
  for (let y = 0; y < height; y += 1) {
    const offset = y * row;
    raw[offset] = 0;
    raw.fill(y > height * .58 ? ground : sky, offset + 1, offset + row);
    const border = Math.max(2, Math.floor(width * .018));
    raw.fill(gold, offset + 1, offset + 1 + border * 4);
    raw.fill(gold, offset + 1 + (width - border) * 4, offset + row);
    if (y < height * .035 || y > height * .965) raw.fill(gold, offset + 1, offset + row);
    if (kind.includes("ASSET") && y > height * .18 && y < height * .86) {
      const half = y < height * .38 ? width * .09 : width * .19;
      raw.fill(subject, offset + 1 + Math.floor(width / 2 - half) * 4, offset + 1 + Math.floor(width / 2 + half) * 4);
    }
    if (kind.includes("SCENE") && (Math.abs(y - height * .2) < 3 || Math.abs(y - height * .8) < 3)) raw.fill(gold, offset + 1 + Math.floor(width * .16) * 4, offset + 1 + Math.floor(width * .84) * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 1 })), chunk("IEND", Buffer.alloc(0))]);
};

const decodeReference = (input: ImageGenerationInput["referenceImages"][number]) => {
  try {
    if (input.mimeType === "image/png") return PNG.sync.read(input.data);
    if (input.mimeType === "image/jpeg") return jpeg.decode(input.data, { useTArray: true, formatAsRGBA: true });
  } catch {
    return undefined;
  }
  return undefined;
};

const referenceDerivedPng = (width: number, height: number, source: NonNullable<ReturnType<typeof decodeReference>>, seed: Buffer) => {
  const output = new PNG({ width, height });
  const background = [Math.max(12, seed[0]! / 8), Math.max(12, seed[1]! / 8), Math.max(12, seed[2]! / 8), 255];
  for (let offset = 0; offset < output.data.length; offset += 4) {
    output.data[offset] = background[0]!;
    output.data[offset + 1] = background[1]!;
    output.data[offset + 2] = background[2]!;
    output.data[offset + 3] = 255;
  }
  const margin = Math.max(8, Math.round(Math.min(width, height) * .045));
  const scale = Math.min((width - margin * 2) / source.width, (height - margin * 2) / source.height);
  const renderedWidth = Math.max(1, Math.round(source.width * scale));
  const renderedHeight = Math.max(1, Math.round(source.height * scale));
  const startX = Math.floor((width - renderedWidth) / 2);
  const startY = Math.floor((height - renderedHeight) / 2);
  for (let y = 0; y < renderedHeight; y += 1) {
    const sourceY = Math.min(source.height - 1, Math.floor(y / scale));
    for (let x = 0; x < renderedWidth; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor(x / scale));
      const sourceOffset = (sourceY * source.width + sourceX) * 4;
      const targetOffset = ((startY + y) * width + startX + x) * 4;
      output.data[targetOffset] = source.data[sourceOffset]!;
      output.data[targetOffset + 1] = source.data[sourceOffset + 1]!;
      output.data[targetOffset + 2] = source.data[sourceOffset + 2]!;
      output.data[targetOffset + 3] = source.data[sourceOffset + 3] ?? 255;
    }
  }
  const gold = [232, 170, 58, 255];
  for (let x = margin - 2; x <= width - margin + 1; x += 1) {
    for (const y of [margin - 2, height - margin + 1]) {
      const offset = (y * width + x) * 4;
      output.data.set(gold, offset);
    }
  }
  for (let y = margin - 2; y <= height - margin + 1; y += 1) {
    for (const x of [margin - 2, width - margin + 1]) {
      const offset = (y * width + x) * 4;
      output.data.set(gold, offset);
    }
  }
  return PNG.sync.write(output, { deflateLevel: 1 });
};

export class LocalReferenceImageProvider implements ImageGenerationProvider {
  readonly id = "continuity-local";
  readonly model = "reference-derivative-v2";
  readonly paid = false;
  estimateCost() { return 0; }
  async generate(input: ImageGenerationInput): Promise<ImageGenerationOutput> {
    const seed = createHash("sha256").update(`${input.id}|${input.prompt}|${input.referencePaths.join("|")}`).digest();
    const source = input.referenceImages.map(decodeReference).find(Boolean);
    return {
      image: source ? referenceDerivedPng(input.width, input.height, source, seed) : png(input.width, input.height, seed, input.kind),
      thumbnail: source ? referenceDerivedPng(384, 216, source, seed) : png(384, 216, seed, input.kind),
      provider: this.id,
      model: this.model,
    };
  }
}
