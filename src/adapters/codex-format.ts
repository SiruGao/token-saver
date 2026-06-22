export type CodexRecord = Record<string, unknown>;

export interface CodexLine {
  timestamp: string;
  type: string;
  payload: CodexRecord;
}

export function codexRecord(value: unknown): CodexRecord {
  return typeof value === "object" && value !== null ? (value as CodexRecord) : {};
}

export function codexString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

export function codexNumber(...values: unknown[]): number {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function parseCodexLines(content: string): CodexLine[] {
  const lines: CodexLine[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    try {
      const value = codexRecord(JSON.parse(rawLine));
      const timestamp = codexString(value.timestamp);
      const type = codexString(value.type);
      const payload = codexRecord(value.payload);
      if (timestamp && type && Object.keys(payload).length) lines.push({ timestamp, type, payload });
    } catch {
      // Keep parsing the remaining JSONL records.
    }
  }
  return lines;
}

export function codexContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      const block = codexRecord(item);
      return codexString(block.text, block.content, block.output_text, block.input_text);
    })
    .filter(Boolean)
    .join("\n");
}
