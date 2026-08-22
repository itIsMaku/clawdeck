import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const targets = {
  cli: [join(root, "packages", "cli", "dist")],
  protocol: [join(root, "packages", "protocol", "dist")],
  plugin: [
    join(root, "packages", "streamdeck-plugin", "com.volkm.clawdeck.sdPlugin", "bin"),
    join(root, "dist", "com.volkm.clawdeck.streamDeckPlugin"),
  ],
};
const selection = process.argv[2];
if (!(selection in targets)) throw new Error(`Unknown clean target: ${selection || "(missing)"}`);
for (const target of targets[selection]) rmSync(target, { recursive: true, force: true });
