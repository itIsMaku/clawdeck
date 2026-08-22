# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) conventions. This project uses semantic versioning for the npm package; the Stream Deck manifest appends a fourth build component.

## [Unreleased]

## [0.1.2] - 2026-08-22

### Fixed

- Provide an ESM `createRequire` shim for bundled CommonJS dependencies used by the official Stream Deck SDK.
- Cold-start the final plugin bundle during every build to catch failures that syntax parsing alone cannot detect.

## [0.1.1] - 2026-08-22

### Fixed

- Transpile standard decorators in the production Stream Deck bundle instead of shipping syntax unsupported by the embedded Node runtime.
- Parse-check the final plugin bundle during every build so this class of startup failure cannot pass CI again.

## [0.1.0] - 2026-08-22

### Added

- Installable CLI for Codex and Claude Code lifecycle hooks.
- Safe configuration merging, backups, idempotent removal, and WSL-to-Windows state discovery.
- Dependency-free concurrent hook runner with multi-session state aggregation.
- Stream Deck plugin with whole-device mosaic rendering, individual tile mode, three scenes, and active-state animation.
- Property Inspector settings for layout, agent filtering, and scene selection.
- Current Node.js 24 Stream Deck runtime with no production debugger listener.
- Stale-session expiry, manual events, diagnostics, tests, packaging, CI, and release automation.
- Strict CLI argument validation, actionable state-file recovery errors, and signed hook ownership checks.
- Cross-platform Node-based build scripts and CI coverage on Linux, Windows, and macOS.
- Interactive browser simulator backed by the production mosaic renderer.
- Transactional hook installation with rollback of configs, runner, backups, and temporary files after late failures.
- Stream Deck plugin installation detection on native Windows, macOS, and Windows-through-WSL diagnostics.
- Production bundle syntax verification and explicit legacy decorator transpilation for the Stream Deck Node runtime.
