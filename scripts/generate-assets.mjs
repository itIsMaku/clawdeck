import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const images = join(root, "packages", "streamdeck-plugin", "com.volkm.clawdeck.sdPlugin", "imgs");
const source = join(images, "plugin-source.svg");

await sharp(source).resize(256, 256).png().toFile(join(images, "plugin.png"));
await sharp(source).resize(512, 512).png().toFile(join(images, "plugin@2x.png"));
