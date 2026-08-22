import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

execFileSync(npm, ["run", "pack", "-w", "@clawdeck/streamdeck-plugin"], {
  cwd: root,
  stdio: "inherit",
});

const vendor = join(root, "packages", "cli", "vendor");
mkdirSync(vendor, { recursive: true });
copyFileSync(join(root, "dist", "com.volkm.clawdeck.streamDeckPlugin"), join(vendor, "Clawdeck.streamDeckPlugin"));
