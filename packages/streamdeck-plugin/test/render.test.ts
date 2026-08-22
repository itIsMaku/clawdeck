import assert from "node:assert/strict";
import test from "node:test";
import { renderStatus } from "../src/render.js";

const snapshot = {
  version: 1 as const,
  state: "working" as const,
  agent: "codex",
  updatedAt: "2026-01-01T00:00:00.000Z",
  sessions: {},
};

function decode(image: string): string {
  return Buffer.from(image.split(",")[1], "base64").toString("utf8");
}

test("mosaic tiles use device coordinates as adjacent view boxes", () => {
  const first = decode(renderStatus(snapshot, { mode: "mosaic", columns: 5, rows: 3, column: 0, row: 0 }));
  const last = decode(renderStatus(snapshot, { mode: "mosaic", columns: 5, rows: 3, column: 4, row: 2 }));
  assert.match(first, /viewBox="0 0 144 144"/);
  assert.match(last, /viewBox="576 288 144 144"/);
  assert.match(first, /width="720" height="432"/);
});

test("scenes and animation phases produce distinct images", () => {
  const signal = renderStatus(snapshot, { mode: "mosaic", scene: "signal", columns: 5, rows: 3, phase: 0 });
  const orbit = renderStatus(snapshot, { mode: "mosaic", scene: "orbit", columns: 5, rows: 3, phase: 1 });
  assert.notEqual(signal, orbit);
  assert.match(decode(orbit), /ellipse/);
});

test("individual tile mode remains available", () => {
  const svg = decode(renderStatus({ ...snapshot, state: "ready" }, { mode: "tile" }));
  assert.match(svg, /READY/);
  assert.match(svg, /viewBox="0 0 144 144"/);
});

test("two-row mosaics keep the agent label inside the physical canvas", () => {
  const mini = decode(renderStatus(snapshot, { mode: "mosaic", columns: 3, rows: 2, column: 1, row: 1 }));
  assert.match(mini, /<text x="216" y="236"[^>]*>WORKING<\/text>/);
  assert.match(mini, /<text x="216" y="268"[^>]*>CODEX<\/text>/);
  assert.doesNotMatch(mini, /y="290"/);

  const standard = decode(renderStatus(snapshot, { mode: "mosaic", columns: 5, rows: 3 }));
  assert.match(standard, /<text x="360" y="322"[^>]*>WORKING<\/text>/);
  assert.match(standard, /<text x="360" y="362"[^>]*>CODEX<\/text>/);
});
