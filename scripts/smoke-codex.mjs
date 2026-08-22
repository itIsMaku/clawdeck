import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = mkdtempSync(join(tmpdir(), "clawdeck-codex-smoke-"));
const stateFile = join(root, "state", "state.json");
const env = {
  ...process.env,
  CLAWDECK_HOME: join(root, "clawdeck"),
  CLAWDECK_STATE_DIR: join(root, "state"),
  CODEX_HOME: join(root, "codex"),
  CLAUDE_CONFIG_DIR: join(root, "claude"),
};

const delay = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function state() {
  if (!existsSync(stateFile)) return undefined;
  try {
    return JSON.parse(readFileSync(stateFile, "utf8")).state;
  } catch {
    return undefined;
  }
}

async function waitForState(expected, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (state() === expected) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${expected}; current state is ${state() || "missing"}`);
}

try {
  const install = spawnSync(
    process.execPath,
    [resolve("packages/cli/dist/cli.js"), "install", "--no-streamdeck", "--no-claude"],
    { env, encoding: "utf8" },
  );
  if (install.status !== 0) throw new Error(install.stderr || install.stdout || "Clawdeck install failed");

  const child = spawn(
    "codex",
    ["--dangerously-bypass-hook-trust", "exec", "--skip-git-repo-check", "Clawdeck hook smoke test"],
    { env, stdio: ["ignore", "ignore", "pipe"] },
  );
  let diagnostic = "";
  child.stderr.on("data", (chunk) => {
    diagnostic += chunk;
  });

  try {
    await waitForState("working", 15_000);
    child.kill("SIGINT");
    await waitForState("offline", 10_000);
  } catch (error) {
    child.kill("SIGKILL");
    throw new Error(`${error.message}\n${diagnostic.trim()}`);
  }

  console.log("✓ Codex emitted UserPromptSubmit and SessionEnd through the installed Clawdeck hooks.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
