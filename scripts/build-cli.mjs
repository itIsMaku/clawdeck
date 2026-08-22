import { chmodSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageRoot = join(root, "packages", "cli");
const output = join(packageRoot, "dist", "cli.js");

await build({
  entryPoints: [join(packageRoot, "src", "cli.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  banner: { js: "#!/usr/bin/env node" },
  outfile: output,
});

mkdirSync(join(packageRoot, "dist", "assets"), { recursive: true });
copyFileSync(join(packageRoot, "assets", "hook.cjs"), join(packageRoot, "dist", "assets", "hook.cjs"));
chmodSync(output, 0o755);
