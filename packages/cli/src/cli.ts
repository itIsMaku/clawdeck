import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type ClawdeckSnapshot, isAgentState, selectSnapshot } from "@clawdeck/protocol";
import { hasClawdeckHook, installHooks, uninstallHooks } from "./hooks.js";
import { commandExists, resolvePaths } from "./paths.js";
import { openPluginInstaller } from "./plugin.js";

const VERSION = "0.1.2";
const here = dirname(fileURLToPath(import.meta.url));

function asset(name: string): string {
  const bundled = join(here, "assets", name);
  const source = join(here, "..", "assets", name);
  return existsSync(bundled) ? bundled : source;
}

function pluginInstaller(): string {
  const bundled = join(here, "vendor", "Clawdeck.streamDeckPlugin");
  return existsSync(bundled) ? bundled : join(here, "..", "vendor", "Clawdeck.streamDeckPlugin");
}

function help(): void {
  console.log(`clawdeck ${VERSION}

Usage:
  clawdeck install [--no-streamdeck] [--no-codex] [--no-claude]
  clawdeck install-plugin
  clawdeck doctor [--json]
  clawdeck status [--json]
  clawdeck event <state> [--agent codex|claude|manual]
  clawdeck reset
  clawdeck uninstall

States: working, ready, permission, error, offline`);
}

const commandOptions: Record<string, Set<string>> = {
  install: new Set(["--no-streamdeck", "--no-codex", "--no-claude"]),
  "install-plugin": new Set(),
  doctor: new Set(["--json"]),
  status: new Set(["--json"]),
  event: new Set(["--agent"]),
  reset: new Set(),
  uninstall: new Set(),
};

