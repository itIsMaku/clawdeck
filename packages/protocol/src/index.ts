export const AGENT_STATES = ["working", "ready", "permission", "error", "offline"] as const;
export type AgentState = (typeof AGENT_STATES)[number];
export type AgentName = "codex" | "claude" | (string & {});

export interface SessionState {
  agent: AgentName;
  state: AgentState;
  sessionId: string;
  updatedAt: string;
}

export interface ClawdeckSnapshot {
  version: 1;
  state: AgentState;
  agent?: AgentName;
  updatedAt: string;
  sessions: Record<string, SessionState>;
}

const priority: Record<AgentState, number> = {
  offline: 0,
  ready: 1,
  working: 2,
  permission: 3,
  error: 4,
};

export function aggregateSessions(sessions: Record<string, SessionState>): Pick<ClawdeckSnapshot, "state" | "agent"> {
  const current = Object.values(sessions).sort((a, b) => {
    const stateOrder = priority[b.state] - priority[a.state];
    return stateOrder || Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  })[0];
  return current ? { state: current.state, agent: current.agent } : { state: "offline" };
}

export interface SelectSnapshotOptions {
  agent?: string | "all";
  now?: number;
  staleAfterMs?: number;
}

export function selectSnapshot(snapshot: ClawdeckSnapshot, options: SelectSnapshotOptions = {}): ClawdeckSnapshot {
  const now = options.now ?? Date.now();
  const staleAfterMs = options.staleAfterMs ?? 24 * 60 * 60 * 1000;
  const sessions = Object.fromEntries(
    Object.entries(snapshot.sessions).filter(([, session]) => {
      if (options.agent && options.agent !== "all" && session.agent !== options.agent) return false;
      const updatedAt = Date.parse(session.updatedAt);
      return Number.isFinite(updatedAt) && now - updatedAt <= staleAfterMs;
    }),
  );
  const aggregate = aggregateSessions(sessions);
  return { version: 1, ...aggregate, updatedAt: snapshot.updatedAt, sessions };
}

export function isAgentState(value: string): value is AgentState {
  return (AGENT_STATES as readonly string[]).includes(value);
}
