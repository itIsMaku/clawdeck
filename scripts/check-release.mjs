import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const json = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const rootPackage = json("package.json");
const packages = new Map([
  ["CLI", json("packages/cli/package.json").version],
  ["protocol", json("packages/protocol/package.json").version],
  ["plugin package", json("packages/streamdeck-plugin/package.json").version],
]);
const manifest = json("packages/streamdeck-plugin/com.itismaku.clawdeck.sdPlugin/manifest.json");

for (const [name, version] of packages) {
  if (version !== rootPackage.version)
    throw new Error(`${name} version ${version} does not match ${rootPackage.version}`);
}
if (manifest.Version !== `${rootPackage.version}.0`) {
  throw new Error(`Stream Deck manifest version ${manifest.Version} does not match ${rootPackage.version}.0`);
}
if (process.env.GITHUB_REF_TYPE === "tag" && process.env.GITHUB_REF_NAME !== `v${rootPackage.version}`) {
  throw new Error(`Tag ${process.env.GITHUB_REF_NAME} does not match v${rootPackage.version}`);
}
console.log(`Release versions are consistent: ${rootPackage.version}`);
