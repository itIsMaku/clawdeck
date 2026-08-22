import assert from "node:assert/strict";
import test from "node:test";
import { aggregateSessions, selectSnapshot } from "../dist/index.js";

const session = (agent, state, updatedAt) => ({ agent, state, sessionId: `${agent}-1`, updatedAt });

test("aggregateSessions gives actionable states priority", () => {
  const result = aggregateSessions({
    ready: session("codex", "ready", "2026-01-01T00:00:02.000Z"),
    permission: session("claude", "permission", "2026-01-01T00:00:01.000Z"),
  });
  assert.deepEqual(result, { state: "permission", agent: "claude" });
});

test("selectSnapshot filters agents and stale sessions", () => {
  const snapshot = {
    version: 1,
    state: "working",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sessions: {
      codex: session("codex", "working", "2026-01-01T00:00:09.000Z"),
      claude: session("claude", "permission", "2026-01-01T00:00:00.000Z"),
    },
  };
  const result = selectSnapshot(snapshot, {
    agent: "codex",
    now: Date.parse("2026-01-01T00:00:10.000Z"),
    staleAfterMs: 5_000,
  });
  assert.equal(result.state, "working");
  assert.deepEqual(Object.keys(result.sessions), ["codex"]);

  const expired = selectSnapshot(snapshot, { now: Date.parse("2026-01-01T00:01:00.000Z"), staleAfterMs: 5_000 });
  assert.equal(expired.state, "offline");
  assert.deepEqual(expired.sessions, {});
});
