import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import type { AgentState } from "@clawdeck/protocol";
import { jsonDestination, readJson, writeJsonSafely } from "./json.js";
import type { ClawdeckPaths } from "./paths.js";

type HookHandler = { type: "command"; command: string; timeout: number };
type HookGroup = { matcher?: string; hooks: HookHandler[] };
type HooksMap = Record<string, HookGroup[]>;
type FileSnapshot =
  | { destination: string; kind: "missing" }
  | { destination: string; kind: "file"; contents: Buffer; mode: number }
  | { destination: string; kind: "other" };

function snapshot(path: string): FileSnapshot {
  const destination = jsonDestination(path);
  if (!existsSync(destination)) return { destination, kind: "missing" };
  const metadata = lstatSync(destination);
  if (!metadata.isFile()) return { destination, kind: "other" };
  return { destination, kind: "file", contents: readFileSync(destination), mode: metadata.mode };
}

function restore(snapshotValue: FileSnapshot): void {
  if (snapshotValue.kind === "other") return;
  if (snapshotValue.kind === "missing") {
    if (existsSync(snapshotValue.destination) && lstatSync(snapshotValue.destination).isFile()) {
      rmSync(snapshotValue.destination, { force: true });
    }
    return;
  }
  mkdirSync(dirname(snapshotValue.destination), { recursive: true });
  writeFileSync(snapshotValue.destination, snapshotValue.contents);
  chmodSync(snapshotValue.destination, snapshotValue.mode);
}

function rollback(snapshots: FileSnapshot[]): void {
  for (const snapshotValue of [...snapshots].reverse()) {
    try {
      restore(snapshotValue);
    } catch {
      // Preserve the original installation error. Any failed rollback target
      // still has its pre-install .clawdeck-backup when one could be created.
    }
  }
}

function isOurs(command?: string): boolean {
  return Boolean(command?.includes("--source com.volkm.clawdeck"));
}

function quote(value: string): string {
  if (process.platform === "win32") return `"${value.replaceAll('"', '\\"')}"`;
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function command(paths: ClawdeckPaths, agent: string, state: AgentState, watchCodex = false): string {
  const watch = watchCodex ? " --watch-codex" : "";
  return `${quote(process.execPath)} ${quote(paths.runner)} --source com.volkm.clawdeck --file ${quote(paths.state)} --agent ${agent} --state ${state}${watch}`;
}

function handler(paths: ClawdeckPaths, agent: string, state: AgentState, watchCodex = false): HookGroup {
  return { hooks: [{ type: "command", command: command(paths, agent, state, watchCodex), timeout: 3 }] };
}

function matcherHandler(paths: ClawdeckPaths, agent: string, state: AgentState, matcher: string): HookGroup {
  return { matcher, ...handler(paths, agent, state) };
}

function cleanHooks(raw: unknown): HooksMap {
  const hooks = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as HooksMap) : {};
  const result: HooksMap = {};
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    const cleaned = groups
      .map((group) => ({
        ...group,
        hooks: Array.isArray(group.hooks) ? group.hooks.filter((item) => !isOurs(item.command)) : [],
      }))
      .filter((group) => group.hooks.length > 0);
    if (cleaned.length > 0) result[event] = cleaned;
  }
  return result;
}

function append(hooks: HooksMap, additions: HooksMap): HooksMap {
  for (const [event, groups] of Object.entries(additions)) hooks[event] = [...(hooks[event] || []), ...groups];
  return hooks;
}

function codexHooks(paths: ClawdeckPaths): HooksMap {
  return {
    SessionStart: [handler(paths, "codex", "ready")],
    UserPromptSubmit: [handler(paths, "codex", "working", true)],
    PreToolUse: [handler(paths, "codex", "working")],
    PermissionRequest: [handler(paths, "codex", "permission")],
    Stop: [handler(paths, "codex", "ready")],
    SessionEnd: [handler(paths, "codex", "offline")],
  };
}

function claudeHooks(paths: ClawdeckPaths): HooksMap {
  return {
    SessionStart: [handler(paths, "claude", "ready")],
    UserPromptSubmit: [handler(paths, "claude", "working")],
    PreToolUse: [handler(paths, "claude", "working")],
    PermissionRequest: [handler(paths, "claude", "permission")],
    Notification: [
      matcherHandler(paths, "claude", "permission", "permission_prompt|agent_needs_input"),
      matcherHandler(paths, "claude", "ready", "idle_prompt|agent_completed"),
    ],
    Stop: [handler(paths, "claude", "ready")],
    StopFailure: [handler(paths, "claude", "error")],
    SessionEnd: [handler(paths, "claude", "offline")],
  };
}

function updateFile(path: string, additions?: HooksMap): string | undefined {
  const root = readJson(path);
  const hooks = cleanHooks(root.hooks);
  root.hooks = additions ? append(hooks, additions) : hooks;
  return writeJsonSafely(path, root);
}

export interface InstallHookOptions {
  codex?: boolean;
  claude?: boolean;
}

export function installHooks(
  paths: ClawdeckPaths,
  assetRunner: string,
  options: InstallHookOptions = {},
): Array<{ name: string; path: string; backup?: string }> {
  const installCodex = options.codex !== false;
  const installClaude = options.claude !== false;
  if (!installCodex && !installClaude) throw new Error("At least one agent integration must be enabled");

  // Parse every selected file before making changes, preventing malformed JSON
  // in one integration from leaving the other integration half-installed.
  if (installCodex) readJson(paths.codexHooks);
  if (installClaude) readJson(paths.claudeSettings);
  const targets = [paths.runner, paths.config];
  if (installCodex) targets.push(paths.codexHooks, `${jsonDestination(paths.codexHooks)}.clawdeck-backup`);
  if (installClaude) targets.push(paths.claudeSettings, `${jsonDestination(paths.claudeSettings)}.clawdeck-backup`);
  const snapshots = targets.map(snapshot);

  try {
    mkdirSync(dirname(paths.runner), { recursive: true });
    copyFileSync(assetRunner, paths.runner);
    const installed = [];
    if (installCodex)
      installed.push({
        name: "Codex",
        path: paths.codexHooks,
        backup: updateFile(paths.codexHooks, codexHooks(paths)),
      });
    if (installClaude)
      installed.push({
        name: "Claude Code",
        path: paths.claudeSettings,
        backup: updateFile(paths.claudeSettings, claudeHooks(paths)),
      });
    writeJsonSafely(paths.config, { version: 1, stateFile: paths.state, installedAt: new Date().toISOString() });
    return installed;
  } catch (error) {
    rollback(snapshots);
    throw error;
  }
}

export function uninstallHooks(paths: ClawdeckPaths): void {
  if (existsSync(paths.codexHooks) && hasClawdeckHook(paths.codexHooks)) updateFile(paths.codexHooks);
  if (existsSync(paths.claudeSettings) && hasClawdeckHook(paths.claudeSettings)) updateFile(paths.claudeSettings);
}

export function hasClawdeckHook(path: string): boolean {
  try {
    const raw = JSON.stringify(readJson(path));
    return raw.includes("--source com.volkm.clawdeck");
  } catch {
    return false;
  }
}
