import { createId, stableHash } from "../core/hash";
import type { AgentSession, NativeHookEventFile, SessionEvent } from "../types";

type JsonRecord = Record<string, unknown>;

export interface ClaudeHookNormalization {
  sessions: AgentSession[];
  acceptedPaths: string[];
}

function record(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null ? value as JsonRecord : {};
}

function text(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function serialized(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  try { return JSON.stringify(value); }
  catch { return String(value); }
}

function eventTimestamp(file: NativeHookEventFile, payload: JsonRecord): string {
  const explicit = text(payload.timestamp, payload.created_at);
  if (explicit && Number.isFinite(Date.parse(explicit))) return explicit;
  const milliseconds = Number(file.modifiedAt);
  return Number.isFinite(milliseconds) && milliseconds > 0
    ? new Date(milliseconds).toISOString()
    : new Date().toISOString();
}

function eventContent(eventName: string, payload: JsonRecord): { display: string; full: string } {
  const toolInput = record(payload.tool_input);
  const full = eventName === "UserPromptSubmit"
    ? text(payload.prompt, payload.user_prompt)
    : eventName === "PostToolUse"
      ? serialized(payload.tool_response ?? payload.tool_result ?? payload.result)
      : eventName === "PostToolUseFailure"
        ? text(payload.error, payload.error_message, serialized(payload.tool_response))
        : eventName === "PreCompact"
          ? text(payload.trigger, "Context compaction requested")
          : eventName === "Stop"
            ? text(payload.reason, "Claude completed a turn")
            : eventName === "SessionEnd"
              ? text(payload.reason, "Claude Code session ended")
              : eventName === "SessionStart"
                ? text(payload.source, "Claude Code session started")
                : serialized(toolInput);
  const safeFull = full || eventName;
  const limit = 64_000;
  const display = safeFull.length > limit
    ? `${safeFull.slice(0, limit)}\n[Token Saver truncated ${safeFull.length - limit} locally captured characters for display.]`
    : safeFull;
  return { display, full: safeFull };
}

function normalizeEvent(file: NativeHookEventFile, payload: JsonRecord): SessionEvent {
  const eventName = text(payload.hook_event_name, "ClaudeHookEvent");
  const toolInput = record(payload.tool_input);
  const content = eventContent(eventName, payload);
  const timestamp = eventTimestamp(file, payload);
  return {
    id: createId("evt", `${file.path}:${stableHash(content.full)}`),
    timestamp,
    type: eventName.toLowerCase(),
    role: eventName === "UserPromptSubmit" ? "user" : undefined,
    tool: text(payload.tool_name) || undefined,
    path: text(toolInput.file_path, toolInput.path, payload.file_path) || undefined,
    content: content.display,
    estimatedTokens: Math.max(1, Math.ceil(content.full.length / 4)),
    contentHash: stableHash(content.full),
  };
}

export function normalizeClaudeHookEvents(files: NativeHookEventFile[]): ClaudeHookNormalization {
  const grouped = new Map<string, Array<{ file: NativeHookEventFile; payload: JsonRecord }>>();
  const acceptedPaths: string[] = [];
  for (const file of files) {
    try {
      const payload = record(JSON.parse(file.content));
      const sessionId = text(payload.session_id);
      const eventName = text(payload.hook_event_name);
      if (!sessionId || !eventName) continue;
      const items = grouped.get(sessionId) ?? [];
      items.push({ file, payload });
      grouped.set(sessionId, items);
      acceptedPaths.push(file.path);
    } catch {
      // A malformed local hook event remains on disk for diagnostics.
    }
  }

  const sessions = [...grouped.entries()].map(([sessionId, items]) => {
    const events = items
      .map(({ file, payload }) => normalizeEvent(file, payload))
      .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
    const firstPayload = items[0]?.payload ?? {};
    const project = text(firstPayload.cwd, "Local project");
    const firstPrompt = events.find((event) => event.role === "user" && event.content.trim());
    const ended = events.some((event) => event.type === "sessionend" || event.type === "stop");
    const failed = events.some((event) => event.type === "posttoolusefailure");
    const startedAt = events[0]?.timestamp ?? new Date().toISOString();
    const finishedAt = events.at(-1)?.timestamp ?? startedAt;
    const durationMs = Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt));

    return {
      id: createId("session", `claude-hook:${sessionId}`),
      title: (firstPrompt?.content ?? `Claude Code session ${sessionId.slice(0, 8)}`)
        .replace(/\s+/g, " ")
        .slice(0, 72),
      project,
      agent: "claude-code",
      source: `Claude Code hooks/${sessionId}`,
      startedAt,
      durationMinutes: Number.isFinite(durationMs) ? Math.max(1, Math.round(durationMs / 60_000)) : 1,
      status: failed ? "failed" : ended ? "success" : "unknown",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        reasoning: 0,
        estimatedCostUsd: 0,
      },
      events,
    } satisfies AgentSession;
  });

  return { sessions, acceptedPaths };
}
