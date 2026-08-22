import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(root, "packages", "cli");
const docs = join(target, "docs");
mkdirSync(docs, { recursive: true });

for (const file of ["README.md", "LICENSE", "CHANGELOG.md", "CODE_OF_CONDUCT.md", "CONTRIBUTING.md", "SECURITY.md"]) {
  copyFileSync(join(root, file), join(target, file));
}
for (const file of ["architecture.md", "compatibility.md", "preview.svg"]) {
  copyFileSync(join(root, "docs", file), join(docs, file));
}
