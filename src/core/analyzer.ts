import { createId, stableHash } from "./hash";
import type {
  AgentId,
  AgentSession,
  Finding,
  SessionEvent,
  SessionStatus,
  TokenUsage,
} from "../types";

const TOKEN_CHAR_RATIO = 4;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function stringValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function numberValue(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function contentValue(record: Record<string, unknown>): string {
  const message = asRecord(record.message);
  const result = asRecord(record.result);
  const output = asRecord(record.output);
  const content = record.content ?? message.content ?? result.content ?? output.content ?? record.text;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        const itemRecord = asRecord(item);
        return stringValue(itemRecord.text, itemRecord.content, itemRecord.value);
      })
      .filter(Boolean)
      .join("\n");
  }
  if (content !== undefined) {
    try {
      return JSON.stringify(content);
    } catch {
      return String(content);
    }
  }
  try {
    return JSON.stringify(record);
  } catch {
    return "";
  }
}

function detectAgent(source: string, records: Record<string, unknown>[]): AgentId {
  const haystack = `${source} ${records.slice(0, 20).map((item) => JSON.stringify(item)).join(" ")}`.toLowerCase();
  if (haystack.includes("claude")) return "claude-code";
  if (haystack.includes("codex") || haystack.includes("openai")) return "codex";
  if (haystack.includes("openclaw")) return "openclaw";
  if (haystack.includes("hermes")) return "hermes";
  if (haystack.includes("opencode")) return "opencode";
  if (haystack.includes("cursor")) return "cursor";
  return "unknown";
}

function detectStatus(records: Record<string, unknown>[]): SessionStatus {
  const text = records.slice(-20).map((item) => JSON.stringify(item)).join(" ").toLowerCase();
  if (/failed|error|exception|cancelled/.test(text)) return "failed";
  if (/success|completed|passed|done/.test(text)) return "success";
  return "unknown";
}

function extractUsage(records: Record<string, unknown>[], events: SessionEvent[]): TokenUsage {
  let input = 0;
  let output = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let reasoning = 0;
  let estimatedCostUsd = 0;

  for (const record of records) {
    const usage = asRecord(record.usage);
    const metadata = asRecord(record.metadata);
    const providerUsage = asRecord(metadata.usage);
    input += numberValue(usage.input_tokens, usage.inputTokens, providerUsage.input_tokens);
    output += numberValue(usage.output_tokens, usage.outputTokens, providerUsage.output_tokens);
    cacheRead += numberValue(usage.cache_read_input_tokens, usage.cached_tokens, providerUsage.cached_tokens);
    cacheWrite += numberValue(usage.cache_creation_input_tokens, usage.cache_write_tokens);
    reasoning += numberValue(usage.reasoning_tokens, usage.reasoningTokens);
    estimatedCostUsd += numberValue(usage.cost_usd, usage.cost, metadata.cost_usd);
  }

  if (input + output === 0) {
    input = events
      .filter((event) => event.role !== "assistant")
      .reduce((total, event) => total + event.estimatedTokens, 0);
    output = events
      .filter((event) => event.role === "assistant")
      .reduce((total, event) => total + event.estimatedTokens, 0);
  }

  return { input, output, cacheRead, cacheWrite, reasoning, estimatedCostUsd };
}

function normalizeEvent(record: Record<string, unknown>, index: number, fallbackTime: string): SessionEvent {
  const input = asRecord(record.input);
  const toolInput = asRecord(record.tool_input);
  const message = asRecord(record.message);
  const content = contentValue(record);
  const type = stringValue(record.event_type, record.type, record.kind, message.type, "event").toLowerCase();
  const role = stringValue(record.role, message.role).toLowerCase() || undefined;
  const tool = stringValue(record.tool_name, record.tool, record.name, input.tool, toolInput.tool) || undefined;
  const path = stringValue(record.path, record.file_path, input.path, input.file_path, toolInput.path) || undefined;
  const timestamp = stringValue(record.timestamp, record.created_at, record.time, fallbackTime);
  const estimatedTokens = Math.max(1, Math.ceil(content.length / TOKEN_CHAR_RATIO));
  return {
    id: createId("evt", `${timestamp}:${index}:${content.slice(0, 128)}`),
    timestamp,
    type,
    role,
    tool,
    path,
    content,
    estimatedTokens,
    contentHash: stableHash(content),
  };
}

