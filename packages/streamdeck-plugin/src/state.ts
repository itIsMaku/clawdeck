import { existsSync, readFileSync, unwatchFile, watchFile } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { type ClawdeckSnapshot, selectSnapshot } from "@clawdeck/protocol";

const DEFAULT_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function statePath(): string {
  if (process.env.CLAWDECK_STATE_FILE) return process.env.CLAWDECK_STATE_FILE;
  if (process.platform === "win32") return join(process.env.LOCALAPPDATA || homedir(), "Clawdeck", "state.json");
  if (process.platform === "darwin") return join(homedir(), "Library", "Application Support", "Clawdeck", "state.json");
  return join(process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "clawdeck", "state.json");
}

export const offlineSnapshot = (): ClawdeckSnapshot => ({
  version: 1,
  state: "offline",
  updatedAt: new Date().toISOString(),
  sessions: {},
});

function staleAfterMs(): number {
  const configured = Number(process.env.CLAWDECK_STALE_AFTER_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_STALE_AFTER_MS;
}

export function readSnapshot(file = statePath(), now = Date.now()): ClawdeckSnapshot {
  if (!existsSync(file)) return offlineSnapshot();
  try {
    const value = JSON.parse(readFileSync(file, "utf8")) as ClawdeckSnapshot;
    if (value?.version !== 1 || !value.sessions || typeof value.sessions !== "object") return offlineSnapshot();
    return selectSnapshot(value, { now, staleAfterMs: staleAfterMs() });
  } catch {
    return offlineSnapshot();
  }
}

export function watchSnapshot(callback: (snapshot: ClawdeckSnapshot) => void, file = statePath()): () => void {
  const refresh = () => callback(readSnapshot(file));
  watchFile(file, { interval: 400 }, refresh);
  const expiryTimer = setInterval(refresh, 60_000);
  expiryTimer.unref();
  refresh();
  return () => {
    unwatchFile(file, refresh);
    clearInterval(expiryTimer);
  };
}
