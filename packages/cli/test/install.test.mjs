import assert from "node:assert/strict";
import { execFile, execFileSync, spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const cli = resolve("dist/cli.js");

test("install preserves existing hooks, emits state, and uninstalls only Clawdeck", () => {
  const root = mkdtempSync(join(tmpdir(), "clawdeck-test-"));
  const codex = join(root, "codex");
  const claude = join(root, "claude");
  const clawdeck = join(root, "clawdeck");
  const stateDir = join(root, "state");
  mkdirSync(codex, { recursive: true });
  mkdirSync(claude, { recursive: true });
  const existing = { type: "command", command: "echo keep-me" };
  const similar = {
    type: "command",
    command: "node /some-other-tool/hook.cjs --agent codex --state ready",
  };
  writeFileSync(join(codex, "hooks.json"), JSON.stringify({ hooks: { Stop: [{ hooks: [existing, similar] }] } }));
  writeFileSync(
    join(claude, "settings.json"),
    JSON.stringify({ theme: "dark", hooks: { Stop: [{ hooks: [existing] }] } }),
  );

  const env = {
    ...process.env,
    CLAWDECK_HOME: clawdeck,
    CLAWDECK_STATE_DIR: stateDir,
    CODEX_HOME: codex,
    CLAUDE_CONFIG_DIR: claude,
  };

  try {
    execFileSync(process.execPath, [cli, "install", "--no-streamdeck"], { env });
    const codexInstalled = JSON.parse(readFileSync(join(codex, "hooks.json"), "utf8"));
    const claudeInstalled = JSON.parse(readFileSync(join(claude, "settings.json"), "utf8"));
    assert.match(JSON.stringify(codexInstalled), /hook\.cjs/);
    assert.match(JSON.stringify(codexInstalled), /keep-me/);
    assert.match(JSON.stringify(codexInstalled), /some-other-tool/);
    assert.equal(claudeInstalled.theme, "dark");
    assert.match(JSON.stringify(claudeInstalled), /permission_prompt/);

    execFileSync(process.execPath, [cli, "install", "--no-streamdeck"], { env });
    const codexReinstalled = readFileSync(join(codex, "hooks.json"), "utf8");
    assert.equal(
      codexReinstalled.match(/--source com\.itismaku\.clawdeck/g)?.length,
      6,
      "reinstall must not duplicate handlers",
    );
    assert.doesNotMatch(
      readFileSync(join(codex, "hooks.json.clawdeck-backup"), "utf8"),
      /--source com\.itismaku\.clawdeck/,
      "reinstall must preserve the pre-Clawdeck backup",
    );

    execFileSync(process.execPath, [cli, "event", "working", "--agent", "codex"], { env, input: "{}" });
    const snapshot = JSON.parse(readFileSync(join(stateDir, "state.json"), "utf8"));
    assert.equal(snapshot.state, "working");
    assert.equal(snapshot.agent, "codex");
    assert.match(
      execFileSync(process.execPath, [cli, "status"], { env, encoding: "utf8" }),
      /WORKING · CODEX · 1 session/,
    );

    execFileSync(process.execPath, [cli, "reset"], { env });
    const resetSnapshot = JSON.parse(readFileSync(join(stateDir, "state.json"), "utf8"));
    assert.equal(resetSnapshot.state, "offline");
    assert.deepEqual(resetSnapshot.sessions, {});

    execFileSync(process.execPath, [cli, "uninstall"], { env });
    assert.doesNotMatch(readFileSync(join(codex, "hooks.json"), "utf8"), /--source com\.itismaku\.clawdeck/);
    assert.match(readFileSync(join(codex, "hooks.json"), "utf8"), /keep-me/);
    assert.match(readFileSync(join(codex, "hooks.json"), "utf8"), /some-other-tool/);
    assert.doesNotMatch(readFileSync(join(claude, "settings.json"), "utf8"), /--source com\.itismaku\.clawdeck/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("standalone runner preserves concurrent sessions", async () => {
  const root = mkdtempSync(join(tmpdir(), "clawdeck-concurrency-"));
  const state = join(root, "state.json");
  const runner = resolve("dist/assets/hook.cjs");
  const run = (agent, sessionId) =>
    new Promise((resolvePromise, reject) => {
      const child = execFile(
        process.execPath,
        [runner, "--file", state, "--agent", agent, "--state", "working"],
        (error) => {
          if (error) reject(error);
          else resolvePromise();
        },
      );
      child.stdin.end(JSON.stringify({ session_id: sessionId }));
    });

  try {
    await Promise.all(
      Array.from({ length: 16 }, (_, index) => run(index % 2 ? "codex" : "claude", `session-${index}`)),
    );
    const snapshot = JSON.parse(readFileSync(state, "utf8"));
    assert.equal(Object.keys(snapshot.sessions).length, 16);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Codex transcript watcher clears working after an interrupted turn", async () => {
  const root = mkdtempSync(join(tmpdir(), "clawdeck-interrupt-"));
  const state = join(root, "state.json");
  const transcript = join(root, "rollout.jsonl");
  const runner = resolve("dist/assets/hook.cjs");
  writeFileSync(transcript, '{"type":"event_msg","payload":{"type":"task_started"}}\n');

  try {
    const child = execFile(process.execPath, [
      runner,
      "--file",
      state,
      "--agent",
      "codex",
      "--state",
      "working",
      "--watch-codex",
    ]);
    child.stdin.end(JSON.stringify({ session_id: "interrupted", transcript_path: transcript }));
    await new Promise((resolvePromise, reject) =>
      child.once("exit", (code) => (code === 0 ? resolvePromise() : reject(new Error(`hook exited ${code}`)))),
    );
    assert.equal(JSON.parse(readFileSync(state, "utf8")).state, "working");

    appendFileSync(
      transcript,
      `${JSON.stringify({ timestamp: new Date().toISOString(), type: "event_msg", payload: { type: "turn_aborted", completed_at: new Date().toISOString() } })}\n`,
    );
    const deadline = Date.now() + 3_000;
    while (JSON.parse(readFileSync(state, "utf8")).state !== "ready" && Date.now() < deadline) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
    }
    assert.equal(JSON.parse(readFileSync(state, "utf8")).state, "ready");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("selective installation does not create or remove an unselected integration", () => {
  const root = mkdtempSync(join(tmpdir(), "clawdeck-selective-"));
  const env = {
    ...process.env,
    CLAWDECK_HOME: join(root, "clawdeck"),
    CLAWDECK_STATE_DIR: join(root, "state"),
    CODEX_HOME: join(root, "codex"),
    CLAUDE_CONFIG_DIR: join(root, "claude"),
  };
  try {
    execFileSync(process.execPath, [cli, "install", "--no-streamdeck", "--no-claude"], { env });
    assert.match(readFileSync(join(root, "codex", "hooks.json"), "utf8"), /hook\.cjs/);
    assert.throws(() => readFileSync(join(root, "claude", "settings.json"), "utf8"), /ENOENT/);
    execFileSync(process.execPath, [cli, "uninstall"], { env });
    assert.throws(() => readFileSync(join(root, "claude", "settings.json"), "utf8"), /ENOENT/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("malformed selected config aborts before changing another integration", () => {
  const root = mkdtempSync(join(tmpdir(), "clawdeck-transaction-"));
  const codex = join(root, "codex");
  const claude = join(root, "claude");
  mkdirSync(claude, { recursive: true });
  writeFileSync(join(claude, "settings.json"), "{not-json");
  const env = {
    ...process.env,
    CLAWDECK_HOME: join(root, "clawdeck"),
    CLAWDECK_STATE_DIR: join(root, "state"),
    CODEX_HOME: codex,
    CLAUDE_CONFIG_DIR: claude,
  };
  try {
    assert.throws(() => execFileSync(process.execPath, [cli, "install", "--no-streamdeck"], { env, stdio: "pipe" }));
    assert.throws(() => readFileSync(join(codex, "hooks.json"), "utf8"), /ENOENT/);
    assert.equal(readFileSync(join(claude, "settings.json"), "utf8"), "{not-json");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a late installation failure rolls back hooks, runner, backups, and temporary files", () => {
  const root = mkdtempSync(join(tmpdir(), "clawdeck-rollback-"));
  const codex = join(root, "codex");
  const claude = join(root, "claude");
  const clawdeck = join(root, "clawdeck");
  mkdirSync(codex, { recursive: true });
  mkdirSync(claude, { recursive: true });
  mkdirSync(join(clawdeck, "config.json"), { recursive: true });
  const codexOriginal = `${JSON.stringify({ owner: "codex-user" }, null, 2)}\n`;
  const claudeOriginal = `${JSON.stringify({ owner: "claude-user" }, null, 2)}\n`;
  writeFileSync(join(codex, "hooks.json"), codexOriginal);
  writeFileSync(join(claude, "settings.json"), claudeOriginal);
  const env = {
    ...process.env,
    CLAWDECK_HOME: clawdeck,
    CLAWDECK_STATE_DIR: join(root, "state"),
    CODEX_HOME: codex,
    CLAUDE_CONFIG_DIR: claude,
  };
  try {
    assert.throws(() => execFileSync(process.execPath, [cli, "install", "--no-streamdeck"], { env, stdio: "pipe" }));
    assert.equal(readFileSync(join(codex, "hooks.json"), "utf8"), codexOriginal);
    assert.equal(readFileSync(join(claude, "settings.json"), "utf8"), claudeOriginal);
    assert.equal(existsSync(join(codex, "hooks.json.clawdeck-backup")), false);
    assert.equal(existsSync(join(claude, "settings.json.clawdeck-backup")), false);
    assert.equal(existsSync(join(clawdeck, "bin", "hook.cjs")), false);
    assert.deepEqual(
      readdirSync(codex).filter((file) => file.endsWith(".tmp")),
      [],
    );
    assert.deepEqual(
      readdirSync(claude).filter((file) => file.endsWith(".tmp")),
      [],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("installation preserves dotfile-manager symlinks", () => {
  const root = mkdtempSync(join(tmpdir(), "clawdeck-symlink-"));
  const codex = join(root, "codex");
  const dotfiles = join(root, "dotfiles");
  mkdirSync(codex, { recursive: true });
  mkdirSync(dotfiles, { recursive: true });
  const target = join(dotfiles, "codex-hooks.json");
  const link = join(codex, "hooks.json");
  writeFileSync(target, JSON.stringify({ owner: "dotfiles" }));
  symlinkSync(target, link);
  const env = {
    ...process.env,
    CLAWDECK_HOME: join(root, "clawdeck"),
    CLAWDECK_STATE_DIR: join(root, "state"),
    CODEX_HOME: codex,
    CLAUDE_CONFIG_DIR: join(root, "claude"),
  };
  try {
    execFileSync(process.execPath, [cli, "install", "--no-streamdeck", "--no-claude"], { env });
    assert.equal(lstatSync(link).isSymbolicLink(), true);
    assert.match(readFileSync(target, "utf8"), /hook\.cjs/);
    assert.match(readFileSync(target, "utf8"), /dotfiles/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI rejects unknown options and invalid install or event combinations", () => {
  const root = mkdtempSync(join(tmpdir(), "clawdeck-arguments-"));
  const env = {
    ...process.env,
    CLAWDECK_HOME: join(root, "clawdeck"),
    CLAWDECK_STATE_DIR: join(root, "state"),
    CODEX_HOME: join(root, "codex"),
    CLAUDE_CONFIG_DIR: join(root, "claude"),
  };
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { env, encoding: "utf8" });
  try {
    const typo = run("status", "--jsoon");
    assert.notEqual(typo.status, 0);
    assert.match(typo.stderr, /Unknown option/);

    const emptyInstall = run("install", "--no-streamdeck", "--no-codex", "--no-claude");
    assert.notEqual(emptyInstall.status, 0);
    assert.match(emptyInstall.stderr, /Nothing to install/);

    const unknownAgent = run("event", "working", "--agent", "chatgpt");
    assert.notEqual(unknownAgent.status, 0);
    assert.match(unknownAgent.stderr, /Unknown agent/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("status explains how to recover from a malformed state file", () => {
  const root = mkdtempSync(join(tmpdir(), "clawdeck-state-error-"));
  const stateDir = join(root, "state");
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, "state.json"), "not-json");
  const result = spawnSync(process.execPath, [cli, "status"], {
    env: { ...process.env, CLAWDECK_HOME: join(root, "clawdeck"), CLAWDECK_STATE_DIR: stateDir },
    encoding: "utf8",
  });
  try {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /State file is not valid JSON/);
    assert.match(result.stderr, /clawdeck reset/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("status expires stale sessions exactly like the Stream Deck plugin", () => {
  const root = mkdtempSync(join(tmpdir(), "clawdeck-stale-status-"));
  const stateDir = join(root, "state");
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    join(stateDir, "state.json"),
    JSON.stringify({
      version: 1,
      state: "working",
      agent: "codex",
      updatedAt: "2020-01-01T00:00:00.000Z",
      sessions: {
        "codex:old": {
          agent: "codex",
          state: "working",
          sessionId: "old",
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      },
    }),
  );
  const env = { ...process.env, CLAWDECK_HOME: join(root, "clawdeck"), CLAWDECK_STATE_DIR: stateDir };
  try {
    assert.equal(
      execFileSync(process.execPath, [cli, "status"], { env, encoding: "utf8" }).trim(),
      "OFFLINE · 0 sessions",
    );
    const json = JSON.parse(execFileSync(process.execPath, [cli, "status", "--json"], { env, encoding: "utf8" }));
    assert.equal(json.state, "offline");
    assert.deepEqual(json.sessions, {});
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
