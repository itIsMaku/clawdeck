import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

const packageVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
const tarball = join("dist", `itismaku-clawdeck-${packageVersion}.tgz`);
const archive = gunzipSync(readFileSync(tarball));
const files = new Set();

for (let offset = 0; offset + 512 <= archive.length; ) {
  const header = archive.subarray(offset, offset + 512);
  if (header.every((byte) => byte === 0)) break;
  const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
  const sizeText = header.subarray(124, 136).toString("ascii").replace(/\0.*$/, "").trim();
  const size = Number.parseInt(sizeText || "0", 8);
  files.add(name);
  offset += 512 + Math.ceil(size / 512) * 512;
}

const required = [
  "package/package.json",
  "package/README.md",
  "package/LICENSE",
  "package/dist/cli.js",
  "package/dist/assets/hook.cjs",
  "package/vendor/Clawdeck.streamDeckPlugin",
  "package/docs/architecture.md",
  "package/docs/compatibility.md",
  "package/docs/preview.svg",
];

const missing = required.filter((file) => !files.has(file));
if (missing.length > 0) throw new Error(`npm artifact is missing: ${missing.join(", ")}`);

const plugin = readFileSync(join("dist", "com.volkm.clawdeck.streamDeckPlugin"));
if (plugin[0] !== 0x50 || plugin[1] !== 0x4b) throw new Error("Stream Deck artifact is not a ZIP package");

console.log(`Verified ${required.length} required npm files and the Stream Deck package envelope.`);