function validateArguments(command: string): void {
  const allowed = commandOptions[command];
  if (!allowed) return;
  const start = command === "event" ? 4 : 3;
  for (let index = start; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    if (!allowed.has(argument)) throw new Error(`Unknown option for ${command}: ${argument}`);
    if (argument === "--agent") {
      const value = process.argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--agent requires a value");
      index += 1;
    }
  }
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function event(): Promise<void> {
  const state = process.argv[3];
  if (!state || !isAgentState(state)) throw new Error(`Unknown state: ${state || "(missing)"}`);
  const agent = option("agent") || "manual";
  if (!new Set(["codex", "claude", "manual"]).has(agent)) throw new Error(`Unknown agent: ${agent}`);
  const paths = resolvePaths();
  mkdirSync(dirname(paths.state), { recursive: true });
  const runner = asset("hook.cjs");
  const result = spawnSync(process.execPath, [runner, "--file", paths.state, "--agent", agent, "--state", state], {
    input: process.stdin.isTTY ? "{}" : readFileSync(0),
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (result.status) process.exitCode = result.status;
}

function status(): void {
  const paths = resolvePaths();
  if (!existsSync(paths.state)) {
    console.log(
      process.argv.includes("--json") ? JSON.stringify({ state: "offline", sessions: {} }, null, 2) : "OFFLINE",
    );
    return;
  }
  let snapshot: ClawdeckSnapshot;
  try {
    const parsed = JSON.parse(readFileSync(paths.state, "utf8"));
    if (parsed?.version !== 1 || !parsed.sessions || typeof parsed.sessions !== "object") throw new Error("schema");
    const configuredStaleAfter = Number(process.env.CLAWDECK_STALE_AFTER_MS);
    snapshot = selectSnapshot(parsed, {
      staleAfterMs:
        Number.isFinite(configuredStaleAfter) && configuredStaleAfter > 0 ? configuredStaleAfter : undefined,
    });
  } catch {
    throw new Error(`State file is not valid JSON: ${paths.state}. Run \`clawdeck reset\` to recover.`);
  }
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  const sessionCount =
    snapshot.sessions && typeof snapshot.sessions === "object" ? Object.keys(snapshot.sessions).length : 0;
  console.log(
    `${String(snapshot.state || "offline").toUpperCase()}${snapshot.agent ? ` · ${String(snapshot.agent).toUpperCase()}` : ""} · ${sessionCount} session${sessionCount === 1 ? "" : "s"}`,
  );
}

function reset(): void {
  const paths = resolvePaths();
  mkdirSync(dirname(paths.state), { recursive: true });
  const result = spawnSync(
    process.execPath,
    [asset("hook.cjs"), "--file", paths.state, "--agent", "clawdeck", "--state", "offline", "--clear"],
    {
      input: "{}",
      stdio: ["pipe", "inherit", "inherit"],
    },
  );
  if (result.status) throw new Error("Failed to reset shared state");
  console.log("✓ Cleared all Clawdeck sessions.");
}

function install(): void {
  const paths = resolvePaths();
  const installCodex = !process.argv.includes("--no-codex");
  const installClaude = !process.argv.includes("--no-claude");
  if (!installCodex && !installClaude) {
    throw new Error("Nothing to install: --no-codex and --no-claude cannot be used together");
  }
  const changes = installHooks(paths, asset("hook.cjs"), { codex: installCodex, claude: installClaude });
  console.log("✓ Hook runner installed");
  for (const change of changes) {
    console.log(`✓ ${change.name} hooks installed: ${change.path}`);
    if (change.backup) console.log(`  backup: ${change.backup}`);
  }
  console.log(`✓ Shared state: ${paths.state}`);
  spawnSync(process.execPath, [paths.runner, "--file", paths.state, "--agent", "clawdeck", "--state", "offline"], {
    input: "{}",
    stdio: ["pipe", "ignore", "ignore"],
  });
  if (installCodex) console.log("\nCodex will ask you to review the new user hook once via /hooks.");

  if (!process.argv.includes("--no-streamdeck")) {
    const result = openPluginInstaller(pluginInstaller());
    if (result.ok) console.log("✓ Opened the Stream Deck plugin installer; confirm it in Stream Deck.");
    else console.log(`! Stream Deck plugin not opened: ${result.reason}`);
  }
  console.log("\nNext: in Stream Deck, drag “Agent Status Tile” onto each key you want Clawdeck to use.");
}

function doctor(): void {
  const paths = resolvePaths(process.env, true);
  const [major, minor, patch] = process.versions.node.split(".").map(Number);
  const nodeSupported = major > 20 || (major === 20 && (minor > 5 || (minor === 5 && patch >= 1)));
  const checks = [
    { label: "Node.js >= 20.5.1", ok: nodeSupported, required: true },
    { label: "Codex executable", ok: commandExists("codex"), required: false },
    { label: "Claude executable", ok: commandExists("claude"), required: false },
    { label: "Codex hook", ok: hasClawdeckHook(paths.codexHooks), required: false },
    { label: "Claude hook", ok: hasClawdeckHook(paths.claudeSettings), required: false },
    {
      label: "At least one agent hook",
      ok: hasClawdeckHook(paths.codexHooks) || hasClawdeckHook(paths.claudeSettings),
      required: true,
    },
    { label: "Hook runner", ok: existsSync(paths.runner), required: true },
    { label: "State file", ok: existsSync(paths.state), required: true },
    {
      label: "Stream Deck plugin",
      ok: Boolean(paths.streamDeckPlugin && existsSync(paths.streamDeckPlugin)),
      required: false,
    },
  ];
  if (process.argv.includes("--json")) {
    console.log(
      JSON.stringify(
        { version: VERSION, platform: process.platform, node: process.versions.node, paths, checks },
        null,
        2,
      ),
    );
    if (checks.some((check) => check.required && !check.ok)) process.exitCode = 1;
    return;
  }
  for (const check of checks)
    console.log(`${check.ok ? "✓" : check.required ? "✗" : "○"} ${check.label}${check.required ? "" : " (optional)"}`);
  console.log(`\nState path: ${paths.state}`);
  if (existsSync(paths.state)) console.log(readFileSync(paths.state, "utf8").trim());
  if (checks.some((check) => check.required && !check.ok)) process.exitCode = 1;
}

function uninstall(): void {
  const paths = resolvePaths();
  uninstallHooks(paths);
  if (existsSync(paths.runner)) rmSync(paths.runner);
  console.log("✓ Removed Clawdeck hooks and hook runner.");
  console.log("  Stream Deck plugin and state history were left in place.");
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!command || command === "help" || command === "--help" || command === "-h") return help();
  if (command === "--version" || command === "-v") return console.log(VERSION);
  validateArguments(command);
  if (command === "install") return install();
  if (command === "install-plugin") {
    const result = openPluginInstaller(pluginInstaller());
    if (!result.ok) throw new Error(result.reason);
    return;
  }
  if (command === "doctor") return doctor();
  if (command === "status") return status();
  if (command === "event") return event();
  if (command === "reset") return reset();
  if (command === "uninstall") return uninstall();
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`clawdeck: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
