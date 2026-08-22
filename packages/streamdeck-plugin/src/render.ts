import type { AgentState, ClawdeckSnapshot } from "@clawdeck/protocol";

export type LayoutMode = "mosaic" | "tile";
export type Scene = "signal" | "orbit" | "minimal";

export interface RenderOptions {
  mode?: LayoutMode;
  scene?: Scene;
  row?: number;
  column?: number;
  rows?: number;
  columns?: number;
  phase?: number;
}

const styles: Record<
  AgentState,
  { background: string; accent: string; foreground: string; label: string; symbol: string }
> = {
  working: { background: "#7f1017", accent: "#ef4444", foreground: "#ffffff", label: "WORKING", symbol: "●" },
  ready: { background: "#075e32", accent: "#22c55e", foreground: "#ffffff", label: "READY", symbol: "✓" },
  permission: { background: "#92400e", accent: "#fbbf24", foreground: "#111827", label: "INPUT NEEDED", symbol: "!" },
  error: { background: "#450a0a", accent: "#dc2626", foreground: "#ffffff", label: "ERROR", symbol: "×" },
  offline: { background: "#111827", accent: "#374151", foreground: "#9ca3af", label: "OFFLINE", symbol: "–" },
};

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function encode(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function tile(snapshot: ClawdeckSnapshot): string {
  const style = styles[snapshot.state] || styles.offline;
  const agent = escapeXml((snapshot.agent || "clawdeck").toUpperCase());
  return encode(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">
    <rect width="144" height="144" rx="18" fill="${style.background}"/>
    <circle cx="72" cy="55" r="31" fill="${style.accent}" opacity=".85"/>
    <text x="72" y="69" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="700" fill="${style.foreground}">${style.symbol}</text>
    <text x="72" y="108" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="${style.foreground}">${style.label}</text>
    <text x="72" y="128" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="${style.foreground}" opacity=".8">${agent}</text>
  </svg>`);
}

function sceneArt(scene: Scene, width: number, height: number, accent: string, phase: number): string {
  const cx = width / 2;
  const cy = height / 2;
  if (scene === "minimal") {
    return `<path d="M0 ${height * 0.78} Q ${width * 0.25} ${height * (0.62 + phase * 0.02)} ${width * 0.5} ${height * 0.78} T ${width} ${height * 0.78} V${height}H0Z" fill="${accent}" opacity=".24"/>`;
  }
  if (scene === "orbit") {
    return `<g fill="none" stroke="${accent}">
      <ellipse cx="${cx}" cy="${cy}" rx="${width * 0.38}" ry="${height * 0.3}" stroke-width="12" opacity=".28" transform="rotate(${phase * 8 - 4} ${cx} ${cy})"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${width * 0.27}" ry="${height * 0.42}" stroke-width="7" opacity=".18" transform="rotate(${65 - phase * 8} ${cx} ${cy})"/>
      <circle cx="${width * (0.12 + phase * 0.02)}" cy="${height * 0.23}" r="22" fill="${accent}" stroke="none" opacity=".75"/>
      <circle cx="${width * (0.86 - phase * 0.02)}" cy="${height * 0.72}" r="13" fill="${accent}" stroke="none" opacity=".5"/>
    </g>`;
  }
  return `<g fill="${accent}">
    <circle cx="${cx}" cy="${cy}" r="${Math.min(width, height) * (0.39 + phase * 0.015)}" opacity=".18"/>
    <circle cx="${cx}" cy="${cy}" r="${Math.min(width, height) * 0.29}" opacity=".2"/>
    <path d="M0 ${height * 0.18} L${width} 0v${height * 0.13}L0 ${height * 0.33}Z" opacity=".16"/>
    <path d="M0 ${height}v-${height * 0.14}L${width} ${height * 0.67}V${height}Z" opacity=".22"/>
  </g>`;
}

export function renderStatus(snapshot: ClawdeckSnapshot, options: RenderOptions = {}): string {
  if ((options.mode || "tile") === "tile") return tile(snapshot);

  const style = styles[snapshot.state] || styles.offline;
  const columns = Math.max(1, options.columns || 1);
  const rows = Math.max(1, options.rows || 1);
  const column = Math.min(columns - 1, Math.max(0, options.column || 0));
  const row = Math.min(rows - 1, Math.max(0, options.row || 0));
  const width = columns * 144;
  const height = rows * 144;
  const x = column * 144;
  const y = row * 144;
  const cx = width / 2;
  const cy = height / 2;
  const phase = Math.max(0, Math.min(1, options.phase || 0));
  const labelSize = Math.max(34, Math.min(58, width / 10));
  const labelY = Math.min(cy + 106, height - 52);
  const agentY = Math.min(cy + 146, height - 20);
  const agent = escapeXml((snapshot.agent || "clawdeck").toUpperCase());
  const scene = options.scene || "signal";

  return encode(`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="${x} ${y} 144 144">
    <defs>
      <radialGradient id="bg" cx="50%" cy="42%" r="80%"><stop offset="0" stop-color="${style.accent}"/><stop offset=".56" stop-color="${style.background}"/><stop offset="1" stop-color="#070b12"/></radialGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity=".35"/></filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    ${sceneArt(scene, width, height, style.accent, phase)}
    <g filter="url(#shadow)">
      <circle cx="${cx}" cy="${cy - 34}" r="${Math.min(92, height * 0.22)}" fill="${style.accent}" opacity=".92"/>
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${Math.min(120, height * 0.3)}" font-weight="800" fill="${style.foreground}">${style.symbol}</text>
      <text x="${cx}" y="${labelY}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${labelSize}" font-weight="800" letter-spacing="4" fill="${style.foreground}">${style.label}</text>
      <text x="${cx}" y="${agentY}" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" letter-spacing="6" fill="${style.foreground}" opacity=".76">${agent}</text>
    </g>
  </svg>`);
}
