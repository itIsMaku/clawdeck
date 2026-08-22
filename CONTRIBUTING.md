# Contributing to Clawdeck

Thanks for improving Clawdeck. Small focused pull requests are easiest to review, but early design discussions are welcome for protocol or installer changes.

## Development setup

Use Node.js 24 for the complete toolchain. CI also verifies the CLI on Node.js 20 and runs the full suite on Linux, Windows, and macOS.

```bash
npm ci
npm run assets
npm run build
npm run check
npm run lint
npm test
```

Validate and package the hardware plugin with:

```bash
npm run validate -w @clawdeck/streamdeck-plugin
npm run pack:plugin
```

Hardware testing requires the Stream Deck desktop application. Link a development build with `npm run link -w @clawdeck/streamdeck-plugin`.
For renderer work without hardware, run `npm run simulator` and open `http://127.0.0.1:4173`.
With Codex installed, `npm run smoke:codex` verifies the real hook lifecycle in an isolated temporary home without using account credentials.

## Pull requests

- Add tests for behavior changes.
- Preserve existing Codex and Claude configuration when changing the installer.
- Keep the installed hook runner dependency-free and fast; hooks sit directly in the agent lifecycle.
- Never include prompts, API keys, transcript contents, or other sensitive data in telemetry. Clawdeck currently has no telemetry.
- Update `CHANGELOG.md` for user-visible changes.

Run the complete local gate before opening a pull request:

```bash
npm run release:check && npm run build && npm run check && npm run lint && npm test && npm audit
```

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
