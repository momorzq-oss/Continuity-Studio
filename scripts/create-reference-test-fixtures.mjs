import jpeg from "jpeg-js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputRoot = path.resolve("screenshots", "reference-e2e-fixtures");
await mkdir(outputRoot, { recursive: true });

const image = (width, height, painter) => {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const [red, green, blue] = painter(x, y, width, height);
      data[offset] = red; data[offset + 1] = green; data[offset + 2] = blue; data[offset + 3] = 255;
    }
  }
  return jpeg.encode({ data, width, height }, 88).data;
};

const portrait = image(480, 640, (x, y, width, height) => {
  const face = ((x - width * .5) / (width * .23)) ** 2 + ((y - height * .37) / (height * .26)) ** 2 < 1;
  const hair = face && y < height * .22;
  const shirt = y > height * .63 && Math.abs(x - width * .5) < width * .34;
  const leftEye = ((x - width * .42) ** 2 + (y - height * .34) ** 2) < 70;
  const rightEye = ((x - width * .58) ** 2 + (y - height * .34) ** 2) < 70;
  if (leftEye || rightEye) return [35, 30, 25];
  if (hair) return [42, 31, 22];
  if (face) return [190, 132, 91];
  if (shirt) return [36, 74, 92];
  return [24 + Math.floor(22 * y / height), 34 + Math.floor(18 * x / width), 45];
});

const location = image(720, 450, (x, y, width, height) => {
  if (y < height * .48) return [42 + Math.floor(38 * y / height), 68, 92];
  const tent = y > height * .48 && y < height * .78 && Math.abs(x - width * .52) < (y - height * .38) * .75;
  if (tent) return [84, 52, 32];
  const fire = ((x - width * .5) ** 2 + (y - height * .78) ** 2) < 900;
  if (fire) return [235, 143, 45];
  return [154 + Math.floor(35 * x / width), 108, 62];
});

await Promise.all([
  writeFile(path.join(outputRoot, "qa-main-character.jpg"), portrait),
  writeFile(path.join(outputRoot, "qa-location.jpg"), location),
]);
console.log(outputRoot);
