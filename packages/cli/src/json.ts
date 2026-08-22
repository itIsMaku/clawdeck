import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

export type JsonObject = Record<string, unknown>;

export function readJson(path: string): JsonObject {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must contain a JSON object`);
  }
  return value as JsonObject;
}

export function jsonDestination(path: string): string {
  return existsSync(path) && lstatSync(path).isSymbolicLink() ? realpathSync(path) : path;
}

export function writeJsonSafely(path: string, value: unknown): string | undefined {
  const destination = jsonDestination(path);
  mkdirSync(dirname(destination), { recursive: true });
  let backup: string | undefined;
  if (existsSync(destination)) {
    backup = `${destination}.clawdeck-backup`;
    // Preserve the pre-Clawdeck baseline across idempotent reinstalls.
    if (!existsSync(backup)) copyFileSync(destination, backup);
  }
  const temporary = `${destination}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    renameSync(temporary, destination);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
  return backup;
}
