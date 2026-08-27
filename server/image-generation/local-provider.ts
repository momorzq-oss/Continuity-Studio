import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
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
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
};

export class LocalReferenceImageProvider implements ImageGenerationProvider {
  readonly id = "continuity-local";
  readonly model = "reference-renderer-v1";
  readonly paid = false;
  estimateCost() { return 0; }
  async generate(input: ImageGenerationInput): Promise<ImageGenerationOutput> {
    const seed = createHash("sha256").update(`${input.id}|${input.prompt}|${input.referencePaths.join("|")}`).digest();
    return {
      image: png(input.width, input.height, seed, input.kind),
      thumbnail: png(384, 216, seed, input.kind),
      provider: this.id,
      model: this.model,
    };
  }
}
