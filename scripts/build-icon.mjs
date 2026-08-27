import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import pngToIco from "png-to-ico";

const source = path.resolve("assets/icon.png");
const destination = path.resolve("assets/icon.ico");
const png = await readFile(source);
const ico = await pngToIco(png);
await writeFile(destination, ico);
console.log(`Updated ${destination} from ${source}`);
