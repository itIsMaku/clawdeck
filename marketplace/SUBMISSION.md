# Clawdeck Marketplace submission

## Product

- Type: Stream Deck plugin
- Name: Clawdeck
- Price: Free
- Product file: `../dist/com.itismaku.clawdeck.streamDeckPlugin`
- App icon: `output/app-icon.png`
- Thumbnail: `output/thumbnail.png`
- Gallery: `output/gallery-1-ready.png`, `output/gallery-2-working.png`, `output/gallery-3-private.png`

## Short description

See when Codex or Claude Code is working, waiting for input, ready, or offline directly on your Stream Deck.

## Description

Clawdeck turns your Stream Deck into a live status display for AI coding agents. The keys change together to show when Codex or Claude Code is working, ready, waiting for permission, reporting an error, or offline—so you can focus elsewhere without repeatedly checking the terminal.

Install the companion command-line integration with one command, then add Agent Status Tile actions to the keys you want to use. Clawdeck supports full-deck mosaics as well as individual status tiles.

Everything runs locally. Clawdeck stores only lifecycle state metadata and does not store prompts, responses, working directories, or conversation content.

Requires Node.js 20.5 or newer. Codex users must approve the installed user hooks once with `/hooks`.

## Additional links

- Support and source code: https://github.com/itIsMaku/clawdeck
- Installation guide: https://github.com/itIsMaku/clawdeck#quick-start
- npm package: https://www.npmjs.com/package/@itismaku/clawdeck
- Issues: https://github.com/itIsMaku/clawdeck/issues

## Release notes — 0.1.4

Initial Marketplace release.

- Live status for Codex and Claude Code
- Working, ready, permission, error, and offline states
- Full-deck mosaic and individual tile layouts
- Recovery after interrupted Codex turns
- Local, privacy-conscious state handling