function deriveTitle(events: SessionEvent[], source: string): string {
  const userEvent = events.find((event) => event.role === "user" && event.content.length > 3);
  const raw = userEvent?.content || source.split(/[\\/]/).pop() || "Imported session";
  return raw.replace(/\s+/g, " ").slice(0, 72);
}

function deriveProject(source: string): string {
  const parts = source.split(/[\\/]/).filter(Boolean);
  return parts.length > 1 ? parts.at(-2) ?? "Local project" : "Local project";
}

export function parseTranscript(content: string, source: string): AgentSession {
  const rawLines = content.split(/\r?\n/).filter((line) => line.trim());
  const records: Record<string, unknown>[] = [];

  for (const line of rawLines) {
    try {
      records.push(asRecord(JSON.parse(line)));
    } catch {
      records.push({ type: "text", content: line });
    }
  }

  if (records.length === 0) {
    try {
      const parsed = JSON.parse(content) as unknown;
      const array = Array.isArray(parsed) ? parsed : [parsed];
      records.push(...array.map(asRecord));
    } catch {
      records.push({ type: "text", content });
    }
  }

  const fallbackTime = new Date().toISOString();
  const events = records.map((record, index) => normalizeEvent(record, index, fallbackTime));
  const startedAt = events[0]?.timestamp ?? fallbackTime;
  const lastTimestamp = events.at(-1)?.timestamp ?? startedAt;
  const durationMs = Math.max(0, Date.parse(lastTimestamp) - Date.parse(startedAt));

  return {
    id: createId("session", `${source}:${stableHash(content)}`),
    title: deriveTitle(events, source),
    project: deriveProject(source),
    agent: detectAgent(source, records),
    source,
    startedAt,
    durationMinutes: Number.isFinite(durationMs) ? Math.max(1, Math.round(durationMs / 60000)) : 1,
    status: detectStatus(records),
    usage: extractUsage(records, events),
    events,
  };
}

function finding(
  type: Finding["type"],
  severity: Finding["severity"],
  title: string,
  description: string,
  evidence: string,
  estimatedTokens: number,
  recommendation: string,
  sessionId?: string,
): Finding {
  return {
    id: createId("finding", `${type}:${sessionId ?? "global"}:${evidence}`),
    type,
    severity,
    title,
    description,
    evidence,
    estimatedTokens,
    recommendation,
    sessionId,
  };
}

