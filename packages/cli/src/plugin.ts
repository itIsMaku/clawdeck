import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

export function openPluginInstaller(path: string): { ok: boolean; reason?: string } {
  if (!existsSync(path)) return { ok: false, reason: "bundled Stream Deck installer was not found" };

  if (process.platform === "win32") {
    const result = spawnSync("cmd.exe", ["/d", "/s", "/c", "start", "", path], { stdio: "ignore", windowsHide: true });
    return result.error ? { ok: false, reason: result.error.message } : { ok: true };
  }
  if (process.env.WSL_DISTRO_NAME) {
    let windowsPath = path;
    try {
      windowsPath = execFileSync("wslpath", ["-w", path], { encoding: "utf8" }).trim();
    } catch {}
    const result = spawnSync("explorer.exe", [windowsPath], { stdio: "ignore" });
    return result.error ? { ok: false, reason: result.error.message } : { ok: true };
  }
  if (process.platform === "darwin") {
    const result = spawnSync("open", [path], { stdio: "ignore" });
    return result.error ? { ok: false, reason: result.error.message } : { ok: true };
  }
  return { ok: false, reason: "automatic plugin opening is supported on Windows, WSL, and macOS" };
}
