import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentState, ClawdeckSnapshot } from "../packages/protocol/src/index.js";
import { renderStatus, type Scene } from "../packages/streamdeck-plugin/src/render.js";

const states = new Set<AgentState>(["working", "ready", "permission", "error", "offline"]);
const scenes = new Set<Scene>(["signal", "orbit", "minimal"]);

function integer(value: string | null, fallback: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= maximum ? parsed : fallback;
}

function html(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Clawdeck simulator</title>
  <style>
    :root { color-scheme: dark; font: 15px system-ui,sans-serif; background:#070b12; color:#f9fafb }
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:radial-gradient(circle at 50% 30%,#1f2937,#070b12 65%) }
    main { width:min(1100px,94vw); padding:34px 0 50px }
    header { display:flex; align-items:end; justify-content:space-between; flex-wrap:wrap; gap:20px; margin-bottom:28px }
    h1 { margin:0; font-size:34px; letter-spacing:-1px } p { margin:7px 0 0; color:#9ca3af }
    .controls { display:flex; flex-wrap:wrap; gap:10px } label { display:grid; gap:5px; color:#9ca3af; font-size:12px; font-weight:700; text-transform:uppercase }
    select { min-width:130px; padding:9px 30px 9px 10px; border:1px solid #374151; border-radius:8px; background:#111827; color:#fff }
    .shell { overflow:auto; padding:26px; border:1px solid #374151; border-radius:34px; background:#111827; box-shadow:0 25px 80px #0008 }
    #deck { --columns:5; display:grid; grid-template-columns:repeat(var(--columns),minmax(72px,144px)); gap:14px; width:max-content; margin:auto }
    #deck img { width:clamp(72px,11vw,144px); aspect-ratio:1; display:block; border-radius:15%; background:#1f2937; box-shadow:inset 0 0 0 2px #ffffff12,0 7px 12px #0008 }
    footer { display:flex; justify-content:space-between; gap:15px; margin-top:18px; color:#6b7280; font-size:13px }
    code { color:#86efac }
  </style>
</head>
<body><main>
  <header><div><h1>Clawdeck simulator</h1><p>The production renderer, without the hardware.</p></div>
  <div class="controls">
    <label>State<select id="state"><option>working</option><option>ready</option><option>permission</option><option>error</option><option>offline</option></select></label>
    <label>Scene<select id="scene"><option>signal</option><option>orbit</option><option>minimal</option></select></label>
    <label>Device<select id="device"><option value="5x3">Stream Deck</option><option value="3x2">Mini</option><option value="8x4">XL</option><option value="4x2">Plus</option><option value="9x4">Plus XL</option></select></label>
    <label>Agent<select id="agent"><option>codex</option><option>claude</option></select></label>
  </div></header>
  <section class="shell"><div id="deck"></div></section>
  <footer><span id="summary"></span><span>Endpoint health: <code>/health</code></span></footer>
</main><script>
  const ids = ["state","scene","device","agent"];
  const controls = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
  const deck = document.getElementById("deck");
  function render() {
    const [columns,rows] = controls.device.value.split("x").map(Number);
    deck.style.setProperty("--columns", columns);
    deck.replaceChildren();
    for (let row=0; row<rows; row++) for (let column=0; column<columns; column++) {
      const image = new Image();
      image.alt = "Clawdeck tile row " + (row + 1) + ", column " + (column + 1);
      const query = new URLSearchParams({ state:controls.state.value, scene:controls.scene.value, agent:controls.agent.value, columns, rows, column, row, phase:0 });
      image.src = "/tile?" + query;
      deck.append(image);
    }
    document.getElementById("summary").textContent = columns + "×" + rows + " · " + controls.state.value.toUpperCase() + " · " + controls.agent.value.toUpperCase();
  }
  ids.forEach(id => controls[id].addEventListener("change", render)); render();
</script></body></html>`;
}

export function createSimulatorServer(): Server {
  return createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/health") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(JSON.stringify({ ok: true, renderer: "production" }));
      return;
    }
    if (url.pathname === "/tile") {
      const stateValue = url.searchParams.get("state") || "working";
      const sceneValue = url.searchParams.get("scene") || "signal";
      const state: AgentState = states.has(stateValue as AgentState) ? (stateValue as AgentState) : "offline";
      const scene: Scene = scenes.has(sceneValue as Scene) ? (sceneValue as Scene) : "signal";
      const snapshot: ClawdeckSnapshot = {
        version: 1,
        state,
        agent: url.searchParams.get("agent") === "claude" ? "claude" : "codex",
        updatedAt: new Date().toISOString(),
        sessions: {},
      };
      const image = renderStatus(snapshot, {
        mode: "mosaic",
        scene,
        columns: integer(url.searchParams.get("columns"), 5, 12) || 1,
        rows: integer(url.searchParams.get("rows"), 3, 8) || 1,
        column: integer(url.searchParams.get("column"), 0, 11),
        row: integer(url.searchParams.get("row"), 0, 7),
        phase: integer(url.searchParams.get("phase"), 0, 1),
      });
      response.writeHead(200, {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      response.end(Buffer.from(image.split(",")[1], "base64"));
      return;
    }
    if (url.pathname === "/") {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      response.end(html());
      return;
    }
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const portIndex = process.argv.indexOf("--port");
  const port = integer(portIndex >= 0 ? process.argv[portIndex + 1] : null, 4173, 65_535);
  const server = createSimulatorServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`Clawdeck simulator: http://127.0.0.1:${port}`);
  });
}