export function analyzeSessions(
  sessions: AgentSession[],
  largeOutputThreshold = 4000,
): Finding[] {
  const findings: Finding[] = [];

  for (const session of sessions) {
    const pathReads = new Map<string, SessionEvent[]>();
    const resultHashes = new Map<string, SessionEvent[]>();

    for (const event of session.events) {
      const looksLikeRead = Boolean(event.path) && /read|cat|open|file|text/.test(`${event.type} ${event.tool ?? ""}`);
      if (looksLikeRead && event.path) {
        const existing = pathReads.get(event.path) ?? [];
        existing.push(event);
        pathReads.set(event.path, existing);
      }

      const looksLikeToolResult = /tool|result|output/.test(event.type) || Boolean(event.tool);
      if (looksLikeToolResult && event.content.length > 40) {
        const existing = resultHashes.get(event.contentHash) ?? [];
        existing.push(event);
        resultHashes.set(event.contentHash, existing);
      }

      if (looksLikeToolResult && event.estimatedTokens >= largeOutputThreshold) {
        findings.push(
          finding(
            "large-tool-output",
            event.estimatedTokens > largeOutputThreshold * 3 ? "high" : "medium",
            "Large tool output entered the context",
            "A single tool result consumed a substantial share of the session context.",
            `${event.tool ?? event.type}: approximately ${event.estimatedTokens.toLocaleString()} tokens`,
            Math.round(event.estimatedTokens * 0.7),
            "Keep failures, exit status, locations, and counts; compact repeated or successful output and retain the original locally.",
            session.id,
          ),
        );
      }

      if ((event.role === "system" || /system|instruction/.test(event.type)) && event.estimatedTokens > 2500) {
        findings.push(
          finding(
            "long-instruction",
            "medium",
            "Large persistent instruction block",
            "Long stable instructions may be resent on every turn and can also reduce cache efficiency when they change.",
            `Approximately ${event.estimatedTokens.toLocaleString()} tokens in one instruction event`,
            Math.round(event.estimatedTokens * 0.35),
            "Split core instructions from task-specific guidance and keep the stable prefix byte-for-byte consistent.",
            session.id,
          ),
        );
      }
    }

    for (const [path, events] of pathReads) {
      if (events.length < 2) continue;
      const avoidable = events.slice(1).reduce((total, event) => total + event.estimatedTokens, 0);
      findings.push(
        finding(
          "repeated-file-read",
          events.length >= 4 ? "high" : "medium",
          "Repeated full-file read",
          "The same file appears to have been loaded multiple times in one task.",
          `${path} was read ${events.length} times`,
          avoidable,
          "Reuse the previous result, request a targeted line range, or send only the changed diff.",
          session.id,
        ),
      );
    }

    for (const events of resultHashes.values()) {
      if (events.length < 2) continue;
      const avoidable = events.slice(1).reduce((total, event) => total + event.estimatedTokens, 0);
      findings.push(
        finding(
          "repeated-tool-result",
          "low",
          "Identical tool result repeated",
          "The same tool output was injected more than once.",
          `${events.length} identical results; hash ${events[0]?.contentHash ?? "unknown"}`,
          avoidable,
          "Reference the earlier result by hash or suppress exact duplicates.",
          session.id,
        ),
      );
    }

    const repeatedToolNames = new Map<string, number>();
    for (const event of session.events) {
      if (!event.tool) continue;
      repeatedToolNames.set(event.tool, (repeatedToolNames.get(event.tool) ?? 0) + 1);
    }
    const hotTool = [...repeatedToolNames.entries()].find(([, count]) => count >= 6);
    if (hotTool) {
      findings.push(
        finding(
          "possible-rework",
          "medium",
          "Possible tool-call rework",
          "A tool was called repeatedly. This can be normal exploration, but it may also indicate missing context or over-compression.",
          `${hotTool[0]} was called ${hotTool[1]} times`,
          0,
          "Inspect the call arguments and determine whether the agent is retrieving details that were removed earlier.",
          session.id,
        ),
      );
    }
  }

  const systemFingerprints = sessions
    .map((session) => session.events.find((event) => event.role === "system" || /system|instruction/.test(event.type)))
    .filter((event): event is SessionEvent => Boolean(event))
    .map((event) => event.contentHash);
  const uniquePrefixes = new Set(systemFingerprints);
  if (systemFingerprints.length >= 3 && uniquePrefixes.size / systemFingerprints.length > 0.65) {
    findings.push(
      finding(
        "prompt-prefix-drift",
        "medium",
        "Stable prompt prefix changes frequently",
        "Most sessions use a different system-instruction fingerprint, which may prevent provider prompt-cache reuse.",
        `${uniquePrefixes.size} unique prefixes across ${systemFingerprints.length} sessions`,
        0,
        "Keep stable instructions and tool definitions in a deterministic order; move timestamps and task-specific content later.",
      ),
    );
  }

  return findings.sort((left, right) => {
    const weight = { high: 3, medium: 2, low: 1 };
    return weight[right.severity] - weight[left.severity] || right.estimatedTokens - left.estimatedTokens;
  });
}

export function efficiencyScore(findings: Finding[]): number {
  const severityPenalty = findings.reduce((total, item) => {
    const severity = item.severity === "high" ? 12 : item.severity === "medium" ? 7 : 3;
    const tokenPenalty = Math.min(8, Math.log10(Math.max(10, item.estimatedTokens)) * 1.5);
    return total + severity + tokenPenalty;
  }, 0);
  return Math.max(0, Math.round(100 - Math.min(100, severityPenalty)));
}
