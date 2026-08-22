import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageRoot = join(root, "packages", "streamdeck-plugin");
const output = join(packageRoot, "com.volkm.clawdeck.sdPlugin", "bin", "plugin.js");

await build({
  entryPoints: [join(packageRoot, "src", "plugin.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  banner: {
    js: 'import { createRequire as __clawdeckCreateRequire } from "node:module"; const require = __clawdeckCreateRequire(import.meta.url);',
  },
  outfile: output,
  supported: { decorators: false },
  tsconfig: join(packageRoot, "tsconfig.json"),
});

const syntax = spawnSync(process.execPath, ["--check", output], { encoding: "utf8" });
if (syntax.status !== 0) throw new Error(syntax.stderr || syntax.stdout || "Plugin bundle syntax check failed");

const coldStart = spawnSync(process.execPath, [output], { encoding: "utf8", timeout: 1_000 });
const coldStartOutput = `${coldStart.stdout || ""}\n${coldStart.stderr || ""}`;
if (/Dynamic require|SyntaxError/.test(coldStartOutput)) {
  throw new Error(`Plugin bundle cold-start failed before SDK argument handling:\n${coldStartOutput.trim()}`);
}
