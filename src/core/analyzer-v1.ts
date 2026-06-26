import { createId, stableHash } from "./hash";
import { analyzeSessions } from "./analyzer";
import type { AgentId, AgentSession, SessionEvent, SessionStatus, TokenUsage } from "../types";

export { analyzeSessions };

type Row = Record<string, unknown>;

function row(value: unknown): Row {
  return typeof value === "object" && value !== null ? (value as Row) : {};
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function firstNumber(...values: unknown[]): number {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function parseRows(content: string): Row[] {
  const trimmed = content.trim();
  if (!trimmed) return [{ type: "text", content: "" }];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return parsed.map(row);
    const root = row(parsed);
    for (const key of ["events", "messages", "items", "records"]) {
      const nested = root[key];
      if (!Array.isArray(nested)) continue;
      const rows = nested.map(row);
      if (rows.length && root.usage !== undefined && rows[0]?.usage === undefined) {
        rows[0] = { ...rows[0], usage: root.usage };
      }
      return rows;
    }
    return [root];
  } catch {
    return content.split(/\r?\n/).filter((line) => line.trim()).map((line) => {
      try {
        return row(JSON.parse(line));
      } catch {
        return { type: "text", content: line };
      }
    });
  }
}

function eventContent(record: Row): string {
  const message = row(record.message);
  const result = row(record.result);
  const output = row(record.output);
  const value = record.content ?? message.content ?? result.content ?? output.content ?? record.text;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => typeof item === "string" ? item : firstText(row(item).text, row(item).content, row(item).value)).filter(Boolean).join("\n");
  }
  if (value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeEvent(record: Row, index: number, fallback: string): SessionEvent {
  const input = row(record.input);
  const toolInput = row(record.tool_input);
  const message = row(record.message);
  const content = eventContent(record);
  const timestamp = firstText(record.timestamp, record.created_at, record.time, fallback);
  return {
    id: createId("evt", `${timestamp}:${index}:${content.slice(0, 128)}`),
    timestamp,
    type: firstText(record.event_type, record.type, record.kind, message.type, "event").toLowerCase(),
    role: firstText(record.role, message.role).toLowerCase() || undefined,
    tool: firstText(record.tool_name, record.tool, record.name, input.tool, toolInput.tool) || undefined,
    path: firstText(record.path, record.file_path, input.path, input.file_path, toolInput.path) || undefined,
    content,
    estimatedTokens: Math.max(1, Math.ceil(content.length / 4)),
    contentHash: stableHash(content),
  };
}

function explicitAgent(records: Row[]): AgentId | undefined {
  for (const record of records.slice(0, 20)) {
    const value = firstText(record.agent, row(record.metadata).agent).toLowerCase();
    if (value === "codex") return "codex";
    if (value === "claude" || value === "claude-code") return "claude-code";
    if (value === "openclaw") return "openclaw";
    if (value === "hermes") return "hermes";
    if (value === "opencode") return "opencode";
    if (value === "cursor") return "cursor";
  }
  return undefined;
}

function detectAgent(source: string, records: Row[]): AgentId {
  const sourceLower = source.toLowerCase();
  if (sourceLower.includes("/.codex/") || sourceLower.includes("\\.codex\\") || /rollout-.*\.jsonl$/i.test(source)) return "codex";
  if (sourceLower.includes("/.claude/") || sourceLower.includes("\\.claude\\")) return "claude-code";

  const declared = explicitAgent(records);
  if (declared) return declared;

  const sample = records.slice(0, 20).map((item) => JSON.stringify(item)).join(" ").toLowerCase();
  if (sample.includes("codex") || sample.includes("openai")) return "codex";
  if (sample.includes("claude")) return "claude-code";
  if (sample.includes("openclaw")) return "openclaw";
  if (sample.includes("hermes")) return "hermes";
  if (sample.includes("opencode")) return "opencode";
  if (sample.includes("cursor")) return "cursor";
  return "unknown";
}

function detectStatus(records: Row[]): SessionStatus {
  const sample = records.slice(-20).map((item) => JSON.stringify(item)).join(" ").toLowerCase();
  if (/failed|error|exception|cancelled/.test(sample)) return "failed";
  if (/success|completed|passed|done/.test(sample)) return "success";
  return "unknown";
}

function extractUsage(records: Row[], events: SessionEvent[]): TokenUsage {
  const total: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, estimatedCostUsd: 0 };
  for (const record of records) {
    const value = row(record.usage);
    const metadata = row(record.metadata);
    const nested = row(metadata.usage);
    total.input += firstNumber(value.input_tokens, value.inputTokens, nested.input_tokens);
    total.output += firstNumber(value.output_tokens, value.outputTokens, nested.output_tokens);
    total.cacheRead += firstNumber(value.cache_read_input_tokens, value.cached_tokens, nested.cached_tokens);
    total.cacheWrite += firstNumber(value.cache_creation_input_tokens, value.cache_write_tokens);
    total.reasoning += firstNumber(value.reasoning_tokens, value.reasoningTokens);
    total.estimatedCostUsd += firstNumber(value.cost_usd, value.cost, metadata.cost_usd);
  }
  if (total.input + total.output === 0) {
    total.input = events.filter((event) => event.role !== "assistant").reduce((sum, event) => sum + event.estimatedTokens, 0);
    total.output = events.filter((event) => event.role === "assistant").reduce((sum, event) => sum + event.estimatedTokens, 0);
  }
  return total;
}

function isSyntheticInstruction(content: string): boolean {
  const sample = content.trim().slice(0, 600).toLowerCase();
  return sample.startsWith("# agents.md instructions")
    || sample.includes("<instructions>")
    || sample.includes("codegraph_start")
    || sample.startsWith("<environment_context>")
    || sample.startsWith("# repository guidelines");
}

function sessionTitle(agent: AgentId, events: SessionEvent[], source: string): string {
  const userEvent = events.find((event) =>
    event.role === "user"
    && event.content.trim().length > 3
    && !isSyntheticInstruction(event.content));
  if (userEvent) return userEvent.content.replace(/\s+/g, " ").slice(0, 72);
  if (agent === "codex") return "Codex session";
  if (agent === "claude-code") return "Claude Code session";
  return source.split(/[\\/]/).pop() ?? "Imported session";
}

export function parseTranscript(content: string, source: string): AgentSession {
  const records = parseRows(content);
  const fallback = new Date().toISOString();
  const events = records.map((record, index) => normalizeEvent(record, index, fallback));
  const startedAt = events[0]?.timestamp ?? fallback;
  const ending = events.at(-1)?.timestamp ?? startedAt;
  const duration = Math.max(0, Date.parse(ending) - Date.parse(startedAt));
  const parts = source.split(/[\\/]/).filter(Boolean);
  const agent = detectAgent(source, records);

  return {
    id: createId("session", `${source}:${stableHash(content)}`),
    title: sessionTitle(agent, events, source),
    project: parts.length > 1 ? parts.at(-2) ?? "Local project" : "Local project",
    agent,
    source,
    startedAt,
    durationMinutes: Number.isFinite(duration) ? Math.max(1, Math.round(duration / 60000)) : 1,
    status: detectStatus(records),
    usage: extractUsage(records, events),
    events,
  };
}
