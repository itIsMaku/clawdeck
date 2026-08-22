import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentState, ClawdeckSnapshot } from "@clawdeck/protocol";
import sharp from "sharp";
import { renderStatus } from "../packages/streamdeck-plugin/src/render.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "marketplace", "output");
const background = join(root, "marketplace", "source", "background.png");
const pluginIcon = join(
  root,
  "packages",
  "streamdeck-plugin",
  "com.itismaku.clawdeck.sdPlugin",
  "imgs",
  "plugin-source.svg",
);

const WIDTH = 1920;
const HEIGHT = 960;

function xml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function svgFromDataUrl(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

async function mosaic(state: AgentState, agent = "codex"): Promise<Buffer> {
  const snapshot: ClawdeckSnapshot = {
    version: 1,
    state,
    agent,
    updatedAt: new Date(0).toISOString(),
    sessions: {},
  };
  const tileSize = 220;
  const gap = 16;
  const padding = 28;
  const width = padding * 2 + tileSize * 3 + gap * 2;
  const height = padding * 2 + tileSize * 2 + gap;
  const composites: sharp.OverlayOptions[] = [];

  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const tile = svgFromDataUrl(
        renderStatus(snapshot, { mode: "mosaic", scene: "signal", rows: 2, columns: 3, row, column, phase: 0.5 }),
      );
      composites.push({
        input: await sharp(tile).resize(tileSize, tileSize).png().toBuffer(),
        left: padding + column * (tileSize + gap),
        top: padding + row * (tileSize + gap),
      });
    }
  }

  const panel = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="42" fill="#20242b" stroke="#4b5563" stroke-width="4"/>
  </svg>`);
  return sharp(panel).composite(composites).png().toBuffer();
}

async function card(
  filename: string,
  title: string,
  subtitle: string,
  states: AgentState[],
  eyebrow = "CLAWDECK",
): Promise<void> {
  const deckImages = await Promise.all(states.map((state) => mosaic(state)));
  const deckWidth = states.length === 1 ? 744 : 560;
  const deckPositions =
    states.length === 1
      ? [{ left: 1080, top: 198 }]
      : [
          { left: 815, top: 218 },
          { left: 1360, top: 218 },
        ];
  const titleLines = title.split("|");
  const subtitleLines = subtitle.split("|");
  const overlay = Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .eyebrow { font: 700 25px Arial, sans-serif; letter-spacing: 8px; fill: #4ade80; }
      .title { font: 800 58px Arial, sans-serif; fill: white; }
      .subtitle { font: 400 27px Arial, sans-serif; fill: #cbd5e1; }
      .command { font: 600 25px monospace; fill: #e2e8f0; }
    </style>
    <text x="110" y="235" class="eyebrow">${xml(eyebrow)}</text>
    <text x="110" y="325" class="title">${titleLines.map((line, index) => `<tspan x="110" dy="${index === 0 ? 0 : 74}">${xml(line)}</tspan>`).join("")}</text>
    <text x="110" y="${titleLines.length > 1 ? 505 : 445}" class="subtitle">${subtitleLines.map((line, index) => `<tspan x="110" dy="${index === 0 ? 0 : 40}">${xml(line)}</tspan>`).join("")}</text>
    <rect x="110" y="555" width="570" height="72" rx="18" fill="#111827" stroke="#374151" stroke-width="2"/>
    <text x="142" y="601" class="command">npx @itismaku/clawdeck install</text>
  </svg>`);

  const composites: sharp.OverlayOptions[] = [{ input: overlay }];
  for (let index = 0; index < deckImages.length; index += 1) {
    composites.push({
      input: await sharp(deckImages[index]).resize({ width: deckWidth }).png().toBuffer(),
      ...deckPositions[index],
    });
  }
  await sharp(background).resize(WIDTH, HEIGHT).composite(composites).png().toFile(join(output, filename));
}

async function main(): Promise<void> {
  await mkdir(output, { recursive: true });
  await sharp(pluginIcon).resize(288, 288).png().toFile(join(output, "app-icon.png"));
  await card(
    "thumbnail.png",
    "AI AGENT STATUS|AT A GLANCE",
    "Live Codex and Claude Code status across your Stream Deck.",
    ["ready"],
  );
  await card("gallery-1-ready.png", "READY AT A GLANCE", "Stop checking the terminal. Your deck tells you.", ["ready"]);
  await card("gallery-2-working.png", "WORKING IN REAL TIME", "Red while the agent runs. Green when it is ready.", [
    "working",
  ]);
  await card(
    "gallery-3-private.png",
    "LOCAL. PRIVATE.",
    "Lifecycle metadata only.|No prompts or responses are stored.",
    ["permission", "offline"],
    "OPEN SOURCE",
  );

  console.log(`Generated Marketplace assets in ${output}`);
}

void main();
