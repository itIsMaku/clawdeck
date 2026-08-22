#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const VALID_STATES = new Set(["working", "ready", "permission", "error", "offline"]);

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function readStdin() {
  let value = "";
  for await (const chunk of process.stdin) value += chunk;
  if (!value.trim()) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function acquireLock(file) {
  const lock = `${file}.lock`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const descriptor = fs.openSync(lock, "wx");
      fs.writeFileSync(descriptor, `${process.pid}\n`);
      return () => {
        try {
          fs.closeSync(descriptor);
        } catch {}
        try {
          fs.unlinkSync(lock);
        } catch {}
      };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > 5_000) fs.unlinkSync(lock);
      } catch {}
      await sleep(10);
    }
  }
  throw new Error("Timed out waiting for the Clawdeck state lock");
}

async function main() {
  const file = arg("file");
  const agent = arg("agent", "unknown");
  const nextState = arg("state", "ready");
  const clear = process.argv.includes("--clear");
  if (!file || !VALID_STATES.has(nextState)) process.exit(0);

  const input = await readStdin();
  const sessionId = String(input.session_id || input.thread_id || `${agent}-default`);
  const key = `${agent}:${sessionId}`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const releaseLock = await acquireLock(file);
  try {
    let snapshot = { version: 1, state: "offline", updatedAt: new Date().toISOString(), sessions: {} };

    try {
      const current = JSON.parse(fs.readFileSync(file, "utf8"));
      if (current && current.version === 1 && current.sessions) snapshot = current;
    } catch {}

    if (clear) {
      snapshot.sessions = {};
    } else if (nextState === "offline") {
      delete snapshot.sessions[key];
    } else {
      snapshot.sessions[key] = {
        agent,
        state: nextState,
        sessionId,
        updatedAt: new Date().toISOString(),
      };
    }

    const priorities = { offline: 0, ready: 1, working: 2, permission: 3, error: 4 };
    const sessions = Object.values(snapshot.sessions);
    sessions.sort(
      (a, b) => priorities[b.state] - priorities[a.state] || Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
    snapshot.state = sessions[0]?.state || "offline";
    snapshot.agent = sessions[0]?.agent;
    snapshot.updatedAt = new Date().toISOString();

    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    fs.renameSync(temporary, file);
  } finally {
    releaseLock();
  }
}

main().catch(() => process.exit(0));
