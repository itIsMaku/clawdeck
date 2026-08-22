import { type ClawdeckSnapshot, selectSnapshot } from "@clawdeck/protocol";
import streamDeck, {
  action,
  type DidReceiveSettingsEvent,
  type KeyAction,
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { type LayoutMode, renderStatus, type Scene } from "./render.js";
import { offlineSnapshot, watchSnapshot } from "./state.js";

type AgentFilter = "all" | "codex" | "claude";
type TileSettings = { mode?: LayoutMode; agent?: AgentFilter; scene?: Scene };
type VisibleTile = {
  action: KeyAction<TileSettings>;
  row: number;
  column: number;
  rows: number;
  columns: number;
  settings: Required<TileSettings>;
};

function normalizeSettings(settings: TileSettings): Required<TileSettings> {
  return {
    mode: settings.mode === "tile" ? "tile" : "mosaic",
    agent: settings.agent === "codex" || settings.agent === "claude" ? settings.agent : "all",
    scene: settings.scene === "orbit" || settings.scene === "minimal" ? settings.scene : "signal",
  };
}

@action({ UUID: "com.volkm.clawdeck.status-tile" })
class StatusTile extends SingletonAction<TileSettings> {
  private readonly visible = new Map<string, VisibleTile>();
  private snapshot: ClawdeckSnapshot = offlineSnapshot();
  private phase = 0;

  constructor() {
    super();
    watchSnapshot((snapshot) => {
      this.snapshot = snapshot;
      void this.renderAll();
    });
    const animation = setInterval(() => {
      if (this.snapshot.state !== "working" && this.snapshot.state !== "permission") return;
      this.phase = this.phase ? 0 : 1;
      void this.renderAll();
    }, 900);
    animation.unref();
  }

  override async onWillAppear(event: WillAppearEvent<TileSettings>): Promise<void> {
    if (!event.action.isKey() || !event.action.coordinates) return;
    const { row, column } = event.action.coordinates;
    const { rows, columns } = event.action.device.size;
    const tile: VisibleTile = {
      action: event.action,
      row,
      column,
      rows,
      columns,
      settings: normalizeSettings(event.payload.settings),
    };
    this.visible.set(event.action.id, tile);
    await this.render(tile);
  }

  override onWillDisappear(event: WillDisappearEvent<TileSettings>): void {
    this.visible.delete(event.action.id);
  }

  override async onDidReceiveSettings(event: DidReceiveSettingsEvent<TileSettings>): Promise<void> {
    const current = this.visible.get(event.action.id);
    if (!current) return;
    current.settings = normalizeSettings(event.payload.settings);
    await this.render(current);
  }

  private async render(tile: VisibleTile): Promise<void> {
    const snapshot = selectSnapshot(this.snapshot, { agent: tile.settings.agent });
    await tile.action.setImage(
      renderStatus(snapshot, {
        ...tile.settings,
        row: tile.row,
        column: tile.column,
        rows: tile.rows,
        columns: tile.columns,
        phase: this.phase,
      }),
    );
  }

  private async renderAll(): Promise<void> {
    await Promise.allSettled([...this.visible.values()].map((tile) => this.render(tile)));
  }
}

streamDeck.actions.registerAction(new StatusTile());
streamDeck.connect();
