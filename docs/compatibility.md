# Compatibility

Clawdeck integrates through public lifecycle hooks and the official Elgato Stream Deck SDK. It does not scrape terminal output or agent transcripts.

## Verified baseline

| Component | Verified version | Evidence |
| --- | --- | --- |
| Codex CLI | 0.149.0 | Isolated runtime smoke test observed `SessionStart`, `UserPromptSubmit`, and `SessionEnd` updating the shared snapshot. |
| Claude Code | 2.1.235 | Hook names and settings shape match the current Claude Code hooks reference. |
| Stream Deck | SDK 2.1.2 / manifest target 7.1 | The official Elgato validator and packer accept the plugin. |
| Node.js | 20.5.1+ for CLI; 24 for plugin runtime | CI covers Node 20 and 24; the plugin manifest requests Node 24. |

The CI matrix runs on Linux, Windows, and macOS. WSL uses the Windows `%LOCALAPPDATA%` path so the Linux hook runner and Windows Stream Deck application share one state file.

`clawdeck doctor` resolves the corresponding native Stream Deck plugin directory, including the Windows roaming profile from WSL, and reports whether Clawdeck is installed there. Platform discovery is lazy and never runs in latency-sensitive lifecycle hook commands.

## Lifecycle contract

Codex maps `SessionStart` and completed turns to ready, `UserPromptSubmit` and tool execution to working, `PermissionRequest` to permission, and `SessionEnd` to offline. Claude Code uses the equivalent lifecycle events and additionally maps `StopFailure` to error and relevant `Notification` matchers to ready or permission.

Run the normal deterministic suite with `npm test`. Contributors with Codex installed can additionally execute the real lifecycle smoke test:

```bash
npm run build
npm run smoke:codex
```

The smoke test creates an isolated temporary `CODEX_HOME`, installs only the generated Clawdeck hook, starts Codex without credentials, observes the working transition, interrupts it, verifies the offline transition, and removes the temporary directory. The trust bypass applies only to that isolated generated hook.

## Compatibility reports

When reporting an integration problem, include:

```bash
clawdeck doctor --json
codex --version
claude --version
```

Do not attach agent transcripts, prompts, authentication files, or API keys.
