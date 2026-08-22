import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { createSimulatorServer } from "./simulator.js";

test("simulator serves the production mosaic renderer", async (context) => {
  const server = createSimulatorServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const { port } = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${port}`;

  const health = await fetch(`${origin}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, renderer: "production" });

  const tile = await fetch(`${origin}/tile?state=permission&scene=orbit&columns=5&rows=3&column=4&row=2`);
  assert.equal(tile.headers.get("content-type"), "image/svg+xml; charset=utf-8");
  const svg = await tile.text();
  assert.match(svg, /viewBox="576 288 144 144"/);
  assert.match(svg, /INPUT NEEDED/);
  assert.match(svg, /ellipse/);

  const page = await fetch(origin);
  assert.match(await page.text(), /Clawdeck simulator/);
  assert.equal((await fetch(`${origin}/missing`)).status, 404);
});
