import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ClawdeckPaths {
  home: string;
  runner: string;
  state: string;
  config: string;
  codexHooks: string;
  claudeSettings: string;
  streamDeckPlugin?: string;
}

function isWsl(): boolean {
  if (process.platform !== "linux") return false;
  if (process.env.WSL_DISTRO_NAME) return true;
  try {
    return /microsoft/i.test(readFileSync("/proc/version", "utf8"));
  } catch {
    return false;
  }
}

function windowsKnownFolderFromWsl(folder: "LocalApplicationData" | "ApplicationData"): string | undefined {
  if (!isWsl()) return undefined;
  try {
    const windowsPath = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", `[Environment]::GetFolderPath('${folder}')`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    if (!windowsPath) return undefined;
    return execFileSync("wslpath", ["-u", windowsPath], { encoding: "utf8" }).trim();
  } catch {
    return undefined;
  }
}

export function resolvePaths(env: NodeJS.ProcessEnv = process.env, discoverStreamDeck = false): ClawdeckPaths {
  const userHome = env.CLAWDECK_HOME || join(homedir(), ".clawdeck");
  let stateRoot = env.CLAWDECK_STATE_DIR;

  if (!stateRoot && process.platform === "win32") {
    stateRoot = join(env.LOCALAPPDATA || userHome, "Clawdeck");
  }
  if (!stateRoot && process.platform === "darwin") {
    stateRoot = join(homedir(), "Library", "Application Support", "Clawdeck");
  }
  if (!stateRoot) {
    const windowsRoot = windowsKnownFolderFromWsl("LocalApplicationData");
    stateRoot = windowsRoot ? join(windowsRoot, "Clawdeck") : join(userHome, "run");
  }

  let streamDeckPlugin: string | undefined;
  if (discoverStreamDeck && process.platform === "win32" && env.APPDATA) {
    streamDeckPlugin = join(env.APPDATA, "Elgato", "StreamDeck", "Plugins", "com.itismaku.clawdeck.sdPlugin");
  } else if (discoverStreamDeck && process.platform === "darwin") {
    streamDeckPlugin = join(
      homedir(),
      "Library",
      "Application Support",
      "com.elgato.StreamDeck",
      "Plugins",
      "com.itismaku.clawdeck.sdPlugin",
    );
  } else if (discoverStreamDeck) {
    const windowsRoaming = windowsKnownFolderFromWsl("ApplicationData");
    if (windowsRoaming) {
      streamDeckPlugin = join(windowsRoaming, "Elgato", "StreamDeck", "Plugins", "com.itismaku.clawdeck.sdPlugin");
    }
  }

  return {
    home: userHome,
    runner: join(userHome, "bin", "hook.cjs"),
    state: env.CLAWDECK_STATE_FILE || join(stateRoot, "state.json"),
    config: join(userHome, "config.json"),
    codexHooks: join(env.CODEX_HOME || join(homedir(), ".codex"), "hooks.json"),
    claudeSettings: join(env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "settings.json"),
    streamDeckPlugin,
  };
}

export function commandExists(command: string): boolean {
  const locator = process.platform === "win32" ? "where.exe" : "which";
  try {
    execFileSync(locator, [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function pathExists(path: string): boolean {
  return existsSync(path);
}
