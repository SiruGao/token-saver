import { analyzeSessions } from "../core/analyzer";
import { createId, stableHash } from "../core/hash";
import type { AgentSession, Integration, SessionEvent, WorkspaceState } from "../types";

function event(
  index: number,
  type: string,
  content: string,
  options: Partial<SessionEvent> = {},
): SessionEvent {
  return {
    id: `demo_evt_${index}`,
    timestamp: new Date(Date.now() - (28 - index) * 60_000).toISOString(),
    type,
    content,
    estimatedTokens: Math.max(1, Math.ceil(content.length / 4)),
    contentHash: stableHash(content),
    ...options,
  };
}

const repeatedFile = `export async function authenticate(request: Request) {\n${"  // authentication logic\n".repeat(220)}return true;\n}`;
const testOutput = `${"PASS src/auth.test.ts\n".repeat(900)}\nFAIL src/session.test.ts\nExpected 200, received 401\n`;

const demoEvents: SessionEvent[] = [
  event(1, "system", `You are a coding agent.\n${"Follow the repository conventions carefully.\n".repeat(260)}`, { role: "system" }),
  event(2, "message", "Fix the authentication regression and make the tests pass.", { role: "user" }),
  event(3, "tool_result", repeatedFile, { tool: "read_file", path: "src/auth.ts" }),
  event(4, "tool_result", repeatedFile, { tool: "read_file", path: "src/auth.ts" }),
  event(5, "tool_result", testOutput, { tool: "npm_test" }),
  event(6, "tool_result", "src/auth.ts:42 invalid session token", { tool: "search" }),
  event(7, "tool_result", repeatedFile, { tool: "read_file", path: "src/auth.ts" }),
  event(8, "assistant", "I found the issue and updated the session validation path.", { role: "assistant" }),
  event(9, "tool_result", "PASS 42 tests", { tool: "npm_test" }),
];

const demoSession: AgentSession = {
  id: createId("session", "demo-auth"),
  title: "Fix authentication regression",
  project: "token-saver-demo",
  agent: "claude-code",
  source: "Demo workspace",
  startedAt: new Date(Date.now() - 38 * 60_000).toISOString(),
  durationMinutes: 38,
  status: "success",
  usage: {
    input: 184_200,
    output: 8_420,
    cacheRead: 42_000,
    cacheWrite: 8_500,
    reasoning: 3_200,
    estimatedCostUsd: 2.71,
  },
  events: demoEvents,
};

const otherSessions: AgentSession[] = [
  {
    ...demoSession,
    id: createId("session", "demo-codex"),
    title: "Review payment webhook handler",
    agent: "codex",
    startedAt: new Date(Date.now() - 26 * 60 * 60_000).toISOString(),
    durationMinutes: 22,
    usage: { input: 91_400, output: 5_100, cacheRead: 18_000, cacheWrite: 0, reasoning: 2_100, estimatedCostUsd: 1.34 },
    events: demoEvents.slice(1, 8).map((item, index) => ({ ...item, id: `codex_${index}`, path: item.path?.replace("auth", "webhook") })),
  },
  {
    ...demoSession,
    id: createId("session", "demo-openclaw"),
    title: "Plan release documentation",
    agent: "openclaw",
    startedAt: new Date(Date.now() - 50 * 60 * 60_000).toISOString(),
    durationMinutes: 17,
    status: "unknown",
    usage: { input: 52_800, output: 7_900, cacheRead: 4_500, cacheWrite: 0, reasoning: 0, estimatedCostUsd: 0.88 },
    events: demoEvents.slice(0, 5).map((item, index) => ({ ...item, id: `claw_${index}`, path: item.path?.replace("auth", "release") })),
  },
];

export const defaultIntegrations: Integration[] = [
  { id: "claude-code", name: "Claude Code", detected: false, connected: false, detail: "Transcript analysis and hook adapter" },
  { id: "codex", name: "OpenAI Codex", detected: false, connected: false, detail: "Session analysis and app-server adapter" },
  { id: "openclaw", name: "OpenClaw", detected: false, connected: false, detail: "Skill and runtime integration" },
  { id: "hermes", name: "Hermes Agent", detected: false, connected: false, detail: "Session and plugin adapter" },
  { id: "opencode", name: "OpenCode", detected: false, connected: false, detail: "Usage and session adapter" },
  { id: "cursor", name: "Cursor", detected: false, connected: false, detail: "Extension and local connector" },
];

export function demoWorkspace(): WorkspaceState {
  const sessions = [demoSession, ...otherSessions];
  return {
    version: 1,
    sessions,
    findings: analyzeSessions(sessions),
    integrations: defaultIntegrations.map((item, index) => ({
      ...item,
      detected: index < 3,
      connected: index < 2,
      path: index < 3 ? `~/.${item.id}` : undefined,
    })),
    settings: {
      theme: "light",
      localOnly: true,
      telemetry: false,
      autoScan: true,
      optimizationMode: "automatic",
      autoCheckStrategyUpdates: true,
      autoCheckAppUpdates: true,
      largeOutputThreshold: 4000,
      repeatedReadWindowMinutes: 30,
    },
    lastScanAt: new Date().toISOString(),
  };
}

export function emptyWorkspace(): WorkspaceState {
  return {
    version: 1,
    sessions: [],
    findings: [],
    integrations: defaultIntegrations,
    settings: {
      theme: "light",
      localOnly: true,
      telemetry: false,
      autoScan: true,
      optimizationMode: "automatic",
      autoCheckStrategyUpdates: true,
      autoCheckAppUpdates: true,
      largeOutputThreshold: 4000,
      repeatedReadWindowMinutes: 30,
    },
  };
}
