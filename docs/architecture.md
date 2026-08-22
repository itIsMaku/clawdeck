# Architecture

Clawdeck has three deliberately small layers:

```text
Codex / Claude Code lifecycle
          │ JSON on stdin
          ▼
dependency-free hook runner
          │ atomic state snapshot
          ▼
Stream Deck plugin → per-key SVG slices
```

## Lifecycle adapters

The installer merges command hooks into user-level Codex and Claude Code JSON. Each handler invokes the copied `hook.cjs` runner with an agent and normalized state. The original event remains on stdin so the runner can read its opaque session identifier. It deliberately ignores prompts, responses, working directories, notification messages, and error text.

Installation is transactional across both agent configurations, the standalone runner, Clawdeck metadata, and newly created backups. If any late write fails, the installer restores the exact pre-install bytes and file modes and removes files created by the failed attempt. Individual JSON replacements use same-directory temporary files and atomic rename.

## State protocol

The version-1 JSON snapshot contains sessions keyed by agent and upstream session ID. Updates use a short-lived filesystem lock plus write-and-rename, preventing partial reads and lost updates from concurrent hook processes. Aggregate priority is:

```text
error > permission > working > ready > offline
```

Sessions expire in the reader after 24 hours by default so an uncleanly terminated terminal cannot leave the deck permanently lit. `CLAWDECK_STALE_AFTER_MS` overrides this for development.

## Stream Deck rendering

Every visible action supplies a device, grid size, and zero-based coordinates. Mosaic mode renders the same virtual SVG canvas with a different `viewBox` for each key. This creates one continuous scene without raster preprocessing and works across different Stream Deck grid sizes. Tile mode renders an independent status button.

The Property Inspector persists settings through Stream Deck itself. Agent filtering is evaluated locally from the complete session map, so a deck can dedicate separate regions or profiles to Codex and Claude.

## Trust boundaries

- No API keys or external server are required.
- No telemetry is collected.
- Existing hook settings are preserved and backed up before writes.
- Codex independently asks the user to review and trust new command hooks.
- Stream Deck communicates with the plugin over Elgato's local SDK channel.
