import { codexContent, codexRecord, codexString, parseCodexLines } from "./codex-format";

type NormalizedRow = Record<string, unknown>;

function normalizedContent(payload: Record<string, unknown>): string {
  return codexString(
    payload.message,
    payload.last_agent_message,
    payload.output,
    payload.delta,
    codexContent(payload.content),
  );
}

export function isCodexRollout(content: string, source = ""): boolean {
  if (/rollout-.*\.jsonl$/i.test(source)) return true;
  const first = parseCodexLines(content)[0];
  return Boolean(first && first.type === "session_meta");
}

export function normalizeCodexRollout(content: string): string {
  const rows: NormalizedRow[] = [];
  let latestUsage: Record<string, unknown> | undefined;

  for (const line of parseCodexLines(content)) {
    const payloadType = codexString(line.payload.type, line.type).toLowerCase();

    if (line.type === "session_meta") {
      const meta = codexRecord(line.payload.meta ?? line.payload);
      rows.push({
        timestamp: line.timestamp,
        type: "session_meta",
        role: "system",
        agent: "codex",
        project: meta.cwd,
        content: `Codex session ${codexString(meta.session_id, meta.id)}`,
      });
      continue;
    }

    if (line.type === "event_msg" && payloadType === "token_count") {
      const info = codexRecord(line.payload.info);
      const total = codexRecord(info.total_token_usage);
      latestUsage = {
        input_tokens: total.input_tokens,
        output_tokens: total.output_tokens,
        cached_tokens: total.cached_input_tokens,
        reasoning_tokens: total.reasoning_output_tokens,
      };
      continue;
    }

    const role = line.type === "response_item"
      ? codexString(line.payload.role)
      : payloadType === "user_message"
        ? "user"
        : payloadType.includes("agent_message")
          ? "assistant"
          : undefined;

    const text = normalizedContent(line.payload);
    if (!text) continue;
    rows.push({
      timestamp: line.timestamp,
      type: payloadType,
      role,
      tool_name: codexString(line.payload.name, line.payload.tool_name, line.payload.command),
      path: codexString(line.payload.path, line.payload.file_path),
      content: text,
    });
  }

  if (latestUsage && rows.length) rows[0] = { ...rows[0], usage: latestUsage };
  return JSON.stringify(rows);
}
