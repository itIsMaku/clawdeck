import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is unavailable; run this script through npm");

execFileSync(process.execPath, [npmCli, "run", "pack", "-w", "@clawdeck/streamdeck-plugin"], {
  cwd: root,
  stdio: "inherit",
});

const vendor = join(root, "packages", "cli", "vendor");
mkdirSync(vendor, { recursive: true });
copyFileSync(join(root, "dist", "com.itismaku.clawdeck.streamDeckPlugin"), join(vendor, "Clawdeck.streamDeckPlugin"));
