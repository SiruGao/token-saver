import { isCodexRollout, normalizeCodexRollout } from "../adapters/codex";
import { analyzeSessions, parseTranscript as parseGeneric } from "./analyzer-v1";
import type { AgentSession } from "../types";

export { analyzeSessions };

export function parseTranscript(content: string, source: string): AgentSession {
  const prepared = isCodexRollout(content, source)
    ? normalizeCodexRollout(content)
    : content;
  return parseGeneric(prepared, source);
}
